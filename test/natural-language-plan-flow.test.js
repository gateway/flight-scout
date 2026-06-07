import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { resolveAirportPlace } from "../src/airport-resolver.js";
import { interpretFlightPlanText } from "../src/plan-intent.js";
import { createPlanFromText, loadPlanTrip } from "../src/plans.js";
import { buildRefreshPlan } from "../src/refresh-plan.js";
import { buildRoutePlans, buildAtomicLegSearches } from "../src/planner.js";
import { writePlanDashboard } from "../src/dashboard.js";
import { writePlanListDashboard } from "../src/plan-list-dashboard.js";

test("airport resolver handles known aliases without duplicate parser logic", () => {
  assert.deepEqual(resolveAirportPlace("Chiang Mai").place, { label: "Chiang Mai", airports: ["CNX"] });
  assert.deepEqual(resolveAirportPlace("Tokyo, Japan").place, { label: "Tokyo", airports: ["HND", "NRT"] });
  assert.deepEqual(resolveAirportPlace("Redmond, Oregon").place, { label: "Redmond/Bend", airports: ["RDM"] });
  const bangkok = resolveAirportPlace("Bangkok");
  assert.deepEqual(bangkok.place, { label: "Bangkok", airports: ["BKK", "DMK"] });
  assert.ok(bangkok.assumptions[0].includes("BKK or DMK"));
  assert.equal(resolveAirportPlace("Springfield").status, "unresolved");
});

test("generic plan intent parses city region text and no-longer-than duration", () => {
  const intent = interpretFlightPlanText("Find a one-way flight from Tokyo, Japan to Redmond, Oregon around August 1, 2026, plus or minus 2 days. Search both Tokyo airports HND and NRT to RDM. Budget around $1000 USD but flexible. Hard cutoff no longer than 25 hours total travel time.");
  assert.equal(intent.status, "ready");
  assert.deepEqual(intent.origin.airports, ["HND", "NRT"]);
  assert.deepEqual(intent.destination.airports, ["RDM"]);
  assert.equal(intent.departureWindow.start, "2026-07-30");
  assert.equal(intent.departureWindow.end, "2026-08-03");
  assert.equal(intent.budget.target, 1000);
  assert.equal(intent.preferences.rejectTotalElapsedHoursOver, 25);
});

test("generic plan intent parses direct budget date-window requests", () => {
  const intent = interpretFlightPlanText("Do not run it yet. Find me a direct flight from Chiang Mai to Bangkok around August 1, plus or minus three days, under $100 USD.");
  assert.equal(intent.status, "ready");
  assert.equal(intent.noLive, true);
  assert.deepEqual(intent.origin.airports, ["CNX"]);
  assert.deepEqual(intent.destination.airports, ["BKK", "DMK"]);
  assert.equal(intent.departureWindow.start, "2026-07-29");
  assert.equal(intent.departureWindow.end, "2026-08-04");
  assert.equal(intent.budget.hardMax, 100);
  assert.equal(intent.directness.required, true);
  assert.equal(intent.preferences.maxStops, 0);
});

test("generic plan intent asks concise clarifying questions for unknown places", () => {
  const intent = interpretFlightPlanText("Plan flights from Springfield to Portland around August 1");
  assert.equal(intent.status, "needs-clarification");
  assert.ok(intent.clarifications.length <= 3);
  assert.ok(intent.clarifications[0].includes("Springfield"));
});

test("generic plan intent separates nice-to-have time from hard duration cutoff", () => {
  const intent = interpretFlightPlanText("Find San Francisco to Portland under $1,100, under 11 hours if possible, shortest flights, nothing over 26 hours, plus or minus three days from August 1.");
  assert.equal(intent.status, "ready");
  assert.deepEqual(intent.destination.airports, ["PDX"]);
  assert.equal(intent.budget.hardMax, 1100);
  assert.equal(intent.preferences.priority, "fastest");
  assert.equal(intent.preferences.preferredTotalElapsedHours, 11);
  assert.equal(intent.preferences.rejectTotalElapsedHoursOver, 26);
  assert.equal(intent.departureWindow.start, "2026-07-29");
  assert.equal(intent.departureWindow.end, "2026-08-04");
});

