import test from "node:test";
import assert from "node:assert/strict";
import { selectBatch } from "../src/batches.js";
import { buildRoutePlans } from "../src/planner.js";

const trip = {
  name: "Test",
  departureWindow: { start: "2026-08-01", end: "2026-08-02" },
  origin: { label: "Chiang Mai", airports: ["CNX"] },
  alternateStarts: [{ label: "Bangkok start", airports: ["BKK", "DMK"] }],
  destination: { label: "Redmond", airports: ["RDM"] },
  optionalStops: [
    { label: "Bangkok", airports: ["BKK", "DMK"], nights: [0, 1] },
    { label: "Tokyo", airports: ["HND", "NRT"], nights: [0, 1, 2] }
  ],
  gatewayAirports: ["SEA", "SFO"],
  routeModes: {
    includeOptionalStopCombinations: true,
    includeGatewaySplit: true
  }
};

test("fastest batch favors no intentional stopover routes", () => {
  const plans = buildRoutePlans(trip);
  const fastest = selectBatch(plans, "fastest");
  assert.ok(fastest.length > 0);
  assert.ok(fastest[0].segments.length <= 2);
});

test("tokyo-stopover batch includes intentional Tokyo nights", () => {
  const plans = buildRoutePlans(trip);
  const tokyo = selectBatch(plans, "tokyo-stopover");
  assert.ok(tokyo.length > 0);
  assert.ok(tokyo.every((plan) => plan.stops.some((stop) => stop.label === "Tokyo" && stop.selectedNights > 0)));
});

test("skip-tokyo batch excludes Tokyo airports", () => {
  const plans = buildRoutePlans(trip);
  const skipTokyo = selectBatch(plans, "skip-tokyo");
  assert.ok(skipTokyo.length > 0);
  assert.ok(skipTokyo.every((plan) => !JSON.stringify(plan.segments).includes("HND")));
  assert.ok(skipTokyo.every((plan) => !JSON.stringify(plan.segments).includes("NRT")));
});
