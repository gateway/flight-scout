import { classifyCandidate, summarizeViability, viabilityRulesFrom, VIABILITY } from "./viability.js";

const TIGHT_LAYOVER_MINUTES = 90;
const WATCH_LAYOVER_MINUTES = 120;
const LONG_LAYOVER_MINUTES = 360;

// Builds a plan-level decision model from ranked route options.
export function analyzeDecision({ plan, trip = null, routeGroups, current = null, refreshPlan = null }) {
  const refreshBySearchId = refreshLookup(refreshPlan);
  const viabilityRules = viabilityRulesFrom({ trip, plan });
  const options = normalizeOptions({ plan, trip, routeGroups, refreshBySearchId });
  const best = minBy(options, (option) => option.humanScore);
  const cheapest = minBy(options, (option) => option.price);
  const fastest = minBy(options, (option) => option.durationMinutes);
  const stopover = minBy(options.filter((option) => option.kind === "composed-stopover" || option.routeType?.includes("stopover")), (option) => option.humanScore);
  const riskyFastest = options.filter((option) => option.connectionRisk.level === "tight").sort((a, b) => a.durationMinutes - b.durationMinutes)[0] ?? null;

  return {
    options,
    best,
    cheapest,
    fastest,
    stopover,
    riskyFastest,
    dateCoverage: dateCoverage(plan),
    dateOpportunities: dateOpportunities(options, best),
    refreshGuidance: refreshGuidance({ best, cheapest, fastest, stopover, refreshPlan }),
    viability: summarizeViability(current?.rankedFlights ?? [], viabilityRules),
    viabilityRules,
    snapshot: snapshotSummary(current)
  };
}

// Converts raw ranked flights and composed stopovers into one shape for scoring/rendering.
export function normalizeOptions({ plan, trip = null, routeGroups, refreshBySearchId = new Map() }) {
  const options = [];
  for (const route of plan.routeIdeas ?? []) {
    for (const option of routeGroups.get(route.id) ?? []) {
      const normalized = normalizeOption({ option, route, trip, refreshBySearchId });
      if (normalized.isEvaluable && normalized.viability.status !== VIABILITY.HARD_REJECT && normalized.viability.status !== VIABILITY.HIDDEN) options.push(normalized);
    }
  }
  return options.sort((a, b) => a.humanScore - b.humanScore);
}

export function normalizeOption({ option, route, trip = null, refreshBySearchId = new Map() }) {
  const price = optionPrice(option);
  const durationMinutes = optionDurationMinutes(option);
  const legs = optionLegs(option);
  const layovers = optionLayovers(option);
  const travelPain = travelPainBreakdown(option);
  const assumptions = extraTravelAssumptions({ option, route, trip });
  const connectionRisk = connectionRiskSummary(layovers);
  const confidence = confidenceLabel({ option, price, durationMinutes, connectionRisk, assumptions, refreshBySearchId });
  const humanScore = humanPainScore({ option, price, durationMinutes, connectionRisk, assumptions, confidence });
  const viability = classifyCandidate(option, viabilityRulesFrom({ trip }));

  return {
    ...option,
    routeIdeaId: route.id,
    routeIdeaLabel: route.label,
    routeSummary: route.summary ?? "",
    routeType: route.type ?? "",
    price,
    durationMinutes,
    date: optionDate(option),
    routeLine: optionRouteLine(option),
    legs,
    layovers,
    travelPain,
    assumptions,
    connectionRisk,
    confidence,
    humanScore,
    viability,
    isHardRejected: viability.status === VIABILITY.HARD_REJECT,
    isEvaluable: Number.isFinite(price) && Number.isFinite(durationMinutes)
  };
}

