import path from "node:path";
import { PROVIDERS } from "./provider-types.js";

const CACHE_SUFFIXES = Object.freeze({
  [PROVIDERS.FLI]: ".fli.json"
});

export function providerCacheFile(root, searchId, providerId) {
  const suffix = CACHE_SUFFIXES[providerId];
  if (!suffix) throw new Error(`No cache suffix configured for provider "${providerId}".`);
  return path.join(root, "cache", `${searchId}${suffix}`);
}

export function providerCacheFiles(root, searchId) {
  return {
    [PROVIDERS.FLI]: providerCacheFile(root, searchId, PROVIDERS.FLI)
  };
}

export function providerCacheCandidates(root, searchId) {
  const files = providerCacheFiles(root, searchId);
  return [
    { providerId: PROVIDERS.FLI, cacheFile: files[PROVIDERS.FLI] }
  ];
}
