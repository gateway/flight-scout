import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createPlanFromText } from "../src/plans.js";
import { loadSavedPlans, writeAppIndex, writePlanListDashboard } from "../src/plan-list-dashboard.js";

test("plan-list public seam preserves loaded data and generated page semantics", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "flight-plan-list-refactor-"));
  const planDir = path.join(root, "plans", "london-to-sydney");
  const previousDir = path.join(planDir, "snapshots", "20990101T000000Z");
  const currentDir = path.join(planDir, "snapshots", "20990102T000000Z");
  await mkdir(previousDir, { recursive: true });
  await mkdir(currentDir, { recursive: true });

  const plan = fixturePlan();
  const current = fixtureSnapshot("20990102T000000Z", 880);
  const previous = fixtureSnapshot("20990101T000000Z", 920);
  await writeJson(path.join(planDir, "plan.json"), plan);
  await writeJson(path.join(planDir, "latest-snapshot.json"), current);
  await writeJson(path.join(planDir, "ranked.json"), current.rankedFlights);
  await writeJson(path.join(previousDir, "snapshot.json"), previous);
  await writeJson(path.join(previousDir, "ranked.json"), previous.rankedFlights);
  await writeJson(path.join(currentDir, "snapshot.json"), current);
  await writeJson(path.join(currentDir, "ranked.json"), current.rankedFlights);

  const loaded = await loadSavedPlans(root);
  assert.equal(loaded.length, 1);
  assert.deepEqual({
    name: loaded[0].plan.name,
    status: loaded[0].status,
    latestId: loaded[0].latest.id,
    previousId: loaded[0].previous.id,
    rankedPrices: loaded[0].latest.rankedFlights.map((option) => option.price),
    comparisonAvailable: loaded[0].comparison.available,
    dashboardHref: loaded[0].dashboardHref,
    planPath: loaded[0].planPath
  }, {
    name: "London to Sydney",
    status: { active: true, label: "Active" },
    latestId: "20990102T000000Z",
    previousId: "20990101T000000Z",
    rankedPrices: [880],
    comparisonAvailable: true,
    dashboardHref: "london-to-sydney.dashboard.html",
    planPath: "plans/london-to-sydney/plan.json"
  });

  const outputPath = path.join(root, "outputs", "plans.dashboard.html");
  await writePlanListDashboard({ root, outputPath });
  const html = await readFile(outputPath, "utf8");
  assert.deepEqual(pageSemantics(html), {
    title: "Flight Plans",
    headings: ["Plans", "Active Plans", "Best Across Plans", "Overview"],
    sections: ["active-plans", "best-across-plans", "overview"],
    actionLabels: [
      "Refresh this plan",
      "Open dashboard",
      "Archive this plan",
      "Open plan decision",
      "Open date compare",
      "Open current read",
      "Compare picks",
      "Open refresh details",
      "Price trend with 2 saved checks",
      "Open date scan",
      "Open routes page"
    ],
    planNameCount: 5,
    hasMovement: true,
    hasRefreshApi: true
  });
  assert.match(html, /<h3>London to Sydney<\/h3>/);
  assert.match(html, /class="price-trend-fragment"/);
  assert.match(html, /Lowest seen: \$880/);
  assert.equal((html.match(/data-price-history-point/g) ?? []).length, 2);
  assert.equal(await readFile(path.join(root, "outputs", "index.html"), "utf8"), html);
  assert.match(await readFile(path.join(root, "outputs", "plans.archived.html"), "utf8"), /Archived Flight Plans/);

  const appIndex = path.join(root, "index.html");
  await writeAppIndex({ root, outputPath: appIndex, dashboardPrefix: "outputs/" });
  const rootHtml = await readFile(appIndex, "utf8");
  assert.match(rootHtml, /href="outputs\/london-to-sydney\.dashboard\.html"/);
  assert.match(rootHtml, /href="outputs\/plans\.archived\.html"/);

  await rm(root, { recursive: true, force: true });
});

