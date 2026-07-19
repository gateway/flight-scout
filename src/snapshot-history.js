import path from "node:path";
import { minBy } from "./collections.js";
import { jsonReadWarning } from "./json-files.js";
import { groupByRouteIdea } from "./route-options.js";
import { listSnapshots, loadSnapshot } from "./snapshots.js";

// Reduce saved snapshots to compact route-level price points so dashboard history
// does not retain every historical flight option in memory.
export async function loadSnapshotPriceHistory(planDir, plan, { onWarning = () => {} } = {}) {
  const routes = new Map((plan.routeIdeas ?? []).map((route) => [route.id, {
    routeIdeaId: route.id,
    routeLabel: route.label,
    points: []
  }]));
  const snapshots = [];
  let snapshotCount = 0;

  for (const snapshotDir of await listSnapshots(planDir)) {
    try {
      const snapshot = await loadSnapshot(snapshotDir);
      snapshotCount += 1;
      snapshots.push(snapshot.meta);
      const routeGroups = groupByRouteIdea(plan, snapshot.rankedFlights);
      for (const route of plan.routeIdeas ?? []) {
        const option = minBy((routeGroups.get(route.id) ?? []).filter((flight) => Number.isFinite(totalCost(flight))), totalCost);
        if (option) routes.get(route.id).points.push(historyPoint(snapshot, snapshotDir, option));
      }
    } catch (error) {
      onWarning(jsonReadWarning(error, { code: "snapshot-history-read-failed", snapshotDir }));
    }
  }

  return {
    snapshotCount,
    snapshots: snapshots.toReversed(),
    routes: [...routes.values()].map(summarizeRouteHistory)
  };
}

function historyPoint(snapshot, snapshotDir, option) {
  return {
    snapshotId: snapshot.meta?.id ?? path.basename(snapshotDir),
    createdAt: snapshot.meta?.createdAt ?? null,
    price: totalCost(option),
    durationMinutes: Number.isFinite(option.durationMinutes) ? option.durationMinutes : null,
    searchId: option.searchId ?? null,
    currency: option.providerCurrency ?? option.currency ?? null
  };
}

function summarizeRouteHistory(route) {
  const latest = route.points.at(-1) ?? null;
  const previous = route.points.at(-2) ?? null;
  const comparable = route.points.filter((point) => sameKnownCurrency(point, latest));
  const cheapest = minBy(comparable, (point) => point.price);
  const first = comparable[0] ?? null;
  const change = latest && previous && sameKnownCurrency(latest, previous)
    ? latest.price - previous.price
    : null;
  const percentChange = Number.isFinite(change) && previous?.price > 0
    ? Math.round((change / previous.price) * 1000) / 10
    : null;
  const overallChange = latest && first && comparable.length > 1 ? latest.price - first.price : null;
  const overallPercentChange = Number.isFinite(overallChange) && first?.price > 0
    ? Math.round((overallChange / first.price) * 1000) / 10
    : null;
  return {
    ...route,
    latestPrice: latest?.price ?? null,
    previousPrice: previous?.price ?? null,
    change,
    percentChange,
    direction: change === null ? "insufficient" : change < 0 ? "down" : change > 0 ? "up" : "flat",
    overallChange,
    overallPercentChange,
    overallDirection: overallChange === null ? "insufficient" : overallChange < 0 ? "down" : overallChange > 0 ? "up" : "flat",
    cheapestPrice: cheapest?.price ?? null,
    cheapestSnapshotId: cheapest?.snapshotId ?? null,
    latestIsCheapest: Boolean(latest && cheapest && latest.price === cheapest.price)
  };
}

function totalCost(flight) {
  return flight.scoring?.breakdown?.estimatedTotalCost ?? flight.totalCost ?? flight.price ?? NaN;
}

function sameKnownCurrency(left, right) {
  return Boolean(left && right) && (!left.currency || !right.currency || left.currency === right.currency);
}
