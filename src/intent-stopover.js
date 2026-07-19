import { knownPlacePattern, resolveAirportPlace } from "./airport-resolver.js";
import { intentNumberPattern, parseIntentNumber } from "./intent-numbers.js";

// Stopover parsing owns stay duration and hotel cost so flight-budget parsing stays independent.
export function parseIntentStopover(text) {
  const stopover = parseStopoverPlace(text);
  const hotelEstimate = parseHotelEstimate(text);
  if (stopover && hotelEstimate) stopover.hotelEstimateUsdPerNight = hotelEstimate;
  return stopover;
}

function parseStopoverPlace(text) {
  const match = text.match(/(?<!non-)\b(?:stop(?:over)?(?: in)?|via|through)\s+(.+?)(?=\s+(?:for|if|maybe|on|around|under|plus)\b|$)/i);
  if (!match) {
    const lower = text.toLowerCase();
    const places = knownPlacePattern();
    const optionalMatch = text.match(new RegExp(`\\b(?:maybe|optionally|consider)\\s+(?:stopping\\s+in\\s+)?(${places}|[A-Z]{3})\\b`, "i"))
      ?? text.match(new RegExp(`\\b(${places}|[A-Z]{3})\\b[^.]{0,50}\\b(?:if\\s+worth|if[^.]{0,20}worth|optional\\s+stopover)\\b`, "i"));
    if (optionalMatch) {
      const resolved = resolveAirportPlace(optionalMatch[1]);
      if (resolved.place) return { ...resolved.place, nights: parseNights(lower), required: false };
    }
    const stayMatch = text.match(new RegExp(`\\b(?:stay(?:ing)?|overnight)\\s+(?:in|at|near)?\\s*(${places}|[A-Z]{3})\\b`, "i"));
    if (stayMatch) {
      const resolved = resolveAirportPlace(stayMatch[1]);
      if (resolved.place) return { ...resolved.place, nights: parseNights(lower), required: false };
    }
    return null;
  }
  const resolved = resolveAirportPlace(match[1]);
  if (!resolved.place) return { label: match[1].trim(), airports: [], nights: [1], unresolved: true };
  return { ...resolved.place, nights: parseNights(text.toLowerCase()), required: !/maybe|if|optional|worth/.test(text.toLowerCase()) };
}

function parseHotelEstimate(text) {
  const match = text.match(/(?:hotel|room|rooms)[^.]{0,40}?\$?\s*([0-9][0-9,]*)\s*(?:usd|dollars?)?(?:\s*per\s*night|\s*\/\s*night)?|(?:\$?\s*([0-9][0-9,]*)\s*(?:usd|dollars?)?)[^.]{0,30}(?:per\s*night|\/\s*night)/i);
  const valueText = match?.[1] ?? match?.[2];
  if (!valueText) return null;
  const value = Number(valueText.replaceAll(",", ""));
  return Number.isFinite(value) ? value : null;
}

function parseNights(lower) {
  if (/one or two|1 or 2|1-2|night or two/.test(lower)) return [1, 2];
  const explicitDigit = lower.match(/(\d+)\s*(?:night|nights)/);
  if (explicitDigit) return [Number(explicitDigit[1])];
  const explicitWord = lower.match(new RegExp(`\\b(${intentNumberPattern()})\\s*(?:night|nights)\\b`));
  if (explicitWord) return [parseIntentNumber(explicitWord[1])];
  return [1];
}
