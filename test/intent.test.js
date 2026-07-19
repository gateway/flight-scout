import test from "node:test";
import assert from "node:assert/strict";
import { parseTripIntent } from "../src/intent.js";

test("parses budget, fastest priority, date window, and Tokyo openness", () => {
  const intent = parseTripIntent("Find me the fastest route from Chiang Mai or Bangkok to Redmond Aug 1-5, 2026, maybe Tokyo if worth it, under $1300");
  assert.equal(intent.interpreted.departureWindow.start, "2026-08-01");
  assert.equal(intent.interpreted.departureWindow.end, "2026-08-05");
  assert.equal(intent.interpreted.tripType, "one-way");
  assert.equal(intent.interpreted.budget.target, 1300);
  assert.equal(intent.interpreted.priorities.fastest, true);
  assert.equal(intent.interpreted.optionalStops[0].label, "Tokyo");
  assert.equal(intent.interpreted.optionalStops[0].required, false);
});

test("parses one-way plus-minus date windows", () => {
  const intent = parseTripIntent("one way CNX to RDM plus or minus 3 days from August 1st, 2026, stopover Tokyo 1 night if worth it");
  assert.equal(intent.interpreted.tripType, "one-way");
  assert.equal(intent.interpreted.departureWindow.start, "2026-07-29");
  assert.equal(intent.interpreted.departureWindow.end, "2026-08-04");
  assert.equal(intent.interpreted.departureWindow.mode, "plus-minus");
  assert.equal(intent.interpreted.optionalStops[0].nights[0], 1);
});
