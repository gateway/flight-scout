import { classifyConnectionDuration, CONNECTION_DURATION } from "./connection-duration.js";
import { longestLayover, shortestLayover, travelPainBreakdown } from "./decision-metrics.js";

const TIGHT_LAYOVER_MINUTES = 90;
const WATCH_LAYOVER_MINUTES = 120;
const LONG_LAYOVER_MINUTES = 360;

// Owns confidence and connection-risk vocabulary so normalization does not duplicate thresholds.
export function confidenceLabel({ option, price, durationMinutes, connectionRisk, assumptions, refreshBySearchId = new Map() }) {
  const reasons = [];
  if (!Number.isFinite(price)) reasons.push("price missing");
  if (!Number.isFinite(durationMinutes)) reasons.push("duration missing");
  if (option.tripComplete === false || option.destinationComplete === false) reasons.push("incomplete route");
  if (connectionRisk.level === "tight") reasons.push("tight connection");
  if (connectionRisk.level === "unknown") reasons.push("connection time needs verification");
  if (assumptions.some((item) => item.level === "warning")) reasons.push("hidden travel assumption");
  if (option.kind === "composed-stopover" && option.inbound.arrivalAirport !== option.onward.departureAirport) reasons.push("airport change between stopover legs");

  const refresh = refreshBySearchId.get(option.searchId);
  if (refresh?.cache?.status === "missing") reasons.push("refresh data missing");
  if (refresh?.cache?.fresh === false) reasons.push("stale cached data");

  if (reasons.includes("price missing") || reasons.includes("duration missing") || reasons.includes("incomplete route")) return { level: "Needs data", reasons };
  if (reasons.some((reason) => ["tight connection", "airport change between stopover legs", "refresh data missing"].includes(reason))) return { level: "Low", reasons };
  if (reasons.length || connectionRisk.level === "watch" || travelPainBreakdown(option).longestLayover?.duration >= LONG_LAYOVER_MINUTES) {
    return { level: "Medium", reasons: reasons.length ? reasons : ["watch connection or long layover"] };
  }
  return { level: "High", reasons: ["complete price, route, and connection data"] };
}

export function connectionRiskSummary(layovers) {
  const values = layovers ?? [];
  const shortest = shortestLayover(values);
  const longest = longestLayover(values);
  const unknown = values.find((layover) => classifyConnectionDuration(layover.duration, TIGHT_LAYOVER_MINUTES).status === CONNECTION_DURATION.UNKNOWN);
  if (shortest && shortest.duration < TIGHT_LAYOVER_MINUTES) return { level: "tight", shortest, longest, label: `Tight ${shortest.id ?? shortest.name} connection` };
  if (unknown) return { level: "unknown", shortest: unknown, longest, label: `${unknown.id ?? unknown.name ?? "Connection"} time needs verification` };
  if (!shortest) return { level: "none", shortest, longest, label: "No layover risk flagged" };
  if (shortest.duration < WATCH_LAYOVER_MINUTES) return { level: "watch", shortest, longest, label: `Watch ${shortest.id ?? shortest.name} connection` };
  return { level: "comfortable", shortest, longest, label: "Connection timing looks workable" };
}
