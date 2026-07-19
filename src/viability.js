import { classifyConnection, CONNECTION_DURATION } from "./connection-duration.js";

export const VIABILITY = {
  RECOMMENDED: "recommended",
  WATCH: "watch",
  HIDDEN: "hidden-by-preference",
  HARD_REJECT: "hard-reject"
};

export function viabilityRulesFrom({ trip = {}, plan = {} } = {}) {
  trip ??= {};
  plan ??= {};
  const rules = trip.rules ?? {};
  const budget = trip.budget ?? {};
  const preferences = plan.preferences ?? {};
  return {
    maxSingleTravelDayHours: rules.maxSingleTravelDayHours ?? preferences.maxSingleTravelDayHours ?? 26,
    rejectTotalElapsedHoursOver: rules.rejectTotalElapsedHoursOver ?? preferences.rejectTotalElapsedHoursOver ?? 35,
    preferredDomesticConnectionMinutes: rules.preferredDomesticConnectionMinutes ?? preferences.connectionMinimums?.domesticMinutes ?? 90,
    preferredInternationalToDomesticConnectionMinutes: rules.preferredInternationalToDomesticConnectionMinutes ?? preferences.connectionMinimums?.internationalToDomesticMinutes ?? 180,
    connectionTypesByAirport: rules.connectionTypesByAirport ?? preferences.connectionTypesByAirport ?? {},
    hardMaxBudget: budget.hardMax ?? preferences.hardMaxBudget ?? null,
    softMaxBudget: budget.softMax ?? preferences.softMaxBudget ?? null,
    maxStops: preferences.maxStops ?? null
  };
}

export function classifyCandidate(candidate, rules = {}) {
  if (!candidate) return { status: VIABILITY.HIDDEN, reasons: ["missing candidate"] };
  if (candidate.kind === "composed-stopover" || candidate.kind === "composed-round-trip") {
    return classifyComposedCandidate(candidate, rules);
  }

  const reasons = [];
  const durationHours = (candidate.durationMinutes ?? Infinity) / 60;
  const price = candidate.scoring?.breakdown?.estimatedTotalCost ?? candidate.estimatedTotalCost ?? candidate.price;

  if (candidate.tripComplete === false || candidate.destinationComplete === false) {
    return { status: VIABILITY.HIDDEN, reasons: ["incomplete route data"] };
  }
  if (candidate.scoring?.labels?.includes("hard-reject")) {
    reasons.push("over hard travel-time limit");
  }
  if (durationHours > (rules.rejectTotalElapsedHoursOver ?? 35)) {
    reasons.push(`over ${rules.rejectTotalElapsedHoursOver ?? 35}h hard limit`);
  }
  if (Number.isFinite(rules.maxStops) && (candidate.stops ?? 0) > rules.maxStops) {
    reasons.push(`more than ${rules.maxStops} stops`);
  }
  if (Number.isFinite(rules.hardMaxBudget) && Number.isFinite(price) && price > rules.hardMaxBudget) {
    reasons.push(`over $${rules.hardMaxBudget} hard budget`);
  }
  if (reasons.length) return { status: VIABILITY.HARD_REJECT, reasons };

  const watchReasons = [];
  if (durationHours > (rules.maxSingleTravelDayHours ?? 26)) {
    watchReasons.push(`long travel day over ${rules.maxSingleTravelDayHours ?? 26}h`);
  }
  for (const layover of candidate.layovers ?? []) {
    const connection = classifyConnection(layover, rules);
    const label = layover.id ?? layover.name ?? "connection";
    if (connection.status === CONNECTION_DURATION.UNKNOWN) {
      watchReasons.push(`${label} connection ${connection.verification ?? "details"} needs verification`);
    } else if (connection.status === CONNECTION_DURATION.TIGHT) {
      watchReasons.push(`${label} under ${connection.minimumMinutes}m`);
    }
  }
  if (Number.isFinite(rules.softMaxBudget) && Number.isFinite(price) && price > rules.softMaxBudget) {
    watchReasons.push(`over $${rules.softMaxBudget} soft budget`);
  }
  if (watchReasons.length) return { status: VIABILITY.WATCH, reasons: watchReasons };
  return { status: VIABILITY.RECOMMENDED, reasons: ["matches current trip rules"] };
}

