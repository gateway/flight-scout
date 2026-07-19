import test from "node:test";
import assert from "node:assert/strict";
import { selectBatch } from "../src/batches.js";
import { buildAtomicLegSearches, buildRoutePlans } from "../src/planner.js";

const trip = {
  name: "Test",
  departureWindow: { start: "2026-08-01", end: "2026-08-01" },
  origin: { label: "Chiang Mai", airports: ["CNX"] },
  destination: { label: "Redmond", airports: ["RDM"] },
  optionalStops: [
    { label: "Bangkok", airports: ["BKK", "DMK"], nights: [0, 1] },
    { label: "Tokyo", airports: ["HND", "NRT"], nights: [1, 2] }
  ],
  gatewayAirports: ["SEA"],
  routeModes: {
    includeOptionalStopCombinations: true,
    includeGatewaySplit: true
  }
};

test("buildRoutePlans expands optional stops and gateway splits", () => {
  const plans = buildRoutePlans(trip);
  assert.ok(plans.length > 4);
  assert.ok(plans.some((plan) => plan.title.includes("Bangkok 1n")));
  assert.ok(plans.some((plan) => plan.title.includes("Tokyo 2n")));
  assert.ok(plans.some((plan) => plan.kind === "gateway-split"));
});

test("buildAtomicLegSearches deduplicates repeated one-way segments", () => {
  const plans = buildRoutePlans(trip);
  const searches = buildAtomicLegSearches(trip, plans);
  const ids = new Set(searches.map((search) => search.id));
  assert.equal(ids.size, searches.length);
  assert.ok(searches.some((search) => search.title.includes("CNX -> RDM")));
});

test("buildRoutePlans keeps distinct one-way airport pairs after one-way input conversion", () => {
  const plans = buildRoutePlans({
    ...trip,
    alternateStarts: [{ label: "Bangkok start", airports: ["BKK", "DMK"] }]
  });
  assert.ok(plans.some((plan) => plan.input.departure_id === "CNX" && plan.input.arrival_id === "RDM"));
  assert.ok(plans.some((plan) => plan.input.departure_id === "BKK,DMK" && plan.input.arrival_id === "RDM"));
  assert.ok(plans.some((plan) => plan.googleFlightsUrl.includes("one+way+flights+from+BKK+to+RDM+departing")));
});

function genericTrip(overrides = {}) {
  return {
    name: "Generic route matrix",
    departureWindow: { start: "2026-09-23", end: "2026-09-23" },
    origin: { label: "London", airports: ["LHR"] },
    alternateStarts: [{ label: "Paris", airports: ["CDG"] }],
    destination: { label: "Sydney", airports: ["SYD"] },
    optionalStops: [{ label: "Reykjavik", airports: ["KEF"], nights: [1] }],
    gatewayAirports: ["JFK"],
    routeModes: {
      includeOptionalStopCombinations: true,
      includeGatewaySplit: true
    },
    ...overrides
  };
}

test("generic route expansion supports alternate starts, stopovers, and gateways", () => {
  const plans = buildRoutePlans(genericTrip());
  const paths = plans.map((plan) => plan.segments.map((segment) => (
    `${segment.from.airports[0]}-${segment.to.airports[0]}`
  )).join("|"));

  assert.equal(plans.length, 8);
  assert.ok(paths.includes("LHR-SYD"));
  assert.ok(paths.includes("CDG-SYD"));
  assert.ok(paths.includes("LHR-KEF|KEF-SYD"));
  assert.ok(paths.includes("CDG-JFK|JFK-SYD"));

  const primary = plans.find((plan) => plan.segments[0].from.airports.includes("LHR"));
  const alternate = plans.find((plan) => plan.segments[0].from.airports.includes("CDG"));
  const stopover = plans.find((plan) => plan.stops.some((stop) => stop.airports.includes("KEF")));
  const gateway = plans.find((plan) => plan.stops.some((stop) => stop.gateway));
  assert.equal(primary.segments[0].from.routeRole, "primary-origin");
  assert.equal(alternate.segments[0].from.routeRole, "alternate-start");
  assert.equal(stopover.stops.find((stop) => stop.airports.includes("KEF")).routeRole, "intentional-stopover");
  assert.equal(gateway.stops.find((stop) => stop.gateway).routeRole, "gateway");
});

test("planner topology replaces stale route-role metadata", () => {
  const plans = buildRoutePlans(genericTrip({
    origin: { label: "London", airports: ["LHR"], routeRole: "alternate-start" },
    alternateStarts: [{ label: "Paris", airports: ["CDG"], routeRole: "primary-origin" }],
    optionalStops: [{ label: "Reykjavik", airports: ["KEF"], nights: [1], routeRole: "gateway" }]
  }));
  const primary = plans.find((plan) => plan.segments[0].from.airports.includes("LHR"));
  const alternate = plans.find((plan) => plan.segments[0].from.airports.includes("CDG"));
  const stopover = plans.find((plan) => plan.stops.some((stop) => stop.airports.includes("KEF")));

  assert.equal(primary.segments[0].from.routeRole, "primary-origin");
  assert.equal(alternate.segments[0].from.routeRole, "alternate-start");
  assert.equal(stopover.stops.find((stop) => stop.airports.includes("KEF")).routeRole, "intentional-stopover");
});

