import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createPlanFromText, loadPlanTrip, validatePlan } from "../src/plans.js";
import { buildRefreshPlan } from "../src/refresh-plan.js";
import { createSnapshot, latestSnapshots } from "../src/snapshots.js";
import { compareSnapshots } from "../src/snapshot-compare.js";
import { writePlanDashboard } from "../src/dashboard.js";
import { bestChoiceSentence, flightGoogleFlightsUrl, renderFlightDetailPanel } from "../src/dashboard-flight-components.js";
import { signalizeText } from "../src/dashboard-signals.js";
import { publicPlanTrip, writePublicPlanFixture } from "./fixtures/public-plan.js";

const root = process.cwd();

function sampleFlight(overrides = {}) {
  return {
    searchId: "bangkok-start-no-intentional-stopover-redmond-bend-2026-08-01",
    searchTitle: "Bangkok start -> Redmond/Bend, no intentional stopover, depart 2026-08-01",
    routeFamily: "bangkok-start",
    googleFlightsUrl: "https://www.google.com/travel/flights?q=one+way+flights+from+BKK+to+RDM+departing+2026-08-01",
    price: 965,
    airline: "EVA Air + Alaska",
    departureAirport: "BKK",
    arrivalAirport: "RDM",
    departureTime: "2026-08-01 16:45",
    arrivalTime: "2026-08-01 23:59",
    duration: "21h 14m",
    durationMinutes: 1274,
    stops: 2,
    destinationComplete: true,
    tripComplete: true,
    scoring: {
      score: 126,
      breakdown: { estimatedTotalCost: 965 }
    },
    legs: [],
    layovers: [],
    ...overrides
  };
}

function sampleLeg(overrides = {}) {
  return {
    duration: 60,
    airline: "Fixture Air",
    travel_class: "Economy",
    airplane: "Fixture 737",
    flight_number: "FA 100",
    departure_airport: { time: "2026-08-01 10:00", name: "Bangkok", id: "BKK" },
    arrival_airport: { time: "2026-08-01 11:00", name: "Redmond", id: "RDM" },
    extensions: ["Average legroom"],
    ...overrides
  };
}

test("saved plan loads and validates route ideas", async (context) => {
  const fixtureRoot = await temporaryRoot(context);
  const { planPath } = await writePublicPlanFixture(fixtureRoot);
  const { plan, trip } = await loadPlanTrip(planPath, fixtureRoot);
  validatePlan(plan);
  assert.equal(plan.routeIdeas.length, 4);
  assert.ok(plan.routeIdeas.some((route) => route.id === "lhr-dub-kef"));
  assert.equal(trip.tripType, "one-way");
  assert.equal(trip.departureWindow.center, "2026-08-04");
});

test("dashboard signal helper highlights decision phrases without swallowing punctuation", () => {
  const html = signalizeText("Saves $16, but adds 0h 10m and has a tight connection.");
  assert.ok(html.includes('<span class="text-signal text-signal-good">Saves $16</span>,'));
  assert.ok(html.includes('<span class="text-signal text-signal-warn">adds 0h 10m</span>'));
  assert.ok(html.includes('<span class="text-signal text-signal-bad">tight connection</span>'));
});

test("refresh plan is provider-aware and exposes atomic decision searches", async (context) => {
  const fixtureRoot = await temporaryRoot(context);
  const { plan, trip } = publicPlanTrip();
  const refreshPlan = await buildRefreshPlan({ plan, trip, mode: "light", root: fixtureRoot });
  assert.equal(refreshPlan.mode, "light");
  assert.ok(refreshPlan.selectedCallCount > 0);
  assert.equal(refreshPlan.selectedCallCount, refreshPlan.calls.length);
  assert.equal(new Set(refreshPlan.calls.map((call) => call.id)).size, refreshPlan.calls.length);
  assert.ok(refreshPlan.calls.every((call) => call.kind === "one-way"));
  assert.ok(Number.isInteger(refreshPlan.fliCallCount));
  assert.ok(refreshPlan.calls.every((call) => call.input));
  assert.ok(refreshPlan.calls.every((call) => call.refreshReasons.length > 0));
  assert.ok(refreshPlan.calls.some((call) => call.id === "one-way-lhr-kef-2026-08-01"));
  assert.ok(refreshPlan.explanation.includes("decision"));
});

