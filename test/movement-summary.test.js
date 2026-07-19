import test from "node:test";
import assert from "node:assert/strict";
import { movementRead } from "../src/movement-summary.js";
import { compareSnapshots } from "../src/snapshot-compare.js";

test("movement copy treats results after an empty snapshot as the first full baseline", () => {
  const current = {
    rankedFlights: [
      flight("first", 500),
      flight("second", 550)
    ]
  };
  const comparison = compareSnapshots(current, { rankedFlights: [] });

  assert.equal(comparison.previousOptionCount, 0);
  assert.deepEqual(movementRead(comparison), {
    label: "First full results",
    body: "First full results for this plan. 2 options saved as the baseline for future price comparison.",
    tone: "info"
  });
});

test("snapshot summary describes a price drop without exposing an internal search id", () => {
  const previous = {
    rankedFlights: [flight("one-way-kef-bkk-2026-10-03", 680, "Keflavik to Bangkok on October 3, 2026")]
  };
  const current = {
    rankedFlights: [flight("one-way-kef-bkk-2026-10-03", 657, "Keflavik to Bangkok on October 3, 2026")]
  };

  const comparison = compareSnapshots(current, previous);

  assert.equal(
    comparison.summary,
    "1 matched option got cheaper. Best drop: $23 on Keflavik to Bangkok on October 3, 2026."
  );
  assert.doesNotMatch(comparison.summary, /one-way-kef-bkk/);
});

test("detailed movement copy does not repeat dates or call an increase cheaper", () => {
  const previous = {
    rankedFlights: [
      flight("one-way-kef-bkk-2026-10-03", 680, "KEF -> BKK on 2026-10-03"),
      flight("one-way-kef-bkk-2026-10-04", 600, "KEF -> BKK on 2026-10-04")
    ]
  };
  const current = {
    rankedFlights: [
      flight("one-way-kef-bkk-2026-10-03", 657, "KEF -> BKK on 2026-10-03"),
      flight("one-way-kef-bkk-2026-10-04", 625, "KEF -> BKK on 2026-10-04")
    ]
  };

  const comparison = compareSnapshots(current, previous);
  const increaseOnly = compareSnapshots(
    { rankedFlights: [flight("one-way-kef-bkk-2026-10-04", 625, "KEF -> BKK on 2026-10-04")] },
    { rankedFlights: [flight("one-way-kef-bkk-2026-10-04", 600, "KEF -> BKK on 2026-10-04")] }
  );

  assert.equal(comparison.humanSummary[0], "Best drop: KEF -> BKK on 2026-10-03 is $23 cheaper.");
  assert.ok(increaseOnly.humanSummary.includes("Date summary: 2026-10-04: $25 more expensive across 1 changed option."));
  assert.doesNotMatch(`${comparison.humanSummary.join(" ")} ${increaseOnly.humanSummary.join(" ")}`, /on 2026-10-03 on 2026-10-03|\$0 cheaper/);
});

function flight(searchId, price, searchTitle = null) {
  return {
    searchId,
    searchTitle,
    price,
    durationMinutes: 600,
    departureTime: "2026-08-01 10:00",
    airline: "Example Air",
    legs: [{
      departure_airport: { id: "AAA" },
      arrival_airport: { id: "BBB" },
      flight_number: searchId
    }]
  };
}
