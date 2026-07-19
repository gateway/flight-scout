import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { writePlanDashboard } from "../src/dashboard.js";
import { loadSnapshotPriceHistory } from "../src/snapshot-history.js";
import { latestSnapshots } from "../src/snapshots.js";

const plan = {
  id: "london-to-sydney",
  name: "London to Sydney",
  destination: { airports: ["SYD"] },
  intent: { dateCoverage: { center: "2026-09-25", plusMinusDays: 1 } },
  routeIdeas: [{
    id: "lhr-syd",
    label: "London to Sydney",
    type: "direct-to-final",
    originAirports: ["LHR"],
    destinationAirports: ["SYD"]
  }]
};

test("route evidence renders full price history and the historical low marker", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "flight-history-dashboard-"));
  const prices = [1000, 920, 850, 870, 830, 860];
  try {
    for (const [index, price] of prices.entries()) await writeSnapshot(root, index, price);
    const snapshots = await latestSnapshots(root, 2);
    const snapshotHistory = await loadSnapshotPriceHistory(root, plan);
    const outputPath = path.join(root, "outputs", "london-to-sydney.dashboard.html");

    await writePlanDashboard({ plan, planDir: root, snapshots, snapshotHistory, outputPath });

    const routesHtml = await readFile(path.join(root, "outputs", "london-to-sydney.routes.html"), "utf8");
    assert.match(routesHtml, /Price history/);
    assert.match(routesHtml, /6 saved prices/);
    assert.match(routesHtml, /Up \$30 since the previous saved price/);
    assert.match(routesHtml, /Down \$140 across all 6 saved prices/);
    assert.match(routesHtml, /Cheapest seen: \$830/);
    assert.match(routesHtml, /data-history-point/g);
    assert.equal((routesHtml.match(/data-history-point/g) ?? []).length, 6);
    assert.match(routesHtml, /history-point cheapest/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("route evidence explains a single saved price without duplicate comparison copy", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "flight-history-dashboard-one-point-"));
  try {
    await writeSnapshot(root, 0, 1000);
    const snapshots = await latestSnapshots(root, 2);
    const snapshotHistory = await loadSnapshotPriceHistory(root, plan);
    const outputPath = path.join(root, "outputs", "london-to-sydney.dashboard.html");

    await writePlanDashboard({ plan, planDir: root, snapshots, snapshotHistory, outputPath });

    const routesHtml = await readFile(path.join(root, "outputs", "london-to-sydney.routes.html"), "utf8");
    assert.match(routesHtml, /Only one saved price so far; price movement will show after the next refresh\./);
    assert.doesNotMatch(routesHtml, /More history is needed/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

async function writeSnapshot(planDir, index, price) {
  const day = String(index + 1).padStart(2, "0");
  const id = `202609${day}T080000-000Z`;
  const dir = path.join(planDir, "snapshots", id);
  const flight = {
    searchId: "one-way-lhr-syd-2026-09-25",
    searchTitle: "London to Sydney, depart 2026-09-25",
    price,
    durationMinutes: 1260,
    departureAirport: "LHR",
    arrivalAirport: "SYD",
    departureTime: "2026-09-25 10:00",
    arrivalTime: "2026-09-26 07:00",
    tripComplete: true,
    destinationComplete: true,
    scoring: { score: 100, breakdown: { estimatedTotalCost: price } }
  };
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "snapshot.json"), `${JSON.stringify({
    id,
    createdAt: `2026-09-${day}T08:00:00.000Z`,
    source: "test",
    summary: { totalOptions: 1, completeOptions: 1 }
  })}\n`);
  await writeFile(path.join(dir, "ranked.json"), `${JSON.stringify([flight])}\n`);
}
