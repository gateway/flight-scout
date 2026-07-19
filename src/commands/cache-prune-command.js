import { CACHE_PRUNE_CONFIRMATION, pruneProviderCache } from "../cache-pruning.js";
import { ROOT } from "../cli-support.js";

const DEFAULT_MAX_AGE_DAYS = 30;

// Presents cache cleanup as an inspect-first operation. Destructive behavior
// remains owned by cache-pruning.js and cannot be enabled by this wrapper alone.
export async function runCachePrune(flags, {
  root = ROOT,
  log = console.log,
  now = new Date()
} = {}) {
  const olderThanDays = flags.olderThanDays ?? DEFAULT_MAX_AGE_DAYS;
  const report = await pruneProviderCache({
    root,
    olderThanDays,
    now,
    apply: flags.apply,
    confirmation: flags.confirmation
  });
  log(report.mode === "apply" ? "Cache prune complete." : "Cache prune dry run.");
  log(`${report.eligible.length} stale cache ${plural(report.eligible.length, "file")} eligible.`);
  log(`${report.protected.length} ${plural(report.protected.length, "file")} protected by active plan dates.`);
  log(`${report.skipped.length} ${plural(report.skipped.length, "file")} skipped by safety checks.`);
  if (report.mode === "apply") {
    log(`${report.deleted.length} stale cache ${plural(report.deleted.length, "file")} deleted.`);
  } else {
    log("Nothing was deleted.");
    if (report.eligible.length > 0) {
      log(`Review the list, then rerun with --apply --confirm "${CACHE_PRUNE_CONFIRMATION}".`);
    }
  }
  for (const item of report.eligible) log(`- ${item.relativePath} (${item.ageDays} days old)`);
  return report;
}

function plural(count, singular) {
  return count === 1 ? singular : `${singular}s`;
}
