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

test("airport resolver handles dataset places without duplicate parser logic", () => {
  assert.deepEqual(resolveAirportPlace("Chiang Mai").place, { label: "Chiang Mai", airports: ["CNX"] });
  assert.deepEqual(resolveAirportPlace("Tokyo, Japan").place, { label: "Tokyo", airports: ["HND", "NRT"] });
  assert.deepEqual(resolveAirportPlace("Keflavik Iceland KEF").place, { label: "Keflavik", airports: ["KEF"] });
  assert.deepEqual(resolveAirportPlace("Taipei, Taiwan").place, { label: "Taipei", airports: ["TSA"] });
  assert.deepEqual(resolveAirportPlace("Redmond, Oregon").place, { label: "Redmond", airports: ["RDM"] });
  const bangkok = resolveAirportPlace("Bangkok");
  assert.deepEqual(bangkok.place, { label: "Bangkok", airports: ["BKK", "DMK"] });
  assert.ok(bangkok.assumptions[0].includes("BKK and DMK"));
  assert.equal(resolveAirportPlace("Springfield").status, "unresolved");
});

test("generic plan intent separates budget ranges, preferred nonstop, and soft travel time", () => {
  const intent = interpretFlightPlanText("Find a one-way flight from Seattle, Washington to Iceland KEF around September 25, 2026 plus or minus 2 days. I prefer nonstop flights under 8 hours if possible and around $500-$700 USD.");
  assert.equal(intent.status, "ready");
  assert.deepEqual(intent.origin.airports, ["SEA", "BFI"]);
  assert.deepEqual(intent.destination.airports, ["KEF"]);
  assert.equal(intent.departureWindow.start, "2026-09-23");
  assert.equal(intent.departureWindow.end, "2026-09-27");
  assert.deepEqual(intent.budget.range, [500, 700]);
  assert.equal(intent.budget.target, 700);
  assert.equal(intent.budget.hardMax, 840);
  assert.equal(intent.preferences.preferredTotalElapsedHours, 8);
  assert.equal(intent.directness.requested, true);
  assert.equal(intent.directness.required, false);
  assert.equal(intent.preferences.maxStops, undefined);
});

