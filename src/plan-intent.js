import { addDays } from "./dates.js";
import { knownPlacePattern, resolveAirportPlace } from "./airport-resolver.js";

const DEFAULT_YEAR = 2026;
const NUMBER_WORDS = new Map([
  ["one", 1],
  ["two", 2],
  ["three", 3],
  ["four", 4],
  ["five", 5],
  ["six", 6],
  ["seven", 7]
]);

const MONTHS = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12"
};

export function interpretFlightPlanText(text, { defaultYear = DEFAULT_YEAR } = {}) {
  if (!text?.trim()) throw new Error("Natural-language plan text is required.");
  const raw = text.trim();
  const lower = raw.toLowerCase();
  const endpoints = parseEndpoints(raw);
  const origin = resolveAirportPlace(endpoints.originText);
  const destination = resolveAirportPlace(endpoints.destinationText);
  const departureWindow = parseDepartureWindow(lower, defaultYear);
  const tripType = parseTripType(lower);
  const budget = parseBudget(raw);
  const directness = parseDirectness(lower);
  const stopover = parseStopover(raw);
  const travelHours = parseTravelHourPreference(lower);
  const noLive = /do\s*not\s*run|don't\s*run|dont\s*run|preview only|no live|don't scan|dont scan/.test(lower);
  const clarifications = [
    ...origin.questions,
    ...destination.questions,
    ...(!departureWindow ? ["What departure date or date range should I use?"] : []),
    ...(tripType === "unknown" ? ["Is this one-way or round-trip?"] : [])
  ].slice(0, 3);

  return {
    raw,
    noLive,
    status: clarifications.length ? "needs-clarification" : "ready",
    clarifications,
    assumptions: [
      ...origin.assumptions,
      ...destination.assumptions,
      ...(tripType === "one-way" && !/\bone[- ]?way\b/.test(lower) ? ["Trip type is assumed to be one-way because only one travel direction was requested."] : []),
      ...(noLive ? ["No provider search should run until the user explicitly approves it."] : [])
    ],
    tripType,
    origin: origin.place,
    destination: destination.place,
    departureWindow,
    budget,
    directness,
    stopover,
    preferences: {
      priority: /fewest|least layover|no layover/.test(lower) ? "fewest-layovers" : /fastest|quickest|shortest/.test(lower) ? "fastest" : /cheap|budget|lowest|best price/.test(lower) ? "cheapest" : "balanced",
      budgetSensitivity: budget || /cheap|cheapest|budget|lowest/.test(lower) ? "high" : "balanced",
      ...(travelHours.hardMax ? { rejectTotalElapsedHoursOver: travelHours.hardMax } : {}),
      ...(travelHours.preferredMax ? { preferredTotalElapsedHours: travelHours.preferredMax } : {}),
      ...(directness.required ? { maxStops: 0 } : {})
    }
  };
}

function parseEndpoints(text) {
  const stopWords = "\\b(?:around|on|depart(?:ing)?|aug|sep|oct|nov|dec|jan|feb|mar|apr|may|jun|jul|plus|under|max|less|that|which|direct|nonstop|for|with|but|and)\\b";
  const fromTo = text.match(new RegExp(`\\bfrom\\s+(.+?)\\s+to\\s+(.+?)(?=[.?!]|\\s+${stopWords}|$)`, "i"));
  if (fromTo) return { originText: fromTo[1], destinationText: fromTo[2] };

  const places = knownPlacePattern();
  const known = text.match(new RegExp(`\\b(${places}|[A-Z]{3})\\b\\s+to\\s+\\b(${places}|[A-Z]{3})\\b`, "i"));
  if (known) return { originText: known[1], destinationText: known[2] };

  return { originText: null, destinationText: null };
}

function parseTripType(lower) {
  if (/round trip|round-trip|return flight|coming back/.test(lower)) return "round-trip";
  if (/one way|one-way|oneway/.test(lower)) return "one-way";
  if (/\bfrom\b.+\bto\b|\bto\b/.test(lower)) return "one-way";
  return "unknown";
}

