#!/usr/bin/env node
import { createServer } from "node:http";
import { createReadStream, existsSync } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { setPlanArchiveStatus } from "./plan-archive.js";
import { writeAppIndex, writePlanListDashboard } from "./plan-list-dashboard.js";

// Tiny local-only static server for generated dashboards plus the archive/restore action.
// It intentionally avoids a web framework so setup stays simple for non-engineer testers.

const ROOT = process.cwd();
const PORT = Number(process.env.PORT ?? 8765);
const HOST = process.env.HOST ?? "127.0.0.1";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml"
};

const server = createServer(async (request, response) => {
  try {
    if (request.method === "POST" && request.url === "/api/plans/archive") {
      await handleArchive(request, response);
      return;
    }
    await serveStatic(request, response);
  } catch (error) {
    response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    response.end(error.message);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Flight research app running at http://${HOST}:${PORT}/`);
});

async function handleArchive(request, response) {
  const body = await readJsonBody(request);
  if (!isSafePlanPath(body.planPath)) {
    response.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
    response.end("Invalid plan path.");
    return;
  }
  const { plan } = await setPlanArchiveStatus({ root: ROOT, planPath: body.planPath, restore: Boolean(body.restore) });
  await regeneratePlanList();
  response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify({ ok: true, id: plan.id, archived: plan.status === "archived" }));
}

async function regeneratePlanList() {
  const outputPath = path.join(ROOT, "outputs", "plans.dashboard.html");
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writePlanListDashboard({ root: ROOT, outputPath });
  await writeAppIndex({ root: ROOT, outputPath: path.join(ROOT, "index.html"), dashboardPrefix: "outputs/" });
}

async function serveStatic(request, response) {
  const url = new URL(request.url ?? "/", `http://${HOST}:${PORT}`);
  const relative = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  const filePath = path.resolve(ROOT, `.${relative}`);
  if (!filePath.startsWith(ROOT) || !existsSync(filePath) || !(await stat(filePath)).isFile()) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }
  response.writeHead(200, { "content-type": TYPES[path.extname(filePath)] ?? "application/octet-stream" });
  createReadStream(filePath).pipe(response);
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let text = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      text += chunk;
      if (text.length > 50_000) reject(new Error("Request body too large."));
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(text || "{}"));
      } catch {
        reject(new Error("Invalid JSON body."));
      }
    });
    request.on("error", reject);
  });
}

function isSafePlanPath(value) {
  if (typeof value !== "string") return false;
  if (!/^plans\/[^/]+\/plan\.json$/.test(value)) return false;
  return existsSync(path.resolve(ROOT, value));
}
