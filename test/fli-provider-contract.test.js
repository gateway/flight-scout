import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import * as fliProviderModule from "../src/providers/fli-google-flights.js";

const search = {
  id: "lhr-syd-2026-09-10",
  title: "London to Sydney, depart 2026-09-10",
  batch: "fastest",
  routeFamily: "direct-ish",
  cacheFile: "cache/lhr-syd.json",
  googleFlightsUrl: "https://example.test/fallback",
  tripStartAirports: ["LHR"],
  finalTripAirports: ["SYD"],
  input: {
    departure_id: "LHR",
    arrival_id: "SYD",
    outbound_date: "2026-09-10"
  }
};

test("FLI provider facade keeps its three public exports", () => {
  assert.deepEqual(Object.keys(fliProviderModule).sort(), [
    "FliProviderError",
    "fliGoogleFlightsProvider",
    "normalizeFliResults"
  ]);
});

test("FLI normalization preserves the complete dashboard flight contract", () => {
  const rawFlight = {
    price: "$840",
    currency: "USD",
    airline: "Example Air",
    departureAirport: "LHR",
    arrivalAirport: "SYD",
    departureTime: "2026-09-10 09:00",
    arrivalTime: "2026-09-11 18:15",
    durationMinutes: 1215,
    stops: 1,
    bookingToken: "generic-token",
    legs: [{
      airlineName: "Example Air",
      flightNumber: "101",
      durationMinutes: 780,
      departureAirport: "LHR",
      departureAirportName: "London Heathrow Airport",
      departureTime: "2026-09-10 09:00",
      arrivalAirport: "SIN",
      arrivalAirportName: "Singapore Changi Airport",
      arrivalTime: "2026-09-11 05:00",
      airplane: "Boeing 787",
      travelClass: "Economy",
      extensions: ["Wi-Fi"]
    }, {
      airline: "Example Air",
      flightNumber: "202",
      durationMinutes: 375,
      departureAirport: "SIN",
      departureTime: "2026-09-11 06:00",
      arrivalAirport: "SYD",
      arrivalTime: "2026-09-11 18:15"
    }],
    layovers: [{ airport: "SIN", airportName: "Singapore Changi Airport", durationMinutes: 60 }]
  };

  assert.deepEqual(fliProviderModule.normalizeFliResults(search, {
    currency: "USD",
    searchTimestamp: "2026-07-17T00:00:00Z",
    results: [rawFlight]
  }, "cached"), [{
    searchId: "lhr-syd-2026-09-10",
    searchTitle: "London to Sydney, depart 2026-09-10",
    searchBatch: "fastest",
    routeFamily: "direct-ish",
    googleFlightsUrl: "https://www.google.com/travel/flights?hl=en&curr=USD&q=one+way+flights+from+LHR+to+SYD+departing+2026-09-10",
    cacheFile: "cache/lhr-syd.json",
    source: "cached",
    provider: "fli-google-flights",
    providerCurrency: "USD",
    searchTimestamp: "2026-07-17T00:00:00Z",
    bucket: "fli",
    price: 840,
    airline: "Example Air",
    departureAirport: "LHR",
    arrivalAirport: "SYD",
    expectedArrivalAirports: ["SYD"],
    destinationComplete: true,
    tripStartComplete: true,
    tripEndComplete: true,
    tripComplete: true,
    departureTime: "2026-09-10 09:00",
    arrivalTime: "2026-09-11 18:15",
    duration: "20h 15m",
    durationMinutes: 1215,
    stops: 1,
    legs: [{
      airline: "Example Air",
      flight_number: "101",
      duration: 780,
      departure_airport: {
        id: "LHR",
        name: "London Heathrow Airport",
        time: "2026-09-10 09:00"
      },
      arrival_airport: {
        id: "SIN",
        name: "Singapore Changi Airport",
        time: "2026-09-11 05:00"
      },
      airplane: "Boeing 787",
      travel_class: "Economy",
      extensions: ["Wi-Fi"]
    }, {
      airline: "Example Air",
      flight_number: "202",
      duration: 375,
      departure_airport: { id: "SIN", name: "SIN", time: "2026-09-11 06:00" },
      arrival_airport: { id: "SYD", name: "SYD", time: "2026-09-11 18:15" },
      airplane: null,
      travel_class: null,
      extensions: []
    }],
    layovers: [{
      id: "SIN",
      name: "Singapore Changi Airport",
      duration: 60,
      arrivalTime: "2026-09-11 05:00",
      departureTime: "2026-09-11 06:00",
      overnight: false
    }],
    bookingToken: "generic-token",
    raw: rawFlight
  }]);
});

test("FLI execution sends the established payload and returns the raw envelope", async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), "fli-contract-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const shim = path.join(directory, "provider-shim.mjs");
  await writeFile(shim, `let input = "";
process.stdin.on("data", chunk => input += chunk);
process.stdin.on("end", () => process.stdout.write(JSON.stringify({
  ok: true,
  received: JSON.parse(input),
  results: []
})));
`);

  const result = await fliProviderModule.fliGoogleFlightsProvider.search(
    { ...search, directOnly: true },
    { pythonPath: process.execPath, adapterArgs: [shim], maxResults: 12, directOnly: false }
  );

  assert.deepEqual(result, {
    providerId: "fli-google-flights",
    raw: {
      ok: true,
      received: {
        id: "lhr-syd-2026-09-10",
        input: search.input,
        maxResults: 12,
        directOnly: false,
        currency: "USD",
        language: "en-US",
        country: "US"
      },
      results: []
    }
  });
});

test("FLI execution preserves adapter-declared provider errors", async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), "fli-error-contract-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const shim = path.join(directory, "provider-error-shim.mjs");
  await writeFile(shim, `process.stdin.resume();
process.stdin.on("end", () => process.stdout.write(JSON.stringify({
  ok: false,
  code: "fli-upstream-rejected",
  message: "Upstream rejected the generic search."
})));
`);

  await assert.rejects(
    () => fliProviderModule.fliGoogleFlightsProvider.search(search, {
      pythonPath: process.execPath,
      adapterArgs: [shim]
    }),
    (error) => {
      assert.equal(error instanceof fliProviderModule.FliProviderError, true);
      assert.equal(error.code, "fli-upstream-rejected");
      assert.equal(error.message, "Upstream rejected the generic search.");
      assert.deepEqual(error.detail, {
        ok: false,
        code: "fli-upstream-rejected",
        message: "Upstream rejected the generic search."
      });
      return true;
    }
  );
});
