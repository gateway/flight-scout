// Owns the optional local watch-rule contract and deterministic evaluation.
// Rules never fetch data; callers evaluate them only against saved flight results.

export function validateWatchRules(rules = []) {
  const ids = new Set();
  for (const rule of rules) {
    if (!rule?.id || ids.has(rule.id)) {
      throw new Error("Every watch rule needs a unique id.");
    }
    ids.add(rule.id);
    if (rule.enabled !== undefined && typeof rule.enabled !== "boolean") {
      throw new Error('Watch rule field "enabled" must be a boolean when provided.');
    }
    const hasPrice = isPositiveFinite(rule?.maxPriceUsd);
    const hasDuration = isPositiveFinite(rule?.maxDurationMinutes);
    if (!hasPrice && !hasDuration) {
      throw new Error("Every watch rule needs a positive price or duration threshold.");
    }
  }
}

export function watchRulesFromIntent(intent) {
  const maxPriceUsd = intent?.budget?.target;
  const maxHours = intent?.preferences?.preferredTotalElapsedHours
    ?? intent?.preferences?.rejectTotalElapsedHoursOver;
  const rule = {
    id: "target-price-and-time",
    label: "Target price and travel time",
    enabled: true,
    ...(isPositiveFinite(maxPriceUsd) ? { maxPriceUsd } : {}),
    ...(isPositiveFinite(maxHours) ? { maxDurationMinutes: maxHours * 60 } : {})
  };
  return Object.keys(rule).length > 3 ? [rule] : [];
}

export function evaluateWatchRules(rules = [], flights = []) {
  if (!Array.isArray(rules) || !Array.isArray(flights)) return [];
  return rules.flatMap((rule) => {
    const matched = activeThresholds(rule);
    if (rule.enabled === false || !Object.keys(matched).length) return [];
    const candidates = flights.filter((flight) => isDecisionReady(flight) && hasThresholdData(flight, matched));
    const match = candidates.filter((flight) => matchesThresholds(flight, matched)).sort(compareFlights)[0];
    const outcome = match ? "met" : "missed";
    const selected = match ?? candidates.sort((left, right) => compareMissDistance(left, right, matched))[0];
    if (!selected) return [];
    return [{
      id: `${rule.id}:${flightKey(selected)}`,
      ruleId: rule.id,
      label: rule.label || (outcome === "met" ? "Saved target met" : "Saved target"),
      outcome,
      matched,
      misses: thresholdMisses(selected, matched),
      flight: selected
    }];
  });
}

function isDecisionReady(flight) {
  if (flight?.tripComplete === false || flight?.destinationComplete === false) return false;
  return !(flight?.scoring?.labels ?? []).includes("hard-reject");
}

function activeThresholds(rule) {
  return {
    ...(isPositiveFinite(rule.maxPriceUsd) ? { maxPriceUsd: rule.maxPriceUsd } : {}),
    ...(isPositiveFinite(rule.maxDurationMinutes) ? { maxDurationMinutes: rule.maxDurationMinutes } : {})
  };
}

function matchesThresholds(flight, thresholds) {
  if (thresholds.maxPriceUsd && flightPrice(flight) > thresholds.maxPriceUsd) return false;
  if (thresholds.maxDurationMinutes && flightDuration(flight) > thresholds.maxDurationMinutes) return false;
  return true;
}

function hasThresholdData(flight, thresholds) {
  if (thresholds.maxPriceUsd && !Number.isFinite(flightPrice(flight))) return false;
  if (thresholds.maxDurationMinutes && !Number.isFinite(flightDuration(flight))) return false;
  return true;
}

function compareFlights(left, right) {
  return flightScore(left) - flightScore(right)
    || flightPrice(left) - flightPrice(right)
    || flightDuration(left) - flightDuration(right)
    || flightKey(left).localeCompare(flightKey(right));
}

function compareMissDistance(left, right, thresholds) {
  return missDistance(left, thresholds) - missDistance(right, thresholds) || compareFlights(left, right);
}

function missDistance(flight, thresholds) {
  const priceDistance = thresholds.maxPriceUsd
    ? Math.max(0, flightPrice(flight) - thresholds.maxPriceUsd) / thresholds.maxPriceUsd
    : 0;
  const durationDistance = thresholds.maxDurationMinutes
    ? Math.max(0, flightDuration(flight) - thresholds.maxDurationMinutes) / thresholds.maxDurationMinutes
    : 0;
  return priceDistance + durationDistance;
}

function thresholdMisses(flight, thresholds) {
  return {
    ...(thresholds.maxPriceUsd && flightPrice(flight) > thresholds.maxPriceUsd
      ? { priceUsd: flightPrice(flight) - thresholds.maxPriceUsd }
      : {}),
    ...(thresholds.maxDurationMinutes && flightDuration(flight) > thresholds.maxDurationMinutes
      ? { durationMinutes: flightDuration(flight) - thresholds.maxDurationMinutes }
      : {})
  };
}

function flightScore(flight) {
  return Number.isFinite(flight?.scoring?.score) ? flight.scoring.score : 0;
}

function flightPrice(flight) {
  return flight?.scoring?.breakdown?.estimatedTotalCost
    ?? flight?.estimatedTotalCost
    ?? flight?.price
    ?? Infinity;
}

function flightDuration(flight) {
  return Number.isFinite(flight?.durationMinutes) ? flight.durationMinutes : Infinity;
}

function flightKey(flight) {
  return [
    flight.id ?? flight.searchId ?? "flight",
    flight.departureAirport ?? "",
    flight.arrivalAirport ?? "",
    flight.departureTime ?? "",
    flightPrice(flight),
    flightDuration(flight)
  ].join("|");
}

function isPositiveFinite(value) {
  return Number.isFinite(value) && value > 0;
}
