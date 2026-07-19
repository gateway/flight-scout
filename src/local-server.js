#!/usr/bin/env node
import { createServer } from "node:http";
import { loadDotEnv } from "./cli-support.js";
import { createPlanApiRouter } from "./server-plan-api.js";
import { RequestBodyError } from "./server-json-body.js";
import { allowStateChangingRequest } from "./server-request-guard.js";
import { servePublicStatic } from "./server-static.js";
import { installProcessErrorGuards } from "./server-process-guards.js";

// The executable owns process configuration and transport only. Security and API behavior
// remain explicit on this request path so release auditing can verify the trust boundary.
const root = process.cwd();
const port = Number(process.env.PORT ?? 8765);
const host = process.env.HOST ?? "127.0.0.1";
const routePlanApi = createPlanApiRouter({ root });
installProcessErrorGuards();

const server = createServer(async (request, response) => {
  try {
    if (!allowStateChangingRequest(request, response)) return;
    if (await routePlanApi(request, response)) return;
    await servePublicStatic({ root, requestUrl: request.url, response });
  } catch (error) {
    const statusCode = error instanceof RequestBodyError ? error.statusCode : 500;
    console.error(`[flight-scout] Request failed: ${error.stack ?? error.message}`);
    if (response.headersSent) {
      response.destroy();
      return;
    }
    response.writeHead(statusCode, { "content-type": "text/plain; charset=utf-8" });
    response.end(error instanceof RequestBodyError ? error.message : "Request failed.");
  }
});

await loadDotEnv();

server.listen(port, host, () => {
  console.log(`Flight research app running at http://${host}:${port}/`);
});
