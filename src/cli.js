#!/usr/bin/env node
import { loadDotEnv, parseArgs, usage } from "./cli-support.js";
import { runIntent, runPlanNew } from "./commands/intent-command.js";
import {
  runPlanArchive,
  runPlanCompare,
  runPlanDashboard,
  runPlanListDashboard,
  runPlanSnapshots
} from "./commands/plan-dashboard-command.js";
import { runPlanRefresh, runPlanRefreshPlan } from "./commands/plan-refresh-command.js";

// Small command router for saved-plan workflows. Keep individual command behavior in
// `src/commands/*` so this file stays as orchestration only.

const { command, tripPath, flags } = parseArgs(process.argv.slice(2));

try {
  await loadDotEnv();
  if (command === "plan:new") {
    await runPlanNew(flags.positionals, flags);
  } else if (command === "plan:refresh-plan") {
    await runPlanRefreshPlan(tripPath, flags);
  } else if (command === "plan:refresh") {
    await runPlanRefresh(tripPath, flags);
  } else if (command === "plan:compare") {
    await runPlanCompare(tripPath);
  } else if (command === "plan:snapshots") {
    await runPlanSnapshots(tripPath);
  } else if (command === "plan:dashboard") {
    await runPlanDashboard(tripPath, flags);
  } else if (command === "plan:archive") {
    await runPlanArchive(tripPath, flags);
  } else if (command === "plan:list-dashboard") {
    await runPlanListDashboard(flags);
  } else if (command === "intent") {
    await runIntent(process.argv.slice(3), flags);
  } else {
    usage();
    process.exit(1);
  }
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
