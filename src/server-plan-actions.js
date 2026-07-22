import { mkdir } from "node:fs/promises";
import path from "node:path";
import { runPlanRefresh } from "./commands/plan-refresh-command.js";
import { setPlanArchiveStatus } from "./plan-archive.js";
import { loadSavedPlans, writeAppIndex, writePlanListDashboard } from "./plan-list-dashboard.js";
import { writeRefreshLowdown } from "./refresh-summary.js";
import { extendPlanWindow as persistPlanWindowExtension } from "./plan-window-extension.js";
import { loadRefreshBudget } from "./refresh-budget.js";

// Plan actions own filesystem and refresh orchestration; HTTP concerns stay in the route module.
export function createPlanActions({ root }) {
  async function archivePlan(planPath, restore) {
    const { plan } = await setPlanArchiveStatus({ root, planPath, restore });
    return plan;
  }

  async function refreshSelection({ all, planPath, body = {}, onPlanStart = () => {}, onEvent = () => {} }) {
    const plans = all ? await activePlans() : [{ planPath }];
    const refreshed = [];
    for (const [index, item] of plans.entries()) {
      const progress = { planIndex: index + 1, planTotal: plans.length, planPath: item.planPath };
      onPlanStart(progress);
      refreshed.push(await refreshOnePlan(item.planPath, body, (event) => onEvent(event, progress)));
    }
    return refreshed;
  }

  async function activePlans() {
    return (await loadSavedPlans(root)).filter((item) => item.status.active);
  }

  async function regeneratePlanList() {
    const outputPath = path.join(root, "outputs", "plans.dashboard.html");
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writePlanListDashboard({ root, outputPath });
    await writeAppIndex({ root, outputPath: path.join(root, "index.html"), dashboardPrefix: "outputs/" });
  }

  async function writeLatestLowdown(refreshed) {
    const plans = await loadSavedPlans(root);
    return writeRefreshLowdown({ root, plans, refreshed });
  }

  async function extendPlanWindow(input) {
    const config = await loadRefreshBudget(root);
    return persistPlanWindowExtension({ root, maxWindowDays: config.maxWindowDays, ...input });
  }

  return { archivePlan, extendPlanWindow, refreshSelection, regeneratePlanList, writeLatestLowdown };
}

async function refreshOnePlan(planPath, body, onEvent) {
  const mode = safeRefreshMode(body.mode);
  const startedAt = new Date().toISOString();
  await runPlanRefresh(planPath, { mode, live: true, refresh: body.refresh !== false, onEvent });
  return { planPath, mode, refresh: body.refresh !== false, startedAt, finishedAt: new Date().toISOString() };
}

function safeRefreshMode(value) {
  return ["light", "standard", "targeted-deep", "deep"].includes(value) ? value : "standard";
}
