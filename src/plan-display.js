import { formatHumanDate, money } from "./html-utils.js";

export function planDisplaySummary(plan) {
  const intent = plan.intent ?? {};
  const coverage = intent.dateCoverage ?? {};
  const tripType = intent.tripType === "round-trip" ? "Round-trip" : "One-way";
  const dateText = formatDateWindow(coverage);
  const departureText = intent.tripType === "round-trip" && dateText ? `Departure ${dateText}` : dateText;
  const firstSentence = departureText ? `${tripType}, ${departureText}` : tripType;
  const returnText = intent.tripType === "round-trip" ? formatReturnWindow(intent.returnDateCoverage ?? {}) : "";
  const routeCount = plan.routeIdeas?.length ?? 0;
  const routeText = routeCount > 1 ? `Compare ${routeCount} route ideas` : "";
  const constraints = planConstraints(plan);
  return [firstSentence, returnText, routeText, constraints].filter(Boolean).join(". ") + ".";
}

function formatDateWindow(coverage) {
  if (coverage.center && Number.isFinite(coverage.plusMinusDays) && coverage.plusMinusDays > 0) {
    const unit = coverage.plusMinusDays === 1 ? "day" : "days";
    const range = coverage.start && coverage.end ? ` (${formatShortDate(coverage.start)} - ${formatShortDate(coverage.end)})` : "";
    return `${formatHumanDate(coverage.center)} plus or minus ${coverage.plusMinusDays} ${unit}${range}`;
  }
  if (coverage.start && coverage.end && coverage.start !== coverage.end) {
    return `${formatHumanDate(coverage.start)} to ${formatHumanDate(coverage.end)}`;
  }
  if (coverage.center || coverage.start) return formatHumanDate(coverage.center ?? coverage.start);
  return "";
}

function formatReturnWindow(coverage) {
  const window = formatDateWindow(coverage);
  return window ? `Return ${window}` : "";
}

function planConstraints(plan) {
  const prefs = plan.preferences ?? {};
  const parts = [];
  if (prefs.directRequired || prefs.maxStops === 0) parts.push("nonstop only");
  if (Number.isFinite(prefs.hardMaxBudget)) parts.push(`target under $${money(prefs.hardMaxBudget)}`);
  if (Number.isFinite(prefs.preferredTotalElapsedHours)) parts.push(`prefer under ${prefs.preferredTotalElapsedHours}h`);
  if (Number.isFinite(prefs.rejectTotalElapsedHoursOver)) parts.push(`ignore trips over ${prefs.rejectTotalElapsedHoursOver}h`);
  if (!parts.length) return "";
  parts[0] = `${parts[0][0].toUpperCase()}${parts[0].slice(1)}`;
  return parts.join("; ");
}

function formatShortDate(value) {
  if (!value) return "";
  const [year, month, day] = String(value).slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return String(value);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric"
  });
}