test("generic plan intent keeps explicit nonstop/direct wording as a hard route filter", () => {
  const direct = interpretFlightPlanText("Find me a direct flight from Chiang Mai to Bangkok around August 1, plus or minus three days, under $100 USD.");
  assert.equal(direct.directness.required, true);
  assert.equal(direct.preferences.maxStops, 0);

  const nonstopOnly = interpretFlightPlanText("Find Seattle to Iceland KEF around September 25 plus or minus 2 days, nonstop only, around $700 USD.");
  assert.equal(nonstopOnly.directness.required, true);
  assert.equal(nonstopOnly.preferences.maxStops, 0);
  assert.equal(nonstopOnly.stopover, null);

  const hyphenated = interpretFlightPlanText("Find SEA to KEF around September 25, non-stop only, under $700 USD.");
  assert.equal(hyphenated.directness.required, true);
  assert.equal(hyphenated.stopover, null);
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
  const intent = interpretFlightPlanText("Do not run it yet. Find me a direct flight from Chiang Mai to Bangkok around August 1, 2026, plus or minus three days, under $100 USD.");
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

test("generic plan intent preserves explicit airport codes outside the alias table", () => {
  const intent = interpretFlightPlanText("Find a one-way flight from LHR to SYD around September 25, 2026.");

  assert.equal(intent.status, "ready");
  assert.deepEqual(intent.origin, { label: "LHR", airports: ["LHR"] });
  assert.deepEqual(intent.destination, { label: "SYD", airports: ["SYD"] });
});

test("generic plan intent separates nice-to-have time from hard duration cutoff", () => {
  const intent = interpretFlightPlanText("Find San Francisco to Portland Oregon under $1,100, under 11 hours if possible, shortest flights, nothing over 26 hours, plus or minus three days from August 1, 2026.");
  assert.equal(intent.status, "ready");
  assert.deepEqual(intent.destination.airports, ["PDX"]);
  assert.equal(intent.budget.hardMax, 1100);
  assert.equal(intent.preferences.priority, "fastest");
  assert.equal(intent.preferences.preferredTotalElapsedHours, 11);
  assert.equal(intent.preferences.rejectTotalElapsedHoursOver, 26);
  assert.equal(intent.departureWindow.start, "2026-07-29");
  assert.equal(intent.departureWindow.end, "2026-08-04");
});

test("generic plan intent parses an explicit hard-cutoff phrase after a soft preference", () => {
  const intent = interpretFlightPlanText(
    "Find a one-way flight from KEF to BKK around October 2, 2026 plus or minus 2 days, prefer under 28 hours, hard cutoff 29 hours."
  );

  assert.equal(intent.status, "ready");
  assert.equal(intent.preferences.preferredTotalElapsedHours, 28);
  assert.equal(intent.preferences.rejectTotalElapsedHoursOver, 29);
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

test("round-trip intent keeps independent outbound and return date windows", () => {
  const intent = interpretFlightPlanText(
    "Find a round-trip flight from LHR to JFK departing September 23, 2026 and returning October 4, 2026 under $900 USD."
  );

  assert.equal(intent.status, "ready");
  assert.equal(intent.tripType, "round-trip");
  assert.deepEqual(intent.departureWindow, {
    start: "2026-09-23",
    end: "2026-09-23",
    mode: "fixed",
    center: "2026-09-23",
    days: 0
  });
  assert.deepEqual(intent.returnWindow, {
    start: "2026-10-04",
    end: "2026-10-04",
    mode: "fixed",
    center: "2026-10-04",
    days: 0
  });
});

test("round-trip intent asks for a missing return date before saving", () => {
  const intent = interpretFlightPlanText(
    "Find a round-trip flight from LHR to JFK departing September 23, 2026 under $900 USD."
  );

  assert.equal(intent.status, "needs-clarification");
  assert.ok(intent.clarifications.some((question) => question.includes("return date")));
});

test("saved round-trip plans select both directions as atomic provider work", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "flight-round-trip-plan-"));
  try {
    const created = await createPlanFromText({
      text: "Find a round-trip flight from LHR to JFK departing September 23, 2026 and returning October 4, 2026 under $900 USD.",
      root: dir
    });
    const { plan, trip } = await loadPlanTrip(created.planPath, dir);

    assert.equal(plan.intent.tripType, "round-trip");
    assert.deepEqual(trip.returnWindow, {
      start: "2026-10-04",
      end: "2026-10-04",
      mode: "fixed",
      center: "2026-10-04",
      days: 0
    });
    assert.equal(plan.routeIdeas[0].type, "round-trip");
    assert.equal(plan.intent.returnDateCoverage.center, "2026-10-04");

    const refreshPlan = await buildRefreshPlan({ plan, trip, mode: "standard", root: dir });
    assert.deepEqual(
      refreshPlan.calls.map((call) => [call.input.departure_id, call.input.arrival_id, call.input.outbound_date]),
      [["LHR", "JFK", "2026-09-23"], ["JFK", "LHR", "2026-10-04"]]
    );
    assert.ok(refreshPlan.calls.every((call) => call.kind === "one-way"));
    assert.ok(refreshPlan.calls.every((call) => !Object.hasOwn(call.input, "return_date")));
    assert.ok(refreshPlan.calls.every((call) => !Object.hasOwn(call.input, "multi_city_json")));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("generic plan intent handles Bangkok hotel stay without treating hotel cost as flight budget", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "flight-bangkok-stay-"));
  const text = "one-way from Chiang Mai to Redmond Oregon RDM around August 1 2026 plus or minus 3 days. Compare Chiang Mai to Redmond against Chiang Mai to Bangkok, stay in Bangkok 1 or 2 nights with hotel estimate 50 USD per night, then Bangkok to Redmond. Find the most cost-effective route with current data. Hard reject anything over 26 hours total flight itinerary time.";
  const intent = interpretFlightPlanText(text);
  assert.equal(intent.status, "ready");
  assert.equal(intent.budget, null);
  assert.deepEqual(intent.stopover.airports, ["BKK", "DMK"]);
  assert.deepEqual(intent.stopover.nights, [1, 2]);
  assert.equal(intent.stopover.hotelEstimateUsdPerNight, 50);
  assert.equal(intent.preferences.rejectTotalElapsedHoursOver, 26);

  const created = await createPlanFromText({ text, root: dir });
  const { plan, trip } = await loadPlanTrip(created.planPath, dir);
  assert.equal(plan.preferences.hardMaxBudget, null);
  assert.equal(trip.rules.hotelNightEstimate.Bangkok, 50);
  assert.equal(trip.routeModes.includeOptionalStopCombinations, true);

  const refreshPlan = await buildRefreshPlan({ plan, trip, mode: "standard", root: dir });
  assert.ok(refreshPlan.calls.length > 7);
  assert.ok(refreshPlan.calls.every((call) => call.kind === "one-way"));
  assert.ok(refreshPlan.calls.every((call) => call.input.departure_id && call.input.arrival_id));
  assert.ok(refreshPlan.calls.some((call) => call.input.departure_id === "CNX" && call.input.arrival_id === "BKK,DMK"));
  assert.ok(refreshPlan.calls.some((call) => call.input.departure_id === "BKK,DMK" && call.input.arrival_id === "RDM"));
  await rm(dir, { recursive: true, force: true });
});

test("generic plan intent creates unique Taipei stopover plans", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "flight-taipei-stay-"));
  const text = "one-way from Chiang Mai to Redmond Oregon RDM via TPE around August 1 2026 plus or minus 3 days. Stay near TPE one night, then TPE to Redmond. Hard reject anything over 26 hours total flight itinerary time.";
  const intent = interpretFlightPlanText(text);
  assert.equal(intent.status, "ready");
  assert.deepEqual(intent.stopover.airports, ["TPE"]);
  assert.deepEqual(intent.stopover.nights, [1]);
  assert.equal(intent.preferences.rejectTotalElapsedHoursOver, 26);

  const created = await createPlanFromText({ text, root: dir });
  const { plan, trip } = await loadPlanTrip(created.planPath, dir);
  assert.equal(plan.id, "chiang-mai-to-redmond-via-tpe-2026-08-01");
  const stopoverRoute = plan.routeIdeas.find((route) => route.id.includes("tpe"));
  assert.ok(stopoverRoute);
  assert.deepEqual(stopoverRoute.stopover.airports, ["TPE"]);
  assert.equal(stopoverRoute.stopover.routeOrder, 0);
  assert.deepEqual(trip.optionalStops[0].airports, ["TPE"]);

  const refreshPlan = await buildRefreshPlan({ plan, trip, mode: "standard", root: dir });
  assert.ok(refreshPlan.calls.some((call) => call.input.departure_id === "CNX" && call.input.arrival_id === "TPE"));
  assert.ok(refreshPlan.calls.some((call) => call.input.departure_id === "TPE" && call.input.arrival_id === "RDM"));
  await rm(dir, { recursive: true, force: true });
});

