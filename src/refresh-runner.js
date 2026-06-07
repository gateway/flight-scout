import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { providerRegistry } from "./providers/provider-registry.js";
import { PROVIDERS } from "./providers/provider-types.js";

// Executes a refresh manifest one search at a time so local FLI calls remain throttled,
// cacheable, and easy to report back to the dashboard.

export async function executeRefreshPlan({ refreshPlan, trip, root = process.cwd(), refresh = false, maxRuns = null, onEvent = () => {} }) {
  await mkdir(path.join(root, "cache"), { recursive: true });
  const runnable = Number.isFinite(maxRuns) ? refreshPlan.calls.slice(0, maxRuns) : refreshPlan.calls;
  let liveRuns = 0;
  let fliRuns = 0;
  let failedRuns = 0;
  for (const [index, call] of runnable.entries()) {
    if (call.cache.fresh && !refresh) {
      onEvent({ type: "cache-hit", index, total: runnable.length, call });
      continue;
    }
    onEvent({ type: "run-start", index, total: runnable.length, call });
    const results = await runProviderPlan({ call, trip, refreshPlan, refresh, onEvent, index, total: runnable.length });
    fliRuns += results.filter((result) => result.providerId === PROVIDERS.FLI && result.ok).length;
    failedRuns += results.filter((result) => !result.ok).length;
    if (index < runnable.length - 1) {
      const delay = trip.rules?.requestDelayMs ?? refreshPlan.requestDelayMs ?? 5000;
      onEvent({ type: "sleep", delay, index, total: runnable.length, call });
      await sleep(delay);
    }
  }
  return {
    liveRuns: 0,
    fliRuns,
    failedRuns,
    cacheHits: runnable.filter((call) => call.cache.fresh && !refresh).length,
    selectedRuns: runnable.length,
    skippedByMaxRuns: refreshPlan.calls.length - runnable.length
  };
}

async function runProviderPlan({ call, trip, refreshPlan, refresh, onEvent, index, total }) {
  const providerIds = [call.provider?.primary ?? PROVIDERS.FLI];
  if (call.provider?.compareWith) providerIds.push(call.provider.compareWith);
  const results = [];
  for (const providerId of providerIds) {
    const cache = call.provider?.providerCaches?.[providerId] ?? call.cache;
    if (cache?.fresh && !refresh) {
      onEvent({ type: "provider-cache-hit", index, total, call, providerId });
      continue;
    }
    try {
      await runSingleProvider({ call, trip, refreshPlan, providerId });
      results.push({ providerId, ok: true });
    } catch (error) {
      results.push({ providerId, ok: false, message: error.message });
      onEvent({ type: "provider-error", index, total, call, providerId, error });
    }
  }
  return results;
}

async function runSingleProvider({ call, trip, refreshPlan, providerId }) {
  const provider = providerRegistry.get(providerId);
  const searchRequest = { ...call, directOnly: call.provider?.directOnly };
  const result = await provider.search(searchRequest, {
    directOnly: call.provider?.directOnly,
    maxResults: trip.rules?.providerMaxResults ?? 50
  });
  const cacheFile = call.provider?.providerCacheFiles?.[providerId] ?? call.cacheFile;
  await writeFile(cacheFile, JSON.stringify(result.raw, null, 2));
  return result.raw;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
