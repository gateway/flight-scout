import test from "node:test";
import assert from "node:assert/strict";
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
