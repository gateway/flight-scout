import test from "node:test";
import assert from "node:assert/strict";
import { planDisplaySummary } from "../src/plan-display.js";

test("plan display states a flexible date window once in sentence case", () => {
  const plan = {
    intent: {
      tripType: "one-way",
      dateCoverage: {
        center: "2026-10-02",
        plusMinusDays: 2,
        start: "2026-09-30",
        end: "2026-10-04"
      }
    },
    preferences: {
      preferredTotalElapsedHours: 28,
      rejectTotalElapsedHoursOver: 29
    },
    routeIdeas: [{ label: "Keflavik/Iceland to Bangkok" }]
  };

  assert.equal(
    planDisplaySummary(plan),
    "One-way, October 2, 2026 plus or minus 2 days (Sep 30 - Oct 4). Prefer under 28h; ignore trips over 29h."
  );
});

test("plan display mentions multiple route ideas without repeating their labels", () => {
  const plan = {
    intent: { tripType: "one-way", dateCoverage: { center: "2026-08-01" } },
    preferences: { hardMaxBudget: 1200 },
    routeIdeas: [{ label: "Route A" }, { label: "Route B" }]
  };

  assert.equal(planDisplaySummary(plan), "One-way, August 1, 2026. Compare 2 route ideas. Target under $1,200.");
});

test("round-trip plan display labels departure and return dates once", () => {
  const plan = {
    intent: {
      tripType: "round-trip",
      dateCoverage: { center: "2026-09-23" },
      returnDateCoverage: { center: "2026-10-04" }
    },
    preferences: {},
    routeIdeas: [{ label: "London to New York" }]
  };

  assert.equal(
    planDisplaySummary(plan),
    "Round-trip, Departure September 23, 2026. Return October 4, 2026."
  );
});
