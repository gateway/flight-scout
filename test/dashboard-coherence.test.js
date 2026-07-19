import test from "node:test";
import assert from "node:assert/strict";
import { renderRoute } from "../src/dashboard-routes-page.js";
import { renderDateOpportunities, renderPriceGraph } from "../src/dashboard-date-page.js";
import { analyzeDecision } from "../src/decision-analysis.js";
import { renderOverview } from "../src/plan-list-overview.js";
import { analyzePlan } from "../src/refresh-summary.js";
import { groupByRouteIdea } from "../src/route-options.js";

function routeFlight(index, overrides = {}) {
  return {
    routeIdeaId: "test-route",
    searchId: `flight-${index}`,
    searchTitle: `Flight ${index}`,
    price: 800 + index,
    durationMinutes: 700 + index,
    duration: `${11 + index}h 40m`,
    departureAirport: "AAA",
    arrivalAirport: "BBB",
    departureTime: "2026-08-01 08:00",
    arrivalTime: "2026-08-01 20:00",
    airline: `Airline ${index}`,
    stops: 1,
    tripComplete: true,
    destinationComplete: true,
    legs: [],
    layovers: [],
    ...overrides
  };
}

function renderedMetricValues(html, metric) {
  return [...html.matchAll(new RegExp(`data-${metric}="(\\d+)"`, "g"))]
    .map((match) => Number(match[1]));
}

test("route evidence includes the true cheapest and fastest complete options beyond the best-ranked limit", () => {
  const flights = Array.from({ length: 10 }, (_, index) => routeFlight(index));
  flights[8] = routeFlight(8, { price: 99, durationMinutes: 708 });
  flights[9] = routeFlight(9, { price: 809, durationMinutes: 120 });

  const html = renderRoute(
    { id: "test-route", label: "Test route", summary: "A focused route fixture." },
    flights,
    { calls: [] }
  );

  const prices = renderedMetricValues(html, "price");
  const durations = renderedMetricValues(html, "duration");
  assert.equal(Math.min(...prices), 99);
  assert.equal(Math.min(...durations), 120);
  assert.equal(prices.length, 10);
});

test("route cards do not repeat a single layover already shown as the connection", () => {
  const layover = { id: "MID", name: "Middle Airport", duration: 120 };
  const html = renderRoute(
    { id: "test-route", label: "Test route", summary: "A focused route fixture." },
    [routeFlight(1, {
      layovers: [layover],
      connectionRisk: { level: "safe", shortest: layover }
    })],
    { calls: [] }
  );

  assert.equal((html.match(/MID 2h 0m/g) ?? []).length, 1);
});

test("route price scan plots the cheapest complete option on each date instead of the balanced option", () => {
  const balanced = routeFlight(1, {
    departureTime: "2026-10-02 08:00",
    price: 500,
    durationMinutes: 600,
    humanScore: 10
  });
  const cheapest = routeFlight(2, {
    departureTime: "2026-10-02 10:00",
    price: 300,
    durationMinutes: 720,
    humanScore: 80
  });

  const analysis = {
    options: [balanced, cheapest],
    best: balanced,
    dateOpportunities: [{
      date: "2026-10-02",
      balanced,
      cheapest,
      fastest: balanced
    }]
  };
  const html = renderPriceGraph(
    { routeIdeas: [{ id: "test-route", label: "Test route" }] },
    analysis
  );
  const cards = renderDateOpportunities(analysis);

  assert.ok(html.includes("<strong>$300</strong>"));
  assert.ok(!html.includes("<strong>$500</strong>"));
  assert.ok(html.includes("$300, 12h"));
  assert.ok(cards.includes("Cheapest that day:"));
  assert.ok(cards.includes("$300"));
});

test("overview and refresh summary use the same human-ranked best flight as the decision page", () => {
  const riskyScorerPick = routeFlight(1, {
    price: 700,
    durationMinutes: 600,
    layovers: [{ id: "MID", duration: 30 }],
    scoring: { score: 1, breakdown: { estimatedTotalCost: 700 } }
  });
  const saferHumanPick = routeFlight(2, {
    price: 720,
    durationMinutes: 620,
    layovers: [{ id: "MID", duration: 180 }],
    scoring: { score: 200, breakdown: { estimatedTotalCost: 720 } }
  });
  const plan = {
    id: "ranking-fixture",
    name: "Ranking fixture",
    routeIdeas: [{
      id: "test-route",
      label: "Test route",
      focusSearchIds: [riskyScorerPick.searchId, saferHumanPick.searchId]
    }],
    watchRules: []
  };
  const latest = {
    rankedFlights: [riskyScorerPick, saferHumanPick],
    summary: {
      balanced: riskyScorerPick,
      cheapest: riskyScorerPick,
      fastest: riskyScorerPick
    }
  };
  const decision = analyzeDecision({
    plan,
    routeGroups: groupByRouteIdea(plan, latest.rankedFlights),
    current: latest
  });
  const item = {
    plan,
    latest,
    decision,
    comparison: { available: false },
    dashboardHref: "ranking-fixture.dashboard.html"
  };

  assert.equal(decision.best.searchId, saferHumanPick.searchId);
  assert.equal(analyzePlan(item).best.searchId, decision.best.searchId);
  const overview = renderOverview([item], "");
  assert.match(overview, /current clean starting point at[^.]*\$720/);
  assert.match(overview, /<span>Best<\/span><strong>\$720<\/strong>/);
});
