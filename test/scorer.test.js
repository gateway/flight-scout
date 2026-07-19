import test from "node:test";
import assert from "node:assert/strict";
import { isHardRejected, rankFlights, scoreFlight } from "../src/scorer.js";

test("flags short connection risk from flight-level geography metadata", () => {
  const score = scoreFlight({
    price: 1000,
    durationMinutes: 1200,
    stops: 2,
    layovers: [{ id: "SEA", duration: 90, connectionType: "international-to-domestic" }]
  }, {
    preferredDomesticConnectionMinutes: 90,
    preferredInternationalToDomesticConnectionMinutes: 180
  });
  assert.ok(score.notes.some((note) => note.includes("SEA international-to-domestic connection")));
});

test("fewest-layover route can rank ahead of cheaper messy route", () => {
  const ranked = rankFlights([
    { price: 900, durationMinutes: 1700, stops: 4, layovers: [] },
    { price: 1050, durationMinutes: 1250, stops: 1, layovers: [] }
  ], { budget: { softMax: 1300 }, rules: { maxSingleTravelDayHours: 26 } });
  assert.equal(ranked[0].stops, 1);
});

test("hard duration threshold marks painful flights as ignored candidates", () => {
  const [flight] = rankFlights([
    { price: 700, durationMinutes: 36 * 60, stops: 2, layovers: [] }
  ], { rules: { rejectTotalElapsedHoursOver: 35 } });
  assert.equal(isHardRejected(flight), true);
  assert.ok(flight.scoring.notes.some((note) => note.includes("hard 35h threshold")));
});

test("missing layover duration is unverified instead of a tight connection", () => {
  const score = scoreFlight({
    price: 800,
    durationMinutes: 900,
    stops: 1,
    layovers: [{ id: "TPE", duration: null }]
  }, {
    preferredDomesticConnectionMinutes: 90
  });

  assert.ok(score.labels.includes("needs-verification"));
  assert.ok(score.notes.some((note) => note.includes("TPE") && note.includes("verification")));
  assert.ok(!score.notes.some((note) => note.includes("under 90m")));
});

test("explicit connection metadata applies the international-to-domestic threshold", () => {
  const score = scoreFlight({
    price: 800,
    durationMinutes: 900,
    stops: 1,
    layovers: [{ id: "YUL", duration: 120 }]
  }, {
    preferredDomesticConnectionMinutes: 90,
    preferredInternationalToDomesticConnectionMinutes: 180,
    connectionTypesByAirport: { YUL: "international-to-domestic" }
  });

  assert.ok(score.notes.some((note) => note.includes("YUL") && note.includes("international-to-domestic") && note.includes("180m")));
});

test("finite connection timing remains unverified when geography metadata is absent", () => {
  const score = scoreFlight({
    price: 800,
    durationMinutes: 900,
    stops: 1,
    layovers: [{ id: "YUL", duration: 120 }]
  }, {
    preferredDomesticConnectionMinutes: 90,
    preferredInternationalToDomesticConnectionMinutes: 180
  });

  assert.ok(score.labels.includes("needs-verification"));
  assert.ok(score.notes.includes("YUL connection type needs verification"));
  assert.ok(!score.notes.some((note) => note.includes("international-to-domestic")));
});
