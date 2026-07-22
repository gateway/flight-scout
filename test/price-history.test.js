import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  PRICE_HISTORY_THRESHOLDS,
  assessCurrentPrice,
  buildPriceHistory,
  derivePriceHistorySummary
} from "../src/price-history.js";
import { createSnapshot } from "../src/snapshots.js";

const PLAN = { id: "history-plan", name: "History Plan" };

test("snapshot creation stores complete-option history fields in metadata", async () => {
  const planDir = await mkdtemp(path.join(tmpdir(), "flight-price-summary-"));
  try {
    const snapshot = await createSnapshot({
      planDir,
      plan: PLAN,
      source: "test",
      rankedFlights: [
        flight({ price: 620, durationMinutes: 540, departureTime: "2026-09-25 08:00" }),
        flight({ price: 580, durationMinutes: 600, departureTime: "2026-09-25 10:00" }),
        flight({ price: 590, durationMinutes: 510, departureTime: "2026-09-26 08:00" }),
        flight({ price: 400, durationMinutes: 300, departureTime: "2026-09-27 08:00", tripComplete: false })
      ]
    });

    assert.deepEqual(pickHistoryFields(snapshot.meta.summary), {
      cheapestCompletePrice: 580,
      fastestCompleteDurationMinutes: 510,
      bestPrice: 620,
      currency: "USD",
      mixedCurrency: false,
      cheapestByDate: { "2026-09-25": 580, "2026-09-26": 590 }
    });
  } finally {
    await rm(planDir, { recursive: true, force: true });
  }
});

test("summary derivation reports mixed currencies without inventing one", () => {
  const summary = derivePriceHistorySummary([
    flight({ price: 500, providerCurrency: "USD" }),
    flight({ price: 460, providerCurrency: "EUR" })
  ]);

  assert.equal(summary.currency, null);
  assert.equal(summary.mixedCurrency, true);
});

test("history lazily backfills legacy snapshots without rewriting them", async () => {
  const planDir = await mkdtemp(path.join(tmpdir(), "flight-price-backfill-"));
  try {
    const snapshotDir = await writeSnapshot(planDir, "20260901T080000-000Z", {
      createdAt: "2026-09-01T08:00:00.000Z",
      summary: {}
    }, [flight({ price: 540, departureTime: "2026-09-25 08:00" })]);
    const metaPath = path.join(snapshotDir, "snapshot.json");
    const before = await readFile(metaPath, "utf8");

    const series = await buildPriceHistory(planDir);

    assert.deepEqual(series, [{
      snapshotId: "20260901T080000-000Z",
      createdAt: "2026-09-01T08:00:00.000Z",
      cheapestCompletePrice: 540,
      bestPrice: 540,
      cheapestByDate: { "2026-09-25": 540 },
      currency: "USD"
    }]);
    assert.equal(await readFile(metaPath, "utf8"), before);
  } finally {
    await rm(planDir, { recursive: true, force: true });
  }
});

test("history skips empty snapshots and explicit currencies unlike the latest", async () => {
  const planDir = await mkdtemp(path.join(tmpdir(), "flight-price-series-"));
  try {
    await writeSummarySnapshot(planDir, "20260901T080000-000Z", "2026-09-01T08:00:00.000Z", 500, "EUR");
    await writeSnapshot(planDir, "20260902T080000-000Z", {
      createdAt: "2026-09-02T08:00:00.000Z",
      summary: { completeOptions: 0, ...emptyHistorySummary() }
    }, []);
    await writeSummarySnapshot(planDir, "20260903T080000-000Z", "2026-09-03T08:00:00.000Z", 560, "USD");

    const series = await buildPriceHistory(planDir);

    assert.deepEqual(series.map((point) => point.snapshotId), ["20260903T080000-000Z"]);
  } finally {
    await rm(planDir, { recursive: true, force: true });
  }
});

test("price assessment handles one and two observations with factual copy", () => {
  const one = assessCurrentPrice(series([600]));
  assert.equal(one.status, "insufficient-history");
  assert.match(one.sentence, /Only one saved check so far/);
  assert.match(one.sentence, /1 check since July 1/);

  const two = assessCurrentPrice(series([543, 657]));
  assert.equal(two.status, "delta-only");
  assert.match(two.sentence, /\$657 now vs \$543 on July 1/);
  assert.match(two.sentence, /2 checks since July 1/);
});

test("price assessment applies every observed-price band at its boundaries", () => {
  assert.equal(PRICE_HISTORY_THRESHOLDS.nearLowRatio, 0.1);
  assert.equal(PRICE_HISTORY_THRESHOLDS.nearHighRatio, 0.1);
  const cases = [
    { prices: [100, 150, 100], status: "lowest-seen" },
    { prices: [100, 150, 110], status: "near-low" },
    { prices: [100, 200, 150], status: "middle" },
    { prices: [100, 200, 180], status: "near-high" },
    { prices: [100, 150, 150], status: "highest-seen" }
  ];
  for (const fixture of cases) {
    const result = assessCurrentPrice(series(fixture.prices));
    assert.equal(result.status, fixture.status, fixture.status);
    assert.match(result.sentence, /3 checks since July 1/);
    assert.doesNotMatch(result.sentence, /\b(?:buy|wait|will|should)\b/i);
  }
});

function flight(overrides = {}) {
  return {
    searchId: "fixture-search",
    searchTitle: "Fixture route",
    price: 540,
    durationMinutes: 500,
    departureTime: "2026-09-25 08:00",
    tripComplete: true,
    destinationComplete: true,
    providerCurrency: "USD",
    ...overrides
  };
}

function pickHistoryFields(summary) {
  const { cheapestCompletePrice, fastestCompleteDurationMinutes, bestPrice, currency, mixedCurrency, cheapestByDate } = summary;
  return { cheapestCompletePrice, fastestCompleteDurationMinutes, bestPrice, currency, mixedCurrency, cheapestByDate };
}

async function writeSnapshot(planDir, id, meta, ranked) {
  const snapshotDir = path.join(planDir, "snapshots", id);
  await mkdir(snapshotDir, { recursive: true });
  await writeFile(path.join(snapshotDir, "snapshot.json"), `${JSON.stringify({ id, ...meta }, null, 2)}\n`);
  await writeFile(path.join(snapshotDir, "ranked.json"), `${JSON.stringify(ranked, null, 2)}\n`);
  return snapshotDir;
}

async function writeSummarySnapshot(planDir, id, createdAt, price, currency) {
  return writeSnapshot(planDir, id, {
    createdAt,
    summary: {
      completeOptions: 1,
      cheapestCompletePrice: price,
      fastestCompleteDurationMinutes: 500,
      bestPrice: price,
      currency,
      mixedCurrency: false,
      cheapestByDate: { "2026-09-25": price }
    }
  }, []);
}

function emptyHistorySummary() {
  return {
    cheapestCompletePrice: null,
    fastestCompleteDurationMinutes: null,
    bestPrice: null,
    currency: null,
    mixedCurrency: false,
    cheapestByDate: {}
  };
}

function series(prices) {
  return prices.map((price, index) => ({
    snapshotId: `snapshot-${index + 1}`,
    createdAt: `2026-07-0${index + 1}T08:00:00.000Z`,
    cheapestCompletePrice: price,
    bestPrice: price,
    cheapestByDate: {},
    currency: "USD"
  }));
}