// Explains whether saving money or saving time is actually worth the tradeoff.
export function worthIt(candidate, baseline) {
  if (!candidate || !baseline) return null;
  const priceDelta = candidate.price - baseline.price;
  const timeDelta = candidate.durationMinutes - baseline.durationMinutes;
  const hours = Math.abs(timeDelta) / 60;
  const dollarsPerHour = hours > 0 ? Math.round(Math.abs(priceDelta) / hours) : null;

  if (priceDelta < 0 && timeDelta > 0) {
    const verdict = dollarsPerHour >= 45 ? "worth it if budget matters" : dollarsPerHour >= 25 ? "maybe worth it" : "probably not worth it";
    return {
      type: "cheaper-but-longer",
      verdict,
      sentence: `Saves $${money(Math.abs(priceDelta))}, but adds ${formatMinutes(timeDelta)} of travel time. That is about $${dollarsPerHour}/hour for the extra travel.`
    };
  }
  if (priceDelta > 0 && timeDelta < 0) {
    const verdict = dollarsPerHour <= 45 ? "worth it if time matters" : dollarsPerHour <= 90 ? "maybe worth it" : "probably not worth it";
    return {
      type: "faster-but-costlier",
      verdict,
      sentence: `Saves ${formatMinutes(Math.abs(timeDelta))}, but costs $${money(priceDelta)} more. That is about $${dollarsPerHour}/hour saved.`
    };
  }
  if (priceDelta < 0) return { type: "cheaper", verdict: "worth it", sentence: `Saves $${money(Math.abs(priceDelta))} without adding travel time.` };
  if (timeDelta < 0) return { type: "faster", verdict: "worth it", sentence: `Saves ${formatMinutes(Math.abs(timeDelta))} without increasing price.` };
  if (priceDelta === 0 && timeDelta === 0) return { type: "same", verdict: "same value", sentence: "Same price and travel time as the current best-balanced option." };
  return { type: "worse", verdict: "probably not worth it", sentence: `Costs $${money(priceDelta)} more and adds ${formatMinutes(timeDelta)} versus the best-balanced option.` };
}

// Separates total itinerary time into parts a traveler can reason about.
export function travelPainBreakdown(option) {
  if (option.kind === "composed-stopover") {
    const inbound = travelPainBreakdown(option.inbound);
    const onward = travelPainBreakdown(option.onward);
    return {
      totalMinutes: (inbound.totalMinutes ?? 0) + (onward.totalMinutes ?? 0),
      airMinutes: (inbound.airMinutes ?? 0) + (onward.airMinutes ?? 0),
      layoverMinutes: (inbound.layoverMinutes ?? 0) + (onward.layoverMinutes ?? 0),
      stopoverNights: option.nights ?? 0,
      dayParts: [
        { label: "First travel day", minutes: inbound.totalMinutes, route: `${option.inbound.departureAirport} -> ${option.inbound.arrivalAirport}` },
        { label: "Stay", nights: option.nights ?? 0, route: option.stopoverLabel },
        { label: "Final travel day", minutes: onward.totalMinutes, route: `${option.onward.departureAirport} -> ${option.onward.arrivalAirport}` }
      ],
      shortestLayover: shortestLayover([...optionLayovers(option.inbound), ...optionLayovers(option.onward)]),
      longestLayover: longestLayover([...optionLayovers(option.inbound), ...optionLayovers(option.onward)])
    };
  }

  const totalMinutes = option.durationMinutes ?? Infinity;
  const airMinutes = optionAirMinutes(option);
  const layoverMinutes = Number.isFinite(totalMinutes) && Number.isFinite(airMinutes) ? Math.max(0, totalMinutes - airMinutes) : null;
  const layovers = optionLayovers(option);
  return {
    totalMinutes,
    airMinutes,
    layoverMinutes,
    stopoverNights: 0,
    dayParts: [],
    shortestLayover: shortestLayover(layovers),
    longestLayover: longestLayover(layovers)
  };
}

