import { summarizeViability, viabilityRulesFrom } from "./viability.js";
import { normalizeOptions } from "./decision-options.js";
import { dateOpportunities, refreshGuidance, selectDecisionOptions } from "./decision-selection.js";
import { evaluateWatchRules } from "./watch-rules.js";

export { normalizeOption, normalizeOptions } from "./decision-options.js";
export { confidenceLabel } from "./decision-confidence.js";
export { travelPainBreakdown, worthIt } from "./decision-metrics.js";
export { dateOpportunities, refreshGuidance } from "./decision-selection.js";

// Stable facade that composes normalized evidence, selectors, and plan-level metadata.
export function analyzeDecision({ plan, trip = null, routeGroups, current = null, refreshPlan = null }) {
  const refreshBySearchId = refreshLookup(refreshPlan);
  const viabilityRules = viabilityRulesFrom({ trip, plan });
  const options = normalizeOptions({ plan, trip, routeGroups, refreshBySearchId });
  const selections = selectDecisionOptions(options);

  return {
    options,
    ...selections,
    dateCoverage: dateCoverage(plan),
    dateOpportunities: dateOpportunities(options, selections.best),
    refreshGuidance: refreshGuidance({ ...selections, refreshPlan }),
    viability: summarizeViability(current?.rankedFlights ?? [], viabilityRules),
    watchAlerts: evaluateWatchRules(plan.watchRules, options),
    viabilityRules,
    snapshot: snapshotSummary(current)
  };
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

function dateCoverage(plan) {
  const coverage = plan.intent?.dateCoverage;
  if (!coverage?.center) return "";
  const returning = plan.intent?.returnDateCoverage;
  if (plan.intent?.tripType === "round-trip" && returning?.center) {
    const exactDates = !Number.isFinite(coverage.plusMinusDays) &&
      !Number.isFinite(returning.plusMinusDays) &&
      !coverage.start && !coverage.end && !returning.start && !returning.end;
    if (exactDates) return `dates ${coverage.center} to ${returning.center}`;
    return `departure ${formatCoverage(coverage)}; return ${formatCoverage(returning)}`;
  }
  return formatCoverage(coverage);
}

function formatCoverage(coverage) {
  if (Number.isFinite(coverage.plusMinusDays)) return `dates ${coverage.center} +/- ${coverage.plusMinusDays} days`;
  if (coverage.start && coverage.end) return `dates ${coverage.start} to ${coverage.end}`;
  return `date ${coverage.center}`;
}
