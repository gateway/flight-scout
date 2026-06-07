import { normalizeFliResults } from "./fli-google-flights.js";
import { PROVIDERS } from "./provider-types.js";

export function providerIdFromRawResult(rawResult) {
  if (rawResult?.provider === PROVIDERS.FLI || rawResult?.providerId === PROVIDERS.FLI) return PROVIDERS.FLI;
  return PROVIDERS.FLI;
}

export function flattenProviderResults(search, rawResult, source = "cached") {
  return normalizeFliResults(search, rawResult, source);
}
