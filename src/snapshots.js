import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

export function snapshotRoot(planDir) {
  return path.join(planDir, "snapshots");
}

export async function listSnapshots(planDir) {
  const root = snapshotRoot(planDir);
  if (!existsSync(root)) return [];
  const entries = await readdir(root, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(root, entry.name))
    .sort();
}

export async function loadSnapshot(snapshotDir) {
  const meta = JSON.parse(await readFile(path.join(snapshotDir, "snapshot.json"), "utf8"));
  const rankedFlights = JSON.parse(await readFile(path.join(snapshotDir, "ranked.json"), "utf8"));
  return { snapshotDir, meta, rankedFlights };
}

export async function latestSnapshots(planDir, count = 2) {
  const dirs = await listSnapshots(planDir);
  const latest = dirs.slice(-count).reverse();
  return Promise.all(latest.map((dir) => loadSnapshot(dir)));
}

export async function createSnapshot({ planDir, plan, refreshPlan, rankedFlights, source = "cache", notes = [] }) {
  const id = timestampId(new Date());
  const dir = path.join(snapshotRoot(planDir), id);
  const meta = {
    id,
    planId: plan.id,
    planName: plan.name,
    createdAt: new Date().toISOString(),
    source,
    refresh: refreshPlan
      ? {
          mode: refreshPlan.mode,
          selectedCallCount: refreshPlan.selectedCallCount,
          fliCallCount: refreshPlan.fliCallCount,
          liveCallCount: refreshPlan.liveCallCount,
          cacheHitCount: refreshPlan.cacheHitCount,
          warnings: refreshPlan.warnings
        }
      : null,
    summary: summarizeRanked(rankedFlights),
    notes
  };
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "snapshot.json"), `${JSON.stringify(meta, null, 2)}\n`);
  await writeFile(path.join(dir, "ranked.json"), `${JSON.stringify(rankedFlights, null, 2)}\n`);
  await writeFile(path.join(planDir, "latest-snapshot.json"), `${JSON.stringify({ snapshotDir: dir, ...meta }, null, 2)}\n`);
  return { snapshotDir: dir, meta, rankedFlights };
}

export async function importRankedSnapshot({ planDir, plan, rankedPath, refreshPlan = null }) {
  const rankedFlights = JSON.parse(await readFile(rankedPath, "utf8"));
  return createSnapshot({
    planDir,
    plan,
    refreshPlan,
    rankedFlights,
    source: "imported-ranked-json",
    notes: [`Imported from ${rankedPath}`]
  });
}

function summarizeRanked(rankedFlights) {
  const complete = rankedFlights.filter((flight) => flight.tripComplete !== false && flight.destinationComplete !== false);
  const cheapest = minBy(complete, (flight) => flight.scoring?.breakdown?.estimatedTotalCost ?? flight.price ?? Infinity);
  const fastest = minBy(complete, (flight) => flight.durationMinutes ?? Infinity);
  const balanced = complete[0] ?? rankedFlights[0] ?? null;
  return {
    totalOptions: rankedFlights.length,
    completeOptions: complete.length,
    balanced: summarizeFlight(balanced),
    cheapest: summarizeFlight(cheapest),
    fastest: summarizeFlight(fastest)
  };
}

function summarizeFlight(flight) {
  if (!flight) return null;
  return {
    searchId: flight.searchId,
    routeFamily: flight.routeFamily,
    title: flight.searchTitle,
    price: flight.price,
    estimatedTotalCost: flight.scoring?.breakdown?.estimatedTotalCost ?? flight.price ?? null,
    durationMinutes: flight.durationMinutes,
    duration: flight.duration,
    departureAirport: flight.departureAirport,
    arrivalAirport: flight.arrivalAirport,
    departureTime: flight.departureTime,
    arrivalTime: flight.arrivalTime,
    airline: flight.airline,
    googleFlightsUrl: flight.googleFlightsUrl
  };
}

function minBy(items, score) {
  return items.reduce((best, item) => (score(item) < score(best) ? item : best), items[0] ?? null);
}

function timestampId(date) {
  return date.toISOString().replace(/[-:]/g, "").replace(".", "-");
}
