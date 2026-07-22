import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { buildRoutePlans } from "../src/planner.js";
import * as refreshPlanModule from "../src/refresh-plan.js";

test("refresh-plan facade preserves its two public exports", () => {
  assert.deepEqual(Object.keys(refreshPlanModule).sort(), ["buildRefreshPlan", "loadRefreshBudget"]);
});

test("refresh manifest projection stays stable across responsibility extraction", async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), "flight-refresh-contract-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, "config"), { recursive: true });
  await writeFile(path.join(root, "config", "refresh-budget.json"), JSON.stringify({
    requestDelayMs: 1234,
    staleAfterHours: 12,
    modes: {
      light: { maxCalls: 1 },
      standard: { maxCalls: 2 },
      "targeted-deep": { maxCalls: 3 },
      deep: { maxCalls: 4 }
    }
  }));

  const trip = contractTrip();
  const focus = buildRoutePlans(trip)[0];
  const plan = {
    id: "manifest-contract",
    refreshPolicy: { defaultMode: "standard" },
    routeIdeas: [{
      id: "primary",
      label: "Primary route",
      type: "direct-to-final",
      focusSearchIds: [focus.id],
      originAirports: ["LHR"],
      destinationAirports: ["KEF"],
      batches: []
    }]
  };

  assert.deepEqual(await refreshPlanModule.loadRefreshBudget(root), {
    requestDelayMs: 1234,
    staleAfterHours: 12,
    maxWindowDays: 14,
    modes: {
      light: { maxCalls: 1 },
      standard: { maxCalls: 2 },
      "targeted-deep": { maxCalls: 3 },
      deep: { maxCalls: 4 }
    }
  });

  const manifest = normalizeManifest(await refreshPlanModule.buildRefreshPlan({ plan, trip, root }), root);
  assert.deepEqual(manifest, expectedManifest());
});

function contractTrip() {
  return {
    name: "Manifest contract",
    tripType: "one-way",
    departureWindow: { start: "2026-09-23", end: "2026-09-23" },
    origin: { label: "London", airports: ["LHR"] },
    destination: { label: "Reykjavik", airports: ["KEF"] },
    optionalStops: [],
    gatewayAirports: [],
    routeModes: { includeOptionalStopCombinations: false, includeGatewaySplit: false }
  };
}

function normalizeManifest(manifest, root) {
  const text = JSON.stringify({ ...manifest, generatedAt: undefined }).replaceAll(root, "<root>");
  return JSON.parse(text);
}

function expectedManifest() {
  const cacheFile = "<root>/cache/one-way-lhr-kef-2026-09-23.fli.json";
  const cache = { status: "missing", fresh: false, ageHours: null };
  return {
    planId: "manifest-contract",
    mode: "standard",
    provider: "fli-google-flights",
    explanation: "Refresh the active date window and route ideas without broad gateway exploration.",
    requestDelayMs: 1234,
    maxWindowDays: 14,
    totalCandidateCalls: 1,
    selectedCallCount: 1,
    fliCallCount: 1,
    cacheHitCount: 0,
    calls: [{
      order: 1,
      id: "one-way-lhr-kef-2026-09-23",
      routeIdeaId: "primary",
      title: "LHR -> KEF on 2026-09-23",
      kind: "one-way",
      routeFamily: "direct-ish",
      priority: "fastest",
      refreshReasons: ["decision-critical focus search", "full date-window coverage"],
      input: {
        adults: 1,
        children: 0,
        infants: 0,
        currency: "USD",
        hl: "en",
        gl: "us",
        fetch_booking_options: false,
        departure_id: "LHR",
        arrival_id: "KEF",
        outbound_date: "2026-09-23"
      },
      googleFlightsUrl: "https://www.google.com/travel/flights?hl=en&curr=USD&q=one+way+flights+from+LHR+to+KEF+departing+2026-09-23",
      cacheFile,
      cache,
      provider: {
        primary: "fli-google-flights",
        cacheFile,
        cache,
        providerCaches: { "fli-google-flights": cache },
        providerCacheFiles: { "fli-google-flights": cacheFile },
        fliLive: true,
        directOnly: false,
        reason: "Use the local FLI provider for missing or stale searches."
      }
    }],
    skippedCalls: [],
    warnings: []
  };
}
