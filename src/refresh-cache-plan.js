import { existsSync, statSync } from "node:fs";
import { providerCacheFiles } from "./providers/provider-cache.js";
import { PROVIDERS } from "./providers/provider-types.js";

// Projects selected provider calls onto their current cache state without owning route selection.
export function attachProviderCachePlans(calls, { root, staleAfterHours, refresh = false }) {
  return calls.map((call, index) => {
    const cacheFiles = providerCacheFiles(root, call.id);
    const cacheStates = Object.fromEntries(Object.entries(cacheFiles).map(([providerId, cacheFile]) => [
      providerId,
      cacheState(cacheFile, staleAfterHours)
    ]));
    const provider = providerPlanForCall(call, cacheFiles, cacheStates, { refresh });
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
      cacheFile: provider.cacheFile,
      cache: provider.cache,
      provider
    };
  });
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

function cacheState(cacheFile, staleAfterHours) {
  if (!existsSync(cacheFile)) return { status: "missing", fresh: false, ageHours: null };
  const ageHours = (Date.now() - statSync(cacheFile).mtimeMs) / 36e5;
  return {
    status: ageHours <= staleAfterHours ? "fresh" : "stale",
    fresh: ageHours <= staleAfterHours,
    ageHours: Math.round(ageHours * 10) / 10
  };
}