test("forced fli refresh counts fresh cache as planned provider work", async (context) => {
  const fixtureRoot = await temporaryRoot(context);
  const { plan, trip } = publicPlanTrip();
  const initial = await buildRefreshPlan({ plan, trip, mode: "standard", root: fixtureRoot });
  await mkdir(path.dirname(initial.calls[0].cacheFile), { recursive: true });
  await writeFile(initial.calls[0].cacheFile, "{}");

  const normal = await buildRefreshPlan({ plan, trip, mode: "standard", root: fixtureRoot });
  const forced = await buildRefreshPlan({ plan, trip, mode: "standard", root: fixtureRoot, refresh: true });
  assert.ok(forced.fliCallCount > normal.fliCallCount);
  assert.equal(forced.fliCallCount, forced.selectedCallCount);
  assert.equal(Object.hasOwn(forced, "liveCallCount"), false);
});


test("standard and deep refresh plans broaden coverage", async (context) => {
  const fixtureRoot = await temporaryRoot(context);
  const { plan, trip } = publicPlanTrip();
  const standard = await buildRefreshPlan({ plan, trip, mode: "standard", root: fixtureRoot });
  const targetedDeep = await buildRefreshPlan({ plan, trip, mode: "targeted-deep", root: fixtureRoot });
  const deep = await buildRefreshPlan({ plan, trip, mode: "deep", root: fixtureRoot });
  assert.ok(standard.selectedCallCount >= 12);
  assert.ok(standard.calls.filter((call) => call.refreshReasons.includes("full date-window coverage")).length >= 14);
  assert.ok(targetedDeep.selectedCallCount >= standard.selectedCallCount);
  assert.ok(targetedDeep.selectedCallCount < deep.selectedCallCount);
  assert.ok(targetedDeep.explanation.includes("viable route families"));
  assert.ok(standard.calls.some((call) => call.title.includes("2026-08-07")));
  assert.ok(deep.selectedCallCount > standard.selectedCallCount);
  assert.ok(deep.skippedCalls.some((call) => call.reason.includes("deep mode")));
});

async function temporaryRoot(context) {
  const fixtureRoot = await mkdtemp(path.join(tmpdir(), "flight-plan-public-fixture-"));
  context.after(() => rm(fixtureRoot, { recursive: true, force: true }));
  return fixtureRoot;
}

test("snapshots can compare price movement", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "flight-plan-"));
  const plan = { id: "fixture", name: "Fixture", routeIdeas: [{ id: "r", label: "Route" }] };
  const previous = await createSnapshot({
    planDir: dir,
    plan,
    rankedFlights: [sampleFlight({ price: 1000, scoring: { score: 140, breakdown: { estimatedTotalCost: 1000 } } })],
    source: "test"
  });
  await new Promise((resolve) => setTimeout(resolve, 5));
  const current = await createSnapshot({
    planDir: dir,
    plan,
    rankedFlights: [sampleFlight({ price: 900, scoring: { score: 120, breakdown: { estimatedTotalCost: 900 } } })],
    source: "test"
  });
  const snapshots = await latestSnapshots(dir, 2);
  assert.equal(snapshots.length, 2);
  const comparison = compareSnapshots(current, previous);
  assert.equal(comparison.available, true);
  assert.equal(comparison.changes[0].delta, -100);
  await rm(dir, { recursive: true, force: true });
});

test("snapshot comparison ignores explicit mixed-currency price movement", () => {
  const previous = {
    rankedFlights: [
      sampleFlight({
        price: 1800,
        providerCurrency: "THB",
        scoring: { score: 100, breakdown: { estimatedTotalCost: 1800 } }
      })
    ]
  };
  const current = {
    rankedFlights: [
      sampleFlight({
        price: 55,
        providerCurrency: "USD",
        scoring: { score: 100, breakdown: { estimatedTotalCost: 55 } }
      })
    ]
  };

  const comparison = compareSnapshots(current, previous);
  assert.equal(comparison.changes.filter((change) => change.direction === "down" || change.direction === "up").length, 0);
  assert.equal(comparison.summary, "No matched flights changed price.");
});

