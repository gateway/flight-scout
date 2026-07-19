import test from "node:test";
import assert from "node:assert/strict";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { buildRoutePlans } from "../src/planner.js";
import { buildRefreshPlan } from "../src/refresh-plan.js";
import { executeRefreshPlan } from "../src/refresh-runner.js";
import { assertProviderSearch } from "../src/providers/provider-types.js";

function composedTrip() {
  return {
    name: "Provider contract fixture",
    tripType: "one-way",
    departureWindow: { start: "2026-09-23", end: "2026-09-23" },
    origin: { label: "London", airports: ["LHR"] },
    destination: { label: "Reykjavik", airports: ["KEF"] },
    optionalStops: [{ label: "Dublin", airports: ["DUB"], nights: [1] }],
    gatewayAirports: [],
    routeModes: { includeOptionalStopCombinations: true, includeGatewaySplit: false }
  };
}

test("refresh manifests expose only provider-compatible atomic searches", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "flight-refresh-plan-"));
  try {
    const trip = composedTrip();
    const composed = buildRoutePlans(trip).find((route) => route.kind === "multi-city");
    assert.ok(composed, "fixture must include a composed route");
    const plan = {
      id: "provider-contract-fixture",
      routeIdeas: [{
        id: "london-dublin-reykjavik",
        label: "London via Dublin to Reykjavik",
        type: "stopover",
        focusSearchIds: [composed.id],
        originAirports: ["LHR"],
        destinationAirports: ["KEF"],
        stopover: { label: "Dublin", airports: ["DUB"] }
      }]
    };

    const manifest = await buildRefreshPlan({ plan, trip, mode: "light", root });

    assert.ok(manifest.calls.length > 0, "fixture must select runnable calls");
    for (const call of manifest.calls) {
      assert.doesNotThrow(() => assertProviderSearch(call), `${call.id} must satisfy the provider contract`);
      assert.equal(call.kind, "one-way", `${call.id} must be atomic provider work`);
      assert.equal(call.input.multi_city_json, undefined, `${call.id} must not expose composed input`);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("composed route ideas execute as atomic searches through the live adapter", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "flight-refresh-plan-"));
  const shim = path.join(root, "fli-shim.mjs");
  await writeFile(shim, `#!/usr/bin/env node
let input = "";
process.stdin.on("data", (chunk) => input += chunk);
process.stdin.on("end", () => {
  const payload = JSON.parse(input);
  process.stdout.write(JSON.stringify({ ok: true, currency: payload.currency, results: [] }));
});
`);
  await chmod(shim, 0o755);

  const previousPython = process.env.FLI_PYTHON;
  process.env.FLI_PYTHON = shim;
  try {
    const trip = { ...composedTrip(), rules: { requestDelayMs: 0 } };
    const composed = buildRoutePlans(trip).find((route) => route.kind === "multi-city");
    const plan = {
      id: "provider-live-fixture",
      routeIdeas: [{
        id: "london-dublin-reykjavik",
        label: "London via Dublin to Reykjavik",
        type: "stopover",
        focusSearchIds: [composed.id],
        originAirports: ["LHR"],
        destinationAirports: ["KEF"],
        stopover: { label: "Dublin", airports: ["DUB"] }
      }]
    };

    const refreshPlan = await buildRefreshPlan({ plan, trip, mode: "light", root, refresh: true });
    const summary = await executeRefreshPlan({ refreshPlan, trip, root, refresh: true });

    assert.equal(summary.completedProviderSearches, 2);
    assert.equal(summary.failedRuns, 0);
  } finally {
    if (previousPython === undefined) delete process.env.FLI_PYTHON;
    else process.env.FLI_PYTHON = previousPython;
    await rm(root, { recursive: true, force: true });
  }
});

