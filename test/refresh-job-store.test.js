import assert from "node:assert/strict";
import test from "node:test";
import { createRefreshJobStore } from "../src/refresh-job-store.js";

test("refresh job retention expires terminal jobs without removing active jobs", () => {
  let now = 0;
  const store = createRefreshJobStore({
    now: () => now,
    terminalMaxAgeMs: 100,
    maxTerminalJobs: 10
  });
  const active = store.create({ label: "active", status: "running" });
  const complete = store.create({ label: "complete", status: "running" });
  store.update(complete.id, { status: "complete" });

  now = 100;
  assert.equal(store.get(complete.id)?.id, complete.id);

  now = 101;

  assert.equal(store.get(complete.id), null);
  assert.equal(store.get(active.id)?.id, active.id);
});

test("refresh job retention keeps only the newest terminal jobs by count", () => {
  let now = 0;
  const store = createRefreshJobStore({
    now: () => now,
    terminalMaxAgeMs: 1_000,
    maxTerminalJobs: 2
  });
  const active = store.create({ label: "active", status: "running" });
  const terminal = [];

  for (const status of ["complete", "failed", "complete"]) {
    const job = store.create({ label: status, status: "running" });
    store.update(job.id, { status });
    terminal.push(job);
    now += 1;
  }

  assert.equal(store.get(terminal[0].id), null);
  assert.equal(store.get(terminal[1].id)?.status, "failed");
  assert.equal(store.get(terminal[2].id)?.status, "complete");
  assert.equal(store.get(active.id)?.status, "running");
});

test("refresh job updates preserve the response shape and refresh its timestamp", () => {
  let now = Date.UTC(2026, 6, 15);
  const store = createRefreshJobStore({ now: () => now });
  const job = store.create({ label: "one plan", status: "running", searchIndex: 0 });

  now += 1_000;
  const updated = store.update(job.id, { status: "complete", searchIndex: 3 });

  assert.deepEqual(updated, {
    id: job.id,
    label: "one plan",
    status: "complete",
    searchIndex: 3,
    createdAt: "2026-07-15T00:00:00.000Z",
    updatedAt: "2026-07-15T00:00:01.000Z"
  });
});

test("refresh job updates cannot replace store-owned identity fields", () => {
  let now = Date.UTC(2026, 6, 15);
  const store = createRefreshJobStore({ now: () => now });
  const job = store.create({ label: "one plan", status: "running" });

  now += 1_000;
  const updated = store.update(job.id, {
    id: "replacement-id",
    createdAt: "2000-01-01T00:00:00.000Z",
    updatedAt: "2000-01-01T00:00:00.000Z",
    status: "complete"
  });

  assert.equal(updated.id, job.id);
  assert.equal(updated.createdAt, "2026-07-15T00:00:00.000Z");
  assert.equal(updated.updatedAt, "2026-07-15T00:00:01.000Z");
  assert.equal(store.get("replacement-id"), null);
});
