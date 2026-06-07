import { existsSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { buildAtomicLegSearches } from "./planner.js";
import { providerCacheCandidates } from "./providers/provider-cache.js";
import { flattenProviderResults, providerIdFromRawResult } from "./providers/provider-normalize.js";
import { writeAppIndex, writePlanListDashboard } from "./plan-list-dashboard.js";

export const ROOT = process.cwd();

export async function loadDotEnv() {
  const envPath = path.join(ROOT, ".env");
  if (!existsSync(envPath)) return;
  const text = await readFile(envPath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const equals = trimmed.indexOf("=");
    if (equals === -1) continue;
    const key = trimmed.slice(0, equals).trim();
    const value = trimmed.slice(equals + 1).trim().replace(/^["']|["']$/g, "");
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

export function usage() {
  console.log(`Usage:
  npm run intent -- "Find me the fastest route from Chiang Mai or Bangkok to Redmond Aug 1-5"
  npm run plan:new -- "One-way from Chiang Mai to Bangkok around August 1 plus or minus 3 days"
  npm run plan:refresh-plan -- plans/flights-home-august-2026/plan.json --mode light
  npm run plan:refresh -- plans/flights-home-august-2026/plan.json --mode light --live
  npm run plan:snapshots -- plans/flights-home-august-2026/plan.json
  npm run plan:dashboard -- plans/flights-home-august-2026/plan.json
  npm run plan:archive -- plans/flights-home-august-2026/plan.json
  npm run plan:archive -- plans/flights-home-august-2026/plan.json --restore
  npm run plan:list-dashboard

Flags:
  --live           Run selected local FLI searches. Without this, refresh commands preview only.
  --max-runs N     Hard cap local FLI searches.
  --refresh        Rerun cached searches.
  --force          Alias for --refresh.
  --allow-broad    Allow broad live all-plan searches.
  --out FILE       Output path for intent JSON.
  --mode NAME      Plan refresh mode: light, standard, targeted-deep, or deep.
  --baseline-ranked FILE
                  Import an existing ranked JSON file as a plan snapshot.
`);
}

export function parseArgs(argv) {
  const [command, ...tokens] = argv;
  const flags = {
    live: false,
    limit: null,
    maxRuns: null,
    batch: null,
    refresh: false,
    allowBroad: false,
    atomic: false,
    out: null,
    mode: null,
    baselineRanked: null,
    restore: false,
    positionals: []
  };
  for (let i = 0; i < tokens.length; i += 1) {
    if (tokens[i] === "--live") flags.live = true;
    else if (tokens[i] === "--refresh") flags.refresh = true;
    else if (tokens[i] === "--force") flags.refresh = true;
    else if (tokens[i] === "--allow-broad") flags.allowBroad = true;
    else if (tokens[i] === "--atomic") flags.atomic = true;
    else if (tokens[i] === "--restore") flags.restore = true;
    else if (tokens[i] === "--out") {
      flags.out = tokens[i + 1];
      i += 1;
    } else if (tokens[i] === "--mode") {
      flags.mode = tokens[i + 1];
      i += 1;
    } else if (tokens[i] === "--baseline-ranked") {
      flags.baselineRanked = tokens[i + 1];
      i += 1;
    } else if (tokens[i] === "--batch") {
      flags.batch = tokens[i + 1];
      i += 1;
    } else if (tokens[i] === "--limit") {
      flags.limit = Number(tokens[i + 1]);
      i += 1;
    } else if (tokens[i] === "--max-runs") {
      flags.maxRuns = Number(tokens[i + 1]);
      i += 1;
    } else {
      flags.positionals.push(tokens[i]);
    }
  }
  const [tripPath] = flags.positionals;
  return { command, tripPath, flags };
}

export async function loadTrip(tripPath) {
  if (!tripPath) {
    usage();
    process.exit(1);
  }
  const absolute = path.resolve(ROOT, tripPath);
  return { absolute, trip: JSON.parse(await readFile(absolute, "utf8")) };
}

export function baseName(tripPath) {
  return path.basename(tripPath).replace(/\.[^.]+$/, "");
}

export function requireMode(flags) {
  if (!flags.mode) throw new Error("Plan refresh commands require explicit --mode light, --mode standard, --mode targeted-deep, or --mode deep.");
}

export function enrichFlights(flights, trip) {
  const hotelEstimates = trip.rules?.hotelNightEstimate ?? {};
  return flights.map((flight) => {
    const searchTitle = flight.searchTitle ?? "";
    let estimatedHotelCost = 0;
    for (const [city, cost] of Object.entries(hotelEstimates)) {
      const match = searchTitle.match(new RegExp(`${city} (\\d+)n`, "i"));
      if (match) estimatedHotelCost += Number(match[1]) * cost;
    }
    return { ...flight, estimatedHotelCost, estimatedTransferCost: 0 };
  });
}

// Normalize cached provider outputs through one path so command modules do not duplicate provider-specific cache rules.
export async function aggregateCachedFlights(trip, routePlans, { searches = null } = {}) {
  const flights = [];
  const selectedSearches = searches ?? [...routePlans, ...buildAtomicLegSearches(trip, routePlans)];
  const seen = new Set();
  for (const item of selectedSearches) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    for (const candidate of providerCacheCandidates(ROOT, item.id)) {
      if (!existsSync(candidate.cacheFile)) continue;
      const result = JSON.parse(await readFile(candidate.cacheFile, "utf8"));
      const actualProviderId = providerIdFromRawResult(result);
      const canonicalFileExists = providerCacheCandidates(ROOT, item.id)
        .some((other) => other.providerId === actualProviderId && other.cacheFile !== candidate.cacheFile && existsSync(other.cacheFile));
      if (actualProviderId !== candidate.providerId && canonicalFileExists) continue;
      flights.push(...flattenProviderResults({
        ...item,
        batch: null,
        finalTripAirports: trip.destination.airports,
        tripStartAirports: tripStartAirports(trip),
        cacheFile: candidate.cacheFile
      }, result, "cached"));
    }
  }
  return flights;
}

export async function refreshPlanListDashboard(outputPath) {
  await writePlanListDashboard({ root: ROOT, outputPath });
  if (path.basename(outputPath) === "plans.dashboard.html") {
    await writeAppIndex({
      root: ROOT,
      outputPath: path.join(ROOT, "index.html"),
      dashboardPrefix: `${path.dirname(path.relative(ROOT, outputPath))}/`
    });
  }
}

export async function ensureOutputDir() {
  await mkdir(path.join(ROOT, "outputs"), { recursive: true });
}

function tripStartAirports(trip) {
  return [trip.origin, ...(trip.alternateStarts ?? [])].flatMap((item) => item.airports ?? []);
}
