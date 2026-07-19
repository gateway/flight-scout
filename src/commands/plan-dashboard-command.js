import path from "node:path";
import { setPlanArchiveStatus } from "../plan-archive.js";
import { writePlanDashboard } from "../dashboard.js";
import { buildRefreshPlan } from "../refresh-plan.js";
import { compareSnapshots } from "../snapshot-compare.js";
import { latestSnapshots, listSnapshots, loadSnapshot } from "../snapshots.js";
import { loadSnapshotPriceHistory } from "../snapshot-history.js";
import { loadPlan, loadPlanTrip } from "../plans.js";
import { refreshPlanListDashboard, ROOT, usage } from "../cli-support.js";

export async function runPlanCompare(planPath) {
  const { planDir } = await loadPlan(planPath, ROOT);
  const snapshots = await latestSnapshots(planDir, 2);
  const comparison = compareSnapshots(snapshots[0], snapshots[1]);
  console.log(comparison.summary);
  for (const change of comparison.changes.slice(0, 10)) {
    console.log(`${change.searchId}: ${formatPriceDelta(change)}`);
  }
}

function formatPriceDelta(change) {
  if (Number.isFinite(change.delta)) return `${change.delta > 0 ? "+" : ""}$${change.delta}`;
  if (change.direction === "new") return "new option";
  if (change.direction === "disappeared") return "no longer found";
  return "price movement unavailable";
}

export async function runPlanSnapshots(planPath) {
  const { planDir } = await loadPlan(planPath, ROOT);
  const dirs = await listSnapshots(planDir);
  if (dirs.length === 0) {
    console.log("No snapshots found.");
    return;
  }
  for (const dir of dirs) {
    const snapshot = await loadSnapshot(dir);
    console.log(`${snapshot.meta.id}: ${snapshot.meta.createdAt} · ${snapshot.meta.summary.completeOptions}/${snapshot.meta.summary.totalOptions} complete options · ${dir}`);
  }
}

export async function runPlanDashboard(planPath, flags = {}) {
  const { absolute, plan, planDir, trip } = await loadPlanTrip(planPath, ROOT);
  const snapshots = await latestSnapshots(planDir, 2);
  const snapshotHistory = await loadSnapshotPriceHistory(planDir, plan);
  const refreshPlan = await buildRefreshPlan({ plan, trip, mode: flags.mode, root: ROOT });
  const outputPath = path.resolve(ROOT, flags.out ?? path.join("outputs", `${plan.id}.dashboard.html`));
  await writePlanDashboard({ plan, planDir, trip, snapshots, snapshotHistory, refreshPlan, outputPath });
  await refreshPlanListDashboard(path.join(ROOT, "outputs", "plans.dashboard.html"));
  console.log(`Wrote ${outputPath}`);
  console.log(`Updated ${path.join(ROOT, "outputs", "plans.dashboard.html")}`);
  console.log(`Plan source: ${absolute}`);
}

export async function runPlanArchive(planPath, flags = {}) {
  if (!planPath) {
    usage();
    process.exit(1);
  }
  const { plan } = await setPlanArchiveStatus({ root: ROOT, planPath, restore: flags.restore });
  await refreshPlanListDashboard(path.join(ROOT, "outputs", "plans.dashboard.html"));
  console.log(`${flags.restore ? "Restored" : "Archived"} ${plan.name ?? plan.id}.`);
  console.log(`Updated ${path.join(ROOT, "outputs", "plans.dashboard.html")}`);
  console.log(`Updated ${path.join(ROOT, "index.html")}`);
}

export async function runPlanListDashboard(flags = {}) {
  const outputPath = path.resolve(ROOT, flags.out ?? path.join("outputs", "plans.dashboard.html"));
  await refreshPlanListDashboard(outputPath);
  console.log(`Wrote ${outputPath}`);
}
