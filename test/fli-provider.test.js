import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fliGoogleFlightsProvider, normalizeFliResults } from "../src/providers/fli-google-flights.js";

const search = {
  id: "one-way-cnx-bkk-dmk-2026-08-01",
  title: "Chiang Mai -> Bangkok, depart 2026-08-01",
  routeFamily: "direct-ish",
  googleFlightsUrl: "https://www.google.com/travel/flights",
  segments: [{
    from: { airports: ["CNX"] },
    to: { airports: ["BKK", "DMK"] },
    date: "2026-08-01"
  }],
  input: {
    departure_id: "CNX",
    arrival_id: "BKK,DMK",
    outbound_date: "2026-08-01"
  }
};

test("normalizes fli provider output into the dashboard flight shape", async () => {
  const raw = JSON.parse(await readFile(new URL("./fixtures/fli/search-result.json", import.meta.url), "utf8"));
  const flights = normalizeFliResults(search, raw, "cached");

  assert.equal(flights.length, 1);
  assert.equal(flights[0].source, "cached");
  assert.equal(flights[0].provider, "fli-google-flights");
  assert.equal(flights[0].providerCurrency, "THB");
  assert.equal(flights[0].price, 1695);
  assert.equal(flights[0].duration, "1h 10m");
  assert.equal(flights[0].departureAirport, "CNX");
  assert.equal(flights[0].arrivalAirport, "DMK");
  assert.equal(flights[0].tripComplete, true);
  assert.equal(flights[0].legs[0].flight_number, "519");
});

test("normalizes refresh-plan searches without segment metadata", async () => {
  const raw = {
    currency: "USD",
    searchTimestamp: "2026-06-04T00:00:00Z",
    results: [{
      price: "$584",
      airline: "AS + CI",
      departureAirport: "BKK",
      arrivalAirport: "RDM",
      departureTime: "2026-08-04T17:30:00",
      arrivalTime: "2026-08-04T23:59:00",
      durationMinutes: 1229,
      stops: 2,
      legs: []
    }]
  };
  const refreshPlanSearch = {
    id: "bangkok-no-intentional-stopover-rdm-2026-08-04",
    title: "Bangkok -> RDM, no intentional stopover, depart 2026-08-04",
    input: {
      departure_id: "BKK,DMK",
      arrival_id: "RDM",
      outbound_date: "2026-08-04"
    }
  };
  const flights = normalizeFliResults(refreshPlanSearch, raw, "cached");

  assert.deepEqual(flights[0].expectedArrivalAirports, ["RDM"]);
  assert.equal(flights[0].destinationComplete, true);
  assert.equal(flights[0].tripStartComplete, true);
  assert.equal(flights[0].tripEndComplete, true);
  assert.equal(flights[0].tripComplete, true);
});

test("uses the returned airport pair for Google Flights links in multi-airport searches", () => {
  const raw = {
    currency: "USD",
    searchTimestamp: "2026-06-04T00:00:00Z",
    results: [{
      price: "$798",
      airline: "AS",
      departureAirport: "NRT",
      arrivalAirport: "RDM",
      departureTime: "2026-07-30T18:00:00",
      arrivalTime: "2026-07-30T17:09:00",
      durationMinutes: 909,
      stops: 1,
      legs: []
    }]
  };
  const multiAirportSearch = {
    id: "tokyo-rdm-2026-07-30",
    title: "Tokyo -> Redmond/Bend, depart 2026-07-30",
    input: {
      departure_id: "HND,NRT",
      arrival_id: "RDM",
      outbound_date: "2026-07-30"
    }
  };
  const [flight] = normalizeFliResults(multiAirportSearch, raw, "cached");

  assert.match(flight.googleFlightsUrl, /from\+NRT\+to\+RDM/);
  assert.doesNotMatch(flight.googleFlightsUrl, /from\+HND\+to\+RDM/);
});

