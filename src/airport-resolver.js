import {
  airportDataMetadataForCode,
  hasAirportCode,
  knownAirportLocationPattern,
  knownAirportPlacePattern,
  resolveAirportDataPlace
} from "./airport-data.js";

export function resolveAirportPlace(value) {
  if (!String(value ?? "").trim()) return { status: "missing", input: value, place: null, questions: [] };

  const dataPlace = resolveAirportDataPlace(value);
  if (dataPlace) {
    return {
      status: "resolved",
      input: value,
      place: dataPlace,
      questions: [],
      assumptions: multiAirportAssumptions(dataPlace)
    };
  }

  const codeMatches = explicitAirportCodes(value);
  if (codeMatches.length && codeMatches.every(hasAirportCode)) {
    const contextualPlace = resolveAirportDataPlace(withoutAirportCodes(value));
    return {
      status: "resolved",
      input: value,
      place: {
        label: contextualPlace && sameAirports(contextualPlace.airports, codeMatches)
          ? contextualPlace.label
          : codeMatches.join(","),
        airports: codeMatches
      },
      questions: [],
      assumptions: []
    };
  }

  return {
    status: "unresolved",
    input: value,
    place: null,
    questions: [`Which airport should I use for "${String(value).trim()}"? A three-letter airport code works best.`],
    assumptions: []
  };
}

function explicitAirportCodes(value) {
  const input = String(value ?? "").trim();
  if (/^[a-z]{3}(?:\s*,\s*[a-z]{3})*$/i.test(input)) {
    return input.split(",").map((code) => code.trim().toUpperCase());
  }
  return [...input.matchAll(/\b[A-Z]{3}\b/g)].map((match) => match[0]);
}

export function knownPlacePattern() {
  return knownAirportPlacePattern();
}

export function knownLocationPattern() {
  return knownAirportLocationPattern();
}

export function airportLabelForCodes(codes) {
  const uniqueCodes = [...new Set(codes ?? [])];
  const municipalities = uniqueCodes
    .map((code) => airportDataMetadataForCode(code)?.municipality)
    .filter(Boolean);
  if (municipalities.length === uniqueCodes.length && new Set(municipalities).size === 1) return municipalities[0];
  return uniqueCodes.join(",");
}

export function airportMetadataForCode(code) {
  return airportDataMetadataForCode(code);
}

function multiAirportAssumptions(place) {
  if ((place.airports?.length ?? 0) < 2) return [];
  return [`${place.label} has multiple matching airports, so ${place.airports.join(" and ")} will both be checked.`];
}

function withoutAirportCodes(value) {
  return String(value ?? "").replace(/\b[A-Z]{3}\b/g, " ").replace(/\s+/g, " ").trim();
}

function sameAirports(left, right) {
  return left.length === right.length && left.every((code) => right.includes(code));
}
