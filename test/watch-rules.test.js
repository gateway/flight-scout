import test from "node:test";
import assert from "node:assert/strict";
import { evaluateWatchRules } from "../src/watch-rules.js";
import { renderOverview } from "../src/plan-list-overview.js";
import { renderWatchAlerts } from "../src/dashboard-watch-alerts.js";

function flight(id, price, durationMinutes, score = 100) {
  return {
    id,
    price,
    durationMinutes,
    departureAirport: "LHR",
    arrivalAirport: "SYD",
    departureTime: "2026-09-25 10:00",
    scoring: { score, breakdown: { estimatedTotalCost: price } }
  };
}

test("price watch rule returns only the best matching saved flight", () => {
  const alerts = evaluateWatchRules([
    { id: "under-700", label: "Under $700", enabled: true, maxPriceUsd: 700 }
  ], [
    flight("over", 720, 1_100, 30),
    flight("match-expensive", 680, 1_000, 80),
    flight("match-best", 640, 1_050, 60)
  ]);

  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].ruleId, "under-700");
  assert.equal(alerts[0].flight.id, "match-best");
  assert.equal(alerts[0].matched.maxPriceUsd, 700);
  assert.equal(alerts[0].outcome, "met");
});

test("duration watch rule triggers only within its travel-time limit", () => {
  const alerts = evaluateWatchRules([
    { id: "under-16h", label: "Under 16 hours", maxDurationMinutes: 960 }
  ], [
    flight("too-long", 500, 961, 10),
    flight("quick-enough", 650, 940, 40)
  ]);

  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].flight.id, "quick-enough");
  assert.equal(alerts[0].matched.maxDurationMinutes, 960);
});

test("watch rules ignore incomplete and hard-rejected flight results", () => {
  const incomplete = { ...flight("incomplete", 400, 800, 5), tripComplete: false };
  const rejected = {
    ...flight("hard-reject", 450, 820, 10),
    scoring: { score: 10, labels: ["hard-reject"], breakdown: { estimatedTotalCost: 450 } }
  };
  const usable = flight("usable", 600, 900, 70);

  const alerts = evaluateWatchRules([
    { id: "usable-only", label: "Usable only", maxPriceUsd: 700, maxDurationMinutes: 960 }
  ], [incomplete, rejected, usable]);

  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].flight.id, "usable");
});

test("combined watch rules require every configured threshold", () => {
  const alerts = evaluateWatchRules([
    { id: "target", label: "Target", maxPriceUsd: 700, maxDurationMinutes: 960 }
  ], [
    flight("cheap-but-long", 600, 980, 10),
    flight("fast-but-expensive", 720, 900, 20),
    flight("matches-both", 680, 940, 30)
  ]);

  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].flight.id, "matches-both");
});

test("disabled and malformed watch rules do not produce status cards", () => {
  assert.deepEqual(evaluateWatchRules([
    { id: "disabled", label: "Disabled", enabled: false, maxPriceUsd: 700 }
  ], [flight("match", 650, 900)]), []);

  assert.deepEqual(evaluateWatchRules({ id: "malformed" }, [flight("match", 650, 900)]), []);
  assert.deepEqual(evaluateWatchRules([
    { id: "missing-price", maxPriceUsd: 500 }
  ], [{ ...flight("missing", 650, 900), price: undefined, scoring: undefined }]), []);
});

test("unmatched watch rules return the closest usable flight as a missed target", () => {
  const [status] = evaluateWatchRules([
    { id: "target", label: "Under $500", maxPriceUsd: 500 }
  ], [flight("far", 700, 900), flight("closest", 650, 900)]);

  assert.equal(status.outcome, "missed");
  assert.equal(status.flight.id, "closest");
  assert.deepEqual(status.misses, { priceUsd: 150 });
});

test("watch alerts provide a readable fallback label", () => {
  const [alert] = evaluateWatchRules([
    { id: "under-700", maxPriceUsd: 700 }
  ], [flight("match", 650, 900)]);

  assert.equal(alert.label, "Saved target met");
});

test("watch status cards style met targets calmly and missed targets as alerts", () => {
  const [met] = evaluateWatchRules([
    { id: "met", maxPriceUsd: 700 }
  ], [flight("match", 650, 900)]);
  const [missed] = evaluateWatchRules([
    { id: "missed", maxPriceUsd: 500 }
  ], [flight("over", 650, 900)]);

  const metHtml = renderWatchAlerts([met]);
  assert.match(metHtml, /<h2>Saved Target Status<\/h2>/);
  assert.match(metHtml, /watch-target-card/);
  assert.match(metHtml, /Target met/);
  assert.match(metHtml, />✓</);
  assert.doesNotMatch(metHtml, /watch-alert-card/);

  const missedHtml = renderWatchAlerts([missed]);
  assert.match(missedHtml, /watch-alert-card/);
  assert.match(missedHtml, /Target missed/);
  assert.match(missedHtml, />!</);
  assert.match(missedHtml, /\$650<\/span> is \$150 over your \$500 price target/);
});

test("active-plan overview labels a met target without warning language", () => {
  const html = renderOverview([{
    plan: {
      id: "london-sydney",
      name: "London to Sydney",
      watchRules: [{ id: "target", label: "Target met", maxPriceUsd: 700 }],
      routeIdeas: [{ id: "route", label: "London to Sydney" }]
    },
    latest: {
      rankedFlights: [flight("match", 650, 900)],
      summary: { balanced: flight("match", 650, 900) }
    },
    dashboardHref: "london-sydney.dashboard.html",
    comparison: { available: false }
  }], "outputs/");

  assert.doesNotMatch(html, /Watch alert/);
  assert.match(html, /Target met/);
  assert.match(html, /Open target status/);
  assert.match(html, /\$650/);
  assert.match(html, /15h 0m/);
});
