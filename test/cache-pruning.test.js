import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, stat, symlink, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { CACHE_PRUNE_CONFIRMATION, pruneProviderCache } from "../src/cache-pruning.js";

test("cache pruning defaults to a dry run that reports old provider files without deleting them", async () => {
  const root = await cacheFixture();
  const cacheFile = path.join(root, "cache", "one-way-lhr-syd-2026-09-23.fli.json");
  try {
    await writeCacheFile(cacheFile, { ageDays: 45 });

    const report = await pruneProviderCache({
      root,
      olderThanDays: 30,
      now: new Date("2026-11-15T00:00:00Z")
    });

    assert.equal(report.mode, "dry-run");
    assert.deepEqual(report.eligible.map((item) => item.relativePath), [
      "cache/one-way-lhr-syd-2026-09-23.fli.json"
    ]);
    assert.equal(report.deleted.length, 0);
    await assert.doesNotReject(() => stat(cacheFile));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("cache pruning preserves old files inside an active plan date window", async () => {
  const root = await cacheFixture();
  const cacheFile = path.join(root, "cache", "one-way-lhr-syd-2026-09-23.fli.json");
  try {
    await writeCacheFile(cacheFile, { ageDays: 45 });

    const report = await pruneProviderCache({
      root,
      olderThanDays: 30,
      now: new Date("2026-11-15T00:00:00Z"),
      protectedDateRanges: [{ start: "2026-09-22", end: "2026-09-24" }]
    });

    assert.equal(report.eligible.length, 0);
    assert.deepEqual(report.protected.map((item) => item.relativePath), [
      "cache/one-way-lhr-syd-2026-09-23.fli.json"
    ]);
    await assert.doesNotReject(() => stat(cacheFile));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("cache pruning reports but never selects files with an unknown provider suffix", async () => {
  const root = await cacheFixture();
  const cacheFile = path.join(root, "cache", "one-way-lhr-syd-2026-09-23.other.json");
  try {
    await writeCacheFile(cacheFile, { ageDays: 45 });

    const report = await pruneProviderCache({
      root,
      olderThanDays: 30,
      now: new Date("2026-11-15T00:00:00Z")
    });

    assert.equal(report.eligible.length, 0);
    assert.deepEqual(report.skipped, [{
      relativePath: "cache/one-way-lhr-syd-2026-09-23.other.json",
      reason: "unknown-provider-suffix"
    }]);
    await assert.doesNotReject(() => stat(cacheFile));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("cache pruning preserves provider files whose search id has no parseable date", async () => {
  const root = await cacheFixture();
  const cacheFile = path.join(root, "cache", "malformed-search.fli.json");
  try {
    await writeCacheFile(cacheFile, { ageDays: 45 });

    const report = await pruneProviderCache({
      root,
      olderThanDays: 30,
      now: new Date("2026-11-15T00:00:00Z")
    });

    assert.equal(report.eligible.length, 0);
    assert.deepEqual(report.skipped, [{
      relativePath: "cache/malformed-search.fli.json",
      reason: "unparseable-search-date"
    }]);
    await assert.doesNotReject(() => stat(cacheFile));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("cache pruning never follows or selects a cache-shaped symbolic link", async () => {
  const root = await cacheFixture();
  const target = path.join(root, "outside-cache.json");
  const link = path.join(root, "cache", "one-way-lhr-syd-2026-09-23.fli.json");
  try {
    await writeFile(target, "{}\n");
    await symlink(target, link);

    const report = await pruneProviderCache({
      root,
      olderThanDays: 30,
      now: new Date("2026-11-15T00:00:00Z")
    });

    assert.equal(report.eligible.length, 0);
    assert.deepEqual(report.skipped, [{
      relativePath: "cache/one-way-lhr-syd-2026-09-23.fli.json",
      reason: "symbolic-link"
    }]);
    await assert.doesNotReject(() => stat(target));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("cache pruning rejects a cache directory that resolves outside the project root", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "flight-cache-prune-root-"));
  const external = await mkdtemp(path.join(tmpdir(), "flight-cache-prune-external-"));
  const externalFile = path.join(external, "one-way-lhr-syd-2026-09-23.fli.json");
  try {
    await writeCacheFile(externalFile, { ageDays: 45 });
    await symlink(external, path.join(root, "cache"));

    await assert.rejects(
      () => pruneProviderCache({
        root,
        olderThanDays: 30,
        now: new Date("2026-11-15T00:00:00Z")
      }),
      /cache directory must be a real directory inside the project root/i
    );
    await assert.doesNotReject(() => stat(externalFile));
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(external, { recursive: true, force: true });
  }
});

test("cache pruning deletes only dry-run eligible files after exact confirmation", async () => {
  const root = await cacheFixture();
  const stale = path.join(root, "cache", "one-way-lhr-syd-2026-09-21.fli.json");
  const active = path.join(root, "cache", "one-way-lhr-syd-2026-09-23.fli.json");
  const fresh = path.join(root, "cache", "one-way-lhr-syd-2026-10-30.fli.json");
  const options = {
    root,
    olderThanDays: 30,
    now: new Date("2026-11-15T00:00:00Z"),
    protectedDateRanges: [{ start: "2026-09-22", end: "2026-09-24" }]
  };
  try {
    await writeCacheFile(stale, { ageDays: 45 });
    await writeCacheFile(active, { ageDays: 45 });
    await writeCacheFile(fresh, { ageDays: 5 });
    const preview = await pruneProviderCache(options);

    await assert.rejects(
      () => pruneProviderCache({ ...options, apply: true }),
      /confirmation/i
    );
    await assert.rejects(
      () => pruneProviderCache({ ...options, apply: true, confirmation: "delete it" }),
      /confirmation/i
    );
    const applied = await pruneProviderCache({
      ...options,
      apply: true,
      confirmation: CACHE_PRUNE_CONFIRMATION
    });

    assert.deepEqual(applied.deleted, preview.eligible);
    await assert.rejects(() => stat(stale), /ENOENT/);
    await assert.doesNotReject(() => stat(active));
    await assert.doesNotReject(() => stat(fresh));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("cache pruning returns an empty report without reading plan state when no cache exists", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "flight-cache-prune-empty-"));
  try {
    const planDir = path.join(root, "plans", "damaged-plan");
    await mkdir(planDir, { recursive: true });
    await writeFile(path.join(planDir, "plan.json"), "{damaged");

    const report = await pruneProviderCache({
      root,
      olderThanDays: 30,
      now: new Date("2026-11-15T00:00:00Z")
    });

    assert.deepEqual(report, {
      mode: "dry-run",
      eligible: [],
      protected: [],
      skipped: [],
      deleted: []
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("cache pruning discovers active departure and return windows from saved plans", async () => {
  const root = await cacheFixture();
  const planDir = path.join(root, "plans", "active-round-trip");
  const departure = path.join(root, "cache", "outbound-lhr-jfk-2026-12-23.fli.json");
  const returning = path.join(root, "cache", "return-jfk-lhr-2027-01-04.fli.json");
  try {
    await mkdir(planDir, { recursive: true });
    await writeFile(path.join(planDir, "plan.json"), JSON.stringify({
      id: "active-round-trip",
      name: "Active round trip",
      tripSpecPath: "../../trips/active-round-trip.json",
      routeIdeas: [{ id: "round-trip", label: "Round trip" }],
      intent: {
        dateCoverage: { start: "2026-12-22", end: "2026-12-24" },
        returnDateCoverage: { start: "2027-01-03", end: "2027-01-05" }
      }
    }));
    await writeCacheFile(departure, { ageDays: 45 });
    await writeCacheFile(returning, { ageDays: 45 });

    const report = await pruneProviderCache({
      root,
      olderThanDays: 30,
      now: new Date("2026-11-15T00:00:00Z")
    });

    assert.equal(report.eligible.length, 0);
    assert.deepEqual(report.protected.map((item) => item.relativePath).sort(), [
      "cache/outbound-lhr-jfk-2026-12-23.fli.json",
      "cache/return-jfk-lhr-2027-01-04.fli.json"
    ]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("cache pruning protects an active legacy trip window referenced by a saved plan", async () => {
  const root = await cacheFixture();
  const planDir = path.join(root, "plans", "legacy-plan");
  const tripFile = path.join(root, "trips", "legacy-trip.json");
  const cacheFile = path.join(root, "cache", "one-way-lhr-syd-2026-12-23.fli.json");
  try {
    await mkdir(planDir, { recursive: true });
    await mkdir(path.dirname(tripFile), { recursive: true });
    await writeFile(path.join(planDir, "plan.json"), JSON.stringify({
      id: "legacy-plan",
      tripSpecPath: "../../trips/legacy-trip.json"
    }));
    await writeFile(tripFile, JSON.stringify({
      departureWindow: { start: "2026-12-22", end: "2026-12-24" }
    }));
    await writeCacheFile(cacheFile, { ageDays: 45 });

    const report = await pruneProviderCache({
      root,
      olderThanDays: 30,
      now: new Date("2026-11-15T00:00:00Z")
    });

    assert.equal(report.eligible.length, 0);
    assert.deepEqual(report.protected.map((item) => item.relativePath), [
      "cache/one-way-lhr-syd-2026-12-23.fli.json"
    ]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("cache pruning does not protect archived or expired plan windows", async () => {
  const root = await cacheFixture();
  const archivedDir = path.join(root, "plans", "archived-plan");
  const expiredDir = path.join(root, "plans", "expired-plan");
  const archivedFile = path.join(root, "cache", "one-way-lhr-syd-2026-12-23.fli.json");
  const expiredFile = path.join(root, "cache", "one-way-lhr-syd-2026-10-23.fli.json");
  try {
    await mkdir(archivedDir, { recursive: true });
    await mkdir(expiredDir, { recursive: true });
    await writeFile(path.join(archivedDir, "plan.json"), JSON.stringify({
      id: "archived-plan",
      archived: true,
      intent: { dateCoverage: { start: "2026-12-22", end: "2026-12-24" } }
    }));
    await writeFile(path.join(expiredDir, "plan.json"), JSON.stringify({
      id: "expired-plan",
      intent: { dateCoverage: { start: "2026-10-22", end: "2026-10-24" } }
    }));
    await writeCacheFile(archivedFile, { ageDays: 45 });
    await writeCacheFile(expiredFile, { ageDays: 45 });

    const report = await pruneProviderCache({
      root,
      olderThanDays: 30,
      now: new Date("2026-11-15T00:00:00Z")
    });

    assert.deepEqual(report.eligible.map((item) => item.relativePath).sort(), [
      "cache/one-way-lhr-syd-2026-10-23.fli.json",
      "cache/one-way-lhr-syd-2026-12-23.fli.json"
    ]);
    assert.equal(report.protected.length, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

async function cacheFixture() {
  const root = await mkdtemp(path.join(tmpdir(), "flight-cache-prune-"));
  await mkdir(path.join(root, "cache"), { recursive: true });
  return root;
}

async function writeCacheFile(file, { ageDays }) {
  await writeFile(file, "{}\n");
  const modified = new Date("2026-11-15T00:00:00Z");
  modified.setUTCDate(modified.getUTCDate() - ageDays);
  await utimes(file, modified, modified);
}
