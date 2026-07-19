import { resolveAirportPlace } from "./airport-resolver.js";
import { parseFlightBudget } from "./intent-budget.js";
import { parseIntentDepartureWindow, parseIntentReturnWindow } from "./intent-dates.js";
import { parseIntentEndpoints, parseIntentTripType } from "./intent-endpoints.js";
import { buildIntentPreferences, parseIntentDirectness, parseIntentTravelHours } from "./intent-preferences.js";
import { parseIntentStopover } from "./intent-stopover.js";

export function interpretFlightPlanText(text, { defaultYear, now = new Date() } = {}) {
  if (!text?.trim()) throw new Error("Natural-language plan text is required.");
  const raw = text.trim();
  const lower = raw.toLowerCase();
  const endpoints = parseIntentEndpoints(raw);
  const origin = resolveAirportPlace(endpoints.originText);
  const destination = resolveAirportPlace(endpoints.destinationText);
  const departureWindow = parseIntentDepartureWindow(lower, { defaultYear, now });
  const tripType = parseIntentTripType(lower);
  const returnWindow = tripType === "round-trip"
    ? parseIntentReturnWindow(lower, { defaultYear, now })
    : null;
  const budgetResult = parseFlightBudget(raw);
  const budget = budgetResult.budget;
  const directness = parseIntentDirectness(lower);
  const stopover = parseIntentStopover(raw);
  const travelHours = parseIntentTravelHours(lower);
  const noLive = /do\s*not\s*run|don't\s*run|dont\s*run|preview only|no live|don't scan|dont scan/.test(lower);
  const clarifications = [
    ...origin.questions,
    ...destination.questions,
    ...(origin.status === "missing" ? ["Where are you flying from?"] : []),
    ...(destination.status === "missing" ? ["Where are you flying to? A city or three-letter airport code works."] : []),
    ...(!departureWindow ? ["What departure date or date range should I use?"] : []),
    ...(tripType === "round-trip" && !returnWindow ? ["What return date or date range should I use?"] : []),
    ...(budgetResult.clarification ? [budgetResult.clarification] : []),
    ...(tripType === "unknown" ? ["Is this one-way or round-trip?"] : [])
  ].slice(0, 3);

  return {
    raw,
    noLive,
    status: clarifications.length ? "needs-clarification" : "ready",
    clarifications,
    assumptions: [
      ...asArray(origin.assumptions),
      ...asArray(destination.assumptions),
      ...(tripType === "one-way" && !/\bone[- ]?way\b/.test(lower) ? ["Trip type is assumed to be one-way because only one travel direction was requested."] : []),
      ...(noLive ? ["No provider search should run until the user explicitly approves it."] : [])
    ],
    tripType,
    origin: origin.place,
    destination: destination.place,
    departureWindow,
    returnWindow,
    budget,
    directness,
    stopover,
    preferences: buildIntentPreferences(lower, { budget, directness, travelHours })
  };
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}
