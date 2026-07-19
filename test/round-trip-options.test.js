import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { composeRoundTripOptions } from "../src/round-trip-options.js";
import { groupByRouteIdea } from "../src/route-options.js";
import { analyzeDecision } from "../src/decision-analysis.js";
import { renderFlightDetailPanel } from "../src/dashboard-flight-components.js";
import { flightActionLinks } from "../src/dashboard-flight-actions.js";
import { writePlanDashboard } from "../src/dashboard.js";
import { createSnapshot } from "../src/snapshots.js";

const route = {
  id: "london-new-york-round-trip",
  label: "London to New York round trip",
  type: "round-trip",
  originAirports: ["LHR"],
  destinationAirports: ["JFK"]
};

test("round-trip composition combines compatible one-way fares and travel time", () => {
  const [option] = composeRoundTripOptions({
    route,
    flights: [
      flight({
        searchId: "outbound",
        departureAirport: "LHR",
        arrivalAirport: "JFK",
        departureTime: "2026-09-23 10:00",
        arrivalTime: "2026-09-23 18:00",
        price: 420,
        durationMinutes: 480
      }),
      flight({
        searchId: "return",
        departureAirport: "JFK",
        arrivalAirport: "LHR",
        departureTime: "2026-10-04 20:00",
        arrivalTime: "2026-10-05 08:00",
        price: 380,
        durationMinutes: 420
      })
    ]
  });

  assert.equal(option.kind, "composed-round-trip");
  assert.equal(option.totalCost, 800);
  assert.equal(option.durationMinutes, 900);
  assert.equal(option.outbound.searchId, "outbound");
  assert.equal(option.returnFlight.searchId, "return");
  assert.equal(option.separateTickets, true);
  assert.match(option.bookingWarning, /separately booked one-way tickets/i);
});

test("round-trip composition uses the best complete flight per date and rejects returns before arrival", () => {
  const options = composeRoundTripOptions({
    route,
    flights: [
      flight({ searchId: "outbound-slow", departureAirport: "LHR", arrivalAirport: "JFK", departureTime: "2026-09-23 08:00", arrivalTime: "2026-09-23 16:00", price: 390, durationMinutes: 480, scoring: { score: 50 } }),
      flight({ searchId: "outbound-best", departureAirport: "LHR", arrivalAirport: "JFK", departureTime: "2026-09-23 10:00", arrivalTime: "2026-09-23 18:00", price: 420, durationMinutes: 480, scoring: { score: 10 } }),
      flight({ searchId: "too-early", departureAirport: "JFK", arrivalAirport: "LHR", departureTime: "2026-09-23 17:00", arrivalTime: "2026-09-24 05:00", price: 300, durationMinutes: 420 }),
      flight({ searchId: "return-best", departureAirport: "JFK", arrivalAirport: "LHR", departureTime: "2026-10-04 20:00", arrivalTime: "2026-10-05 08:00", price: 380, durationMinutes: 420 })
    ]
  });

  assert.equal(options.length, 1);
  assert.equal(options[0].outbound.searchId, "outbound-best");
  assert.equal(options[0].returnFlight.searchId, "return-best");
});

test("round-trip composition requires complete legs in the declared airport groups", () => {
  const outbound = flight({ departureAirport: "LHR", arrivalAirport: "JFK", departureTime: "2026-09-23 10:00", arrivalTime: "2026-09-23 18:00", price: 420, durationMinutes: 480 });
  const wrongReturn = flight({ departureAirport: "BOS", arrivalAirport: "LHR", departureTime: "2026-10-04 20:00", arrivalTime: "2026-10-05 08:00", price: 300, durationMinutes: 420 });
  const incompleteReturn = flight({ departureAirport: "JFK", arrivalAirport: "LHR", departureTime: "2026-10-04 20:00", arrivalTime: "2026-10-05 08:00", price: 380, durationMinutes: 420, tripComplete: false });

  assert.deepEqual(composeRoundTripOptions({ route, flights: [outbound] }), []);
  assert.deepEqual(composeRoundTripOptions({ route, flights: [outbound, wrongReturn] }), []);
  assert.deepEqual(composeRoundTripOptions({ route, flights: [outbound, incompleteReturn] }), []);
});

test("round-trip composition pairs the same airports in reverse without losing valid same-day alternatives", () => {
  const multiAirportRoute = {
    ...route,
    originAirports: ["LHR", "LGW"],
    destinationAirports: ["JFK", "EWR"]
  };
  const options = composeRoundTripOptions({
    route: multiAirportRoute,
    flights: [
      flight({
        searchId: "cheaper-mismatched-outbound",
        departureAirport: "LHR",
        arrivalAirport: "JFK",
        departureTime: "2026-09-23 08:00",
        arrivalTime: "2026-09-23 16:00",
        price: 300,
        durationMinutes: 480,
        scoring: { score: 5 }
      }),
      flight({
        searchId: "compatible-outbound",
        departureAirport: "LGW",
        arrivalAirport: "EWR",
        departureTime: "2026-09-23 10:00",
        arrivalTime: "2026-09-23 18:00",
        price: 350,
        durationMinutes: 480,
        scoring: { score: 10 }
      }),
      flight({
        searchId: "compatible-return",
        departureAirport: "EWR",
        arrivalAirport: "LGW",
        departureTime: "2026-10-04 20:00",
        arrivalTime: "2026-10-05 08:00",
        price: 380,
        durationMinutes: 420
      })
    ]
  });

  assert.equal(options.length, 1);
  assert.equal(options[0].outbound.searchId, "compatible-outbound");
  assert.equal(options[0].returnFlight.searchId, "compatible-return");
});

