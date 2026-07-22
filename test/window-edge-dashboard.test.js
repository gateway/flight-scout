import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { writePlanDashboard } from "../src/dashboard.js";
import { createSnapshot } from "../src/snapshots.js";

test("decision and date pages share a window-edge action and render missing dates honestly", async (context) => {
  const planDir = await mkdtemp(path.join(tmpdir(), "flight-window-dashboard-"));
  context.after(() => rm(planDir, { recursive: true, force: true }));
  const outputPath = path.join(planDir, "sample.dashboard.html");
  const plan = {
    id: "sample",
    name: "Sample",
    intent: { dateCoverage: { center: "2026-10-03", plusMinusDays: 2, start: "2026-10-01", end: "2026-10-05" } },
    routeIdeas: [{ id: "route", label: "Sample route", originAirports: ["AAA"], destinationAirports: ["BBB"] }]
  };
  const trip = { departureWindow: { center: "2026-10-03", mode: "plus-minus", days: 2, start: "2026-10-01", end: "2026-10-05" } };
  const snapshot = await createSnapshot({
    planDir,
    plan,
    source: "test",
    rankedFlights: [flight("2026-10-02", 700), flight("2026-10-05", 500)]
  });

  await writePlanDashboard({
    plan,
    planDir,
    trip,
    snapshots: [snapshot],
    refreshPlan: { maxWindowDays: 14, selectedCallCount: 5, calls: [], warnings: [] },
    outputPath
  });

  const decision = await readFile(outputPath, "utf8");
  const dates = await readFile(path.join(planDir, "sample.dates.html"), "utf8");
  for (const html of [decision, dates]) {
    assert.match(html, /October 5 is the cheapest date found and it is the edge of your search window\./);
    assert.match(html, /Extend the search to October 6 and 7\?/);
    assert.match(html, /data-plan-extend-window/);
    assert.match(html, /\/api\/plans\/extend-window/);
  }
  assert.equal((dates.match(/needs data/g) ?? []).length, 3);
});

function flight(date, price) {
  return {
    searchId: `route-${date}`,
    routeIdeaId: "route",
    routeIdeaLabel: "Sample route",
    price,
    currency: "USD",
    durationMinutes: 600,
    departureAirport: "AAA",
    arrivalAirport: "BBB",
    departureTime: `${date} 08:00`,
    arrivalTime: `${date} 18:00`,
    stops: 1,
    tripComplete: true,
    destinationComplete: true,
    scoring: { score: price, breakdown: { estimatedTotalCost: price } },
    legs: [],
    layovers: []
  };
}
