import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { latestSnapshots } from "../src/snapshots.js";
import { loadSnapshotPriceHistory } from "../src/snapshot-history.js";

async function writeSnapshot(planDir, id, { meta = {}, ranked = [] } = {}) {
  const dir = path.join(planDir, "snapshots", id);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "snapshot.json"), `${JSON.stringify({ id, ...meta })}\n`);
  await writeFile(path.join(dir, "ranked.json"), `${JSON.stringify(ranked)}\n`);
  return dir;
}

test("latest snapshots skip damaged state and report a structured warning", async () => {
  const planDir = await mkdtemp(path.join(tmpdir(), "flight-snapshots-"));
  const warnings = [];
  try {
    await writeSnapshot(planDir, "20260923T080000-000Z", {
      meta: { planId: "fixture-plan" },
      ranked: [{ searchId: "valid-flight", price: 500 }]
    });
    const damagedDir = await writeSnapshot(planDir, "20260924T080000-000Z");
    await writeFile(path.join(damagedDir, "ranked.json"), "{\"truncated\":");

    const snapshots = await latestSnapshots(planDir, 2, {
      onWarning: (warning) => warnings.push(warning)
    });

    assert.equal(snapshots.length, 1);
    assert.equal(snapshots[0].rankedFlights[0].searchId, "valid-flight");
    assert.deepEqual(warnings.map(({ code, snapshotDir }) => ({ code, snapshotDir })), [{
      code: "snapshot-read-failed",
      snapshotDir: damagedDir
    }]);
    assert.match(warnings[0].message, /ranked\.json/i);
  } finally {
    await rm(planDir, { recursive: true, force: true });
  }
});

test("snapshot price history skips damaged state and retains valid route points", async () => {
  const planDir = await mkdtemp(path.join(tmpdir(), "flight-snapshot-history-damaged-"));
  const warnings = [];
  const plan = {
    routeIdeas: [{ id: "lhr-syd", label: "London to Sydney", focusSearchIds: ["lhr-syd-2026-09-25"] }]
  };
  try {
    await writeSnapshot(planDir, "20260901T080000-000Z", {
      meta: { createdAt: "2026-09-01T08:00:00.000Z" },
      ranked: [{ searchId: "lhr-syd-2026-09-25", price: 840 }]
    });
    const damagedDir = await writeSnapshot(planDir, "20260902T080000-000Z");
    await writeFile(path.join(damagedDir, "ranked.json"), "{\"truncated\":");
    await writeSnapshot(planDir, "20260903T080000-000Z", {
      meta: { createdAt: "2026-09-03T08:00:00.000Z" },
      ranked: [{ searchId: "lhr-syd-2026-09-25", price: 810 }]
    });

    const history = await loadSnapshotPriceHistory(planDir, plan, {
      onWarning: (warning) => warnings.push(warning)
    });

    assert.equal(history.snapshotCount, 2);
    assert.deepEqual(history.routes[0].points.map((point) => point.price), [840, 810]);
    assert.deepEqual(warnings.map(({ code, snapshotDir }) => ({ code, snapshotDir })), [{
      code: "snapshot-history-read-failed",
      snapshotDir: damagedDir
    }]);
  } finally {
    await rm(planDir, { recursive: true, force: true });
  }
});

test("snapshot price history marks the only route price as the cheapest seen", async () => {
  const planDir = await mkdtemp(path.join(tmpdir(), "flight-snapshot-history-"));
  const plan = {
    routeIdeas: [{ id: "lhr-syd", label: "London to Sydney", focusSearchIds: ["lhr-syd-2026-09-25"] }]
  };
  try {
    await writeSnapshot(planDir, "20260901T080000-000Z", {
      meta: { createdAt: "2026-09-01T08:00:00.000Z" },
      ranked: [{
        searchId: "lhr-syd-2026-09-25",
        price: 840,
        durationMinutes: 1280,
        tripComplete: true,
        destinationComplete: true
      }]
    });

    const history = await loadSnapshotPriceHistory(planDir, plan);

    assert.equal(history.snapshotCount, 1);
    assert.equal(history.routes.length, 1);
    assert.deepEqual(history.routes[0], {
      routeIdeaId: "lhr-syd",
      routeLabel: "London to Sydney",
      points: [{
        snapshotId: "20260901T080000-000Z",
        createdAt: "2026-09-01T08:00:00.000Z",
        price: 840,
        durationMinutes: 1280,
        searchId: "lhr-syd-2026-09-25",
        currency: null
      }],
      latestPrice: 840,
      previousPrice: null,
      change: null,
      percentChange: null,
      direction: "insufficient",
      overallChange: null,
      overallPercentChange: null,
      overallDirection: "insufficient",
      cheapestPrice: 840,
      cheapestSnapshotId: "20260901T080000-000Z",
      latestIsCheapest: true
    });
  } finally {
    await rm(planDir, { recursive: true, force: true });
  }
});

