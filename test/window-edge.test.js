import assert from "node:assert/strict";
import test from "node:test";

import { detectWindowEdgeSuggestion } from "../src/window-edge.js";

const window = { start: "2026-10-01", end: "2026-10-05" };

test("window edge detection suggests the uniquely cheapest boundary", () => {
  assert.deepEqual(detectWindowEdgeSuggestion({
    departureWindow: window,
    pricesByDate: new Map([
      ["2026-10-01", 500],
      ["2026-10-02", 650],
      ["2026-10-03", 600]
    ])
  }), {
    direction: "earlier",
    addDays: 2,
    edgeDate: "2026-10-01",
    edgePrice: 500,
    runnerUpPrice: 600,
    dates: ["2026-09-29", "2026-09-30"]
  });

  assert.equal(detectWindowEdgeSuggestion({
    departureWindow: window,
    pricesByDate: { "2026-10-02": 650, "2026-10-05": 510 }
  }).direction, "later");
});

test("window edge detection suppresses middle lows, ties, sparse data, and capped windows", () => {
  const cases = [
    new Map([["2026-10-01", 600], ["2026-10-03", 500], ["2026-10-05", 700]]),
    new Map([["2026-10-01", 500], ["2026-10-03", 500], ["2026-10-05", 700]]),
    new Map([["2026-10-01", 500]])
  ];
  for (const pricesByDate of cases) {
    assert.equal(detectWindowEdgeSuggestion({ departureWindow: window, pricesByDate }), null);
  }
  assert.equal(detectWindowEdgeSuggestion({
    departureWindow: { start: "2026-10-01", end: "2026-10-14" },
    pricesByDate: new Map([["2026-10-01", 500], ["2026-10-02", 600]]),
    maxWindowDays: 14
  }), null);
});

test("window edge detection trims its suggestion to the remaining cap", () => {
  const suggestion = detectWindowEdgeSuggestion({
    departureWindow: { start: "2026-10-01", end: "2026-10-13" },
    pricesByDate: new Map([["2026-10-12", 600], ["2026-10-13", 500]]),
    maxWindowDays: 14
  });

  assert.equal(suggestion.addDays, 1);
  assert.deepEqual(suggestion.dates, ["2026-10-14"]);
});