// Confidence is data-derived and explains whether a recommendation is trustworthy.
export function confidenceLabel({ option, price, durationMinutes, connectionRisk, assumptions, refreshBySearchId = new Map() }) {
  const reasons = [];
  if (!Number.isFinite(price)) reasons.push("price missing");
  if (!Number.isFinite(durationMinutes)) reasons.push("duration missing");
  if (option.tripComplete === false || option.destinationComplete === false) reasons.push("incomplete route");
  if (connectionRisk.level === "tight") reasons.push("tight connection");
  if (assumptions.some((item) => item.level === "warning")) reasons.push("hidden travel assumption");
  if (option.kind === "composed-stopover" && option.inbound.arrivalAirport !== option.onward.departureAirport) reasons.push("airport change between stopover legs");

  const refresh = refreshBySearchId.get(option.searchId);
  if (refresh?.cache?.status === "missing") reasons.push("refresh data missing");
  if (refresh?.cache?.fresh === false) reasons.push("stale cached data");

  if (reasons.includes("price missing") || reasons.includes("duration missing") || reasons.includes("incomplete route")) {
    return { level: "Needs data", reasons };
  }
  if (reasons.some((reason) => ["tight connection", "airport change between stopover legs", "refresh data missing"].includes(reason))) {
    return { level: "Low", reasons };
  }
  if (reasons.length || connectionRisk.level === "watch" || travelPainBreakdown(option).longestLayover?.duration >= LONG_LAYOVER_MINUTES) {
    return { level: "Medium", reasons: reasons.length ? reasons : ["watch connection or long layover"] };
  }
  return { level: "High", reasons: ["complete price, route, and connection data"] };
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
    return {
      searchId,
      reason,
      cacheStatus: call?.cache?.status ?? "unknown"
    };
  });
}

function humanPainScore({ option, price, durationMinutes, connectionRisk, assumptions, confidence }) {
  const stops = optionStops(option);
  const tightPenalty = connectionRisk.level === "tight" ? 180 : 0;
  const watchPenalty = connectionRisk.level === "watch" ? 60 : 0;
  const longPenalty = durationMinutes > 30 * 60 ? 120 : 0;
  const stopoverPenalty = option.kind === "composed-stopover" ? 35 : 0;
  const assumptionPenalty = assumptions.length * 45;
  const confidencePenalty = confidence?.level === "Low" ? 120 : confidence?.level === "Medium" ? 45 : 0;
  return price / 25 + durationMinutes / 12 + stops * 35 + tightPenalty + watchPenalty + longPenalty + stopoverPenalty + assumptionPenalty + confidencePenalty;
}

function extraTravelAssumptions({ option, route, trip }) {
  const assumptions = [];
  if (!trip?.origin?.airports?.length) return assumptions;
  const primary = new Set(trip.origin.airports);
  const departure = option.kind === "composed-stopover" ? option.inbound.departureAirport : option.departureAirport;
  if (departure && !primary.has(departure)) {
    const alternate = (trip.alternateStarts ?? []).find((item) => (item.airports ?? []).includes(departure));
    const startLabel = cleanStartLabel(alternate?.label ?? departure);
    const primaryLabel = trip.origin.label ?? "the main starting city";
    assumptions.push({
      level: "warning",
      label: `Starts in ${startLabel}`,
      text: alternate
        ? `This option starts in ${startLabel}, not ${primaryLabel}. Use it only if you will already be there, or add the flight, hotel, transfer time, and hassle to get from ${primaryLabel} to ${startLabel}.`
        : `This option starts outside ${primaryLabel}. Add the time and cost to get there before comparing it with routes from ${primaryLabel}.`
    });
  }
  if (route.type?.includes("alternate-start") && option.kind !== "composed-stopover") {
    assumptions.push({ level: "warning", label: "Extra travel first", text: "This is not a simple door-to-door route from your main starting city. Add the extra flight, hotel, transfer time, and hassle before treating the price as the real total." });
  }
  return assumptions;
}

function cleanStartLabel(value) {
  return String(value ?? "alternate start").replace(/\s+start$/i, "");
}

