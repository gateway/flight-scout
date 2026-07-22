import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { writePlanDashboard } from "./dashboard.js";
import { writeAppIndex, writePlanListDashboard } from "./plan-list-dashboard.js";
import { buildRefreshPlan } from "./refresh-plan.js";
import { loadSnapshotPriceHistory } from "./snapshot-history.js";
import { latestSnapshots } from "./snapshots.js";

// Rebuilds derived manifests and pages after a date-contract edit; it never calls a provider.
export async function rebuildPlanWindowArtifacts({ root, planPath, plan, trip, planDir }) {
  const snapshots = await latestSnapshots(planDir, 2);
  const snapshotHistory = await loadSnapshotPriceHistory(planDir, plan);
  const refreshPlan = await buildRefreshPlan({ plan, trip, root });
  await writeFile(path.join(planDir, "last-refresh-plan.json"), `${JSON.stringify(refreshPlan, null, 2)}\n`);

  const outputDir = path.join(root, "outputs");
  await mkdir(outputDir, { recursive: true });
  await writePlanDashboard({
    plan,
    planDir,
    trip,
    snapshots,
    snapshotHistory,
    refreshPlan,
    outputPath: path.join(outputDir, `${plan.id}.dashboard.html`)
  });
  await writePlanListDashboard({ root, outputPath: path.join(outputDir, "plans.dashboard.html") });
  await writeAppIndex({ root, outputPath: path.join(root, "index.html"), dashboardPrefix: "outputs/" });
  return { planPath, refreshPlan };
}