test("snapshot price history reports the route change across two snapshots", async () => {
  const planDir = await mkdtemp(path.join(tmpdir(), "flight-snapshot-history-"));
  const plan = {
    routeIdeas: [{ id: "lhr-syd", label: "London to Sydney", focusSearchIds: ["lhr-syd-2026-09-25"] }]
  };
  try {
    for (const [id, createdAt, price] of [
      ["20260901T080000-000Z", "2026-09-01T08:00:00.000Z", 1000],
      ["20260902T080000-000Z", "2026-09-02T08:00:00.000Z", 880]
    ]) {
      await writeSnapshot(planDir, id, {
        meta: { createdAt },
        ranked: [{ searchId: "lhr-syd-2026-09-25", price, durationMinutes: 1280 }]
      });
    }

    const history = await loadSnapshotPriceHistory(planDir, plan);
    const route = history.routes[0];

    assert.equal(route.points.length, 2);
    assert.equal(route.latestPrice, 880);
    assert.equal(route.previousPrice, 1000);
    assert.equal(route.change, -120);
    assert.equal(route.percentChange, -12);
    assert.equal(route.direction, "down");
    assert.equal(route.latestIsCheapest, true);
  } finally {
    await rm(planDir, { recursive: true, force: true });
  }
});

test("snapshot price history keeps six points and distinguishes recent movement from the overall trend", async () => {
  const planDir = await mkdtemp(path.join(tmpdir(), "flight-snapshot-history-"));
  const plan = {
    routeIdeas: [{ id: "lhr-syd", label: "London to Sydney", focusSearchIds: ["lhr-syd-2026-09-25"] }]
  };
  const prices = [1000, 920, 850, 870, 830, 860];
  try {
    for (const [index, price] of prices.entries()) {
      const day = String(index + 1).padStart(2, "0");
      await writeSnapshot(planDir, `202609${day}T080000-000Z`, {
        meta: { createdAt: `2026-09-${day}T08:00:00.000Z` },
        ranked: [{ searchId: "lhr-syd-2026-09-25", price, durationMinutes: 1280 }]
      });
    }

    const history = await loadSnapshotPriceHistory(planDir, plan);
    const route = history.routes[0];

    assert.deepEqual(route.points.map((point) => point.price), prices);
    assert.equal(route.change, 30);
    assert.equal(route.direction, "up");
    assert.equal(route.overallChange, -140);
    assert.equal(route.overallPercentChange, -14);
    assert.equal(route.overallDirection, "down");
    assert.equal(route.cheapestPrice, 830);
    assert.equal(route.cheapestSnapshotId, "20260905T080000-000Z");
    assert.equal(route.latestIsCheapest, false);
  } finally {
    await rm(planDir, { recursive: true, force: true });
  }
});

test("snapshot price history groups a generic route without an exact focus search id", async () => {
  const planDir = await mkdtemp(path.join(tmpdir(), "flight-snapshot-history-"));
  const plan = {
    destination: { airports: ["SYD"] },
    routeIdeas: [{
      id: "lhr-syd",
      label: "London to Sydney",
      type: "direct-to-final",
      originAirports: ["LHR"],
      destinationAirports: ["SYD"]
    }]
  };
  try {
    await writeSnapshot(planDir, "20260901T080000-000Z", {
      meta: { createdAt: "2026-09-01T08:00:00.000Z" },
      ranked: [{
        searchId: "one-way-lhr-syd-2026-09-25",
        searchTitle: "London to Sydney, depart 2026-09-25",
        price: 790,
        durationMinutes: 1260,
        departureAirport: "LHR",
        arrivalAirport: "SYD",
        tripComplete: true,
        destinationComplete: true
      }]
    });

    const history = await loadSnapshotPriceHistory(planDir, plan);

    assert.equal(history.routes[0].points.length, 1);
    assert.equal(history.routes[0].latestPrice, 790);
  } finally {
    await rm(planDir, { recursive: true, force: true });
  }
});