test("generic stopovers have a distinct route family from direct routes", () => {
  const plans = buildRoutePlans(genericTrip());
  const direct = plans.find((plan) => plan.segments.length === 1 && plan.segments[0].from.airports[0] === "LHR");
  const stopover = plans.find((plan) => (
    plan.kind === "multi-city" && plan.stops.some((stop) => stop.airports.includes("KEF"))
  ));

  assert.ok(direct);
  assert.ok(stopover);
  assert.notEqual(stopover.routeFamily, direct.routeFamily);
});

test("route families depend on route topology instead of specific airports", () => {
  const plans = buildRoutePlans({
    ...trip,
    alternateStarts: [{ label: "Bangkok start", airports: ["BKK", "DMK"] }],
    gatewayAirports: [],
    routeModes: {
      includeOptionalStopCombinations: true,
      includeGatewaySplit: false
    }
  });
  const familyFor = (originAirport, stopAirports) => plans.find((plan) => (
    plan.segments[0].from.airports.includes(originAirport) &&
    plan.stops.length === stopAirports.length &&
    stopAirports.every((airport) => plan.stops.some((stop) => stop.airports.includes(airport)))
  ))?.routeFamily;

  assert.equal(familyFor("CNX", []), "direct-ish");
  assert.equal(familyFor("CNX", ["BKK"]), "stopover");
  assert.equal(familyFor("CNX", ["HND"]), "stopover");
  assert.equal(familyFor("CNX", ["BKK", "HND"]), "multiple-stopovers");
  assert.equal(familyFor("BKK", []), "direct-ish");
  assert.equal(familyFor("BKK", ["HND"]), "alternate-start-stopover");
});

test("generic fastest batch preserves the primary origin before alternate starts", () => {
  const plans = buildRoutePlans(genericTrip({
    origin: { label: "Paris", airports: ["CDG"] },
    alternateStarts: [{ label: "London", airports: ["LHR"] }],
    optionalStops: [],
    gatewayAirports: []
  }));
  const selectedOrigins = selectBatch(plans, "fastest").map((plan) => plan.segments[0].from.airports[0]);

  assert.deepEqual(selectedOrigins, ["CDG", "LHR"]);
});

test("generic gateway comparison preserves the user's gateway priority", () => {
  const plans = buildRoutePlans(genericTrip({
    alternateStarts: [],
    optionalStops: [],
    gatewayAirports: ["KEF", "JFK"]
  }));
  const selectedGateways = selectBatch(plans, "gateway-compare").map((plan) => (
    plan.stops.find((stop) => stop.gateway)?.airports[0]
  ));

  assert.deepEqual(selectedGateways, ["KEF", "JFK"]);
});

test("gateway routes remain unique when no optional stopovers are configured", () => {
  const plans = buildRoutePlans(genericTrip({
    alternateStarts: [],
    optionalStops: [],
    gatewayAirports: ["JFK"]
  }));

  assert.equal(plans.length, 2);
  assert.equal(new Set(plans.map((plan) => plan.id)).size, plans.length);
});

test("round trips expand into provider-compatible outbound and return one-way searches", () => {
  const roundTrip = genericTrip({
    tripType: "round-trip",
    departureWindow: { start: "2026-09-23", end: "2026-09-24" },
    returnWindow: { start: "2026-10-04", end: "2026-10-05" },
    alternateStarts: [],
    optionalStops: [],
    gatewayAirports: []
  });

  const plans = buildRoutePlans(roundTrip);
  const searches = buildAtomicLegSearches(roundTrip, plans);

  assert.deepEqual(
    plans.map((plan) => [plan.direction, plan.input.departure_id, plan.input.arrival_id, plan.input.outbound_date]),
    [
      ["outbound", "LHR", "SYD", "2026-09-23"],
      ["outbound", "LHR", "SYD", "2026-09-24"],
      ["return", "SYD", "LHR", "2026-10-04"],
      ["return", "SYD", "LHR", "2026-10-05"]
    ]
  );
  assert.equal(searches.length, 4);
  assert.ok(searches.every((search) => search.kind === "one-way"));
  assert.ok(searches.every((search) => search.input.outbound_date));
  assert.ok(searches.every((search) => !Object.hasOwn(search.input, "return_date")));
  assert.ok(searches.every((search) => !Object.hasOwn(search.input, "multi_city_json")));
});
