import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { aggregateCachedFlights, parseArgs } from "../src/cli-support.js";
import { providerCacheFile } from "../src/providers/provider-cache.js";
import { PROVIDERS } from "../src/providers/provider-types.js";

const PROJECT_ROOT = fileURLToPath(new URL("..", import.meta.url));

test("CLI value flags reject a missing value", () => {
  for (const flag of ["--out", "--mode", "--baseline-ranked", "--max-runs"]) {
    assert.throws(
      () => parseArgs(["plan:refresh", "fixture-plan.json", flag]),
      new RegExp(`${flag} requires a value`, "i")
    );
  }
  assert.throws(
    () => parseArgs(["intent", "--out", "--live"]),
    /--out requires a value/i
  );
  assert.throws(
    () => parseArgs(["plan:refresh-scheduled", "--jitter-ms"]),
    /--jitter-ms requires a value/i
  );
});

test("CLI rejects parsed flags that have no command behavior", () => {
  for (const [flag, value] of [["--batch", "gateway-compare"], ["--limit", "10"]]) {
    assert.throws(
      () => parseArgs(["plan:refresh", "fixture-plan.json", flag, value]),
      new RegExp(`unsupported option.*${flag}`, "i")
    );
  }
  for (const flag of ["--allow-broad", "--atomic"]) {
    assert.throws(
      () => parseArgs(["plan:refresh", "fixture-plan.json", flag]),
      new RegExp(`unsupported option.*${flag}`, "i")
    );
  }
});

test("CLI requires max runs to be a positive integer", () => {
  for (const value of ["nope", "0", "-1", "1.5"]) {
    assert.throws(
      () => parseArgs(["plan:refresh", "fixture-plan.json", "--max-runs", value]),
      /--max-runs must be a positive integer/i
    );
  }
  assert.equal(
    parseArgs(["plan:refresh", "fixture-plan.json", "--max-runs", "3"]).flags.maxRuns,
    3
  );
});

test("scheduled refresh accepts only a non-negative jitter bound", () => {
  for (const value of ["nope", "-1", "1.5"]) {
    assert.throws(
      () => parseArgs(["plan:refresh-scheduled", "--jitter-ms", value]),
      /--jitter-ms must be a non-negative integer/i
    );
  }
  assert.equal(parseArgs(["plan:refresh-scheduled", "--jitter-ms", "0"]).flags.jitterMs, 0);
  assert.equal(parseArgs(["plan:refresh-scheduled", "--jitter-ms", "300000"]).flags.jitterMs, 300_000);
});

test("scheduled refresh preserves an explicit refresh mode", () => {
  assert.equal(
    parseArgs(["plan:refresh-scheduled", "--mode", "light"]).flags.mode,
    "light"
  );
});

test("CLI executable reports option errors without an internal stack trace", () => {
  const result = spawnSync(process.execPath, ["src/cli.js", "intent", "--out"], {
    cwd: PROJECT_ROOT,
    encoding: "utf8"
  });

  assert.equal(result.status, 1);
  assert.equal(result.stderr.trim(), "--out requires a value.");
});

test("CLI rejects unknown options instead of treating them as positional input", () => {
  assert.throws(
    () => parseArgs(["plan:refresh", "fixture-plan.json", "--refesh"]),
    /unknown option.*--refesh/i
  );
});

test("CLI rejects a supported option when the selected command does not use it", () => {
  for (const [command, flag, value] of [
    ["intent", "--live"],
    ["plan:refresh-plan", "--max-runs", "2"],
    ["plan:archive", "--mode", "standard"]
  ]) {
    assert.throws(
      () => parseArgs([command, "fixture", flag, ...(value ? [value] : [])]),
      new RegExp(`${flag} is not supported by ${command}`, "i")
    );
  }
});

test("CLI preserves every supported option and refresh alias", () => {
  const { tripPath, flags } = parseArgs([
    "plan:refresh",
    "fixture-plan.json",
    "--live",
    "--force",
    "--out",
    "custom-output.json",
    "--mode",
    "standard",
    "--baseline-ranked",
    "ranked.json",
    "--max-runs",
    "2"
  ]);

  assert.equal(tripPath, "fixture-plan.json");
  assert.deepEqual({
    live: flags.live,
    refresh: flags.refresh,
    out: flags.out,
    mode: flags.mode,
    baselineRanked: flags.baselineRanked,
    maxRuns: flags.maxRuns
  }, {
    live: true,
    refresh: true,
    out: "custom-output.json",
    mode: "standard",
    baselineRanked: "ranked.json",
    maxRuns: 2
  });
  assert.equal(parseArgs(["plan:archive", "fixture-plan.json", "--restore"]).flags.restore, true);
});

test("cache prune CLI defaults to dry run and preserves explicit deletion controls", () => {
  const preview = parseArgs(["cache:prune"]);
  assert.equal(preview.flags.apply, false);
  assert.equal(preview.flags.olderThanDays, null);
  assert.equal(preview.flags.confirmation, null);

  const apply = parseArgs([
    "cache:prune",
    "--older-than-days", "45",
    "--apply",
    "--confirm", "DELETE STALE CACHE"
  ]);
  assert.equal(apply.flags.olderThanDays, 45);
  assert.equal(apply.flags.apply, true);
  assert.equal(apply.flags.confirmation, "DELETE STALE CACHE");
  assert.throws(
    () => parseArgs(["cache:prune", "--older-than-days", "0"]),
    /--older-than-days must be a positive integer/i
  );
  assert.throws(
    () => parseArgs(["cache:prune", "--older-than-days"]),
    /--older-than-days requires a value/i
  );
  assert.throws(
    () => parseArgs(["cache:prune", "--confirm"]),
    /--confirm requires a value/i
  );
});

test("cached flight aggregation skips damaged JSON and reports a structured warning", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "flight-cache-read-"));
  const searches = [search("valid-search", "2026-09-23"), search("damaged-search", "2026-09-24")];
  const warnings = [];
  try {
    await mkdir(path.join(root, "cache"), { recursive: true });
    await writeFile(providerCacheFile(root, searches[0].id, PROVIDERS.FLI), JSON.stringify({
      provider: PROVIDERS.FLI,
      currency: "USD",
      results: [{
        price: "$500",
        departureAirport: "LHR",
        arrivalAirport: "SYD",
        durationMinutes: 1200,
        stops: 1,
        legs: []
      }]
    }));
    const damagedFile = providerCacheFile(root, searches[1].id, PROVIDERS.FLI);
    await writeFile(damagedFile, "{\"truncated\":");

    const flights = await aggregateCachedFlights(trip(), [], {
      searches,
      root,
      onWarning: (warning) => warnings.push(warning)
    });

    assert.equal(flights.length, 1);
    assert.equal(flights[0].searchId, "valid-search");
    assert.deepEqual(warnings.map(({ code, cacheFile, searchId }) => ({ code, cacheFile, searchId })), [{
      code: "cache-read-failed",
      cacheFile: damagedFile,
      searchId: "damaged-search"
    }]);
    assert.match(warnings[0].message, /damaged-search\.fli\.json/i);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

function search(id, date) {
  return {
    id,
    title: `London -> Sydney, depart ${date}`,
    input: { departure_id: "LHR", arrival_id: "SYD", outbound_date: date }
  };
}

function trip() {
  return {
    origin: { airports: ["LHR"] },
    destination: { airports: ["SYD"] },
    alternateStarts: []
  };
}
