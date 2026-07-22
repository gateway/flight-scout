import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SOURCES = {
  airports: "https://davidmegginson.github.io/ourairports-data/airports.csv",
  countries: "https://davidmegginson.github.io/ourairports-data/countries.csv",
  regions: "https://davidmegginson.github.io/ourairports-data/regions.csv"
};
const ALLOWED_OPTIONS = new Set(["airports", "countries", "regions", "service-overrides", "out", "meta", "generated-at"]);
const PASSENGER_AIRPORT_TYPES = new Set(["large_airport", "medium_airport", "small_airport"]);

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const options = parseArgs(process.argv.slice(2));
const inputs = {
  airports: await loadText(options.airports ?? SOURCES.airports),
  countries: await loadText(options.countries ?? SOURCES.countries),
  regions: await loadText(options.regions ?? SOURCES.regions),
  serviceOverrides: await loadText(options.serviceOverrides ?? path.join(root, "data/airport-service-overrides.json"))
};
const data = buildSnapshot(inputs);
const dataText = `${JSON.stringify(data)}\n`;
const metadata = {
  schemaVersion: 2,
  source: "OurAirports",
  license: "Public Domain",
  sourcePage: "https://ourairports.com/data/",
  sourceUrls: { ...SOURCES, serviceOverrides: "data/airport-service-overrides.json" },
  generatedAt: options.generatedAt ?? new Date().toISOString(),
  airportCount: data.airports.length,
  sourceSha256: Object.fromEntries(Object.entries(inputs).map(([name, text]) => [name, sha256(text)])),
  dataSha256: sha256(dataText)
};

await writeAtomic(options.out ?? path.join(root, "data/airports.json"), dataText);
await writeAtomic(options.meta ?? path.join(root, "data/airports.meta.json"), `${JSON.stringify(metadata, null, 2)}\n`);
console.log(`Wrote ${data.airports.length} scheduled-service IATA airports.`);

function buildSnapshot(source) {
  const countries = keyBy(parseCsv(source.countries), "code", "name");
  const regions = keyBy(parseCsv(source.regions), "code", "name");
  const serviceOverrides = parseServiceOverrides(source.serviceOverrides);
  const airports = parseCsv(source.airports)
    .filter((row) => (row.scheduled_service === "yes" || serviceOverrides.has(row.iata_code))
      && PASSENGER_AIRPORT_TYPES.has(row.type)
      && /^[A-Z]{3}$/.test(row.iata_code))
    .map((row) => [
      row.iata_code,
      row.name,
      row.municipality,
      row.iso_country,
      countries.get(row.iso_country) ?? "",
      row.iso_region,
      regions.get(row.iso_region) ?? "",
      row.type,
      metroKeywords(row.keywords),
      serviceOverrides.get(row.iata_code) ?? true
    ]);
  assertUniqueAirportCodes(airports);
  airports.sort((left, right) => left[0].localeCompare(right[0]));
  return { version: 2, airports };
}

function parseServiceOverrides(text) {
  const values = JSON.parse(text);
  return new Map(Object.entries(values).map(([code, value]) => {
    if (!/^[A-Z]{3}$/.test(code) || typeof value?.scheduledService !== "boolean") {
      throw new Error(`Invalid airport service override ${code}`);
    }
    return [code, value.scheduledService];
  }));
}

function assertUniqueAirportCodes(airports) {
  const seen = new Set();
  for (const airport of airports) {
    if (seen.has(airport[0])) throw new Error(`Duplicate IATA code ${airport[0]}`);
    seen.add(airport[0]);
  }
}

function parseCsv(text) {
  const records = [];
  let record = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      record.push(field);
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      record.push(field);
      if (record.some(Boolean)) records.push(record);
      record = [];
      field = "";
    } else {
      field += character;
    }
  }
  if (field || record.length) {
    record.push(field);
    records.push(record);
  }
  const [headers = [], ...rows] = records;
  return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}

function keyBy(rows, key, value) {
  return new Map(rows.map((row) => [row[key], row[value]]));
}

function metroKeywords(value) {
  return [...new Set(String(value ?? "").match(/\b[A-Z]{3}\b/g) ?? [])].sort();
}

async function loadText(source) {
  if (/^https?:\/\//.test(source)) {
    const response = await fetch(source);
    if (!response.ok) throw new Error(`Unable to download ${source}: HTTP ${response.status}`);
    return response.text();
  }
  return readFile(path.resolve(source), "utf8");
}

async function writeAtomic(file, text) {
  const target = path.resolve(file);
  await mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.tmp`;
  await writeFile(temporary, text, "utf8");
  await rename(temporary, target);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function parseArgs(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (!key?.startsWith("--") || value == null) throw new Error(`Expected --name value, received ${key ?? "end of input"}`);
    const name = key.slice(2);
    if (!ALLOWED_OPTIONS.has(name)) throw new Error(`Unknown option ${key}`);
    parsed[toCamelCase(name)] = value;
  }
  return parsed;
}

function toCamelCase(value) {
  return value.replace(/-([a-z])/g, (_, character) => character.toUpperCase());
}
