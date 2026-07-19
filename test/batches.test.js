import test from "node:test";
import assert from "node:assert/strict";
import { BATCHES, listBatches, selectBatch } from "../src/batches.js";
import { buildRoutePlans } from "../src/planner.js";

function unrelatedTrip(overrides = {}) {
  return {
    name: "Unrelated route matrix",
    departureWindow: { start: "2026-09-23", end: "2026-09-23" },
    origin: { label: "Lisbon", airports: ["LIS"] },
    alternateStarts: [{ label: "Porto", airports: ["OPO"] }],
    destination: { label: "Montreal", airports: ["YUL"] },
    optionalStops: [{ label: "Reykjavik", airports: ["KEF"], nights: [0, 1] }],
    gatewayAirports: ["YYZ", "BOS"],
    routeModes: { includeOptionalStopCombinations: true, includeGatewaySplit: true },
    ...overrides
  };
}

test("fastest batch favors no intentional stopover routes", () => {
  const plans = buildRoutePlans(unrelatedTrip());
  const fastest = selectBatch(plans, "fastest");
  assert.ok(fastest.length > 0);
  assert.ok(fastest[0].segments.length <= 2);
});

test("intentional-stopover batch selects any declared stopover role", () => {
  const plans = buildRoutePlans(unrelatedTrip({
    alternateStarts: [],
    gatewayAirports: [],
    routeModes: { includeOptionalStopCombinations: true, includeGatewaySplit: false }
  }));
  const selected = selectBatch(plans, "intentional-stopover");

  assert.ok(selected.length > 0);
  assert.ok(selected.every((plan) => plan.stops.some((stop) => (
    stop.routeRole === "intentional-stopover" && stop.selectedNights > 0
  ))));
});

test("gateway batch preserves origin priority before gateway priority", () => {
  const plans = buildRoutePlans(unrelatedTrip({
    optionalStops: [],
  }));
  const paths = selectBatch(plans, "gateway-compare").map((plan) => (
    `${plan.segments[0].from.airports[0]}-${plan.stops[0].airports[0]}`
  ));

  assert.deepEqual(paths, ["LIS-YYZ", "LIS-BOS", "OPO-YYZ", "OPO-BOS"]);
});

test("route-neutral batch catalog exposes only canonical names", () => {
  const plans = buildRoutePlans(unrelatedTrip());
  const alternateStarts = selectBatch(plans, "alternate-start");
  const oneNightStops = selectBatch(plans, "one-night-stopover");
  const fewestLayovers = selectBatch(plans, "fewest-layovers");
  const names = new Set(listBatches().map(({ name }) => name));

  assert.ok(alternateStarts.length > 0);
  assert.ok(alternateStarts.every((plan) => plan.segments[0].from.routeRole === "alternate-start"));
  assert.ok(oneNightStops.length > 0);
  assert.ok(oneNightStops.every((plan) => (
    plan.stops.filter((stop) => stop.routeRole === "intentional-stopover")
      .reduce((sum, stop) => sum + stop.selectedNights, 0) === 1 &&
    plan.stops.every((stop) => stop.routeRole !== "gateway")
  )));
  assert.ok(fewestLayovers.every((plan) => (
    plan.stops.every((stop) => stop.routeRole !== "intentional-stopover" || stop.selectedNights === 0)
  )));
  const canonicalNames = [
    "fastest", "fewest-layovers", "intentional-stopover", "one-night-stopover",
    "alternate-start", "gateway-compare", "cheap-explorer", "all-reviewed"
  ];
  assert.deepEqual(Object.keys(BATCHES), canonicalNames);
  assert.deepEqual([...names], canonicalNames);
  for (const name of canonicalNames) {
    assert.ok(names.has(name), `missing batch ${name}`);
  }
});

test("legacy batch strings remain hidden compatibility inputs with route-neutral semantics", () => {
  const plans = buildRoutePlans(unrelatedTrip({
    optionalStops: [
      { label: "Reykjavik", airports: ["KEF"], nights: [0, 1] },
      { label: "Dublin", airports: ["DUB"], nights: [0, 1, 2] }
    ]
  }));

  assert.deepEqual(
    selectBatch(plans, "bangkok-start").map(({ id }) => id),
    selectBatch(plans, "alternate-start").map(({ id }) => id)
  );
  assert.ok(selectBatch(plans, "bangkok-stopover").every((plan) => hasOvernightStop(plan, 0)));
  assert.ok(selectBatch(plans, "skip-tokyo").every((plan) => !hasDeclaredStop(plan, 1)));
  assert.ok(selectBatch(plans, "tokyo-stopover").every((plan) => hasOvernightStop(plan, 1)));
  assert.ok(selectBatch(plans, "tokyo-core").every((plan) => (
    hasOvernightStop(plan, 1, 1) && plan.stops.every((stop) => stop.routeRole !== "gateway")
  )));
});

function hasDeclaredStop(plan, routeOrder) {
  return plan.stops.some((stop) => stop.routeRole === "intentional-stopover" && stop.routeOrder === routeOrder);
}

function hasOvernightStop(plan, routeOrder, nights = null) {
  return plan.stops.some((stop) => (
    stop.routeRole === "intentional-stopover" &&
    stop.routeOrder === routeOrder &&
    (nights === null ? stop.selectedNights > 0 : stop.selectedNights === nights)
  ));
}