test("route grouping exposes composed round trips instead of loose one-way results", () => {
  const flights = [
    flight({ departureAirport: "LHR", arrivalAirport: "JFK", departureTime: "2026-09-23 10:00", arrivalTime: "2026-09-23 18:00", price: 420, durationMinutes: 480 }),
    flight({ departureAirport: "JFK", arrivalAirport: "LHR", departureTime: "2026-10-04 20:00", arrivalTime: "2026-10-05 08:00", price: 380, durationMinutes: 420 })
  ];

  const grouped = groupByRouteIdea({ routeIdeas: [route] }, flights).get(route.id);

  assert.equal(grouped.length, 1);
  assert.equal(grouped[0].kind, "composed-round-trip");
});

test("decision analysis evaluates the combined fare and exposes separate-ticket risk", () => {
  const flights = [
    flight({ departureAirport: "LHR", arrivalAirport: "JFK", departureTime: "2026-09-23 10:00", arrivalTime: "2026-09-23 18:00", price: 420, durationMinutes: 480, legs: [{ duration: 480 }] }),
    flight({ departureAirport: "JFK", arrivalAirport: "LHR", departureTime: "2026-10-04 20:00", arrivalTime: "2026-10-05 08:00", price: 380, durationMinutes: 420, legs: [{ duration: 420 }] })
  ];
  const plan = { routeIdeas: [route], preferences: { hardMaxBudget: 900 } };
  const routeGroups = groupByRouteIdea(plan, flights);

  const analysis = analyzeDecision({ plan, routeGroups });

  assert.equal(analysis.best.price, 800);
  assert.equal(analysis.best.durationMinutes, 900);
  assert.equal(analysis.best.legs.length, 2);
  assert.ok(analysis.best.assumptions.some((item) => /separate/i.test(item.label)));
  const panel = renderFlightDetailPanel(analysis.best);
  assert.equal((panel.match(/This comparison combines two separately booked one-way tickets/g) ?? []).length, 1);
});

test("decision analysis applies the budget to the combined round-trip fare", () => {
  const flights = [
    flight({ departureAirport: "LHR", arrivalAirport: "JFK", departureTime: "2026-09-23 10:00", arrivalTime: "2026-09-23 18:00", price: 420, durationMinutes: 480 }),
    flight({ departureAirport: "JFK", arrivalAirport: "LHR", departureTime: "2026-10-04 20:00", arrivalTime: "2026-10-05 08:00", price: 380, durationMinutes: 420 })
  ];
  const plan = { routeIdeas: [route], preferences: { hardMaxBudget: 750 } };

  const analysis = analyzeDecision({
    plan,
    routeGroups: groupByRouteIdea(plan, flights)
  });

  assert.equal(analysis.options.length, 0);
  assert.equal(analysis.best, null);
});

test("round-trip drawer labels both directions and exposes both one-way booking links", () => {
  const option = composeRoundTripOptions({
    route,
    flights: [
      flight({
        departureAirport: "LHR",
        arrivalAirport: "JFK",
        departureTime: "2026-09-23 10:00",
        arrivalTime: "2026-09-23 18:00",
        price: 420,
        durationMinutes: 480,
        googleFlightsUrl: "https://example.test/outbound",
        legs: [leg("LHR", "JFK", 480)]
      }),
      flight({
        departureAirport: "JFK",
        arrivalAirport: "LHR",
        departureTime: "2026-10-04 20:00",
        arrivalTime: "2026-10-05 08:00",
        price: 380,
        durationMinutes: 420,
        googleFlightsUrl: "https://example.test/return",
        legs: [leg("JFK", "LHR", 420)]
      })
    ]
  })[0];

  const panel = renderFlightDetailPanel(option);

  assert.match(panel, />Outbound</);
  assert.match(panel, />Return</);
  assert.match(panel, /href="https:\/\/example\.test\/outbound"[^>]*>Open outbound/);
  assert.match(panel, /href="https:\/\/example\.test\/return"[^>]*>Open return/);
  assert.match(panel, /<span>Dates<\/span><strong>2026-09-23 to 2026-10-04<\/strong>/);
  assert.match(panel, /separately booked one-way tickets/i);
  assert.equal((panel.match(/class="timeline-leg"/g) ?? []).length, 2);

  const cardActions = flightActionLinks(option);
  assert.match(cardActions, /Open flight detail/);
  assert.doesNotMatch(cardActions, /aria-label="Open in Google Flights"/);
});

