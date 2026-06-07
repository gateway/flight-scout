import { readFile } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { buildAtomicLegSearches, buildRoutePlans } from "./planner.js";
import { selectBatch } from "./batches.js";
import { providerCacheFiles } from "./providers/provider-cache.js";
import { PROVIDERS } from "./providers/provider-types.js";

// Builds a deterministic refresh manifest before any live search runs. The UI and skill use
// this to show exactly which local searches are needed and which cached results can be reused.

const DEFAULT_CONFIG = {
  requestDelayMs: 5000,
  staleAfterHours: 24,
  modes: {
    light: { maxCalls: 8 },
    standard: { maxCalls: 28 },
    "targeted-deep": { maxCalls: 42 },
    deep: { maxCalls: 60 }
  },
};

export async function loadRefreshBudget(root = process.cwd()) {
  const configPath = path.join(root, "config", "refresh-budget.json");
  if (!existsSync(configPath)) return DEFAULT_CONFIG;
  return { ...DEFAULT_CONFIG, ...JSON.parse(await readFile(configPath, "utf8")) };
}

export async function buildRefreshPlan({ plan, trip, mode = null, root = process.cwd(), refresh = false }) {
  const config = await loadRefreshBudget(root);
  const selectedMode = mode ?? plan.refreshPolicy?.defaultMode ?? "light";
  if (!config.modes[selectedMode]) throw new Error(`Unknown refresh mode "${selectedMode}".`);

  const routePlans = buildRoutePlans(trip);
  const atomicSearches = buildAtomicLegSearches(trip, routePlans);
  const catalog = dedupeById([...routePlans, ...atomicSearches]);
  const calls = selectCalls({ plan, mode: selectedMode, routePlans, catalog });
  const maxCalls = config.modes[selectedMode].maxCalls;
  const cappedRaw = calls.slice(0, maxCalls);
  const skippedRaw = calls.slice(maxCalls);
  const capped = cappedRaw.map((call, index) => {
    const cacheFiles = providerCacheFiles(root, call.id);
    const cacheStates = Object.fromEntries(Object.entries(cacheFiles).map(([providerId, cacheFile]) => [
      providerId,
      cacheState(cacheFile, plan.refreshPolicy?.staleAfterHours ?? config.staleAfterHours)
    ]));
    const provider = providerPlanForCall(call, cacheFiles, cacheStates, { refresh });
    const cacheFile = provider.cacheFile;
    const cache = provider.cache;
    return {
      order: index + 1,
      id: call.id,
      routeIdeaId: call.routeIdeaId,
      title: call.title,
      kind: call.kind,
      routeFamily: call.routeFamily ?? null,
      priority: call.priority ?? null,
      refreshReasons: call.refreshReasons ?? [],
      input: call.input,
      googleFlightsUrl: call.googleFlightsUrl,
      cacheFile,
      cache,
      provider
    };
  });
  const fliCallCount = capped.filter((call) => call.provider.fliLive).length;

  return {
    planId: plan.id,
    mode: selectedMode,
    generatedAt: new Date().toISOString(),
    provider: PROVIDERS.FLI,
    explanation: modeExplanation(selectedMode),
    requestDelayMs: trip.rules?.requestDelayMs ?? config.requestDelayMs,
    totalCandidateCalls: calls.length,
    selectedCallCount: capped.length,
    liveCallCount: 0,
    fliCallCount,
    cacheHitCount: capped.filter((call) => call.cache.fresh && !call.provider.fliLive).length,
    calls: capped,
    skippedCalls: skippedRaw.map((call) => ({
      id: call.id,
      routeIdeaId: call.routeIdeaId,
      title: call.title,
      reason: `${selectedMode} mode limits refreshes to ${maxCalls} searches`
    })),
    warnings: buildWarnings({ selectedMode, calls, capped })
  };
}

function providerPlanForCall(call, cacheFiles, cacheStates, { refresh = false } = {}) {
  const directOnly = call.input?.stops === "NON_STOP" || call.input?.max_stops === 0 || /direct|nonstop/i.test(call.title ?? "");
  const cache = cacheStates[PROVIDERS.FLI];
  return {
    primary: PROVIDERS.FLI,
    cacheFile: cacheFiles[PROVIDERS.FLI],
    cache,
    providerCaches: cacheStates,
    providerCacheFiles: cacheFiles,
    fliLive: refresh || !cache.fresh,
    directOnly,
    reason: "Use the local FLI provider for missing or stale searches."
  };
}

function selectCalls({ plan, mode, routePlans, catalog }) {
  const byId = new Map(catalog.map((item) => [item.id, item]));
  const selected = [];
  for (const routeIdea of plan.routeIdeas) {
    for (const id of routeIdea.focusSearchIds ?? []) {
      const item = byId.get(id);
      if (item) selected.push({ ...item, routeIdeaId: routeIdea.id, refreshReasons: ["decision-critical focus search"] });
    }
    if (mode !== "light") {
      for (const item of dateWindowCoreCalls(routeIdea, routePlans)) {
        selected.push({ ...item, routeIdeaId: routeIdea.id, refreshReasons: ["full date-window coverage"] });
      }
    }
  }
  for (const routeIdea of plan.routeIdeas) {
    if (mode !== "light") {
      for (const batch of routeIdea.batches ?? []) {
        for (const item of selectBatch(routePlans, batch)) {
          selected.push({ ...item, routeIdeaId: routeIdea.id, refreshReasons: [`route batch: ${batch}`] });
        }
      }
    }
  }
  if (mode === "targeted-deep") {
    for (const item of selectBatch(routePlans, "gateway-compare")) selected.push({ ...item, routeIdeaId: "targeted-gateway-compare", refreshReasons: ["gateway confidence"] });
  }
  if (mode === "deep") {
    for (const item of selectBatch(routePlans, "gateway-compare")) selected.push({ ...item, routeIdeaId: "deep-gateway-compare", refreshReasons: ["gateway confidence"] });
    for (const item of selectBatch(routePlans, "cheap-explorer")) selected.push({ ...item, routeIdeaId: "deep-cheap-explorer", refreshReasons: ["cheap explorer"] });
  }
  return dedupeById(selected);
}

