import path from "node:path";
import { ROOT } from "../cli-support.js";
import { DEFAULT_SCHEDULE_JITTER_MS, runScheduledRefresh } from "../scheduled-refresh.js";
import { runPlanRefreshSummary } from "./plan-refresh-command.js";

// CLI adapter for one opt-in scheduled pass. Cron supplies repetition; the app
// deliberately exits after this single cache-aware active-plan refresh.
export async function runPlanScheduledRefresh(flags, dependencies = {}) {
  const {
    root = ROOT,
    runScheduled = runScheduledRefresh,
    refreshSummary = runPlanRefreshSummary,
    log = console.log
  } = dependencies;
  const result = await runScheduled({
    lockPath: path.join(root, "work", "scheduled-refresh.lock"),
    jitterMaxMs: flags.jitterMs ?? DEFAULT_SCHEDULE_JITTER_MS,
    runRefresh: () => refreshSummary({ ...flags, refresh: false })
  });
  if (result.status === "skipped-overlap") {
    log("Skipped scheduled refresh because another scheduled run is active.");
    return result;
  }
  log(`Scheduled refresh completed after ${result.jitterMs}ms jitter.`);
  return result;
}
