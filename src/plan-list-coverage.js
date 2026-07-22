import { dateOnly } from "./html-utils.js";
import { optionDate } from "./dashboard-flight-components.js";

export function coverageText(plan, latest) {
  if (!latest) return "no snapshot";
  const expected = dateWindowDays(plan);
  if (!expected.length) return "date coverage unknown";
  const seen = new Set((latest.rankedFlights ?? []).map((option) => optionDate(option) ?? dateOnly(option.departureTime)).filter(Boolean));
  const covered = expected.filter((date) => seen.has(date)).length;
  return covered === expected.length ? `all ${expected.length} dates covered` : `${covered}/${expected.length} dates covered`;
}

export function dateWindowDays(plan) {
  const coverage = plan.intent?.dateCoverage;
  if (!coverage?.start || !coverage?.end) return [];
  const start = new Date(`${coverage.start}T00:00:00Z`);
  const end = new Date(`${coverage.end}T00:00:00Z`);
  if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf()) || start > end) return [];
  const dates = [];
  for (const current = new Date(start); current <= end; current.setUTCDate(current.getUTCDate() + 1)) {
    dates.push(current.toISOString().slice(0, 10));
  }
  return dates.slice(0, 14);
}
