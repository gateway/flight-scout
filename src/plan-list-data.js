import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { compareSnapshots } from "./snapshot-compare.js";
import { analyzeSnapshotDecision } from "./snapshot-decision.js";
import { buildPriceHistory } from "./price-history.js";

// Owns the read-only projection from persisted plans and snapshots to plan-list items.
export async function loadSavedPlans(root) {
  const plansDir = path.join(root, "plans");
  const plans = [];
  if (!existsSync(plansDir)) return plans;
  for (const entry of await readdir(plansDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const planPath = path.join(plansDir, entry.name, "plan.json");
    const latestPath = path.join(plansDir, entry.name, "latest-snapshot.json");
    if (!existsSync(planPath)) continue;
    const plan = JSON.parse(await readFile(planPath, "utf8"));
    const trip = await loadTrip(planPath, plan);
    const latest = existsSync(latestPath) ? await loadSnapshot(latestPath) : null;
    const previous = await loadPreviousSnapshot(path.join(plansDir, entry.name), latest?.id);
    plans.push({
      plan,
      trip,
      latest,
      previous,
      decision: analyzeSnapshotDecision({ plan, trip, latest }),
      comparison: compareSnapshots(latest, previous),
      priceHistory: await buildPriceHistory(path.join(plansDir, entry.name)),
      dashboardHref: `${plan.id}.dashboard.html`,
      planPath: `plans/${entry.name}/plan.json`,
      status: planStatus(plan)
    });
  }
  return plans.sort((a, b) => a.plan.name.localeCompare(b.plan.name));
}

async function loadTrip(planPath, plan) {
  if (!plan.tripSpecPath) return null;
  const tripPath = path.resolve(path.dirname(planPath), plan.tripSpecPath);
  return existsSync(tripPath) ? JSON.parse(await readFile(tripPath, "utf8")) : null;
}

async function loadSnapshot(snapshotPath) {
  const snapshot = JSON.parse(await readFile(snapshotPath, "utf8"));
  const localRankedPath = path.join(path.dirname(snapshotPath), "ranked.json");
  const rankedPath = snapshot.snapshotDir ? path.join(snapshot.snapshotDir, "ranked.json") : localRankedPath;
  if (rankedPath && existsSync(rankedPath)) {
    snapshot.rankedFlights = JSON.parse(await readFile(rankedPath, "utf8"));
  }
  return snapshot;
}

async function loadPreviousSnapshot(planDir, latestId) {
  const snapshotsDir = path.join(planDir, "snapshots");
  if (!existsSync(snapshotsDir)) return null;
  const ids = (await readdir(snapshotsDir, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((id) => id !== latestId)
    .sort()
    .reverse();
  for (const id of ids) {
    const snapshotPath = path.join(snapshotsDir, id, "snapshot.json");
    if (existsSync(snapshotPath)) return loadSnapshot(snapshotPath);
  }
  return null;
}

function planStatus(plan) {
  if (plan.archived || plan.status === "archived" || plan.hidden) return { active: false, label: "Archived" };
  const end = plan.intent?.dateCoverage?.end;
  if (end && end < todayDate()) return { active: false, label: "Past date" };
  return { active: true, label: "Active" };
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}
