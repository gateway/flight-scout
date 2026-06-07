import test from "node:test";
import assert from "node:assert/strict";
import { isHardRejected, rankFlights, scoreFlight } from "../src/scorer.js";

test("flags short gateway connection risk", () => {
  const score = scoreFlight({
    price: 1000,
    durationMinutes: 1200,
    stops: 2,
    layovers: [{ id: "SEA", duration: 90 }]
  }, {
    preferredDomesticConnectionMinutes: 90,
    preferredInternationalToDomesticConnectionMinutes: 180
  });
  assert.ok(score.notes.some((note) => note.includes("SEA gateway connection")));
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
