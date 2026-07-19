import { analyzeDecision } from "./decision-analysis.js";
import { groupByRouteIdea } from "./route-options.js";

// Converts one persisted snapshot into the same decision model used by plan pages.
export function analyzeSnapshotDecision({ plan, trip = null, latest = null }) {
  return analyzeDecision({
    plan,
    trip,
    routeGroups: groupByRouteIdea(plan, latest?.rankedFlights ?? []),
    current: latest
  });
}
