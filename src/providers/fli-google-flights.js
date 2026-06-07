import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { assertProviderSearch, providerCapabilities, PROVIDERS } from "./provider-types.js";

const ADAPTER_PATH = fileURLToPath(new URL("./fli/fli_search_adapter.py", import.meta.url));
const DEFAULT_LOCALE = Object.freeze({
  currency: "USD",
  language: "en-US",
  country: "US"
});

export class FliProviderError extends Error {
  constructor(message, { code = "fli-provider-error", detail = null } = {}) {
    super(message);
    this.name = "FliProviderError";
    this.code = code;
    this.detail = detail;
  }
}

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
    if (!canRun.ok) throw new FliProviderError(canRun.reason, { code: "fli-unsupported-search" });
    const payload = {
      id: searchRequest.id,
      input: searchRequest.input,
      maxResults: context.maxResults ?? 30,
      directOnly: context.directOnly ?? searchRequest.directOnly ?? false,
      currency: context.currency ?? searchRequest.currency ?? DEFAULT_LOCALE.currency,
      language: context.language ?? searchRequest.language ?? DEFAULT_LOCALE.language,
      country: context.country ?? searchRequest.country ?? DEFAULT_LOCALE.country
    };
    const python = context.pythonPath ?? process.env.FLI_PYTHON ?? "python3";
    try {
      const { stdout } = await runAdapterProcess({
        python,
        payload,
        adapterArgs: context.adapterArgs,
        timeoutMs: context.timeoutMs ?? 90_000,
        maxBuffer: context.maxBuffer ?? 1024 * 1024 * 8
      });
      const parsed = JSON.parse(stdout);
      if (!parsed.ok) {
        throw new FliProviderError(parsed.message ?? "fli provider search failed.", {
          code: parsed.code ?? "fli-search-failed",
          detail: parsed
        });
      }
      return { providerId: PROVIDERS.FLI, raw: parsed };
    } catch (error) {
      if (error instanceof FliProviderError) throw error;
      if (error.code === "ENOENT") {
        throw new FliProviderError(`Could not run ${python}. Install Python 3.11+ or set FLI_PYTHON.`, {
          code: "fli-python-missing"
        });
      }
      const stderr = String(error.stderr ?? "").trim();
      throw new FliProviderError(stderr || error.message, {
        code: "fli-adapter-failed",
        detail: { stderr, adapter: path.relative(process.cwd(), ADAPTER_PATH) }
      });
    }
  },
  normalize(rawResult, searchRequest, context = {}) {
    return normalizeFliResults(context.searchMeta ?? searchRequest, rawResult.raw ?? rawResult, context.source ?? "live");
  }
};

function runAdapterProcess({ python, payload, adapterArgs = null, timeoutMs, maxBuffer }) {
  return new Promise((resolve, reject) => {
    const child = spawn(python, adapterArgs ?? [ADAPTER_PATH], { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      const error = new Error(`fli adapter timed out after ${timeoutMs}ms.`);
      error.code = "ETIMEDOUT";
      error.stderr = stderr;
      reject(error);
    }, timeoutMs);

    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      if (stdout.length > maxBuffer) {
        child.kill("SIGTERM");
        const error = new Error("fli adapter output exceeded max buffer.");
        error.code = "ERR_CHILD_PROCESS_STDIO_MAXBUFFER";
        error.stderr = stderr;
        reject(error);
      }
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        const error = new Error(`fli adapter exited with code ${code}.`);
        error.code = code;
        error.stderr = stderr;
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });

    child.stdin.end(JSON.stringify(payload));
  });
}

export function normalizeFliResults(search, rawResult, source = "live") {
  const timestamp = rawResult.searchTimestamp ?? new Date().toISOString();
  return (rawResult.results ?? []).map((flight) => {
    const legs = (flight.legs ?? []).map(normalizeFliLeg);
    const layovers = normalizeFliLayovers(flight.layovers, legs);
    return {
    searchId: search.id,
    searchTitle: search.title,
    searchBatch: search.batch ?? null,
    routeFamily: search.routeFamily ?? null,
    googleFlightsUrl: googleFlightsUrlForFlight(search, flight),
    cacheFile: search.cacheFile ?? null,
    source,
    provider: PROVIDERS.FLI,
    providerCurrency: rawResult.currency ?? flight.currency ?? null,
    searchTimestamp: timestamp,
    bucket: "fli",
    price: numericPrice(flight.price),
    airline: flight.airline || null,
    departureAirport: flight.departureAirport ?? null,
    arrivalAirport: flight.arrivalAirport ?? null,
    expectedArrivalAirports: expectedArrivalAirports(search, flight),
    destinationComplete: expectedArrivalAirports(search, flight).includes(flight.arrivalAirport),
    tripStartComplete: tripStartAirports(search, flight).includes(flight.departureAirport),
    tripEndComplete: tripEndAirports(search, flight).includes(flight.arrivalAirport),
    tripComplete: true,
    departureTime: flight.departureTime ?? null,
    arrivalTime: flight.arrivalTime ?? null,
    duration: formatDuration(flight.durationMinutes),
    durationMinutes: flight.durationMinutes ?? null,
    stops: flight.stops ?? Math.max(0, legs.length - 1),
    legs,
    layovers,
    bookingToken: flight.bookingToken ?? null,
    raw: flight
  };
  }).map((flight) => ({
    ...flight,
    tripComplete: flight.tripStartComplete && flight.tripEndComplete
  }));
}