export function summarizeViability(candidates, rules = {}) {
  const counts = {
    total: 0,
    recommended: 0,
    watch: 0,
    hiddenByPreference: 0,
    hardReject: 0
  };
  const reasons = new Map();
  const filteredReasons = new Map();
  const watchReasons = new Map();
  const excludedReasons = new Map();
  for (const candidate of candidates ?? []) {
    counts.total += 1;
    const result = classifyCandidate(candidate, rules);
    if (result.status === VIABILITY.RECOMMENDED) counts.recommended += 1;
    if (result.status === VIABILITY.WATCH) counts.watch += 1;
    if (result.status === VIABILITY.HIDDEN) counts.hiddenByPreference += 1;
    if (result.status === VIABILITY.HARD_REJECT) counts.hardReject += 1;
    for (const reason of result.reasons ?? []) {
      reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
      if (result.status !== VIABILITY.RECOMMENDED) {
        filteredReasons.set(reason, (filteredReasons.get(reason) ?? 0) + 1);
      }
      if (result.status === VIABILITY.WATCH) {
        watchReasons.set(reason, (watchReasons.get(reason) ?? 0) + 1);
      }
      if (result.status === VIABILITY.HIDDEN || result.status === VIABILITY.HARD_REJECT) {
        excludedReasons.set(reason, (excludedReasons.get(reason) ?? 0) + 1);
      }
    }
  }
  return {
    ...counts,
    topReasons: [...reasons.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 4)
      .map(([reason, count]) => ({ reason, count })),
    topFilteredReasons: [...filteredReasons.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 4)
      .map(([reason, count]) => ({ reason, count })),
    topWatchReasons: [...watchReasons.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 3)
      .map(([reason, count]) => ({ reason, count })),
    topExcludedReasons: [...excludedReasons.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 4)
      .map(([reason, count]) => ({ reason, count }))
  };
}

function classifyComposedCandidate(candidate, rules) {
  const [firstFlight, secondFlight] = candidate.kind === "composed-round-trip"
    ? [candidate.outbound, candidate.returnFlight]
    : [candidate.inbound, candidate.onward];
  const first = classifyCandidate(firstFlight, { ...rules, hardMaxBudget: null, softMaxBudget: null });
  const second = classifyCandidate(secondFlight, { ...rules, hardMaxBudget: null, softMaxBudget: null });
  const hardReasons = [...first.reasons, ...second.reasons].filter(Boolean);
  if (Number.isFinite(rules.hardMaxBudget) && candidate.totalCost > rules.hardMaxBudget) {
    return { status: VIABILITY.HARD_REJECT, reasons: [`over $${rules.hardMaxBudget} hard budget`] };
  }
  if (first.status === VIABILITY.HARD_REJECT || second.status === VIABILITY.HARD_REJECT) {
    return { status: VIABILITY.HARD_REJECT, reasons: hardReasons };
  }
  if (first.status === VIABILITY.HIDDEN || second.status === VIABILITY.HIDDEN) {
    return { status: VIABILITY.HIDDEN, reasons: hardReasons.length ? hardReasons : ["missing composed leg data"] };
  }
  const watchReasons = [
    ...(first.status === VIABILITY.WATCH ? first.reasons : []),
    ...(second.status === VIABILITY.WATCH ? second.reasons : [])
  ];
  if (Number.isFinite(rules.softMaxBudget) && candidate.totalCost > rules.softMaxBudget) {
    watchReasons.push(`over $${rules.softMaxBudget} soft budget`);
  }
  if (watchReasons.length) return { status: VIABILITY.WATCH, reasons: watchReasons };
  return { status: VIABILITY.RECOMMENDED, reasons: ["matches current trip rules"] };
}
