import test from "node:test";
import assert from "node:assert/strict";
import { analyzeDecision, confidenceLabel, normalizeOption, travelPainBreakdown, worthIt } from "../src/decision-analysis.js";
import { connectionPill } from "../src/dashboard-flight-components.js";

function flight(overrides = {}) {
  return {
    searchId: "main-2026-08-01",
    searchTitle: "Primary route",
    price: 1000,
    departureAirport: "AAA",
    arrivalAirport: "ZZZ",
    departureTime: "2026-08-01 10:00",
    arrivalTime: "2026-08-01 22:00",
    duration: "12h 0m",
    durationMinutes: 720,
    stops: 1,
    tripComplete: true,
    destinationComplete: true,
    legs: [
      { duration: 300, departure_airport: { id: "AAA", time: "2026-08-01 10:00" }, arrival_airport: { id: "BBB", time: "2026-08-01 15:00" } },
      { duration: 300, departure_airport: { id: "BBB", time: "2026-08-01 17:00" }, arrival_airport: { id: "ZZZ", time: "2026-08-01 22:00" } }
    ],
    layovers: [{ id: "BBB", name: "Connection", duration: 120 }],
    scoring: { score: 100, breakdown: { estimatedTotalCost: 1000 } },
    ...overrides
  };
}

test("worth-it math explains cheaper longer and faster costlier tradeoffs", () => {
  const best = { price: 1000, durationMinutes: 720 };
  const cheap = { price: 800, durationMinutes: 1020 };
  const fast = { price: 1180, durationMinutes: 540 };

  assert.deepEqual(worthIt(cheap, best), {
    type: "cheaper-but-longer",
    verdict: "maybe worth it",
    sentence: "Saves $200, but adds 5h 0m of travel time. That is about $40/hour for the extra travel."
  });
  assert.equal(worthIt(fast, best).type, "faster-but-costlier");
  assert.equal(worthIt(fast, best).sentence, "Saves 3h 0m, but costs $180 more. That is about $60/hour saved.");
});

test("worth-it math explains why a cheaper and faster challenger can still lose", () => {
  const best = {
    price: 1000,
    durationMinutes: 720,
    connectionRisk: { level: "comfortable", shortest: { id: "AMS", duration: 200 } },
    confidence: { level: "High" },
    stops: 1
  };
  const challenger = {
    price: 800,
    durationMinutes: 600,
    connectionRisk: { level: "tight", shortest: { id: "ARN", duration: 65 } },
    confidence: { level: "Low" },
    stops: 1
  };

  assert.deepEqual(worthIt(challenger, best), {
    type: "cheaper-and-faster",
    verdict: "check the connection tradeoff",
    sentence: "Saves $200 and 2h 0m of travel time, but depends on a tight 1h 5m connection at ARN and has lower confidence."
  });
});

test("travel pain breakdown separates air, layover, and stopover days", () => {
  const base = flight();
  const pain = travelPainBreakdown(base);
  assert.equal(pain.totalMinutes, 720);
  assert.equal(pain.airMinutes, 600);
  assert.equal(pain.layoverMinutes, 120);
  assert.equal(pain.shortestLayover.id, "BBB");

  const stopover = {
    kind: "composed-stopover",
    inbound: flight({ departureAirport: "AAA", arrivalAirport: "MID", durationMinutes: 600 }),
    onward: flight({ departureAirport: "MID", arrivalAirport: "ZZZ", durationMinutes: 800 }),
    nights: 1,
    stopoverLabel: "Stop City",
    durationMinutes: 1400,
    totalCost: 1300
  };
  const stopoverPain = travelPainBreakdown(stopover);
  assert.equal(stopoverPain.stopoverNights, 1);
  assert.equal(stopoverPain.dayParts.length, 3);
  assert.equal(stopoverPain.dayParts[1].label, "Stay");
});

