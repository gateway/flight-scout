import { mkdir } from "node:fs/promises";
import path from "node:path";
import { writeIntentFiles } from "../intent.js";
import { createPlanFromText, loadPlanTrip } from "../plans.js";
import { buildRefreshPlan } from "../refresh-plan.js";
import { ROOT } from "../cli-support.js";

export async function runIntent(argv, flags) {
  const text = argv.join(" ").trim();
  if (!text) throw new Error("Intent text is required.");
  const outputPath = path.resolve(ROOT, flags.out ?? "outputs/last-intent.json");
  await mkdir(path.dirname(outputPath), { recursive: true });
  const result = await writeIntentFiles({ text, outputPath });
  console.log(JSON.stringify(result.interpreted, null, 2));
  console.log(`Wrote ${outputPath}`);
}

export async function runPlanNew(argv, flags) {
  const text = argv.join(" ").trim();
  const result = await createPlanFromText({ text, outputDir: flags.out, root: ROOT });
  const { plan, trip } = await loadPlanTrip(result.planPath, ROOT);
  const mode = flags.mode ?? plan.refreshPolicy?.defaultMode ?? "standard";
  const refreshPlan = await buildRefreshPlan({ plan, trip, mode, root: ROOT });
  const relativePlanPath = path.relative(ROOT, result.planPath);
  console.log("Interpreted plan:");
  console.log(JSON.stringify(result.plan, null, 2));
  console.log(`Created ${result.planPath}`);
  console.log("Search has not been run yet.");
  console.log(`Search check (${refreshPlan.mode}):`);
  console.log(`  I would check ${refreshPlan.selectedCallCount} date/route search${refreshPlan.selectedCallCount === 1 ? "" : "es"}.`);
  console.log(`  ${refreshPlan.cacheHitCount} can reuse saved data right now; ${(refreshPlan.fliCallCount ?? 0)} would need a fresh local search.`);
  console.log(`If this looks right, run: npm run plan:refresh -- ${relativePlanPath} --mode ${refreshPlan.mode} --live`);
}