test("plan list dashboard renders active and archived navigation semantics", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "flight-plan-list-"));
  const planDir = path.join(root, "plans", "fixture");
  await createPlanFromText({
    text: "San Francisco to Portland Oregon via Tokyo around August 1 plus or minus 3",
    outputDir: planDir,
    root
  });
  const outputPath = path.join(root, "outputs", "plans.dashboard.html");
  await writePlanListDashboard({ root, outputPath });
  const html = await readFile(outputPath, "utf8");
  for (const copy of ["Plans", "Overview", "Active Plans", "Current read", "Best decisions right now", "Route date scan", "Not refreshed yet", "Refresh all active plans", "San Francisco to Portland"]) {
    assert.ok(html.includes(copy));
  }
  for (const label of ["Open dashboard", "Refresh this plan", "Open current read", "Open date scan", "Open routes page", "Archive this plan"]) {
    assert.ok(html.includes(`aria-label="${label}"`));
  }
  assert.ok(html.includes('data-plan-refresh-action="all"'));
  assert.ok(html.includes('data-plan-refresh-action="plan"'));
  assert.ok(html.includes('data-plan-path="plans/fixture/plan.json"'));
  assert.ok(html.includes('data-plan-archive-action="archive"'));
  assert.ok(html.includes("/api/plans/refresh/start"));
  assert.ok(html.includes("/api/plans/refresh-status"));
  for (const copy of [">Open dashboard<", ">Open read<", ">Date scan<", ">Open routes page<", ">Archive this plan<", "Command fallback", "How this works", "Describe the trip in plain language"]) {
    assert.ok(!html.includes(copy));
  }

  const indexHtml = await readFile(path.join(root, "outputs", "index.html"), "utf8");
  assert.ok(indexHtml.includes("#active-plans"));
  assert.ok(!indexHtml.includes('href="#overview"'));
  assert.ok(!indexHtml.includes("http-equiv=\"refresh\""));
  await writeAppIndex({ root, outputPath: path.join(root, "index.html"), dashboardPrefix: "outputs/" });
  const rootIndex = await readFile(path.join(root, "index.html"), "utf8");
  assert.ok(rootIndex.includes("outputs/san-francisco-to-portland-via-tokyo-2026-08-01.dashboard.html"));

  const planPath = path.join(planDir, "plan.json");
  const plan = JSON.parse(await readFile(planPath, "utf8"));
  await writeJson(planPath, { ...plan, status: "archived" });
  await writePlanListDashboard({ root, outputPath });
  const archivedHtml = await readFile(outputPath, "utf8");
  assert.ok(archivedHtml.includes("Archived plans"));
  assert.ok(archivedHtml.includes("plans.archived.html"));
  assert.ok(!archivedHtml.includes('<section id="archived-plans"'));
  const archivedOverview = archivedHtml.slice(archivedHtml.indexOf('<section id="overview"'), archivedHtml.indexOf("<details"));
  assert.ok(!archivedOverview.includes("San Francisco to Portland"));

  const archivePage = await readFile(path.join(root, "outputs", "plans.archived.html"), "utf8");
  assert.ok(archivePage.includes("Archived Plans"));
  assert.ok(archivePage.includes("San Francisco to Portland"));
  assert.ok(!archivedHtml.includes('aria-label="Restore this plan"'));
  assert.ok(archivePage.includes('aria-label="Restore this plan"'));
  assert.ok(!archivePage.includes(">Restore this plan<"));
  assert.ok(archivePage.includes('data-plan-path="plans/fixture/plan.json"'));
  assert.ok(archivePage.includes('data-plan-archive-action="restore"'));

  await writeAppIndex({ root, outputPath: path.join(root, "index.html"), dashboardPrefix: "outputs/" });
  assert.match(await readFile(path.join(root, "index.html"), "utf8"), /outputs\/plans\.archived\.html/);
  assert.match(await readFile(path.join(root, "outputs", "plans.archived.html"), "utf8"), /href="\/"/);
  await rm(root, { recursive: true, force: true });
});

function fixturePlan() {
  return {
    id: "london-to-sydney",
    name: "London to Sydney",
    status: "active",
    intent: {
      tripType: "one-way",
      dateCoverage: { start: "2099-01-01", end: "2099-01-03", center: "2099-01-02", plusMinusDays: 1 }
    },
    routeIdeas: [{ id: "lhr-syd", label: "London to Sydney", type: "direct-to-final" }],
    preferences: { hardMaxBudget: 1000 }
  };
}

function fixtureSnapshot(id, price) {
  const option = {
    searchId: "lhr-syd-2099-01-02",
    price,
    duration: "22h 0m",
    durationMinutes: 1320,
    departureAirport: "LHR",
    arrivalAirport: "SYD",
    departureTime: "2099-01-02 10:00",
    arrivalTime: "2099-01-03 19:00",
    stops: 1,
    routeIdeaId: "lhr-syd",
    tripComplete: true,
    destinationComplete: true
  };
  return {
    id,
    createdAt: id === "20990102T000000Z" ? "2099-01-02T00:00:00.000Z" : "2099-01-01T00:00:00.000Z",
    summary: { completeOptions: 1, balanced: option, cheapest: option, fastest: option },
    rankedFlights: [option]
  };
}

function pageSemantics(html) {
  return {
    title: html.match(/<title>([^<]+)<\/title>/)?.[1],
    headings: [...html.matchAll(/<h[12]>([^<]+)<\/h[12]>/g)].map((match) => match[1]),
    sections: [...html.matchAll(/<section id="([^"]+)"/g)].map((match) => match[1]),
    actionLabels: [...html.matchAll(/aria-label="([^"]+)"/g)].map((match) => match[1]),
    planNameCount: html.split("London to Sydney").length - 1,
    hasMovement: html.includes("Mostly better than last refresh"),
    hasRefreshApi: html.includes("/api/plans/refresh/start")
  };
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}
