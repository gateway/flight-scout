import test from "node:test";
import assert from "node:assert/strict";
import { classifyCandidate, summarizeViability, viabilityRulesFrom, VIABILITY } from "../src/viability.js";

const rules = viabilityRulesFrom({
  trip: {
    budget: { softMax: 1500, hardMax: 1800 },
    rules: {
      maxSingleTravelDayHours: 26,
      rejectTotalElapsedHoursOver: 35,
      preferredDomesticConnectionMinutes: 90,
      preferredInternationalToDomesticConnectionMinutes: 180
    }
  }
});

test("classifyCandidate hard rejects flights outside user criteria", () => {
  const result = classifyCandidate({ price: 900, durationMinutes: 36 * 60, stops: 2, layovers: [], tripComplete: true, destinationComplete: true }, rules);
  assert.equal(result.status, VIABILITY.HARD_REJECT);
  assert.ok(result.reasons.some((reason) => reason.includes("35h hard limit")));
});

test("classifyCandidate keeps long-but-not-rejected flights on the watch list", () => {
  const result = classifyCandidate({ price: 900, durationMinutes: 28 * 60, stops: 2, layovers: [], tripComplete: true, destinationComplete: true }, rules);
  assert.equal(result.status, VIABILITY.WATCH);
  assert.ok(result.reasons.some((reason) => reason.includes("long travel day")));
});

test("summarizeViability counts recommendation, watch, hidden, and reject pools", () => {
  const summary = summarizeViability([
    { price: 900, durationMinutes: 20 * 60, stops: 1, layovers: [], tripComplete: true, destinationComplete: true },
    { price: 900, durationMinutes: 28 * 60, stops: 1, layovers: [], tripComplete: true, destinationComplete: true },
    { price: 900, durationMinutes: 36 * 60, stops: 1, layovers: [], tripComplete: true, destinationComplete: true },
    { price: 900, durationMinutes: 12 * 60, stops: 1, layovers: [], tripComplete: false, destinationComplete: true }
  ], rules);
  assert.equal(summary.recommended, 1);
  assert.equal(summary.watch, 1);
  assert.equal(summary.hardReject, 1);
  assert.equal(summary.hiddenByPreference, 1);
});