test("generic plan intent keeps soft travel-time preferences when not hard required", () => {
  const intent = interpretFlightPlanText("I need a flight from Chiang Mai to Tokyo around August 1, 2026 plus or minus two days. Budget under 800 USD and flight time should be under 10 hours if possible, not a hard requirement.");
  assert.equal(intent.status, "ready");
  assert.deepEqual(intent.origin.airports, ["CNX"]);
  assert.deepEqual(intent.destination.airports, ["HND", "NRT"]);
  assert.equal(intent.budget.hardMax, 800);
  assert.equal(intent.preferences.preferredTotalElapsedHours, 10);
  assert.equal(intent.preferences.rejectTotalElapsedHoursOver, undefined);
});

test("generic plan intent handles conversational punctuation after destination", () => {
  const intent = interpretFlightPlanText("I want to go from San Francisco to Portland. I want something under 11 hours if possible, with the shortest trip possible, no more than 26 hours give or take, plus or minus three days from August 1, 2026");
  assert.equal(intent.status, "ready");
  assert.deepEqual(intent.origin.airports, ["SFO"]);
  assert.deepEqual(intent.destination.airports, ["PDX"]);
  assert.equal(intent.budget, null);
  assert.equal(intent.preferences.preferredTotalElapsedHours, 11);
  assert.equal(intent.preferences.rejectTotalElapsedHoursOver, 26);
});

test("generic plan intent asks for dates before building scan searches", () => {
  const intent = interpretFlightPlanText("Find San Francisco to Portland under $1,100 and nothing over 26 hours.");
  assert.equal(intent.status, "needs-clarification");
  assert.ok(intent.clarifications.some((question) => question.includes("departure date")));
});

test("new natural-language plan creates independent trip spec and dashboard", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "flight-nl-plan-"));
  const created = await createPlanFromText({
    text: "Do not run it yet. Find me a direct flight from Chiang Mai to Bangkok around August 1, plus or minus three days, under $100 USD.",
    root: dir
  });
  const { plan, planDir, trip } = await loadPlanTrip(created.planPath, dir);
  assert.equal(plan.id, "chiang-mai-to-bangkok-2026-08-01");
  assert.equal(plan.intent.noLiveRequested, true);
  assert.equal(plan.preferences.directRequired, true);
  assert.equal(plan.preferences.maxStops, 0);
  assert.ok(!plan.tripSpecPath.includes("cnx-rdm-aug1-plusminus3"));
  assert.deepEqual(trip.origin.airports, ["CNX"]);
  assert.deepEqual(trip.destination.airports, ["BKK", "DMK"]);
  assert.equal(trip.budget.hardMax, 100);

  const routePlans = buildRoutePlans(trip);
  assert.equal(routePlans.length, 7);
  assert.ok(routePlans.every((route) => route.segments.length === 1));
  const refreshPlan = await buildRefreshPlan({ plan, trip, mode: "standard", root: dir });
  assert.equal(refreshPlan.selectedCallCount, 7);
  assert.equal(refreshPlan.fliCallCount, 7);
  assert.equal(refreshPlan.liveCallCount, 0);
  assert.equal(refreshPlan.cacheHitCount, 0);
  const dashboardPath = path.join(dir, "outputs", `${plan.id}.dashboard.html`);
  await writePlanDashboard({ plan, planDir, trip, snapshots: [], refreshPlan, outputPath: dashboardPath });
  await writePlanListDashboard({ root: dir, outputPath: path.join(dir, "outputs", "plans.dashboard.html") });
  const dashboard = await readFile(dashboardPath, "utf8");
  assert.ok(dashboard.includes("Decision + Budget"));
  assert.ok(dashboard.includes("Date Compare"));
  assert.ok(dashboard.includes("Routes"));
  assert.ok(dashboard.includes("Refresh"));
  assert.ok(!dashboard.includes("Compact report"));
  assert.ok(!dashboard.includes("Do not run it yet"));
  assert.ok(!dashboard.includes("Preview"));
  const allPlans = await readFile(path.join(dir, "outputs", "plans.dashboard.html"), "utf8");
  assert.ok(allPlans.includes("Chiang Mai to Bangkok"));
  assert.ok(!allPlans.includes("Do not run it yet"));
  await rm(dir, { recursive: true, force: true });
});
