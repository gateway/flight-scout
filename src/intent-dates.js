import { addDays } from "./dates.js";
import { intentNumberPattern, parseIntentNumber } from "./intent-numbers.js";

const MONTHS = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12"
};
const MONTH_PATTERN = Object.keys(MONTHS).join("|");
const MONTH_SUFFIX = "(?:uary|ruary|ch|il|e|y|ust|tember|ober|ember)?";

// Date parsing owns year rollover so yearless requests always resolve against the supplied clock.
export function parseIntentDepartureWindow(lower, dateContext) {
  const plusMinus = lower.match(new RegExp(`\\b(${MONTH_PATTERN})${MONTH_SUFFIX}\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?(?:[^.]{0,80})?(?:plus\\s*or\\s*minus|\\+/-|plus-minus)\\s+(${intentNumberPattern()})(?:\\s*days?)?`));
  if (plusMinus) {
    const center = intentDate(plusMinus[1], plusMinus[2], plusMinus[3], dateContext);
    const days = parseIntentNumber(plusMinus[4]);
    return { start: addDays(center, -days), end: addDays(center, days), mode: "plus-minus", center, days };
  }

  const plusMinusBefore = lower.match(new RegExp(`(?:plus\\s*or\\s*minus|\\+/-|plus-minus)\\s+(${intentNumberPattern()})(?:\\s*days?)?\\s+(?:from\\s+)?\\b(${MONTH_PATTERN})${MONTH_SUFFIX}\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?`));
  if (plusMinusBefore) {
    const center = intentDate(plusMinusBefore[2], plusMinusBefore[3], plusMinusBefore[4], dateContext);
    const days = parseIntentNumber(plusMinusBefore[1]);
    return { start: addDays(center, -days), end: addDays(center, days), mode: "plus-minus", center, days };
  }

  const range = lower.match(new RegExp(`\\b(${MONTH_PATTERN})${MONTH_SUFFIX}\\s+(\\d{1,2})\\s*(?:-|to|through)\\s*(\\d{1,2})(?:,?\\s+(\\d{4}))?`));
  if (range) {
    const year = intentYear(range[1], range[2], range[4], dateContext);
    return { start: isoDateFromParts(range[1], range[2], year), end: isoDateFromParts(range[1], range[3], year), mode: "range" };
  }

  const single = lower.match(new RegExp(`\\b(${MONTH_PATTERN})${MONTH_SUFFIX}\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?`));
  if (!single) return null;
  const center = intentDate(single[1], single[2], single[3], dateContext);
  return { start: center, end: center, mode: "fixed", center, days: 0 };
}

export function parseIntentReturnWindow(lower, dateContext) {
  const returnText = lower.match(/\b(?:returning|return(?:ing)?(?: flight)?(?: on)?|coming back(?: on)?)\s+(.+)$/)?.[1];
  return returnText ? parseIntentDepartureWindow(returnText, dateContext) : null;
}

function isoDateFromParts(monthName, day, year) {
  const monthNumber = MONTHS[monthName.slice(0, 3)];
  return `${year}-${monthNumber}-${String(day).padStart(2, "0")}`;
}

function intentDate(monthName, day, explicitYear, dateContext) {
  return isoDateFromParts(monthName, day, intentYear(monthName, day, explicitYear, dateContext));
}

function intentYear(monthName, day, explicitYear, { defaultYear, now }) {
  if (explicitYear) return Number(explicitYear);
  if (defaultYear != null) return Number(defaultYear);
  const reference = new Date(now);
  if (Number.isNaN(reference.getTime())) throw new Error("Intent date reference must be valid.");
  const year = reference.getUTCFullYear();
  const candidate = isoDateFromParts(monthName, day, year);
  return candidate < reference.toISOString().slice(0, 10) ? year + 1 : year;
}