function connectionRiskSummary(layovers) {
  const shortest = shortestLayover(layovers);
  const longest = longestLayover(layovers);
  if (!shortest) return { level: "none", shortest, longest, label: "No layover risk flagged" };
  if (shortest.duration < TIGHT_LAYOVER_MINUTES) return { level: "tight", shortest, longest, label: `Tight ${shortest.id ?? shortest.name} connection` };
  if (shortest.duration < WATCH_LAYOVER_MINUTES) return { level: "watch", shortest, longest, label: `Watch ${shortest.id ?? shortest.name} connection` };
  return { level: "comfortable", shortest, longest, label: "Connection timing looks workable" };
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
  return [option.searchId].filter(Boolean);
}

function refreshLookup(refreshPlan) {
  return new Map((refreshPlan?.calls ?? []).map((call) => [call.id, call]));
}

function snapshotSummary(current) {
  if (!current) return null;
  return {
    createdAt: current.meta?.createdAt,
    totalOptions: current.meta?.summary?.totalOptions ?? 0,
    completeOptions: current.meta?.summary?.completeOptions ?? 0
  };
}

function optionRouteLine(option) {
  if (option.kind === "composed-stopover") return `${option.inbound.departureAirport ?? "?"} -> ${option.stopoverLabel ?? "stopover"} -> ${option.onward.arrivalAirport ?? "?"}`;
  return `${option.departureAirport ?? "?"} -> ${option.arrivalAirport ?? "?"}`;
}

function optionDate(option) {
  return dateOnly(option.kind === "composed-stopover" ? option.inbound.departureTime : option.departureTime);
}

function optionPrice(option) {
  return option.kind === "composed-stopover" ? option.totalCost : option.scoring?.breakdown?.estimatedTotalCost ?? option.estimatedTotalCost ?? option.price ?? Infinity;
}

function optionDurationMinutes(option) {
  return option.kind === "composed-stopover" ? option.durationMinutes : option.durationMinutes ?? Infinity;
}

function optionStops(option) {
  if (option.kind === "composed-stopover") return (option.inbound.stops ?? 0) + (option.onward.stops ?? 0) + 1;
  return option.stops ?? 0;
}

function optionLegs(option) {
  if (option.kind === "composed-stopover") return [...(option.inbound.legs ?? []), ...(option.onward.legs ?? [])];
  return option.legs ?? [];
}

function optionLayovers(option) {
  if (!option) return [];
  if (option.kind === "composed-stopover") return [...(option.inbound.layovers ?? []), ...(option.onward.layovers ?? [])];
  return option.layovers ?? [];
}

function optionAirMinutes(option) {
  const legs = option.legs ?? [];
  if (!legs.length) return option.durationMinutes ?? Infinity;
  return legs.reduce((sum, leg) => sum + (Number(leg.duration) || 0), 0);
}

function shortestLayover(layovers) {
  return [...(layovers ?? [])].sort((a, b) => Number(a.duration) - Number(b.duration))[0] ?? null;
}

function longestLayover(layovers) {
  return [...(layovers ?? [])].sort((a, b) => Number(b.duration) - Number(a.duration))[0] ?? null;
}

function dateCoverage(plan) {
  const coverage = plan.intent?.dateCoverage;
  if (!coverage?.center) return "";
  if (Number.isFinite(coverage.plusMinusDays)) return `dates ${coverage.center} +/- ${coverage.plusMinusDays} days`;
  if (coverage.start && coverage.end) return `dates ${coverage.start} to ${coverage.end}`;
  return `date ${coverage.center}`;
}

function groupBy(items, keyFn) {
  const grouped = new Map();
  for (const item of items) {
    const key = keyFn(item);
    grouped.set(key, [...(grouped.get(key) ?? []), item]);
  }
  return grouped;
}

function minBy(items, score) {
  return items.reduce((best, item) => (score(item) < score(best) ? item : best), items[0] ?? null);
}

function dateOnly(value) {
  return value?.slice(0, 10) ?? null;
}

function formatMinutes(minutes) {
  if (!Number.isFinite(minutes)) return "n/a";
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function money(value) {
  return Number.isFinite(value) ? Number(value).toLocaleString("en-US") : "n/a";
}
