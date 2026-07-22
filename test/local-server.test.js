import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { request as httpRequest } from "node:http";
import { createServer } from "node:net";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, test } from "node:test";

const HOST = "127.0.0.1";
const SERVER_PATH = fileURLToPath(new URL("../src/local-server.js", import.meta.url));

let fixtureRoot;
let siblingRoot;
let serverProcess;
let serverUrl;
let symlinkFixtureAvailable = false;

before(async () => {
  fixtureRoot = await mkdtemp(path.join(tmpdir(), "flight-local-server-"));
  siblingRoot = `${fixtureRoot}-sibling`;
  await mkdir(path.join(fixtureRoot, "outputs"), { recursive: true });
  await mkdir(path.join(fixtureRoot, "cache"), { recursive: true });
  await mkdir(path.join(fixtureRoot, "src"), { recursive: true });
  await mkdir(path.join(fixtureRoot, ".git"), { recursive: true });
  await mkdir(path.join(fixtureRoot, "plans", "synthetic-plan"), { recursive: true });
  await mkdir(siblingRoot, { recursive: true });
  await writeFile(path.join(fixtureRoot, "index.html"), "<h1>Flight Scout</h1>\n");
  await writeFile(path.join(fixtureRoot, "outputs", "example.dashboard.html"), "<h1>Safe dashboard</h1>\n");
  await writeFile(path.join(fixtureRoot, "outputs", "dashboard.css"), "body { color: black; }\n");
  await writeFile(path.join(fixtureRoot, "outputs", "dashboard.js"), "document.documentElement.dataset.ready = 'true';\n");
  await writeFile(path.join(fixtureRoot, "outputs", "latest-refresh-lowdown.md"), "# Latest refresh\n");
  await writeFile(path.join(fixtureRoot, "outputs", "logo.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  await writeFile(path.join(fixtureRoot, "outputs", "last-intent.json"), "{\"private\":true}\n");
  try {
    await symlink("last-intent.json", path.join(fixtureRoot, "outputs", "intent-leak.html"));
    symlinkFixtureAvailable = true;
  } catch (error) {
    if (!["EACCES", "ENOTSUP", "EPERM"].includes(error.code)) throw error;
  }
  await writeFile(path.join(fixtureRoot, "cache", "provider.json"), "{\"private\":true}\n");
  await writeFile(path.join(fixtureRoot, "src", "private.js"), "export const privateValue = true;\n");
  await writeFile(path.join(fixtureRoot, "README.md"), "private project documentation\n");
  await writeFile(path.join(fixtureRoot, ".env"), "TEST_SECRET=must-not-be-served\n");
  await writeFile(path.join(fixtureRoot, ".git", "config"), "private git metadata\n");
  await writeFile(path.join(fixtureRoot, "plans", "synthetic-plan", "plan.json"), "{\"id\":\"synthetic-plan\"}\n");
  await writeFile(path.join(siblingRoot, "private.txt"), "sibling data must not be served\n");

  const port = await reserveLoopbackPort();
  serverUrl = `http://${HOST}:${port}`;
  serverProcess = spawn(process.execPath, [SERVER_PATH], {
    cwd: fixtureRoot,
    env: { ...process.env, HOST, PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"]
  });
  await waitForServer(serverProcess, serverUrl);
});

after(async () => {
  await stopProcess(serverProcess);
  const fixturePaths = [fixtureRoot, siblingRoot].filter(Boolean);
  await Promise.all(fixturePaths.map((fixturePath) => rm(fixturePath, { recursive: true, force: true })));
});

test("local server serves only intended index and output asset types", async () => {
  const expectedPublicPaths = [
    "/",
    "/index.html",
    "/outputs/example.dashboard.html",
    "/outputs/dashboard.css",
    "/outputs/dashboard.js",
    "/outputs/latest-refresh-lowdown.md",
    "/outputs/logo.png"
  ];

  for (const publicPath of expectedPublicPaths) {
    const response = await fetch(`${serverUrl}${publicPath}`);
    assert.equal(response.status, 200, publicPath);
  }
});

test("local server rejects project roots and non-public output data", async () => {
  const expectedPrivatePaths = [
    "/README.md",
    "/src/private.js",
    "/cache/provider.json",
    "/outputs/last-intent.json"
  ];

  for (const privatePath of expectedPrivatePaths) {
    const response = await fetch(`${serverUrl}${privatePath}`);
    assert.equal(response.status, 404, privatePath);
  }
});

test("local server validates the real target type before serving an output symlink", async (context) => {
  if (!symlinkFixtureAvailable) {
    context.skip("File symlinks are unavailable on this platform.");
    return;
  }

  const response = await fetch(`${serverUrl}/outputs/intent-leak.html`);

  assert.equal(response.status, 404);
});

test("local server does not expose the project environment file", async () => {
  const response = await fetch(`${serverUrl}/.env`);

  assert.equal(response.status, 404);
});

test("local server does not expose Git metadata", async () => {
  const response = await fetch(`${serverUrl}/.git/config`);

  assert.equal(response.status, 404);
});

test("local server does not expose saved plan JSON", async () => {
  const response = await fetch(`${serverUrl}/plans/synthetic-plan/plan.json`);

  assert.equal(response.status, 404);
});

test("local server rejects traversal into a similarly named sibling directory", async () => {
  const siblingName = path.basename(siblingRoot);
  const siblingResponse = await fetch(`${serverUrl}/%2e%2e%2f${siblingName}%2fprivate.txt`);
  const outputEscapeResponse = await fetch(`${serverUrl}/outputs/%2e%2e%2f.env`);

  assert.equal(siblingResponse.status, 404);
  assert.equal(outputEscapeResponse.status, 404);
});

test("local server accepts a same-origin state-changing request for route validation", async () => {
  const response = await fetch(`${serverUrl}/api/plans/archive`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: serverUrl },
    body: JSON.stringify({ planPath: "invalid" })
  });

  assert.equal(response.status, 400);
  assert.equal(await response.text(), "Invalid plan path.");
});

test("local server preserves plan-specific refresh validation at the HTTP boundary", async () => {
  for (const route of ["/api/plans/refresh", "/api/plans/refresh/start"]) {
    const response = await fetch(`${serverUrl}${route}`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: serverUrl },
      body: JSON.stringify({ planPath: "invalid" })
    });

    assert.equal(response.status, 400, route);
    assert.equal(await response.text(), "Invalid plan path.", route);
  }
});

