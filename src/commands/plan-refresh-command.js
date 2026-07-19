import { writeFile } from "node:fs/promises";
import path from "node:path";
import { runPlanDashboard } from "./plan-dashboard-command.js";
import { buildRoutePlans } from "../planner.js";
import { loadPlanTrip, resolveFromPlan } from "../plans.js";
import { buildRefreshPlan } from "../refresh-plan.js";
import { executeRefreshPlan } from "../refresh-runner.js";
import { rankFlights } from "../scorer.js";
import { createSnapshot, importRankedSnapshot } from "../snapshots.js";
import { refreshSpendSummaryText } from "../dashboard-refresh-ux.js";
import { loadSavedPlans, writeAppIndex, writePlanListDashboard } from "../plan-list-dashboard.js";
import { writeRefreshLowdown } from "../refresh-summary.js";
import {
  aggregateCachedFlights,
  enrichFlights,
  requireMode,
  ROOT
} from "../cli-support.js";

export async function runPlanRefreshPlan(planPath, flags) {
  requireMode(flags);
  const { plan, planDir, trip } = await loadPlanTrip(planPath, ROOT);
  const refreshPlan = await buildRefreshPlan({ plan, trip, mode: flags.mode, root: ROOT, refresh: flags.refresh });
  const outputPath = resolveFromPlan(planDir, "last-refresh-plan.json");
  await writeFile(outputPath, `${JSON.stringify(refreshPlan, null, 2)}\n`);
  console.log(`${refreshPlan.mode} refresh: ${refreshPlan.selectedCallCount} selected searches.`);
  console.log(refreshSpendSummaryText(refreshPlan));
  console.log(`Why these searches: ${refreshPlan.explanation}`);
  if (refreshPlan.warnings.length) console.log(`Warnings: ${refreshPlan.warnings.join(" ")}`);
  console.log(`Wrote ${outputPath}`);
}

export async function runPlanRefresh(planPath, flags) {
  requireMode(flags);
  const { absolute, plan, planDir, trip } = await loadPlanTrip(planPath, ROOT);
  const refreshPlan = await buildRefreshPlan({ plan, trip, mode: flags.mode, root: ROOT, refresh: flags.refresh });

  if (flags.baselineRanked) {
    const rankedPath = path.resolve(ROOT, flags.baselineRanked);
    const snapshot = await importRankedSnapshot({ planDir, plan, rankedPath, refreshPlan });
    console.log(`Imported baseline snapshot ${snapshot.meta.id} from ${rankedPath}`);
    await runPlanDashboard(absolute, flags);
    return;
  }

  if (!flags.live) {
    console.log("Dry run only. Add --live to run the selected local FLI searches, or use --baseline-ranked to import existing ranked data.");
    console.log(`${refreshPlan.fliCallCount ?? 0} FLI search${(refreshPlan.fliCallCount ?? 0) === 1 ? "" : "es"} and ${refreshPlan.cacheHitCount ?? 0} fresh cache hit${(refreshPlan.cacheHitCount ?? 0) === 1 ? "" : "s"} selected.`);
    return;
  }

  let runSummary;
  try {
    runSummary = await executeRefreshPlan({
      refreshPlan,
      trip,
      root: ROOT,
      refresh: flags.refresh,
      maxRuns: flags.maxRuns,
      onEvent: (event) => {
        logRefreshEvent(event);
        flags.onEvent?.(event);
      }
    });
  } catch (error) {
    const failurePath = path.join(planDir, "last-refresh-error.json");
    await writeFile(failurePath, `${JSON.stringify({
      createdAt: new Date().toISOString(),
      planId: plan.id,
      mode: refreshPlan.mode,
      message: error.message,
      refreshPlan
    }, null, 2)}\n`);
    throw new Error(`Refresh failed. Wrote partial error report to ${failurePath}. ${error.message}`);
  }

  if (runSummary.skippedByMaxRuns > 0) console.log(`${runSummary.skippedByMaxRuns} searches skipped by --max-runs.`);
  console.log(`Searches used: ${runSummary.completedProviderSearches} fresh local search${runSummary.completedProviderSearches === 1 ? "" : "es"}, ${runSummary.cacheHits} saved-data hit${runSummary.cacheHits === 1 ? "" : "s"}.`);
  if ((runSummary.completedProviderSearches + runSummary.cacheHits) === 0 && runSummary.failedRuns > 0) {
    throw new Error(`Refresh produced no usable flight data. ${runSummary.failedRuns} local search${runSummary.failedRuns === 1 ? "" : "es"} failed.`);
  }

  const routePlans = buildRoutePlans(trip);
  // Only the refresh-selected searches are aggregated here. That keeps stale unrelated cache files from faking a successful snapshot.
  const rankedFlights = rankFlights(enrichFlights(await aggregateCachedFlights(trip, routePlans, { searches: refreshPlan.calls }), trip), trip);
  const snapshot = await createSnapshot({
    planDir,
    plan,
    refreshPlan: { ...refreshPlan, cacheHitCount: runSummary.cacheHits },
    rankedFlights,
    source: "live-refresh"
  });
  console.log(`Created snapshot ${snapshot.meta.id} with ${rankedFlights.length} ranked options.`);
  await runPlanDashboard(absolute, flags);
}

export async function runPlanRefreshSummary(flags, dependencies = {}) {
  const {
    root = ROOT,
    loadPlans = loadSavedPlans,
    refreshPlan = runPlanRefresh,
    writePlanList = writePlanListDashboard,
    writeIndex = writeAppIndex,
    writeLowdown = writeRefreshLowdown,
    log = console.log
  } = dependencies;
  const mode = flags.mode ?? "standard";
  const plans = (await loadPlans(root)).filter((item) => item.status.active);
  const refreshed = [];
  for (const item of plans) {
    await refreshPlan(item.planPath, { ...flags, mode, live: true, refresh: flags.refresh !== false });
    refreshed.push({ planPath: item.planPath, mode, refresh: flags.refresh !== false });
  }
  const outputDir = path.join(root, "outputs");
  await writePlanList({ root, outputPath: path.join(outputDir, "plans.dashboard.html") });
  await writeIndex({ root, outputPath: path.join(root, "index.html"), dashboardPrefix: "outputs/" });
  const refreshedPlans = await loadPlans(root);
  const summary = await writeLowdown({ root, plans: refreshedPlans, refreshed });
  log(`Wrote ${summary.outputPath}`);
  if (summary.topOption) {
    const flight = summary.topOption.flight;
    log(`Top practical option: ${summary.topOption.plan.name}, ${flight.departureAirport} -> ${flight.arrivalAirport}.`);
  }
  return summary;
}

function logRefreshEvent(event) {
  if (event.type === "cache-hit") console.log(`[${event.index + 1}/${event.total}] Using saved data for ${event.call.id}`);
  if (event.type === "run-start") console.log(`[${event.index + 1}/${event.total}] Running ${event.call.id}`);
  if (event.type === "provider-error") console.log(`[${event.index + 1}/${event.total}] Search failed for ${event.call.id}: ${event.error.message}`);
  if (event.type === "sleep") console.log(`Sleeping ${event.delay}ms before next local search.`);
}
