import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createPlanFromText, loadPlanTrip, validatePlan } from "../src/plans.js";

test("legacy saved plans receive backward-compatible recommendation metadata defaults", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "flight-scout-arch004-"));
  const planDir = path.join(root, "plans", "legacy");
  await mkdir(planDir, { recursive: true });
  await mkdir(path.join(root, "trips"), { recursive: true });
  await writeFile(path.join(planDir, "plan.json"), JSON.stringify({
    id: "legacy",
    name: "Legacy plan",
    tripSpecPath: "../../trips/legacy.json",
    routeIdeas: [{ id: "route", label: "Legacy route" }]
  }));
  await writeFile(path.join(root, "trips", "legacy.json"), JSON.stringify({
    origin: { airports: ["AAA"] },
    destination: { airports: ["BBB"] },
    rules: {}
  }));

  const loaded = await loadPlanTrip("plans/legacy/plan.json", root);

  assert.equal(loaded.plan.primary, false);
  assert.deepEqual(loaded.plan.watchRules, []);
  assert.deepEqual(loaded.trip.rules.connectionTypesByAirport, {});
});

test("new saved plans persist explicit recommendation metadata defaults", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "flight-scout-arch004-new-"));

  const created = await createPlanFromText({
    text: "one way Seattle to Keflavik on September 25, 2026 plus or minus 2 days",
    outputDir: "plans/current",
    root
  });

  assert.equal(created.plan.primary, false);
  assert.deepEqual(created.plan.watchRules, []);
  assert.deepEqual(created.trip.rules.connectionTypesByAirport, {});
});

test("new saved plans convert stated price and duration limits into one local watch rule", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "flight-scout-watch-rule-new-"));

  const created = await createPlanFromText({
    text: "one way Seattle to Keflavik on September 25, 2026 under $700 and maximum 16 hours",
    outputDir: "plans/current",
    root
  });

  assert.deepEqual(created.plan.watchRules, [{
    id: "target-price-and-time",
    label: "Target price and travel time",
    enabled: true,
    maxPriceUsd: 700,
    maxDurationMinutes: 960
  }]);
});

test("plan validation accepts only boolean primary metadata", () => {
  assert.throws(() => validatePlan({
    id: "invalid",
    name: "Invalid plan",
    primary: "yes",
    tripSpecPath: "trip.json",
    routeIdeas: [{ id: "route", label: "Route" }]
  }), /primary.*boolean/i);
});

test("plan validation requires watch rules to be an array", () => {
  assert.throws(() => validatePlan({
    id: "invalid-watch-rules",
    name: "Invalid watch rules",
    tripSpecPath: "trip.json",
    routeIdeas: [{ id: "route", label: "Route" }],
    watchRules: { maxPriceUsd: 500 }
  }), /watchRules.*array/i);
});

test("plan validation requires each watch rule to have a usable threshold", () => {
  assert.throws(() => validatePlan({
    id: "threshold-free-watch-rule",
    name: "Threshold-free watch rule",
    tripSpecPath: "trip.json",
    routeIdeas: [{ id: "route", label: "Route" }],
    watchRules: [{ id: "empty", label: "Empty rule", enabled: true }]
  }), /watch rule.*price or duration threshold/i);
});

test("plan validation rejects duplicate watch rule identifiers", () => {
  assert.throws(() => validatePlan({
    id: "duplicate-watch-rules",
    name: "Duplicate watch rules",
    tripSpecPath: "trip.json",
    routeIdeas: [{ id: "route", label: "Route" }],
    watchRules: [
      { id: "target", label: "First target", maxPriceUsd: 500 },
      { id: "target", label: "Second target", maxDurationMinutes: 600 }
    ]
  }), /watch rule.*unique id/i);
});

test("plan validation accepts only boolean watch-rule enabled metadata", () => {
  assert.throws(() => validatePlan({
    id: "invalid-watch-enabled",
    name: "Invalid watch enabled",
    tripSpecPath: "trip.json",
    routeIdeas: [{ id: "route", label: "Route" }],
    watchRules: [{ id: "target", enabled: "yes", maxPriceUsd: 500 }]
  }), /watch rule.*enabled.*boolean/i);
});