test("snapshot comparison detects up, unchanged, new, disappeared, and tradeoffs", () => {
  const previous = {
    rankedFlights: [
      sampleFlight({ searchId: "down", price: 1000, durationMinutes: 900, scoring: { score: 1, breakdown: { estimatedTotalCost: 1000 } } }),
      sampleFlight({ searchId: "up", price: 1000, scoring: { score: 1, breakdown: { estimatedTotalCost: 1000 } } }),
      sampleFlight({ searchId: "same", price: 1000, scoring: { score: 1, breakdown: { estimatedTotalCost: 1000 } } }),
      sampleFlight({ searchId: "gone", price: 700, scoring: { score: 1, breakdown: { estimatedTotalCost: 700 } } })
    ]
  };
  const current = {
    rankedFlights: [
      sampleFlight({ searchId: "down", price: 910, durationMinutes: 960, scoring: { score: 1, breakdown: { estimatedTotalCost: 910 } } }),
      sampleFlight({ searchId: "up", price: 1140, scoring: { score: 1, breakdown: { estimatedTotalCost: 1140 } } }),
      sampleFlight({ searchId: "same", price: 1000, scoring: { score: 1, breakdown: { estimatedTotalCost: 1000 } } }),
      sampleFlight({ searchId: "new", price: 800, scoring: { score: 1, breakdown: { estimatedTotalCost: 800 } } })
    ]
  };
  const comparison = compareSnapshots(current, previous);
  assert.equal(comparison.changes.find((change) => change.searchId === "down").delta, -90);
  assert.equal(comparison.changes.find((change) => change.searchId === "down").tradeoff, "cheaper-but-longer");
  assert.equal(comparison.changes.find((change) => change.searchId === "up").delta, 140);
  assert.equal(comparison.changes.find((change) => change.searchId === "same").direction, "same");
  assert.equal(comparison.changes.find((change) => change.searchId === "new").direction, "new");
  assert.equal(comparison.changes.find((change) => change.searchId === "gone").direction, "disappeared");
});