function parseBudget(text) {
  const hard = /(?:does(?:n't| not)? cost more than|under|less than|no more than|max(?:imum)?)/i.test(text);
  const moneyMatch = text.match(/\$\s*([0-9][0-9,]*)|([0-9][0-9,]*)\s*(?:usd|dollars?)/i);
  const contextualLimit = text.match(/(?:budget|cost|price|fare)[^.]{0,30}(?:under|less than|no more than|max(?:imum)?|does(?:n't| not)? cost more than)\s+\$?\s*([0-9][0-9,]*)/i);
  const valueText = moneyMatch ? (moneyMatch[1] ?? moneyMatch[2]) : contextualLimit?.[1];
  if (!valueText) return null;
  const value = Number(valueText.replaceAll(",", ""));
  if (!Number.isFinite(value)) return null;
  return {
    target: value,
    softMax: hard ? value : Math.round(value * 1.1),
    hardMax: hard ? value : Math.round(value * 1.3),
    currency: /usd|\$/.test(text.toLowerCase()) ? "USD" : "USD",
    hard
  };
}

function parseDirectness(lower) {
  const required = /direct(?:ly)?|nonstop|non-stop|no layover|no stops/.test(lower);
  return {
    requested: required || /fewest layover|least layover/.test(lower),
    required,
    maxStops: required ? 0 : null
  };
}

function parseStopover(text) {
  const match = text.match(/(?:stop(?:over)?(?: in)?|via|through)\s+(.+?)(?=\s+(?:for|if|maybe|on|around|under|plus)\b|$)/i);
  if (!match) {
    const lower = text.toLowerCase();
    if (/\btokyo\b/.test(lower) && /maybe|if worth|if.*worth|optional|stopover|stay|overnight/.test(lower)) {
      const resolved = resolveAirportPlace("tokyo");
      return { ...resolved.place, nights: parseNights(lower), required: false };
    }
    return null;
  }
  const resolved = resolveAirportPlace(match[1]);
  if (!resolved.place) return { label: match[1].trim(), airports: [], nights: [1], unresolved: true };
  return { ...resolved.place, nights: parseNights(text.toLowerCase()), required: !/maybe|if|optional|worth/.test(text.toLowerCase()) };
}

function parseDepartureWindow(lower, defaultYear) {
  const plusMinus = lower.match(new RegExp(`\\b(${Object.keys(MONTHS).join("|")})(?:uary|ruary|ch|il|e|y|ust|tember|ober|ember)?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:[^.]{0,80})?(?:plus\\s*or\\s*minus|\\+/-|plus-minus)\\s+(${numberPattern()})(?:\\s*days?)?`));
  if (plusMinus) {
    const center = dateOnly(plusMinus[1], plusMinus[2], defaultYear);
    const days = parseSmallNumber(plusMinus[3]);
    return { start: addDays(center, -days), end: addDays(center, days), mode: "plus-minus", center, days };
  }

  const plusMinusBefore = lower.match(new RegExp(`(?:plus\\s*or\\s*minus|\\+/-|plus-minus)\\s+(${numberPattern()})(?:\\s*days?)?\\s+(?:from\\s+)?\\b(${Object.keys(MONTHS).join("|")})(?:uary|ruary|ch|il|e|y|ust|tember|ober|ember)?\\s+(\\d{1,2})(?:st|nd|rd|th)?`));
  if (plusMinusBefore) {
    const center = dateOnly(plusMinusBefore[2], plusMinusBefore[3], defaultYear);
    const days = parseSmallNumber(plusMinusBefore[1]);
    return { start: addDays(center, -days), end: addDays(center, days), mode: "plus-minus", center, days };
  }

  const range = lower.match(new RegExp(`\\b(${Object.keys(MONTHS).join("|")})(?:uary|ruary|ch|il|e|y|ust|tember|ober|ember)?\\s+(\\d{1,2})\\s*(?:-|to|through)\\s*(\\d{1,2})`));
  if (range) return { start: dateOnly(range[1], range[2], defaultYear), end: dateOnly(range[1], range[3], defaultYear), mode: "range" };

  const single = lower.match(new RegExp(`\\b(${Object.keys(MONTHS).join("|")})(?:uary|ruary|ch|il|e|y|ust|tember|ober|ember)?\\s+(\\d{1,2})(?:st|nd|rd|th)?`));
  if (!single) return null;
  const center = dateOnly(single[1], single[2], defaultYear);
  return { start: center, end: center, mode: "fixed", center, days: 0 };
}

function parseTravelHourPreference(lower) {
  const result = { hardMax: null, preferredMax: null };
  const preferred = lower.match(/(?:under|less than|around|about)\s*(\d{1,2})\s*(?:h|hour|hours)[^.]{0,45}\bif possible\b/)
    ?? lower.match(/\bprefer(?:red)?\b[^.]{0,60}(?:under|less than|around|about)\s*(\d{1,2})\s*(?:h|hour|hours)/)
    ?? lower.match(/(?:flight|travel|trip)\s*time[^.]{0,40}(?:under|less than|around|about)\s*(\d{1,2})\s*(?:h|hour|hours)[^.]{0,50}(?:not (?:a )?hard|soft|if possible)/);
  if (preferred) result.preferredMax = Number(preferred[1]);

  const hardPatterns = [
    /(?:max|maximum|no more than|no longer than|avoid over|not over|nothing over|anything over|over)\s*(?:a\s*)?(\d{2})[-\s]*(?:h|hour|hours)/,
    /(?:do not want|don't want|dont want)[^.]{0,40}\bover\s*(?:a\s*)?(\d{2})[-\s]*(?:h|hour|hours)/
  ];
  const explicit = hardPatterns.map((pattern) => lower.match(pattern)).find(Boolean);
  if (explicit) result.hardMax = Number(explicit[1]);
  if (!result.hardMax && /no (?:brutal|painful|long long)|avoid (?:brutal|painful|long long|35 hour)|not .*35 hour/.test(lower)) {
    result.hardMax = 35;
  }
  return result;
}

function parseNights(lower) {
  const explicit = lower.match(/(\d+)\s*(?:night|nights)/);
  if (explicit) return [Number(explicit[1])];
  if (/one or two|1 or 2|1-2|night or two/.test(lower)) return [1, 2];
  if (/two|2/.test(lower)) return [2];
  return [1];
}

function dateOnly(monthName, day, year) {
  const monthNumber = MONTHS[monthName.slice(0, 3)];
  return `${year}-${monthNumber}-${String(day).padStart(2, "0")}`;
}

function numberPattern() {
  return `\\d+|${[...NUMBER_WORDS.keys()].join("|")}`;
}

function parseSmallNumber(value) {
  return Number(value) || NUMBER_WORDS.get(String(value).toLowerCase()) || 0;
}
