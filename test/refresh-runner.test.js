import test from "node:test";
import assert from "node:assert/strict";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { executeRefreshPlan } from "../src/refresh-runner.js";

test("refresh runner reports completed provider searches without dead legacy counters", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "flight-refresh-runner-"));
  const shim = path.join(root, "fli-shim.mjs");
  const cacheFile = path.join(root, "cache", "fixture.json");
  await writeFile(shim, `#!/usr/bin/env node
let input = "";
process.stdin.on("data", (chunk) => input += chunk);
process.stdin.on("end", () => {
  const payload = JSON.parse(input);
  process.stdout.write(JSON.stringify({
    ok: true,
    currency: payload.currency,
    searchTimestamp: "2026-07-15T00:00:00Z",
    results: []
  }));
});
`);
  await chmod(shim, 0o755);

  const previousPython = process.env.FLI_PYTHON;
  process.env.FLI_PYTHON = shim;
  try {
    const summary = await executeRefreshPlan({
      root,
      refreshPlan: {
        requestDelayMs: 0,
        calls: [{
          id: "one-way-lhr-syd-2026-09-25",
          input: {
            departure_id: "LHR",
            arrival_id: "SYD",
            outbound_date: "2026-09-25"
          },
          cache: { fresh: false },
          cacheFile
        }]
      },
      trip: { rules: { requestDelayMs: 0 } }
    });

    assert.equal(summary.completedProviderSearches, 1);
    assert.equal(summary.failedRuns, 0);
    assert.equal(summary.cacheHits, 0);
    assert.equal(Object.hasOwn(summary, "liveRuns"), false);
    assert.equal(Object.hasOwn(summary, "fliRuns"), false);
    assert.equal(JSON.parse(await readFile(cacheFile, "utf8")).ok, true);
  } finally {
    if (previousPython === undefined) delete process.env.FLI_PYTHON;
    else process.env.FLI_PYTHON = previousPython;
    await rm(root, { recursive: true, force: true });
  }
});
