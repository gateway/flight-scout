import test from "node:test";
import assert from "node:assert/strict";
import * as decisionAnalysis from "../src/decision-analysis.js";

function flight(overrides = {}) {
  return {
    searchId: "primary-2026-08-01",
    searchTitle: "Primary route",
    price: 900,
    departureAirport: "AAA",
    arrivalAirport: "ZZZ",
    departureTime: "2026-08-01 08:00",
    arrivalTime: "2026-08-01 20:00",
    durationMinutes: 720,
    stops: 1,
    tripComplete: true,
    destinationComplete: true,
    legs: [{ duration: 600 }],
    layovers: [{ id: "BBB", name: "Connection", duration: 120 }],
    scoring: { score: 100, breakdown: { estimatedTotalCost: 900 } },
    ...overrides
  };
}

test("decision-analysis facade and semantic projection stay stable during extraction", () => {
  assert.deepEqual(Object.keys(decisionAnalysis).sort(), [
    "analyzeDecision",
    "confidenceLabel",
    "dateOpportunities",
    "normalizeOption",
    "normalizeOptions",
    "refreshGuidance",
    "travelPainBreakdown",
    "worthIt"
  ]);

  const primary = flight();
  const alternate = flight({
    searchId: "alternate-2026-08-02",
    price: 650,
    departureAirport: "ALT",
    departureTime: "2026-08-02 08:00",
    durationMinutes: 960,
    scoring: { score: 110, breakdown: { estimatedTotalCost: 650 } }
  });
  const stopover = {
    kind: "composed-stopover",
    searchId: "stopover-pair",
    inbound: flight({
      searchId: "stop-in",
      price: 300,
      departureAirport: "AAA",
      arrivalAirport: "MID",
      durationMinutes: 300,
      departureTime: "2026-08-03 08:00",
      scoring: { score: 50, breakdown: { estimatedTotalCost: 300 } }
    }),
    onward: flight({
      searchId: "stop-out",
      price: 700,
      departureAirport: "MID",
      arrivalAirport: "ZZZ",
      durationMinutes: 600,
      departureTime: "2026-08-04 08:00",
      scoring: { score: 75, breakdown: { estimatedTotalCost: 700 } }
    }),
    totalCost: 1000,
    durationMinutes: 900,
    nights: 1,
    stopoverLabel: "Middle City"
  };
  const plan = {
    id: "generic-contract-fixture",
    intent: { dateCoverage: { center: "2026-08-01", plusMinusDays: 2 } },
    routeIdeas: [
      { id: "primary", label: "Primary route", type: "direct-to-final" },
      { id: "alternate", label: "Alternate route", type: "alternate-start" },
      { id: "stopover", label: "Stopover route", type: "stopover" }
    ]
  };
  const analysis = decisionAnalysis.analyzeDecision({
    plan,
    trip: {
      origin: { label: "Origin City", airports: ["AAA"] },
      alternateStarts: [{ label: "Alternate City start", airports: ["ALT"] }]
    },
    routeGroups: new Map([
      ["primary", [primary]],
      ["alternate", [alternate]],
      ["stopover", [stopover]]
    ]),
    current: {
      meta: {
        createdAt: "2026-07-16T12:00:00.000Z",
        summary: { totalOptions: 4, completeOptions: 3 }
      },
      rankedFlights: [primary, alternate]
    },
    refreshPlan: {
      calls: [
        { id: "primary-2026-08-01", cache: { status: "fresh", fresh: true } },
        { id: "stop-out", cache: { status: "missing" } }
      ]
    }
  });

  assert.deepEqual({
    optionIds: analysis.options.map((option) => option.searchId),
    best: analysis.best.searchId,
    cheapest: analysis.cheapest.searchId,
    fastest: analysis.fastest.searchId,
    stopover: analysis.stopover.searchId,
    riskyFastest: analysis.riskyFastest,
    coverage: analysis.dateCoverage,
    dates: analysis.dateOpportunities.map(({ date, label, count, priceDeltaFromBest }) => ({ date, label, count, priceDeltaFromBest })),
    guidance: analysis.refreshGuidance,
    snapshot: analysis.snapshot,
    alternateAssumptions: analysis.cheapest.assumptions.map(({ level, label }) => ({ level, label })),
    stopoverPain: {
      nights: analysis.stopover.travelPain.stopoverNights,
      parts: analysis.stopover.travelPain.dayParts.map((part) => part.label)
    }
  }, {
    optionIds: ["primary-2026-08-01", "stopover-pair", "alternate-2026-08-02"],
    best: "primary-2026-08-01",
    cheapest: "alternate-2026-08-02",
    fastest: "primary-2026-08-01",
    stopover: "stopover-pair",
    riskyFastest: null,
    coverage: "dates 2026-08-01 +/- 2 days",
    dates: [
      { date: "2026-08-01", label: "best balance", count: 1, priceDeltaFromBest: 0 },
      { date: "2026-08-02", label: "cheapest", count: 1, priceDeltaFromBest: -250 },
      { date: "2026-08-03", label: "solid option", count: 1, priceDeltaFromBest: 100 }
    ],
    guidance: [
      { searchId: "primary-2026-08-01", reason: "fastest challenger", cacheStatus: "fresh" },
      { searchId: "alternate-2026-08-02", reason: "cheapest challenger", cacheStatus: "unknown" },
      { searchId: "stop-in", reason: "stopover challenger", cacheStatus: "unknown" },
      { searchId: "stop-out", reason: "missing route data", cacheStatus: "missing" }
    ],
    snapshot: {
      createdAt: "2026-07-16T12:00:00.000Z",
      totalOptions: 4,
      completeOptions: 3
    },
    alternateAssumptions: [
      { level: "warning", label: "Starts in Alternate City" },
      { level: "warning", label: "Extra travel first" }
    ],
    stopoverPain: { nights: 1, parts: ["First travel day", "Stay", "Final travel day"] }
  });
});