test("local server leaves unknown API routes on the constrained static 404 path", async () => {
  const response = await fetch(`${serverUrl}/api/plans/unknown`);

  assert.equal(response.status, 404);
  assert.equal(await response.text(), "Not found");
});

test("local server accepts a matching LAN-style Host and Origin", async () => {
  const authority = "100.64.12.34:8765";
  const response = await postJson(`${serverUrl}/api/plans/archive`, { planPath: "invalid" }, {
      "content-type": "application/json",
      host: authority,
      origin: `http://${authority}`
  });

  assert.equal(response.status, 400);
  assert.equal(response.body, "Invalid plan path.");
});

test("local server rejects an untrusted browser origin before every state-changing handler", async () => {
  const routes = [
    "/api/plans/archive",
    "/api/plans/extend-window",
    "/api/plans/refresh",
    "/api/plans/refresh-all",
    "/api/plans/refresh/start"
  ];

  for (const route of routes) {
    const response = await fetch(`${serverUrl}${route}`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://attacker.example" },
      body: JSON.stringify({ planPath: "invalid" })
    });

    assert.equal(response.status, 403, route);
  }
});

test("local server fails closed for missing, opaque, malformed, or cross-scheme origins", async () => {
  const origins = [undefined, "null", "not a URL", serverUrl.replace("http:", "https:")];

  for (const origin of origins) {
    const headers = { "content-type": "application/json" };
    if (origin !== undefined) headers.origin = origin;
    const response = await fetch(`${serverUrl}/api/plans/archive`, {
      method: "POST",
      headers,
      body: JSON.stringify({ planPath: "invalid" })
    });

    assert.equal(response.status, 403, String(origin));
  }
});

test("local server fails closed when Host and Origin are both malformed", async () => {
  const response = await postJson(
    `${serverUrl}/api/plans/archive`,
    { planPath: "invalid" },
    { "content-type": "application/json", host: "%%%", origin: "not a URL" }
  );

  assert.equal(response.status, 403);
});