test("plan dashboard renders decision cards and route sections", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "flight-dashboard-"));
  const outputPath = path.join(dir, "dashboard.html");
  const plan = {
    id: "fixture",
    name: "Fixture Plan",
    intent: { naturalLanguage: "Find a one-way flight home." },
    watchRules: [{
      id: "target",
      label: "Target price and travel time",
      maxPriceUsd: 1000,
      maxDurationMinutes: 1300
    }],
    routeIdeas: [{
      id: "bangkok-to-redmond",
      label: "Bangkok to Redmond",
      summary: "Start from Bangkok.",
      focusSearchIds: ["bangkok-start-no-intentional-stopover-redmond-bend-2026-08-01"]
    }]
  };
  const snapshot = await createSnapshot({
    planDir: dir,
    plan,
    rankedFlights: [
      sampleFlight({ legs: [sampleLeg()] }),
      sampleFlight({
        searchId: "fastest-2026-07-29",
        departureTime: "2026-07-29 10:00",
        arrivalTime: "2026-07-30 04:00",
        price: 1500,
        duration: "18h 0m",
        durationMinutes: 1080,
        scoring: { score: 300, breakdown: { estimatedTotalCost: 1500 } },
        legs: [sampleLeg()]
      })
    ],
    source: "test"
  });
  await writePlanDashboard({
    plan,
    planDir: dir,
    snapshots: [snapshot],
    refreshPlan: { selectedCallCount: 1, fliCallCount: 0, cacheHitCount: 1, warnings: [] },
    outputPath
  });
  const html = await readFile(outputPath, "utf8");
  assert.ok(html.includes("Best Decision Right Now"));
  assert.ok(html.includes("Decision + Budget"));
  assert.ok(html.includes("dashboard.dates.html"));
  assert.ok(html.includes("dashboard.routes.html"));
  assert.ok(html.includes("dashboard.refresh.html"));
  assert.ok(html.includes("Best current choice"));
  assert.ok(html.includes("Saved Target Status"));
  assert.ok(html.includes("Target price and travel time"));
  assert.ok(html.includes("$965"));
  assert.ok(html.includes("21h 14m"));
  assert.ok(html.includes("The cleanest option right now"));
  assert.doesNotMatch(html, /<\/details>\./);
  assert.match(html, /<summary><strong>[^<]+\.<\/strong><\/summary>/);
  assert.doesNotMatch(html, /<\/details> at /);
  assert.match(html, /<\/details>&nbsp;at&nbsp;/);
  assert.ok(html.includes("selected searches are still fresh in cache."));
  const datesHtml = await readFile(path.join(dir, "dashboard.dates.html"), "utf8");
  assert.ok(datesHtml.includes("Best Dates To Consider"));
  assert.ok(datesHtml.includes("Route Price Scan"));
  assert.ok(datesHtml.includes("Best Option On Each Date"));
  assert.ok(datesHtml.includes("cheapest route-specific date"));
  assert.ok(datesHtml.includes("compares it against the best flexible-date choice"));
  assert.ok(datesHtml.includes("Best option on this date"));
  assert.ok(datesHtml.includes("best flexible date"));
  assert.ok(datesHtml.includes("cheapest that day"));
  assert.ok(datesHtml.includes("price-bar"));
  assert.ok(datesHtml.includes("complete date"));
  assert.ok(datesHtml.includes("flight-card date-card"));
  assert.ok(!datesHtml.includes("Same as best"));
  assert.ok(!datesHtml.includes("Small price change"));
  assert.ok(!datesHtml.includes("Costs more"));
  assert.ok(!datesHtml.includes("Higher price, best for this date"));
  assert.ok(!datesHtml.includes("Close to best overall"));
  const routesHtml = await readFile(path.join(dir, "dashboard.routes.html"), "utf8");
  assert.ok(routesHtml.includes("Route Evidence"));
  assert.ok(routesHtml.includes("Bangkok to Redmond"));
  assert.ok(routesHtml.includes("data-sort-route=\"best\""));
  assert.ok(routesHtml.includes("data-sort-route=\"cheapest\""));
  assert.ok(routesHtml.includes("data-sort-route=\"fastest\""));
  assert.ok(routesHtml.includes("data-route-options"));
  assert.ok(routesHtml.includes("data-rank=\"0\""));
  assert.ok(routesHtml.includes("data-price=\"965\""));
  assert.ok(routesHtml.includes("data-duration=\"1274\""));
  assert.ok(routesHtml.includes("card-detail-drawer"));
  assert.ok(html.includes("Open in Google Flights"));
  assert.ok(html.includes("drawer-head-actions"));
  assert.ok(!html.includes("drawer-footer"));
  assert.ok(html.includes("card-stat"));
  assert.ok(html.includes('data-plan-refresh-action="plan"'));
  assert.ok(html.includes("/api/plans/refresh"));
  for (const generated of [html, datesHtml, routesHtml]) {
    assert.ok(!generated.includes("Compact report"));
    assert.ok(!generated.includes("Decision Evidence"));
    assert.ok(!generated.includes("Smart Filters"));
    assert.ok(!generated.includes("positioning"));
    assert.ok(!generated.includes("Preview"));
    assert.ok(!generated.includes("Human read"));
  }
  const refreshHtml = await readFile(path.join(dir, "dashboard.refresh.html"), "utf8");
  assert.ok(refreshHtml.includes("Refresh check"));
  assert.ok(refreshHtml.includes("Local searches"));
  assert.ok(refreshHtml.includes("Already cached"));
  assert.ok(refreshHtml.includes("Refresh history"));
  assert.doesNotMatch(refreshHtml, /Open snapshot|\.\.\/plans\//);
  assert.ok(refreshHtml.includes("What changed"));
  assert.ok(!refreshHtml.includes("Compact report"));
  assert.ok(!refreshHtml.includes("Decision Evidence"));
  assert.ok(!refreshHtml.includes("Smart Filters"));
  assert.ok(!refreshHtml.includes("positioning"));
  for (const generated of [html, datesHtml, routesHtml, refreshHtml]) {
    assert.doesNotMatch(generated, /\bFLI\b/);
  }
  await rm(dir, { recursive: true, force: true });
});

