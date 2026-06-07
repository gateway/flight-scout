export const PROVIDERS = Object.freeze({
  FLI: "fli-google-flights"
});

export function providerCapabilities(overrides = {}) {
  return {
    optionalExternal: false,
    unofficial: false,
    supportsDateRange: false,
    supportsRoundTrip: false,
    supportsDirectFilter: false,
    ...overrides
  };
}

export function assertProviderSearch(searchRequest) {
  if (!searchRequest?.id) throw new Error("Provider search request is missing id.");
  if (!searchRequest?.input) throw new Error(`Provider search "${searchRequest.id}" is missing input.`);
  const input = searchRequest.input;
  for (const field of ["departure_id", "arrival_id", "outbound_date"]) {
    if (!input[field]) throw new Error(`Provider search "${searchRequest.id}" is missing ${field}.`);
  }
}
