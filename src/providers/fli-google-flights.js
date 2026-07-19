import { executeFliSearch, FliProviderError } from "./fli-execution.js";
import { normalizeFliResults } from "./fli-normalization.js";
import { assertProviderSearch, providerCapabilities, PROVIDERS } from "./provider-types.js";

// Stable registry-facing facade. Execution and mapping remain internal provider concerns.
export { FliProviderError, normalizeFliResults };

export const fliGoogleFlightsProvider = {
  id: PROVIDERS.FLI,
  label: "Google Flights via fli",
  capabilities: providerCapabilities({
    unofficial: true,
    supportsDateRange: false,
    supportsRoundTrip: false,
    supportsDirectFilter: true
  }),
  estimate(searchRequest, context = {}) {
    const cached = searchRequest.cache?.fresh && !context.refresh;
    return {
      providerId: PROVIDERS.FLI,
      liveCalls: cached ? 0 : 1
    };
  },
  canRun(searchRequest) {
    try {
      assertProviderSearch(searchRequest);
      if (searchRequest.input.return_date) {
        return { ok: false, reason: "fli provider currently supports one-way searches only." };
      }
      return { ok: true };
    } catch (error) {
      return { ok: false, reason: error.message };
    }
  },
  async search(searchRequest, context = {}) {
    assertProviderSearch(searchRequest);
    const canRun = this.canRun(searchRequest);
    if (!canRun.ok) {
      throw new FliProviderError(canRun.reason, { code: "fli-unsupported-search" });
    }
    return executeFliSearch(searchRequest, context);
  },
  normalize(rawResult, searchRequest, context = {}) {
    return normalizeFliResults(
      context.searchMeta ?? searchRequest,
      rawResult.raw ?? rawResult,
      context.source ?? "live"
    );
  }
};
