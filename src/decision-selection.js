import { minBy } from "./collections.js";

// Owns winner selection and the compact evidence lists derived from normalized options.
export function selectDecisionOptions(options) {
  const best = minBy(options, (option) => option.humanScore);
  const cheapest = minBy(options, (option) => option.price);
  const fastest = minBy(options, (option) => option.durationMinutes);
  const stopover = minBy(options.filter((option) => option.kind === "composed-stopover" || option.routeType?.includes("stopover")), (option) => option.humanScore);
  const riskyFastest = options.filter((option) => option.connectionRisk.level === "tight").sort((a, b) => a.durationMinutes - b.durationMinutes)[0] ?? null;
  return { best, cheapest, fastest, stopover, riskyFastest };
}

export function dateOpportunities(options, best) {
  const grouped = groupBy(options, (option) => option.date ?? "unknown");
  const cheapestOverall = minBy(options, (option) => option.price);
  const fastestOverall = minBy(options, (option) => option.durationMinutes);
  return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, items]) => {
    const balanced = minBy(items, (option) => option.humanScore);
    const cheapest = minBy(items, (option) => option.price);
    const fastest = minBy(items, (option) => option.durationMinutes);
    const label = dateLabel({ date, balanced, cheapest, fastest, best, cheapestOverall, fastestOverall });
    return {
      date,
      label,
      balanced,
      cheapest,
      fastest,
      priceDeltaFromBest: best && cheapest ? cheapest.price - best.price : null,
      count: items.length
    };
  });
}

export function refreshGuidance({ best, cheapest, fastest, stopover, refreshPlan }) {
  if (!refreshPlan) return [];
  const selected = new Map();
  for (const [reason, option] of [["current best", best], ["cheapest challenger", cheapest], ["fastest challenger", fastest], ["stopover challenger", stopover]]) {
    if (!option) continue;
    for (const searchId of optionSearchIds(option)) selected.set(searchId, reason);
  }
  const missing = (refreshPlan.calls ?? []).filter((call) => call.cache?.status === "missing");
  for (const call of missing) selected.set(call.id, "missing route data");
  return [...selected.entries()].slice(0, 6).map(([searchId, reason]) => {
    const call = (refreshPlan.calls ?? []).find((item) => item.id === searchId);
    return { searchId, reason, cacheStatus: call?.cache?.status ?? "unknown" };
  });
}

function dateLabel({ date, balanced, cheapest, fastest, best, cheapestOverall, fastestOverall }) {
  if (best && balanced === best) return "best balance";
  if (cheapestOverall && cheapest === cheapestOverall) return "cheapest";
  if (fastestOverall && fastest === fastestOverall) return fastest.connectionRisk.level === "tight" ? "fastest but risky" : "fastest";
  if (balanced?.confidence?.level === "Low") return "avoid";
  return date === "unknown" ? "needs data" : "solid option";
}

function optionSearchIds(option) {
  if (!option) return [];
  if (option.kind === "composed-stopover") return [option.inbound.searchId, option.onward.searchId].filter(Boolean);
  if (option.kind === "composed-round-trip") return [option.outbound.searchId, option.returnFlight.searchId].filter(Boolean);
  return [option.searchId].filter(Boolean);
}

function groupBy(items, keyFn) {
  const grouped = new Map();
  for (const item of items) {
    const key = keyFn(item);
    grouped.set(key, [...(grouped.get(key) ?? []), item]);
  }
  return grouped;
}