test("derives layovers from fli legs when provider omits layover objects", () => {
  const raw = {
    currency: "USD",
    searchTimestamp: "2026-06-04T00:00:00Z",
    results: [{
      price: "$584",
      airline: "AS + CI",
      departureAirport: "BKK",
      arrivalAirport: "RDM",
      departureTime: "2026-08-04T17:30:00",
      arrivalTime: "2026-08-04T23:59:00",
      durationMinutes: 1229,
      stops: 2,
      layovers: [],
      legs: [
        {
          airlineName: "CI",
          flightNumber: "836",
          durationMinutes: 215,
          departureAirport: "BKK",
          departureAirportName: "Suvarnabhumi Airport",
          arrivalAirport: "TPE",
          arrivalAirportName: "Taiwan Taoyuan International Airport",
          departureTime: "2026-08-04 17:30",
          arrivalTime: "2026-08-04 22:05"
        },
        {
          airlineName: "CI",
          flightNumber: "22",
          durationMinutes: 675,
          departureAirport: "TPE",
          departureAirportName: "Taiwan Taoyuan International Airport",
          arrivalAirport: "SEA",
          arrivalAirportName: "Seattle-Tacoma International Airport",
          departureTime: "2026-08-04 23:30",
          arrivalTime: "2026-08-04 19:45"
        },
        {
          airlineName: "AS",
          flightNumber: "2094",
          durationMinutes: 66,
          departureAirport: "SEA",
          departureAirportName: "Seattle-Tacoma International Airport",
          arrivalAirport: "RDM",
          arrivalAirportName: "Roberts Field",
          departureTime: "2026-08-04 22:53",
          arrivalTime: "2026-08-04 23:59"
        }
      ]
    }]
  };
  const [flight] = normalizeFliResults({
    id: "bkk-rdm-2026-08-04",
    title: "Bangkok -> RDM",
    input: { departure_id: "BKK", arrival_id: "RDM", outbound_date: "2026-08-04" }
  }, raw, "cached");

  assert.equal(flight.stops, 2);
  assert.deepEqual(flight.layovers.map((layover) => [layover.id, layover.duration]), [["TPE", 85], ["SEA", 188]]);
  assert.deepEqual(flight.layovers.map((layover) => [layover.arrivalTime, layover.departureTime]), [
    ["2026-08-04 22:05", "2026-08-04 23:30"],
    ["2026-08-04 19:45", "2026-08-04 22:53"]
  ]);
  assert.deepEqual(flight.layovers.map((layover) => layover.overnight), [false, false]);
});

test("fli provider reports unsupported round trips before running Python", () => {
  const result = fliGoogleFlightsProvider.canRun({
    ...search,
    input: { ...search.input, return_date: "2026-08-05" }
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /one-way/);
});

test("fli provider reports missing Python as a setup issue", async () => {
  await assert.rejects(
    () => fliGoogleFlightsProvider.search(search, { pythonPath: "/definitely/missing/python" }),
    (error) => {
      assert.equal(error.code, "fli-python-missing");
      assert.match(error.message, /Install Python|FLI_PYTHON/);
      return true;
    }
  );
});

test("fli provider requests USD locale by default", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "fli-payload-"));
  const shim = path.join(dir, "python-shim.mjs");
  await writeFile(shim, `#!/usr/bin/env node
let input = "";
process.stdin.on("data", (chunk) => input += chunk);
process.stdin.on("end", () => {
  const payload = JSON.parse(input);
  process.stdout.write(JSON.stringify({
    ok: true,
    provider: "fli-google-flights",
    currency: payload.currency,
    language: payload.language,
    country: payload.country,
    searchTimestamp: "2026-06-04T00:00:00Z",
    results: []
  }));
});
`);
  const result = await fliGoogleFlightsProvider.search(search, { pythonPath: process.execPath, adapterArgs: [shim] });
  assert.equal(result.raw.currency, "USD");
  assert.equal(result.raw.language, "en-US");
  assert.equal(result.raw.country, "US");
  await rm(dir, { recursive: true, force: true });
});
