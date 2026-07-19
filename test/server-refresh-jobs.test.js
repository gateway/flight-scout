import assert from "node:assert/strict";
import test from "node:test";
import { createRefreshJobStore } from "../src/refresh-job-store.js";
import { createServerRefreshJobs } from "../src/server-refresh-jobs.js";

test("server refresh jobs preserve plan and provider progress before completion", async () => {
  const patches = [];
  const baseStore = createRefreshJobStore();
  const store = {
    create: baseStore.create,
    get: baseStore.get,
    update(id, patch) {
      patches.push(patch);
      return baseStore.update(id, patch);
    }
  };
  const calls = [];
  const actions = {
    async refreshSelection({ all, onPlanStart, onEvent }) {
      assert.equal(all, true);
      const progress = { planIndex: 1, planTotal: 1, planPath: "plans/sample/plan.json" };
      onPlanStart(progress);
      onEvent({ type: "run-start", index: 0, total: 2, call: { id: "sample-search" } }, progress);
      return [{ planPath: progress.planPath }];
    },
    async writeLatestLowdown(refreshed) {
      calls.push(["lowdown", refreshed.length]);
      return true;
    },
    async regeneratePlanList() {
      calls.push(["regenerate"]);
    }
  };
  const jobs = createServerRefreshJobs({ actions, store });

  const started = jobs.start({ all: true });
  const completed = await waitForTerminal(jobs, started.id);

  assert.equal(completed.status, "complete");
  assert.equal(completed.lowdownHref, "outputs/latest-refresh-lowdown.md");
  assert.deepEqual(calls, [["lowdown", 1], ["regenerate"]]);
  assert.ok(patches.some((patch) => patch.message === "Plan 1 of 1: preparing refresh."));
  assert.ok(patches.some((patch) => patch.message === "Plan 1 of 1, search 1 of 2: checking sample-search."));
});

test("server refresh jobs expose action failures as terminal job state", async () => {
  const actions = {
    async refreshSelection() {
      throw new Error("provider unavailable");
    }
  };
  const jobs = createServerRefreshJobs({ actions });

  const started = jobs.start({ all: false, planPath: "plans/sample/plan.json" });
  const failed = await waitForTerminal(jobs, started.id);

  assert.equal(failed.status, "failed");
  assert.equal(failed.title, "Refresh failed");
  assert.equal(failed.message, "provider unavailable");
});

async function waitForTerminal(jobs, id) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const job = jobs.get(id);
    if (["complete", "failed"].includes(job?.status)) return job;
    await new Promise((resolve) => setImmediate(resolve));
  }
  throw new Error("Timed out waiting for refresh job.");
}
