import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { bestAcrossPlans, writeRefreshLowdown } from "../src/refresh-summary.js";
import { runPlanRefreshSummary } from "../src/commands/plan-refresh-command.js";

function analyzedPlan(name, flight) {
  return {
    plan: { id: name.toLowerCase(), name },
    best: flight,
    cheapest: null,
    fastest: null
  };
}

function savedPlan(id, name, flight, overrides = {}) {
  return {
    id,
    name,
    routeIdeas: [{ id: "route", label: "Route", focusSearchIds: [flight.id] }],
    ...overrides
  };
}

test("cross-plan ranking honors the scorer's public score", () => {
  const shared = {
    price: 700,
    durationMinutes: 900,
    scoring: { breakdown: { estimatedTotalCost: 700 } }
  };
  const result = bestAcrossPlans([
    analyzedPlan("Risky", { ...shared, id: "risky", scoring: { ...shared.scoring, score: 220 } }),
    analyzedPlan("Safer", { ...shared, id: "safe", scoring: { ...shared.scoring, score: 80 } })
  ]);

  assert.equal(result.flight.id, "safe");
});

test("refresh lowdown scopes its recommendation to explicitly primary plans", async () => {
  const flight = (id, score) => ({
    id,
    searchId: id,
    price: 700,
    durationMinutes: 900,
    departureAirport: "AAA",
    arrivalAirport: "BBB",
    departureTime: "2026-08-01 08:00",
    scoring: { score, breakdown: { estimatedTotalCost: 700 } }
  });
  const plans = [
    {
      plan: savedPlan("redmond-home", "Redmond home", flight("legacy-name", 20), { primary: false }),
      status: { active: true },
      latest: { rankedFlights: [flight("legacy-name", 20)] }
    },
    {
      plan: savedPlan("porto-to-montreal", "Porto to Montreal", flight("explicit-primary", 80), { primary: true }),
      status: { active: true },
      latest: { rankedFlights: [flight("explicit-primary", 80)] }
    }
  ];

  const result = await writeRefreshLowdown({
    root: process.cwd(),
    plans,
    outputPath: `${process.env.TMPDIR ?? "/tmp"}/arch-004-primary-lowdown.md`
  });

  assert.equal(result.topOption.plan.id, "porto-to-montreal");
});

test("legacy plans without primary metadata compete without destination-name bias", async () => {
  const flight = (id, score) => ({
    id,
    searchId: id,
    price: 700,
    durationMinutes: 900,
    departureAirport: "AAA",
    arrivalAirport: "BBB",
    departureTime: "2026-08-01 08:00",
    scoring: { score, breakdown: { estimatedTotalCost: 700 } }
  });
  const plans = [
    {
      plan: savedPlan("redmond-home", "Redmond home", flight("legacy-name", 200)),
      status: { active: true },
      latest: { rankedFlights: [flight("legacy-name", 200)] }
    },
    {
      plan: savedPlan("porto-to-montreal", "Porto to Montreal", flight("best-score", 20)),
      status: { active: true },
      latest: { rankedFlights: [flight("best-score", 20)] }
    }
  ];

  const result = await writeRefreshLowdown({
    root: process.cwd(),
    plans,
    outputPath: `${process.env.TMPDIR ?? "/tmp"}/arch-004-legacy-lowdown.md`
  });

  assert.equal(result.topOption.plan.id, "porto-to-montreal");
});

test("refresh lowdown surfaces a triggered local watch rule", async () => {
  const outputPath = path.join(os.tmpdir(), "flight-scout-watch-alert-lowdown.md");
  const flight = {
    id: "target-match",
    price: 650,
    durationMinutes: 900,
    departureAirport: "LHR",
    arrivalAirport: "SYD",
    departureTime: "2026-09-25 08:00",
    googleFlightsUrl: "https://www.google.com/travel/flights?q=LHR+SYD",
    scoring: { score: 50, breakdown: { estimatedTotalCost: 650 } }
  };

  await writeRefreshLowdown({
    plans: [{
      plan: {
        id: "london-sydney",
        name: "London to Sydney",
        routeIdeas: [{ id: "route", label: "Route", focusSearchIds: [flight.id] }],
        watchRules: [{
          id: "target",
          label: "Target price and travel time",
          maxPriceUsd: 700,
          maxDurationMinutes: 960
        }]
      },
      status: { active: true },
      latest: { rankedFlights: [flight] }
    }],
    outputPath
  });

  const markdown = await readFile(outputPath, "utf8");
  assert.match(markdown, /## Saved Target Status/);
  assert.match(markdown, /Target price and travel time/);
  assert.match(markdown, /LHR -> SYD.*\$650.*15h/);
});

test("refresh summary delegates only active plans and rebuilds the summary once", async () => {
  const refreshed = [];
  const writes = [];
  const plans = [
    { plan: { id: "active", name: "Active" }, planPath: "plans/active/plan.json", status: { active: true } },
    { plan: { id: "archived", name: "Archived" }, planPath: "plans/archived/plan.json", status: { active: false } }
  ];

  const result = await runPlanRefreshSummary({ mode: "standard", refresh: false }, {
    root: "/tmp/flight-scheduled-command",
    loadPlans: async () => plans,
    refreshPlan: async (planPath) => refreshed.push(planPath),
    writePlanList: async () => writes.push("plan-list"),
    writeIndex: async () => writes.push("index"),
    writeLowdown: async ({ refreshed: records }) => ({
      outputPath: "/tmp/lowdown.md",
      refreshedPlanCount: records.length,
      topOption: null
    }),
    log: () => {}
  });

  assert.deepEqual(refreshed, ["plans/active/plan.json"]);
  assert.deepEqual(writes, ["plan-list", "index"]);
  assert.equal(result.refreshedPlanCount, 1);
});