function dateWindowCoreCalls(routeIdea, routePlans) {
  if (routeIdea.type === "direct-to-final") {
    return routePlans.filter((routePlan) => (
      routeMatchesIdea(routeIdea, routePlan) &&
      routePlan.kind === "one-way" &&
      routePlan.segments.length === 1 &&
      !hasIntentionalStopover(routePlan)
    ));
  }
  if (routeIdea.type?.includes("stopover") && routeIdea.stopover?.label) {
    return routePlans.filter((routePlan) => (
      routeMatchesIdea(routeIdea, routePlan) &&
      routePlan.kind === "multi-city" &&
      routePlan.stops.some((stop) => stop.label === routeIdea.stopover.label && stop.selectedNights > 0) &&
      routePlan.stops.every((stop) => stop.gateway || stop.label === routeIdea.stopover.label) &&
      !routePlan.stops.some((stop) => stop.gateway)
    ));
  }
  return [];
}

function routeMatchesIdea(routeIdea, routePlan) {
  if (routeIdea.originAirports?.length && !sharesAny(routePlan.segments[0]?.from?.airports, routeIdea.originAirports)) return false;
  if (routeIdea.destinationAirports?.length && !sharesAny(routePlan.segments.at(-1)?.to?.airports, routeIdea.destinationAirports)) return false;
  if (routeIdea.originAirports?.length || routeIdea.destinationAirports?.length) {
    return routeIdea.stopover?.label ? routePlan.stops.some((stop) => stop.label === routeIdea.stopover.label) : true;
  }
  const label = `${routeIdea.id} ${routeIdea.label}`.toLowerCase();
  const origin = routePlan.segments[0]?.from?.label?.toLowerCase() ?? "";
  if (label.includes("bangkok") && !origin.includes("bangkok")) return false;
  if (label.includes("chiang-mai") || label.includes("chiang mai")) {
    if (!origin.includes("chiang mai")) return false;
  }
  if (routeIdea.stopover?.label) {
    return routePlan.stops.some((stop) => stop.label === routeIdea.stopover.label);
  }
  const haystack = `${routePlan.id} ${routePlan.title} ${routePlan.routeFamily ?? ""}`.toLowerCase();
  return label
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2 && !["the", "and", "with"].includes(token))
    .every((token) => haystack.includes(token));
}

function sharesAny(left = [], right = []) {
  const values = new Set(left);
  return right.some((value) => values.has(value));
}

function hasIntentionalStopover(routePlan) {
  return routePlan.stops.some((stop) => !stop.gateway && stop.selectedNights > 0);
}

function dedupeById(items) {
  const byId = new Map();
  for (const item of items) {
    const existing = byId.get(item.id);
    if (!existing) {
      byId.set(item.id, { ...item, refreshReasons: [...new Set(item.refreshReasons ?? [])] });
      continue;
    }
    byId.set(item.id, {
      ...existing,
      refreshReasons: [...new Set([...(existing.refreshReasons ?? []), ...(item.refreshReasons ?? [])])]
    });
  }
  return [...byId.values()];
}

function cacheState(cacheFile, staleAfterHours) {
  if (!existsSync(cacheFile)) return { status: "missing", fresh: false, ageHours: null };
  const ageHours = (Date.now() - statSync(cacheFile).mtimeMs) / 36e5;
  return {
    status: ageHours <= staleAfterHours ? "fresh" : "stale",
    fresh: ageHours <= staleAfterHours,
    ageHours: Math.round(ageHours * 10) / 10
  };
}

function buildWarnings({ selectedMode, calls, capped }) {
  const warnings = [];
  if (calls.length > capped.length) warnings.push(`${calls.length - capped.length} candidate searches were held back by the ${selectedMode} mode cap.`);
  if (selectedMode === "deep") warnings.push("Deep mode is intentionally broad. Use it only when the plan changed or cached data is stale.");
  const stale = capped.filter((call) => call.cache.status === "stale").length;
  if (stale > 0) warnings.push(`${stale} selected cached searches are stale and should be refreshed before booking.`);
  return warnings;
}

function modeExplanation(mode) {
  if (mode === "light") return "Refresh only the route leads that are most likely to change the decision.";
  if (mode === "standard") return "Refresh the active date window and route ideas without broad gateway exploration.";
  if (mode === "targeted-deep") return "Refresh viable route families plus gateway comparisons without the full exploratory search space.";
  return "Refresh broad gateway and price-explorer routes when the decision is stale or the plan changed.";
}
