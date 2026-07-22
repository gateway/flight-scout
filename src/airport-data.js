import { readFileSync } from "node:fs";
import { escapeRegExp } from "./regex.js";

// Owns the bundled airport snapshot and its lazy indexes; resolver policy stays in airport-resolver.js.
const TYPE_PRIORITY = new Map([["large_airport", 0], ["medium_airport", 1], ["small_airport", 2]]);
let cachedData;

export function resolveAirportDataPlace(value) {
  const query = splitPlaceQuery(value);
  if (!query.city) return null;
  const data = airportData();
  const cityMatches = data.byCity.get(query.city);
  let direct = cityMatches ? scheduledServiceAirports(cityMatches) : data.byName.get(query.city) ?? [];
  if (query.location) direct = direct.filter((airport) => locationMatches(airport, query.location));
  if (!direct.length || isAmbiguous(direct, query.location)) return null;

  const directCodes = new Set(direct.map((airport) => airport.code));
  const metroCodes = new Set(direct.flatMap((airport) => airport.metroCodes));
  const expanded = [...metroCodes]
    .flatMap((code) => data.byMetro.get(code) ?? [])
    .filter((airport) => !directCodes.has(airport.code))
    .filter((airport) => airport.type === "large_airport" && airport.scheduledService)
    .filter((airport) => airport.isoCountry === direct[0].isoCountry);
  const airports = uniqueAirports([...direct, ...expanded])
    .sort((left, right) => compareAirports(left, right, directCodes));

  return {
    label: placeLabel(query),
    airports: airports.map((airport) => airport.code)
  };
}

// Endpoint parsing consumes the same place vocabulary as airport resolution instead
// of maintaining a second, route-specific alias table.
export function knownAirportPlacePattern() {
  return airportData().placeTerms.map(escapeRegExp).join("|");
}

export function knownAirportLocationPattern() {
  return airportData().locationAliases.map(escapeRegExp).join("|");
}

export function airportDataMetadataForCode(code) {
  const airport = airportData().byCode.get(String(code ?? "").toUpperCase());
  if (!airport) return null;
  return {
    code: airport.code,
    name: airport.name,
    municipality: airport.municipality,
    isoCountry: airport.isoCountry,
    country: airport.country,
    isoRegion: airport.isoRegion,
    region: airport.region,
    type: airport.type
  };
}

export function hasAirportCode(code) {
  return airportData().byCode.has(String(code ?? "").toUpperCase());
}

function airportData() {
  if (cachedData) return cachedData;
  const snapshot = JSON.parse(readFileSync(new URL("../data/airports.json", import.meta.url), "utf8"));
  if (![1, 2].includes(snapshot.version) || !Array.isArray(snapshot.airports)) throw new Error("Unsupported airport data snapshot.");
  const airports = snapshot.airports.map(toAirport);
  const byCode = new Map(airports.map((airport) => [airport.code, airport]));
  const byCity = groupBy(airports, (airport) => normalizeMunicipality(airport.municipality));
  const byNameItems = groupBy(
    airports.flatMap((airport) => airportNameAliases(airport).map((alias) => ({ alias, airport }))),
    (item) => item.alias
  );
  const byName = new Map([...byNameItems].map(([alias, items]) => [alias, items.map((item) => item.airport)]));
  const metroGroups = groupBy(airports.flatMap((airport) => airport.metroCodes.map((code) => ({ code, airport }))), (item) => item.code);
  const byMetro = new Map([...metroGroups]
    .filter(([, items]) => items.length > 1)
    .map(([code, items]) => [code, items.map((item) => item.airport)]));
  const locationAliases = [...new Set(airports.flatMap((airport) => [
    normalize(airport.country), normalize(airport.isoCountry),
    normalize(airport.region), normalize(airport.isoRegion)
  ]))].filter(Boolean).sort((left, right) => right.length - left.length);
  const placeTerms = [...new Set([...byCity.keys(), ...byName.keys()])]
    .filter((term) => term.length > 2)
    .sort((left, right) => right.length - left.length);
  cachedData = { byCode, byCity, byName, byMetro, locationAliases, placeTerms };
  return cachedData;
}

function toAirport(row) {
  return {
    code: row[0], name: row[1], municipality: row[2], isoCountry: row[3], country: row[4],
    isoRegion: row[5], region: row[6], type: row[7], metroCodes: row[8] ?? [],
    scheduledService: row.length < 10 || row[9] === true
  };
}

function scheduledServiceAirports(airports) {
  const scheduled = airports.filter((airport) => airport.scheduledService);
  return scheduled.length ? scheduled : airports;
}

function groupBy(items, keyFor) {
  const groups = new Map();
  for (const item of items) {
    const key = keyFor(item);
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return groups;
}

function splitPlaceQuery(value) {
  const text = String(value ?? "").trim();
  const data = text.split(",").map((part) => normalize(part)).filter(Boolean);
  if (data.length > 1) return { city: data[0], location: data.at(-1) };
  const normalized = normalize(text);
  const location = airportData().locationAliases.find((name) => normalized.endsWith(` ${name}`));
  return location
    ? { city: normalized.slice(0, -(location.length + 1)).trim(), location }
    : { city: normalized, location: null };
}

function locationMatches(airport, query) {
  return [airport.country, airport.isoCountry, airport.region, airport.isoRegion]
    .some((value) => normalize(value) === query);
}

function isAmbiguous(airports, locationSpecified) {
  if (!locationSpecified && new Set(airports.map((airport) => airport.isoCountry)).size > 1) return true;
  return new Set(airports.map((airport) => airport.isoRegion)).size > 1;
}

function compareAirports(left, right, directCodes) {
  return (TYPE_PRIORITY.get(left.type) ?? 9) - (TYPE_PRIORITY.get(right.type) ?? 9)
    || Number(directCodes.has(right.code)) - Number(directCodes.has(left.code))
    || left.code.localeCompare(right.code);
}

function uniqueAirports(airports) {
  return [...new Map(airports.map((airport) => [airport.code, airport])).values()];
}

function placeLabel(query) {
  return query.city.replace(/\b\w/g, (character) => character.toUpperCase());
}

function airportNameAliases(airport) {
  const name = normalize(airport.name)
    .replace(/\b(?:international|airport|airfield|aerodrome|municipal|regional)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return name && name !== normalizeMunicipality(airport.municipality) ? [name] : [];
}

function normalizeMunicipality(value) {
  return normalize(String(value ?? "").replace(/\s*\([^)]*\)\s*/g, " "));
}

function normalize(value) {
  return String(value ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
