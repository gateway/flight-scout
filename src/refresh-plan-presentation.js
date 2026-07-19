// User-facing manifest explanations and warnings are kept separate from selection and cache policy.
export function buildRefreshWarnings({ selectedMode, candidateCalls, selectedCalls }) {
  const warnings = [];
  if (candidateCalls.length > selectedCalls.length) warnings.push(`${candidateCalls.length - selectedCalls.length} candidate searches were held back by the ${selectedMode} mode cap.`);
  if (selectedMode === "deep") warnings.push("Deep mode is intentionally broad. Use it only when the plan changed or cached data is stale.");
  const stale = selectedCalls.filter((call) => call.cache.status === "stale").length;
  if (stale > 0) warnings.push(`${stale} selected cached searches are stale and should be refreshed before booking.`);
  return warnings;
}

export function refreshModeExplanation(mode) {
  if (mode === "light") return "Refresh only the route leads that are most likely to change the decision.";
  if (mode === "standard") return "Refresh the active date window and route ideas without broad gateway exploration.";
  if (mode === "targeted-deep") return "Refresh viable route families plus gateway comparisons without the full exploratory search space.";
  return "Refresh broad gateway and price-explorer routes when the decision is stale or the plan changed.";
}

const REFRESH_REASON_COPY = new Map([
  ["decision-critical focus search", "current decision candidates"],
  ["full date-window coverage", "all dates in your search window"],
  ["gateway confidence", "alternate gateway comparisons"],
  ["cheap explorer", "lower-fare route exploration"],
  ["current best", "current best option"],
  ["cheapest challenger", "lower-price alternative"],
  ["fastest challenger", "faster alternative"],
  ["missing route data", "missing route coverage"]
]);

// Internal selection reasons stay stable for refresh policy; only presentation is translated.
export function humanizeRefreshReason(reason) {
  const normalized = String(reason ?? "").trim();
  if (!normalized) return "selected for this refresh";
  if (REFRESH_REASON_COPY.has(normalized)) return REFRESH_REASON_COPY.get(normalized);
  if (normalized.startsWith("route batch:")) {
    return `${readableWords(normalized.slice("route batch:".length))} route candidates`;
  }
  return readableWords(normalized);
}

export function humanizeRefreshReasons(reasons) {
  const source = reasons?.length ? reasons : [""];
  return [...new Set(source.map(humanizeRefreshReason))];
}

function readableWords(value) {
  return String(value ?? "")
    .trim()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ");
}
