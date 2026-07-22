import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { extendPlanWindow } from "../src/plan-window-extension.js";

test("plan window extension rewrites both date contracts without changing identity or running searches", async (context) => {
  const root = await fixtureRoot(context);
  const rebuilds = [];
  const result = await extendPlanWindow({
    root,
    planPath: "plans/sample/plan.json",
    direction: "later",
    days: 2,
    maxWindowDays: 14,
    rebuild: async (input) => rebuilds.push(input)
  });
  const plan = await readJson(path.join(root, "plans/sample/plan.json"));
  const trip = await readJson(path.join(root, "trips/sample.json"));

  assert.equal(plan.id, "sample");
  assert.equal(plan.intent.dateCoverage.start, "2026-10-01");
  assert.equal(plan.intent.dateCoverage.end, "2026-10-07");
  assert.equal(plan.intent.dateCoverage.center, "2026-10-03");
  assert.equal(plan.intent.dateCoverage.plusMinusDays, null);
  assert.equal(trip.departureWindow.center, "2026-10-03");
  assert.equal(trip.departureWindow.mode, "range");
  assert.equal(trip.departureWindow.days, null);
  assert.equal(trip.departureWindow.end, "2026-10-07");
  assert.equal(result.daysAdded, 2);
  assert.equal(rebuilds.length, 1);
  assert.equal(rebuilds[0].planPath, "plans/sample/plan.json");
  assert.equal(rebuilds[0].root, root);
});

test("plan window extension restores both date contracts when artifact rebuild fails", async (context) => {
  const root = await fixtureRoot(context);
  const planFile = path.join(root, "plans/sample/plan.json");
  const tripFile = path.join(root, "trips/sample.json");
  const originalPlan = await readFile(planFile, "utf8");
  const originalTrip = await readFile(tripFile, "utf8");

  await assert.rejects(
    extendPlanWindow({
      root,
      planPath: "plans/sample/plan.json",
      direction: "earlier",
      days: 2,
      rebuild: async () => {
        throw new Error("rebuild failed");
      }
    }),
    /rebuild failed/
  );

  assert.equal(await readFile(planFile, "utf8"), originalPlan);
  assert.equal(await readFile(tripFile, "utf8"), originalTrip);
});

test("plan window extension rejects a change beyond the configured cap", async (context) => {
  const root = await fixtureRoot(context, { start: "2026-10-01", end: "2026-10-14" });

  await assert.rejects(
    extendPlanWindow({ root, planPath: "plans/sample/plan.json", direction: "earlier", days: 1, maxWindowDays: 14 }),
    (error) => error.code === "WINDOW_CAP_EXCEEDED"
  );
});

async function fixtureRoot(context, departureWindow = { start: "2026-10-01", end: "2026-10-05" }) {
  const root = await mkdtemp(path.join(tmpdir(), "flight-window-extension-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, "plans/sample"), { recursive: true });
  await mkdir(path.join(root, "trips"), { recursive: true });
  const plan = {
    id: "sample",
    name: "Sample",
    tripSpecPath: "../../trips/sample.json",
    intent: { dateCoverage: { center: "2026-10-03", plusMinusDays: 2, ...departureWindow } },
    routeIdeas: [{ id: "sample-route", label: "Sample route" }]
  };
  const trip = { tripType: "one-way", departureWindow: { center: "2026-10-03", mode: "plus-minus", days: 2, ...departureWindow } };
  await writeFile(path.join(root, "plans/sample/plan.json"), `${JSON.stringify(plan, null, 2)}\n`);
  await writeFile(path.join(root, "trips/sample.json"), `${JSON.stringify(trip, null, 2)}\n`);
  return root;
}

async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}
