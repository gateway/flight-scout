import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable, Writable } from "node:stream";
import { once } from "node:events";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";
import { servePublicStatic } from "../src/server-static.js";

const execFileAsync = promisify(execFile);

class RecordingResponse extends Writable {
  constructor() {
    super();
    this.body = "";
    this.headersSent = false;
    this.wasDestroyed = false;
  }

  _write(chunk, _encoding, callback) {
    this.body += String(chunk);
    callback();
  }

  writeHead(statusCode, headers) {
    this.statusCode = statusCode;
    this.headers = headers;
    this.headersSent = true;
    return this;
  }

  destroy(error) {
    this.wasDestroyed = true;
    return super.destroy(error);
  }
}

test("static stream errors close only the failed response and later requests still work", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "flight-static-resilience-"));
  const logs = [];
  try {
    await mkdir(path.join(root, "outputs"), { recursive: true });
    await writeFile(path.join(root, "index.html"), "<h1>Still available</h1>\n");
    const failedResponse = new RecordingResponse();
    const closed = once(failedResponse, "close");

    await servePublicStatic({
      root,
      requestUrl: "/",
      response: failedResponse,
      openReadStream: () => new Readable({
        read() {
          this.destroy(new Error("simulated read failure"));
        }
      }),
      logger: (message) => logs.push(String(message))
    });
    await closed;

    assert.equal(failedResponse.wasDestroyed, true);
    assert.ok(logs.some((line) => line.includes("simulated read failure")));

    const healthyResponse = new RecordingResponse();
    const finished = once(healthyResponse, "finish");
    await servePublicStatic({ root, requestUrl: "/", response: healthyResponse });
    await finished;
    assert.equal(healthyResponse.statusCode, 200);
    assert.ok(healthyResponse.body.includes("Still available"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("process guards log unexpected errors and keep the local process alive", async () => {
  const moduleUrl = pathToFileURL(path.resolve("src/server-process-guards.js")).href;
  const script = `
    import { installProcessErrorGuards } from ${JSON.stringify(moduleUrl)};
    installProcessErrorGuards();
    Promise.reject(new Error("rejection probe"));
    setTimeout(() => { throw new Error("exception probe"); }, 5);
    setTimeout(() => { console.log("still alive"); }, 30);
  `;

  const { stdout, stderr } = await execFileAsync(process.execPath, ["--input-type=module", "--eval", script]);

  assert.ok(stdout.includes("still alive"));
  assert.ok(stderr.includes("rejection probe"));
  assert.ok(stderr.includes("exception probe"));
});