test("flight detail drawer does not call multi-stop flights nonstop", () => {
  const html = renderFlightDetailPanel(sampleFlight({
    stops: 2,
    layovers: [
      { id: "TPE", name: "Taiwan Taoyuan International Airport", duration: 85 },
      { id: "SEA", name: "Seattle-Tacoma International Airport", duration: 188 }
    ],
    legs: [
      {
        airline: "CI",
        flight_number: "836",
        duration: 215,
        extensions: [],
        departure_airport: { id: "BKK", name: "Suvarnabhumi Airport", time: "2026-08-04 17:30" },
        arrival_airport: { id: "TPE", name: "Taiwan Taoyuan International Airport", time: "2026-08-04 22:05" }
      },
      {
        airline: "CI",
        flight_number: "22",
        duration: 675,
        extensions: [],
        departure_airport: { id: "TPE", name: "Taiwan Taoyuan International Airport", time: "2026-08-04 23:30" },
        arrival_airport: { id: "SEA", name: "Seattle-Tacoma International Airport", time: "2026-08-04 19:45" }
      },
      {
        airline: "AS",
        flight_number: "2094",
        duration: 66,
        extensions: [],
        departure_airport: { id: "SEA", name: "Seattle-Tacoma International Airport", time: "2026-08-04 22:53" },
        arrival_airport: { id: "RDM", name: "Roberts Field", time: "2026-08-04 23:59" }
      }
    ]
  }));

  assert.ok(html.includes("<strong>2 stops</strong>"));
  assert.ok(html.includes("1h 25m layover"));
  assert.ok(html.includes("3h 8m layover"));
  assert.ok(!html.includes(">Nonstop<"));
  assert.ok(!html.includes("<span>Onboard</span></div>"));
});

test("nonstop best-choice copy stays destination neutral", () => {
  const sentence = bestChoiceSentence(sampleFlight({
    routeIdeaLabel: "Seattle to Keflavik/Iceland",
    departureAirport: "SEA",
    arrivalAirport: "KEF",
    stops: 0,
    layovers: []
  }));

  assert.ok(sentence.includes("price and departure time"));
  assert.ok(!sentence.includes("Bangkok airport"));
});

test("flight links use the displayed airport pair instead of stale snapshot URLs", () => {
  const url = flightGoogleFlightsUrl(sampleFlight({
    departureAirport: "CNX",
    arrivalAirport: "DMK",
    departureTime: "2026-08-02 13:55",
    googleFlightsUrl: "https://www.google.com/travel/flights?hl=en&curr=USD&q=one+way+flights+from+CNX+to+BKK+departing+2026-08-02"
  }));

  assert.match(url, /from\+CNX\+to\+DMK\+departing\+2026-08-02/);
  assert.doesNotMatch(url, /to\+BKK/);
});

test("natural-language plan creation parses current trip and asks clarification for ambiguous cities", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "flight-plan-new-"));
  const current = await createPlanFromText({
    text: "one way Chiang Mai to Redmond Oregon RDM via Tokyo for two nights around August 1 plus or minus 3, cheapest but fewest layovers",
    outputDir: path.join(dir, "current"),
    root: dir
  });
  assert.equal(current.plan.intent.tripType, "one-way");
  assert.equal(current.plan.intent.dateCoverage.plusMinusDays, 3);
  assert.equal(current.plan.preferences.budgetSensitivity, "high");
  assert.equal(current.plan.preferences.priority, "fewest-layovers");
  assert.equal(current.plan.routeIdeas.find((route) => route.id.includes("tokyo")).stopover.nights[0], 2);
  const strict = await createPlanFromText({
    text: "one way Chiang Mai to Redmond Oregon RDM around August 1 plus or minus 3, no long long flights and max 30 hours",
    outputDir: path.join(dir, "strict"),
    root: dir
  });
  assert.equal(strict.plan.preferences.rejectTotalElapsedHoursOver, 30);
  await assert.rejects(
    () => createPlanFromText({ text: "one way Chiang Mai to Bend around August 1 plus or minus 3", outputDir: path.join(dir, "missing-endpoint"), root: dir }),
    /Where are you flying to\?/
  );
  await assert.rejects(
    () => createPlanFromText({ text: "Plan flights from Springfield to Portland", outputDir: path.join(dir, "ambiguous"), root: dir }),
    /Clarification needed/
  );
  await rm(dir, { recursive: true, force: true });
});
