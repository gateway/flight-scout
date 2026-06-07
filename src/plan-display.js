import { formatHumanDate, money } from "./html-utils.js";

export function planDisplaySummary(plan) {
  const intent = plan.intent ?? {};
  const coverage = intent.dateCoverage ?? {};
  const routeNames = (plan.routeIdeas ?? []).map((route) => route.label).filter(Boolean);
  const tripType = intent.tripType === "round-trip" ? "Round-trip" : "One-way";
  const dateText = formatDateWindow(coverage);
  const routeText = routeNames.length === 1
    ? routeNames[0]
    : `${routeNames.length} route ideas`;
  const constraints = planConstraints(plan);
  return [tripType, routeText, dateText, constraints].filter(Boolean).join(". ") + ".";
}

function formatDateWindow(coverage) {
  if (coverage.start && coverage.end && coverage.start !== coverage.end) {
    const center = coverage.center ? ` around ${formatHumanDate(coverage.center)}` : "";
    const spread = Number.isFinite(coverage.plusMinusDays) && coverage.plusMinusDays > 0
      ? `, plus or minus ${coverage.plusMinusDays} days`
      : "";
    return `Date window ${formatHumanDate(coverage.start)} to ${formatHumanDate(coverage.end)}${center}${spread}`;
  }
  if (coverage.center || coverage.start) return `Departure ${formatHumanDate(coverage.center ?? coverage.start)}`;
  return "";
}

function planConstraints(plan) {
  const prefs = plan.preferences ?? {};
  const parts = [];
  if (prefs.directRequired || prefs.maxStops === 0) parts.push("direct/nonstop preferred");
  if (Number.isFinite(prefs.hardMaxBudget)) parts.push(`target under $${money(prefs.hardMaxBudget)}`);
  if (Number.isFinite(prefs.preferredTotalElapsedHours)) parts.push(`prefer near ${prefs.preferredTotalElapsedHours} hours if possible`);
  if (Number.isFinite(prefs.rejectTotalElapsedHoursOver)) parts.push(`ignore trips over ${prefs.rejectTotalElapsedHoursOver} hours`);
  return parts.join(", ");
}
