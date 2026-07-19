import { knownLocationPattern, knownPlacePattern } from "./airport-resolver.js";

// Endpoint parsing only locates user-provided place text; airport resolution remains centralized.
export function parseIntentEndpoints(text) {
  const stopWords = "\\b(?:via|through|around|on|depart(?:ing)?|aug|sep|oct|nov|dec|jan|feb|mar|apr|may|jun|jul|plus|under|max|less|that|which|direct|nonstop|for|with|but|and)\\b";
  const fromTo = text.match(new RegExp(`\\bfrom\\s+(.+?)\\s+to\\s+(.+?)(?=[.?!]|\\s+${stopWords}|$)`, "i"));
  if (fromTo) return { originText: fromTo[1], destinationText: fromTo[2] };

  const places = knownPlacePattern();
  const locations = knownLocationPattern();
  const endpoint = `(?:${places}|[A-Z]{3})(?:\\s*,?\\s+(?:${locations}))?`;
  const known = text.match(new RegExp(`\\b(${endpoint})\\b\\s+to\\s+\\b(${endpoint})\\b`, "i"));
  if (known) return { originText: known[1], destinationText: known[2] };

  return { originText: null, destinationText: null };
}

export function parseIntentTripType(lower) {
  if (/round trip|round-trip|return flight|coming back/.test(lower)) return "round-trip";
  if (/one way|one-way|oneway/.test(lower)) return "one-way";
  if (/\bfrom\b.+\bto\b|\bto\b/.test(lower)) return "one-way";
  return "unknown";
}