test("deep stopover and gateway selections stay inside the atomic provider contract", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "flight-refresh-plan-"));
  try {
    const trip = {
      ...composedTrip(),
      gatewayAirports: ["SEA"],
      routeModes: { includeOptionalStopCombinations: true, includeGatewaySplit: true }
    };
    const plan = {
      id: "provider-deep-fixture",
      routeIdeas: [{
        id: "all-routes",
        label: "All declared route shapes",
        type: "direct-to-final",
        originAirports: ["LHR"],
        destinationAirports: ["KEF"],
        batches: ["all-reviewed"]
      }]
    };

    const manifest = await buildRefreshPlan({ plan, trip, mode: "deep", root });

    assert.ok(manifest.calls.length > 2, "fixture must cover more than the direct route");
    for (const call of manifest.calls) {
      assert.doesNotThrow(() => assertProviderSearch(call));
      assert.equal(call.kind, "one-way");
      assert.equal(call.input.multi_city_json, undefined);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("legacy route ideas default to trip airports instead of matching city words in labels", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "flight-refresh-plan-"));
  try {
    const trip = {
      name: "Legacy metadata fixture",
      tripType: "one-way",
      departureWindow: { start: "2026-10-04", end: "2026-10-04" },
      origin: { label: "Lisbon", airports: ["LIS"] },
      destination: { label: "Montreal", airports: ["YUL"] },
      alternateStarts: [],
      optionalStops: [],
      gatewayAirports: [],
      routeModes: { includeOptionalStopCombinations: false, includeGatewaySplit: false }
    };
    const plan = {
      id: "legacy-metadata-fixture",
      routeIdeas: [{
        id: "old-bangkok-route-name",
        label: "Old Bangkok route name",
        type: "direct-to-final",
        batches: []
      }]
    };

    const manifest = await buildRefreshPlan({ plan, trip, mode: "standard", root });

    assert.equal(manifest.calls.length, 1);
    assert.equal(manifest.calls[0].input.departure_id, "LIS");
    assert.equal(manifest.calls[0].input.arrival_id, "YUL");
    assert.equal(manifest.calls[0].routeIdeaId, "old-bangkok-route-name");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("legacy saved batch names remain runnable without entering public batch discovery", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "flight-refresh-plan-"));
  try {
    const trip = {
      name: "Legacy batch fixture",
      tripType: "one-way",
      departureWindow: { start: "2026-10-04", end: "2026-10-04" },
      origin: { label: "Lisbon", airports: ["LIS"] },
      alternateStarts: [{ label: "Porto", airports: ["OPO"] }],
      destination: { label: "Montreal", airports: ["YUL"] },
      optionalStops: [],
      gatewayAirports: [],
      routeModes: { includeOptionalStopCombinations: false, includeGatewaySplit: false }
    };
    const plan = {
      id: "legacy-batch-fixture",
      routeIdeas: [{
        id: "old-alternate-start",
        label: "Older alternate-origin route",
        type: "direct-to-final",
        batches: ["bangkok-start"]
      }]
    };

    const manifest = await buildRefreshPlan({ plan, trip, mode: "standard", root });

    const legacyBatchCalls = manifest.calls.filter((call) => (
      call.refreshReasons.includes("route batch: bangkok-start")
    ));
    assert.ok(legacyBatchCalls.length > 0);
    assert.ok(legacyBatchCalls.every((call) => call.input.departure_id === "OPO"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("legacy stopover ideas default to the trip stop airport instead of its display label", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "flight-refresh-plan-"));
  try {
    const trip = composedTrip();
    const plan = {
      id: "legacy-stopover-fixture",
      routeIdeas: [{
        id: "legacy-stopover",
        label: "Legacy overnight route",
        type: "stopover",
        stopover: { label: "Old stop name", nights: [1] },
        batches: []
      }]
    };

    const manifest = await buildRefreshPlan({ plan, trip, mode: "standard", root });

    assert.deepEqual(
      manifest.calls.map((call) => [call.input.departure_id, call.input.arrival_id]),
      [["LHR", "DUB"], ["DUB", "KEF"]]
    );
    assert.ok(manifest.calls.every((call) => call.routeIdeaId === "legacy-stopover"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("legacy focus searches preserve an alternate origin across the full date window", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "flight-refresh-plan-"));
  try {
    const trip = {
      name: "Legacy alternate-origin fixture",
      tripType: "one-way",
      departureWindow: { start: "2026-10-04", end: "2026-10-05" },
      origin: { label: "Lisbon", airports: ["LIS"] },
      alternateStarts: [{ label: "Porto", airports: ["OPO"] }],
      destination: { label: "Montreal", airports: ["YUL"] },
      optionalStops: [],
      gatewayAirports: [],
      routeModes: { includeOptionalStopCombinations: false, includeGatewaySplit: false }
    };
    const alternateFocus = buildRoutePlans(trip).find((route) => (
      route.startDate === "2026-10-04" && route.input.departure_id === "OPO"
    ));
    assert.ok(alternateFocus);
    const plan = {
      id: "legacy-alternate-origin-fixture",
      routeIdeas: [{
        id: "legacy-alternate-route",
        label: "Renamed alternate route",
        type: "direct-to-final",
        focusSearchIds: [alternateFocus.id],
        batches: []
      }]
    };

    const manifest = await buildRefreshPlan({ plan, trip, mode: "standard", root });

    assert.deepEqual(
      manifest.calls.map((call) => [call.input.departure_id, call.input.outbound_date]),
      [["OPO", "2026-10-04"], ["OPO", "2026-10-05"]]
    );
    assert.ok(manifest.calls.every((call) => call.routeIdeaId === "legacy-alternate-route"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