test("round-trip decision guidance retains both atomic provider search ids", () => {
  const flights = [
    flight({
      searchId: "outbound-search",
      departureAirport: "LHR",
      arrivalAirport: "JFK",
      departureTime: "2026-09-23 10:00",
      arrivalTime: "2026-09-23 18:00",
      price: 420,
      durationMinutes: 480
    }),
    flight({
      searchId: "return-search",
      departureAirport: "JFK",
      arrivalAirport: "LHR",
      departureTime: "2026-10-04 20:00",
      arrivalTime: "2026-10-05 08:00",
      price: 380,
      durationMinutes: 420
    })
  ];
  const plan = { routeIdeas: [route] };
  const refreshPlan = {
    calls: [
      { id: "outbound-search", cache: { status: "fresh" } },
      { id: "return-search", cache: { status: "fresh" } }
    ]
  };

  const analysis = analyzeDecision({
    plan,
    routeGroups: groupByRouteIdea(plan, flights),
    refreshPlan
  });

  assert.deepEqual(
    analysis.refreshGuidance.map((item) => item.searchId).sort(),
    ["outbound-search", "return-search"]
  );
});

test("disposable round-trip pipeline writes honest decision, date, route, and refresh pages", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "flight-round-trip-"));
  const outputPath = path.join(root, "outputs", "london-new-york.dashboard.html");
  const plan = {
    id: "london-new-york",
    name: "London to New York",
    intent: {
      tripType: "round-trip",
      dateCoverage: { center: "2026-09-23" },
      returnDateCoverage: { center: "2026-10-04" }
    },
    preferences: { hardMaxBudget: 900 },
    routeIdeas: [route]
  };
  const flights = [
    flight({
      searchId: "outbound-search",
      departureAirport: "LHR",
      arrivalAirport: "JFK",
      departureTime: "2026-09-23 10:00",
      arrivalTime: "2026-09-23 18:00",
      price: 420,
      durationMinutes: 480,
      googleFlightsUrl: "https://example.test/outbound",
      legs: [leg("LHR", "JFK", 480)]
    }),
    flight({
      searchId: "return-search",
      departureAirport: "JFK",
      arrivalAirport: "LHR",
      departureTime: "2026-10-04 20:00",
      arrivalTime: "2026-10-05 08:00",
      price: 380,
      durationMinutes: 420,
      googleFlightsUrl: "https://example.test/return",
      legs: [leg("JFK", "LHR", 420)]
    })
  ];
  const snapshot = await createSnapshot({ planDir: root, plan, rankedFlights: flights, source: "test" });

  try {
    await writePlanDashboard({
      plan,
      planDir: root,
      snapshots: [snapshot],
      refreshPlan: {
        selectedCallCount: 2,
        fliCallCount: 2,
        cacheHitCount: 0,
        calls: [
          { id: "outbound-search", cache: { status: "fresh" } },
          { id: "return-search", cache: { status: "fresh" } }
        ],
        warnings: []
      },
      outputPath
    });
    const pages = await Promise.all([
      readFile(outputPath, "utf8"),
      readFile(path.join(root, "outputs", "london-new-york.dates.html"), "utf8"),
      readFile(path.join(root, "outputs", "london-new-york.routes.html"), "utf8"),
      readFile(path.join(root, "outputs", "london-new-york.refresh.html"), "utf8")
    ]);

    assert.ok(pages.every((html) => html.includes("London to New York")));
    assert.match(pages[0], /Departure September 23, 2026/);
    assert.match(pages[0], /Return October 4, 2026/);
    assert.match(pages[0], /dates 2026-09-23 to 2026-10-04/);
    assert.doesNotMatch(pages[0], /dates 2026-09-23 to 2026-09-23/);
    assert.match(pages[0], /\$800/);
    assert.match(pages[0], /\$420 outbound and \$380 return/);
    assert.match(pages[0], /outbound.*LHR.*JFK.*return.*JFK.*LHR/is);
    assert.match(pages[0], /15h 0m of scheduled flight time/);
    assert.doesNotMatch(pages[0], /from <strong>LHR \(LHR\) to LHR \(LHR\)<\/strong>/);
    assert.match(pages[0], /Separate one-way tickets/);
    assert.match(pages[0], />Outbound</);
    assert.match(pages[0], />Return</);
    assert.match(pages[0], /https:\/\/example\.test\/outbound/);
    assert.match(pages[0], /https:\/\/example\.test\/return/);
    assert.match(pages[1], /\$800/);
    assert.match(pages[2], /Separate one-way tickets/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

function flight(overrides) {
  return {
    tripComplete: true,
    destinationComplete: true,
    scoring: { score: 10 },
    legs: [],
    layovers: [],
    stops: 0,
    ...overrides
  };
}

function leg(from, to, duration) {
  return {
    duration,
    airline: "Fixture Air",
    departure_airport: { id: from, name: from, time: "2026-09-23 10:00" },
    arrival_airport: { id: to, name: to, time: "2026-09-23 18:00" }
  };
}