test("local server terminates an oversized JSON request with 413", async () => {
  const response = await postBody(
    `${serverUrl}/api/plans/archive`,
    JSON.stringify({ padding: "x".repeat(50_100) }),
    { "content-type": "application/json", origin: serverUrl }
  );

  assert.equal(response.status, 413);
  assert.equal(response.body, "Request body too large.");
});

test("local server bounds chunked JSON by bytes rather than string characters", async () => {
  const response = await postBody(
    `${serverUrl}/api/plans/archive`,
    JSON.stringify({ padding: "😀".repeat(13_000) }),
    { "content-type": "application/json", origin: serverUrl },
    { omitContentLength: true }
  );

  assert.equal(response.status, 413);
  assert.equal(response.body, "Request body too large.");
});

test("local server returns 400 for invalid JSON without invoking a route handler", async () => {
  const response = await postBody(
    `${serverUrl}/api/plans/archive`,
    "{",
    { "content-type": "application/json", origin: serverUrl }
  );

  assert.equal(response.status, 400);
  assert.equal(response.body, "Invalid JSON body.");
});

test("local server treats an empty JSON body as an empty object", async () => {
  const response = await postBody(
    `${serverUrl}/api/plans/archive`,
    "",
    { "content-type": "application/json", origin: serverUrl }
  );

  assert.equal(response.status, 400);
  assert.equal(response.body, "Invalid plan path.");
});

test("local server returns 404 for an unknown refresh job", async () => {
  const response = await fetch(`${serverUrl}/api/plans/refresh-status?id=missing-job`);

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { ok: false, message: "Refresh job not found." });
});

async function reserveLoopbackPort() {
  const reservation = createServer();
  await new Promise((resolve, reject) => {
    reservation.once("error", reject);
    reservation.listen(0, HOST, resolve);
  });
  const address = reservation.address();
  await new Promise((resolve, reject) => reservation.close((error) => error ? reject(error) : resolve()));
  return address.port;
}

function waitForServer(child, url) {
  return new Promise((resolve, reject) => {
    let stderr = "";
    const timeout = setTimeout(() => finish(new Error(`Timed out starting local server. ${stderr}`)), 5_000);
    const onStdout = (chunk) => {
      if (String(chunk).includes(url)) finish();
    };
    const onStderr = (chunk) => {
      stderr += String(chunk);
    };
    const onExit = (code) => finish(new Error(`Local server exited before startup with code ${code}. ${stderr}`));
    const finish = (error) => {
      clearTimeout(timeout);
      child.stdout.off("data", onStdout);
      child.stderr.off("data", onStderr);
      child.off("exit", onExit);
      error ? reject(error) : resolve();
    };
    child.stdout.on("data", onStdout);
    child.stderr.on("data", onStderr);
    child.once("exit", onExit);
  });
}

async function stopProcess(child) {
  if (!child || child.exitCode !== null) return;
  const exited = new Promise((resolve) => child.once("exit", resolve));
  if (!child.kill("SIGTERM")) return;
  const stoppedGracefully = await Promise.race([
    exited.then(() => true),
    wait(2_000).then(() => false)
  ]);
  if (!stoppedGracefully && child.exitCode === null) {
    child.kill("SIGKILL");
    await exited;
  }
}

function wait(milliseconds) {
  return new Promise((resolve) => {
    const timeout = setTimeout(resolve, milliseconds);
    timeout.unref();
  });
}

function postJson(url, body, headers, requestOptions = {}) {
  return postBody(url, JSON.stringify(body), headers, requestOptions);
}

function postBody(url, payload, headers, { omitContentLength = false, ...requestOptions } = {}) {
  return new Promise((resolve, reject) => {
    const requestHeaders = omitContentLength
      ? { ...headers }
      : { ...headers, "content-length": Buffer.byteLength(payload) };
    const request = httpRequest(url, {
      method: "POST",
      ...requestOptions,
      headers: requestHeaders
    }, (response) => {
      let responseBody = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        responseBody += chunk;
      });
      response.on("end", () => resolve({ status: response.statusCode, body: responseBody }));
    });
    request.on("error", reject);
    request.end(payload);
  });
}
