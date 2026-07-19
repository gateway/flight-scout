import { loadRefreshBudget } from "./refresh-budget.js";
import { attachProviderCachePlans } from "./refresh-cache-plan.js";
import { buildRefreshWarnings, refreshModeExplanation } from "./refresh-plan-presentation.js";
import { capRefreshCalls, selectRefreshCalls } from "./refresh-selection.js";
import { PROVIDERS } from "./providers/provider-types.js";

// Public facade for the deterministic, provider-safe manifest shown before live searches.
export { loadRefreshBudget };

export async function buildRefreshPlan({ plan, trip, mode = null, root = process.cwd(), refresh = false }) {
  const config = await loadRefreshBudget(root);
  const selectedMode = mode ?? plan.refreshPolicy?.defaultMode ?? "light";
  if (!config.modes[selectedMode]) throw new Error(`Unknown refresh mode "${selectedMode}".`);

  const selection = selectRefreshCalls({ plan, trip, mode: selectedMode });
  const cappedSelection = capRefreshCalls(selection.calls, {
    mode: selectedMode,
    maxCalls: config.modes[selectedMode].maxCalls
  });
  const calls = attachProviderCachePlans(cappedSelection.calls, {
    root,
    staleAfterHours: plan.refreshPolicy?.staleAfterHours ?? config.staleAfterHours,
    refresh
  });

  return {
    planId: plan.id,
    mode: selectedMode,
    generatedAt: new Date().toISOString(),
    provider: PROVIDERS.FLI,
    explanation: refreshModeExplanation(selectedMode),
    requestDelayMs: trip.rules?.requestDelayMs ?? config.requestDelayMs,
    totalCandidateCalls: selection.calls.length,
    selectedCallCount: calls.length,
    fliCallCount: calls.filter((call) => call.provider.fliLive).length,
    cacheHitCount: calls.filter((call) => call.cache.fresh && !call.provider.fliLive).length,
    calls,
    skippedCalls: [...selection.skippedCalls, ...cappedSelection.skippedCalls],
    warnings: buildRefreshWarnings({ selectedMode, candidateCalls: selection.calls, selectedCalls: calls })
  };
}
