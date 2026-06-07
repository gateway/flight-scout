import { fliGoogleFlightsProvider } from "./fli-google-flights.js";

const DEFAULT_PROVIDERS = [
  fliGoogleFlightsProvider
];

export function createProviderRegistry(providers = DEFAULT_PROVIDERS) {
  const byId = new Map();
  for (const provider of providers) {
    if (!provider?.id) throw new Error("Provider is missing id.");
    if (byId.has(provider.id)) throw new Error(`Duplicate provider id "${provider.id}".`);
    byId.set(provider.id, provider);
  }
  return {
    list: () => [...byId.values()],
    has: (id) => byId.has(id),
    get: (id) => {
      const provider = byId.get(id);
      if (!provider) throw new Error(`Unknown flight data provider "${id}".`);
      return provider;
    }
  };
}

export const providerRegistry = createProviderRegistry();
