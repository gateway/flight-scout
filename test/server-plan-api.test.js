import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import test from "node:test";
import { createPlanApiRouter } from "../src/server-plan-api.js";

test("plan API router dispatches archive and serializes its established response", async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), "flight-server-api-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, "plans", "sample"), { recursive: true });
  await writeFile(path.join(root, "plans", "sample", "plan.json"), "{}\n");
  const calls = [];
  const actions = {
    archivePlan: async (...args) => {
      calls.push(["archive", ...args]);
      return { id: "sample", status: "archived" };
    },
    regeneratePlanList: async () => calls.push(["regenerate"])
  };
  const route = createPlanApiRouter({ root, actions, jobs: unusedJobs() });
  const request = jsonRequest("POST", "/api/plans/archive", { planPath: "plans/sample/plan.json" });
  const response = captureResponse();

  assert.equal(await route(request, response), true);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(response.body), { ok: true, id: "sample", archived: true });
  assert.deepEqual(calls, [["archive", "plans/sample/plan.json", false], ["regenerate"]]);
});

test("plan API router delegates refresh-all and refresh job status", async () => {
  const calls = [];
  const actions = {
    refreshSelection: async (input) => {
      calls.push(["refresh", input.all]);
      return [{ planPath: "plans/sample/plan.json" }];
    },
    regeneratePlanList: async () => calls.push(["regenerate"])
  };
  const jobs = {
    get: (id) => id === "known" ? { id, status: "running" } : null,
    start: () => ({ id: "started" })
  };
  const route = createPlanApiRouter({ root: process.cwd(), actions, jobs });
  const refreshResponse = captureResponse();
  const statusResponse = captureResponse();

  assert.equal(await route(jsonRequest("POST", "/api/plans/refresh-all", {}), refreshResponse), true);
  assert.equal(refreshResponse.statusCode, 200);
  assert.deepEqual(JSON.parse(refreshResponse.body), {
    ok: true,
    refreshed: [{ planPath: "plans/sample/plan.json" }]
  });
  assert.deepEqual(calls, [["refresh", true], ["regenerate"]]);

  assert.equal(await route(jsonRequest("GET", "/api/plans/refresh-status?id=known"), statusResponse), true);
  assert.equal(statusResponse.statusCode, 200);
  assert.deepEqual(JSON.parse(statusResponse.body), { ok: true, job: { id: "known", status: "running" } });
  assert.equal(await route(jsonRequest("GET", "/api/plans/refresh-status-extra?id=known"), captureResponse()), false);
  assert.equal(await route(jsonRequest("GET", "/api/plans/unknown"), captureResponse()), false);
});

function jsonRequest(method, url, body = {}) {
  const request = Readable.from(method === "GET" ? [] : [JSON.stringify(body)]);
  Object.assign(request, { method, url, headers: {}, socket: { encrypted: false } });
  return request;
}

function captureResponse() {
  return {
    statusCode: null,
    headers: null,
    body: "",
    writeHead(statusCode, headers) {
      this.statusCode = statusCode;
      this.headers = headers;
    },
    end(body = "") {
      this.body += body;
    }
  };
}

function unusedJobs() {
  return { get: () => null, start: () => ({ id: "unused" }) };
}