function expectedArrivalAirports(search, flight) {
  return nonEmptyAirports(
    search.segments?.at(-1)?.to?.airports,
    search.finalTripAirports,
    splitAirportCodes(search.input?.arrival_id),
    [flight.arrivalAirport]
  );
}

function tripStartAirports(search, flight) {
  return nonEmptyAirports(
    search.tripStartAirports,
    search.segments?.at(0)?.from?.airports,
    splitAirportCodes(search.input?.departure_id),
    [flight.departureAirport]
  );
}

function tripEndAirports(search, flight) {
  return nonEmptyAirports(
    search.finalTripAirports,
    search.segments?.at(-1)?.to?.airports,
    splitAirportCodes(search.input?.arrival_id),
    [flight.arrivalAirport]
  );
}

function nonEmptyAirports(...candidates) {
  for (const candidate of candidates) {
    const airports = (candidate ?? []).filter(Boolean);
    if (airports.length) return airports;
  }
  return [];
}

function splitAirportCodes(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  return value.split(",").map((code) => code.trim()).filter(Boolean);
}

function googleFlightsUrlForFlight(search, flight) {
  const from = flight.departureAirport;
  const to = flight.arrivalAirport;
  const date = dateOnly(flight.departureTime) ?? search.input?.outbound_date;
  if (!from || !to || !date) return search.googleFlightsUrl ?? null;
  const params = new URLSearchParams({
    hl: "en",
    curr: "USD",
    q: `one way flights from ${from} to ${to} departing ${date}`
  });
  return `https://www.google.com/travel/flights?${params.toString()}`;
}

function dateOnly(value) {
  if (typeof value !== "string") return null;
  return value.slice(0, 10);
}

function normalizeFliLeg(leg) {
  return {
    airline: leg.airlineName ?? leg.airline ?? null,
    flight_number: leg.flightNumber ?? null,
    duration: leg.durationMinutes ?? null,
    departure_airport: {
      id: leg.departureAirport ?? null,
      name: leg.departureAirportName ?? leg.departureAirport ?? null,
      time: leg.departureTime ?? null
    },
    arrival_airport: {
      id: leg.arrivalAirport ?? null,
      name: leg.arrivalAirportName ?? leg.arrivalAirport ?? null,
      time: leg.arrivalTime ?? null
    },
    airplane: leg.airplane ?? null,
    travel_class: leg.travelClass ?? null,
    extensions: leg.extensions ?? []
  };
}

function numericPrice(value) {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^0-9.]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeFliLayovers(layovers, legs) {
  const provided = (layovers ?? []).filter(Boolean).map((layover) => ({
    id: layover.id ?? layover.airport ?? null,
    name: layover.name ?? layover.airportName ?? layover.id ?? layover.airport ?? null,
    duration: layover.duration ?? layover.durationMinutes ?? null
  }));
  return provided.length ? provided : deriveLayoversFromLegs(legs);
}

function deriveLayoversFromLegs(legs) {
  const layovers = [];
  for (let index = 0; index < legs.length - 1; index += 1) {
    const current = legs[index];
    const next = legs[index + 1];
    const arrival = parseLocalDateTime(current.arrival_airport?.time);
    const departure = parseLocalDateTime(next.departure_airport?.time);
    const duration = arrival && departure ? Math.round((departure - arrival) / 60000) : null;
    layovers.push({
      id: current.arrival_airport?.id ?? next.departure_airport?.id ?? null,
      name: current.arrival_airport?.name ?? next.departure_airport?.name ?? null,
      duration: Number.isFinite(duration) && duration >= 0 ? duration : null
    });
  }
  return layovers;
}

function parseLocalDateTime(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.valueOf()) ? null : parsed;
}

function formatDuration(minutes) {
  if (!Number.isFinite(minutes)) return null;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours}h ${remainder}m`;
}