test("confidence labels distinguish high, low, and needs-data options", () => {
  const high = confidenceLabel({
    option: flight(),
    price: 1000,
    durationMinutes: 720,
    connectionRisk: { level: "comfortable" },
    assumptions: []
  });
  assert.equal(high.level, "High");

  const low = confidenceLabel({
    option: flight({ layovers: [{ id: "BBB", duration: 45 }] }),
    price: 1000,
    durationMinutes: 720,
    connectionRisk: { level: "tight" },
    assumptions: []
  });
  assert.equal(low.level, "Low");

  const missing = confidenceLabel({
    option: flight({ tripComplete: false }),
    price: Infinity,
    durationMinutes: 720,
    connectionRisk: { level: "comfortable" },
    assumptions: []
  });
  assert.equal(missing.level, "Needs data");

  const stale = confidenceLabel({
    option: flight({ searchId: "stale" }),
    price: 1000,
    durationMinutes: 720,
    connectionRisk: { level: "comfortable" },
    assumptions: [],
    refreshBySearchId: new Map([["stale", { cache: { fresh: false } }]])
  });
  assert.equal(stale.level, "Medium");
});

test("decision summaries keep an unknown connection out of tight-risk signals", () => {
  const option = normalizeOption({
    option: flight({ layovers: [{ id: "BBB", name: "Connection", duration: null }] }),
    route: { id: "primary", label: "Primary", type: "direct-to-final" }
  });
  const pill = connectionPill(option);

  assert.equal(option.connectionRisk.level, "unknown");
  assert.match(option.connectionRisk.label, /verif/i);
  assert.ok(option.confidence.reasons.some((reason) => /connection.*verif/i.test(reason)));
  assert.doesNotMatch(pill, /tight/i);
  assert.match(pill, /time unknown/i);
});

test("decision analysis produces generic best choice, date opportunities, and refresh guidance", () => {
  const plan = {
    id: "fixture",
    intent: { dateCoverage: { center: "2026-08-01", plusMinusDays: 1 } },
    routeIdeas: [
      { id: "primary", label: "Primary", focusSearchIds: ["main-2026-08-01"] },
      { id: "alternate", label: "Alternate", focusSearchIds: ["alt-2026-08-02"] }
    ]
  };
  const trip = {
    origin: { label: "Origin", airports: ["AAA"] },
    alternateStarts: [{ label: "Alternate start", airports: ["ALT"] }]
  };
  const routeGroups = new Map([
    ["primary", [flight()]],
    ["alternate", [flight({
      searchId: "alt-2026-08-02",
      price: 700,
      departureAirport: "ALT",
      departureTime: "2026-08-02 10:00",
      durationMinutes: 1100,
      scoring: { score: 120, breakdown: { estimatedTotalCost: 700 } }
    })]]
  ]);
  const analysis = analyzeDecision({
    plan,
    trip,
    routeGroups,
    refreshPlan: {
      calls: [{ id: "missing-leg", routeIdeaId: "alternate", cache: { status: "missing" } }]
    }
  });

  assert.equal(analysis.best.routeIdeaLabel, "Primary");
  assert.equal(analysis.cheapest.routeIdeaLabel, "Alternate");
  assert.equal(analysis.cheapest.assumptions[0].label, "Starts in Alternate");
  assert.equal(analysis.dateOpportunities.length, 2);
  assert.ok(analysis.refreshGuidance.some((item) => item.reason === "missing route data"));
});

test("decision analysis excludes hard rejected long flights from recommendations", () => {
  const route = { id: "r", label: "Route" };
  const routeGroups = new Map([["r", [
    flight({
      searchId: "too-long",
      price: 500,
      durationMinutes: 36 * 60,
      scoring: { labels: ["hard-reject"], breakdown: { estimatedTotalCost: 500 } }
    }),
    flight({
      searchId: "workable",
      price: 900,
      durationMinutes: 20 * 60,
      scoring: { labels: [], breakdown: { estimatedTotalCost: 900 } }
    })
  ]]]);
  const analysis = analyzeDecision({ plan: { routeIdeas: [route] }, routeGroups });
  assert.equal(analysis.options.length, 1);
  assert.equal(analysis.best.searchId, "workable");
});

test("stopover confidence detects airport changes between separate legs", () => {
  const stopover = {
    kind: "composed-stopover",
    searchId: "stopover",
    inbound: flight({ departureAirport: "AAA", arrivalAirport: "HND" }),
    onward: flight({ departureAirport: "NRT", arrivalAirport: "ZZZ" }),
    totalCost: 1200,
    durationMinutes: 1500,
    nights: 1,
    stopoverLabel: "Stopover"
  };
  const confidence = confidenceLabel({
    option: stopover,
    price: 1200,
    durationMinutes: 1500,
    connectionRisk: { level: "comfortable" },
    assumptions: []
  });
  assert.equal(confidence.level, "Low");
  assert.ok(confidence.reasons.includes("airport change between stopover legs"));
});
