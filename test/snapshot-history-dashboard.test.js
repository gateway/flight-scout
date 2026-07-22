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

    const decisionHtml = await readFile(outputPath, "utf8");
    const routesHtml = await readFile(path.join(root, "outputs", "london-to-sydney.routes.html"), "utf8");
    assert.match(decisionHtml, /Price Changes/);
    assert.match(decisionHtml, /Today&#39;s \$860 is near the low end of this plan&#39;s saved prices across 6 checks since September 1\./);
    assert.match(decisionHtml, /Cheapest seen: \$830 on September 5, 2026/);
    assert.match(decisionHtml, /Earlier checks/);
    assert.match(decisionHtml, /Latest check/);
    assert.match(decisionHtml, /Price changes across 6 saved checks from September 1, 2026 through September 6, 2026; latest price \$860/);
    assert.equal((decisionHtml.match(/data-price-history-point/g) ?? []).length, 6);
    assert.match(routesHtml, /Price Changes/);
    assert.match(routesHtml, /6 saved checks/);
    assert.match(routesHtml, /Earlier checks/);
    assert.match(routesHtml, /Latest check/);
    assert.match(routesHtml, /Today&#39;s \$860 is near the low end of this plan&#39;s saved prices across 6 checks since September 1\./);
    assert.match(routesHtml, /Cheapest seen: \$830/);
    assert.equal((routesHtml.match(/data-price-history-point/g) ?? []).length, 6);
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

    const decisionHtml = await readFile(outputPath, "utf8");
    const routesHtml = await readFile(path.join(root, "outputs", "london-to-sydney.routes.html"), "utf8");
    assert.match(decisionHtml, /Only one saved check so far; price history builds with each refresh\./);
    assert.match(routesHtml, /Only one saved check so far; price history builds with each refresh\./);
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