test("generic plan intent recognizes an optional known-city stop without route-specific branches", () => {
  const intent = interpretFlightPlanText(
    "Find Chiang Mai to Redmond around August 1, 2027, maybe Seattle if worth it."
  );

  assert.deepEqual(intent.stopover, {
    label: "Seattle",
    airports: ["SEA", "BFI"],
    nights: [1],
    required: false
  });
});

test("generic plan intent handles conversational punctuation after destination", () => {
  const intent = interpretFlightPlanText("I want to go from San Francisco to Portland, Oregon. I want something under 11 hours if possible, with the shortest trip possible, no more than 26 hours give or take, plus or minus three days from August 1, 2026");
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

test("generic plan intent preserves explicit years and rolls yearless dates forward", () => {
  const explicit = interpretFlightPlanText(
    "Find San Francisco to Portland around January 5, 2028 plus or minus 2 days."
  );
  assert.equal(explicit.departureWindow.center, "2028-01-05");

  const yearless = interpretFlightPlanText(
    "Find San Francisco to Portland around January 5 plus or minus 2 days.",
    { now: new Date("2026-12-20T12:00:00Z") }
  );
  assert.equal(yearless.departureWindow.center, "2027-01-05");
  assert.equal(yearless.departureWindow.start, "2027-01-03");
  assert.equal(yearless.departureWindow.end, "2027-01-07");
});

test("generic plan intent asks for a USD budget instead of relabeling non-USD input", () => {
  for (const [label, budgetText] of [
    ["EUR", "under 700 EUR"],
    ["EUR symbol", "under €700"],
    ["EUR with hotel", "under 700 EUR and a hotel estimate of 50 USD per night"],
    ["GBP", "under GBP 650"],
    ["GBP symbol", "under £650"],
    ["THB", "under 20,000 THB"],
    ["THB symbol", "under ฿20,000"],
    ["CAD", "under 700 CAD"],
    ["JPY", "under JPY 100,000"],
    ["JPY symbol", "under ¥100,000"],
    ["ZAR", "under ZAR 12,000"]
  ]) {
    const intent = interpretFlightPlanText(
      `Find San Francisco to Portland around August 1, 2027 with a budget ${budgetText}.`
    );

    assert.equal(intent.status, "needs-clarification", label);
    assert.equal(intent.budget, null, label);
    assert.ok(intent.clarifications.some((question) => question.includes(label.split(" ")[0]) && question.includes("USD")), label);
  }
});

test("saved plan creation stops when a non-USD budget needs clarification", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "flight-non-usd-plan-"));
  await assert.rejects(
    () => createPlanFromText({
      text: "Find San Francisco to Portland around August 1, 2027 with a budget under 700 EUR.",
      root: dir
    }),
    /What USD budget should I use instead of EUR/i
  );
  await rm(dir, { recursive: true, force: true });
});

test("new natural-language plan creates independent trip spec and dashboard", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "flight-nl-plan-"));
  const created = await createPlanFromText({
    text: "Do not run it yet. Find me a direct flight from Chiang Mai to Bangkok around August 1, 2026, plus or minus three days, under $100 USD.",
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
  assert.equal(Object.hasOwn(refreshPlan, "liveCallCount"), false);
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
