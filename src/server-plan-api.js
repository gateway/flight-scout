import { existsSync } from "node:fs";
import path from "node:path";
import { readJsonBody } from "./server-json-body.js";
import { createPlanActions } from "./server-plan-actions.js";
import { createServerRefreshJobs } from "./server-refresh-jobs.js";

// The API router owns route matching, input validation, and HTTP response serialization.
export function createPlanApiRouter({ root, actions, jobs } = {}) {
  const planActions = actions ?? createPlanActions({ root });
  const refreshJobs = jobs ?? createServerRefreshJobs({ actions: planActions });

  return async function routePlanApi(request, response) {
    if (request.method === "POST" && request.url === "/api/plans/archive") {
      await handleArchive(request, response);
      return true;
    }
    if (request.method === "POST" && request.url === "/api/plans/refresh") {
      await handlePlanRefresh(request, response);
      return true;
    }
    if (request.method === "POST" && request.url === "/api/plans/refresh-all") {
      await handleRefreshAll(request, response);
      return true;
    }
    if (request.method === "POST" && request.url === "/api/plans/refresh/start") {
      await handleRefreshStart(request, response);
      return true;
    }
    if (request.method === "GET" && requestPathname(request) === "/api/plans/refresh-status") {
      handleRefreshStatus(request, response);
      return true;
    }
    return false;
  };

  async function handleArchive(request, response) {
    const body = await readJsonBody(request);
    if (!validPlanPath(body.planPath)) return sendInvalidPlan(response);
    const plan = await planActions.archivePlan(body.planPath, Boolean(body.restore));
    await planActions.regeneratePlanList();
    sendJson(response, 200, { ok: true, id: plan.id, archived: plan.status === "archived" });
  }

  async function handlePlanRefresh(request, response) {
    const body = await readJsonBody(request);
    if (!validPlanPath(body.planPath)) return sendInvalidPlan(response);
    const refreshed = await planActions.refreshSelection({ all: false, planPath: body.planPath, body });
    await planActions.regeneratePlanList();
    sendJson(response, 200, { ok: true, refreshed });
  }

  async function handleRefreshAll(request, response) {
    const body = await readJsonBody(request);
    const refreshed = await planActions.refreshSelection({ all: true, body });
    await planActions.regeneratePlanList();
    sendJson(response, 200, { ok: true, refreshed });
  }

  async function handleRefreshStart(request, response) {
    const body = await readJsonBody(request);
    if (!body.all && !validPlanPath(body.planPath)) return sendInvalidPlan(response);
    const job = refreshJobs.start(body);
    sendJson(response, 202, { ok: true, jobId: job.id });
  }

  function handleRefreshStatus(request, response) {
    const url = new URL(request.url ?? "/", "http://localhost");
    const job = refreshJobs.get(url.searchParams.get("id"));
    if (!job) return sendJson(response, 404, { ok: false, message: "Refresh job not found." });
    sendJson(response, 200, { ok: true, job });
  }

  function validPlanPath(value) {
    if (typeof value !== "string" || !/^plans\/[^/]+\/plan\.json$/.test(value)) return false;
    return existsSync(path.resolve(root, value));
  }
}

function requestPathname(request) {
  return new URL(request.url ?? "/", "http://localhost").pathname;
}

function sendInvalidPlan(response) {
  response.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
  response.end("Invalid plan path.");
}

function sendJson(response, statusCode, value) {
  response.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(value));
}
