import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { acquireRefreshLock, runScheduledRefresh } from "../src/scheduled-refresh.js";
import { runPlanScheduledRefresh } from "../src/commands/scheduled-refresh-command.js";

test("scheduled refresh applies one bounded jitter and releases its lock", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "flight-scheduled-success-"));
  const lockPath = path.join(root, "work", "refresh.lock");
  const delays = [];
  try {
    const result = await runScheduledRefresh({
      lockPath,
      jitterMaxMs: 1_000,
      random: () => 0.25,
      sleep: async (delay) => delays.push(delay),
      runRefresh: async () => ({ refreshedPlanCount: 2 }),
      handleSignals: false
    });

    assert.deepEqual(delays, [250]);
    assert.equal(result.status, "completed");
    assert.equal(result.jitterMs, 250);
    assert.equal(result.refresh.refreshedPlanCount, 2);
    assert.equal(existsSync(lockPath), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("scheduled refresh never exceeds its jitter bound", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "flight-scheduled-jitter-"));
  const lockPath = path.join(root, "work", "refresh.lock");
  const delays = [];
  try {
    const result = await runScheduledRefresh({
      lockPath,
      jitterMaxMs: 1_000,
      random: () => 1,
      sleep: async (delay) => delays.push(delay),
      runRefresh: async () => null,
      handleSignals: false
    });

    assert.deepEqual(delays, [1_000]);
    assert.equal(result.jitterMs, 1_000);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("scheduled refresh command runs once inside its configured root", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "flight-scheduled-command-"));
  const received = [];
  try {
    const result = await runPlanScheduledRefresh({ mode: "light", maxRuns: 2, jitterMs: 0 }, {
      root,
      refreshSummary: async (flags) => {
        received.push(flags);
        return { refreshedPlanCount: 1 };
      },
      log: () => {}
    });

    assert.equal(result.status, "completed");
    assert.deepEqual(received, [{ mode: "light", maxRuns: 2, jitterMs: 0, refresh: false }]);
    assert.equal(existsSync(path.join(root, "work", "scheduled-refresh.lock")), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("lock acquisition cleans a partial lock when writing fails", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "flight-scheduled-write-failure-"));
  const lockPath = path.join(root, "work", "refresh.lock");
  let closed = false;
  try {
    await assert.rejects(
      acquireRefreshLock({
        lockPath,
        openFile: async () => {
          await writeFile(lockPath, "partial");
          return {
            writeFile: async () => { throw new Error("disk write failed"); },
            close: async () => { closed = true; }
          };
        }
      }),
      /disk write failed/
    );
    assert.equal(closed, true);
    assert.equal(existsSync(lockPath), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("scheduled refresh skips an overlapping live owner", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "flight-scheduled-overlap-"));
  const lockPath = path.join(root, "work", "refresh.lock");
  let ran = false;
  try {
    await writeLock(lockPath, { pid: 42, token: "active", acquiredAt: "2026-07-17T00:00:00.000Z" });
    const result = await runScheduledRefresh({
      lockPath,
      jitterMaxMs: 0,
      isProcessAlive: () => true,
      runRefresh: async () => { ran = true; },
      handleSignals: false
    });

    assert.equal(result.status, "skipped-overlap");
    assert.equal(ran, false);
    assert.equal(JSON.parse(await readFile(lockPath, "utf8")).token, "active");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("scheduled refresh reclaims a dead owner lock and cleans up on failure", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "flight-scheduled-stale-"));
  const lockPath = path.join(root, "work", "refresh.lock");
  try {
    await writeLock(lockPath, { pid: 42, token: "dead", acquiredAt: "2026-07-17T00:00:00.000Z" });
    await assert.rejects(
      runScheduledRefresh({
        lockPath,
        jitterMaxMs: 0,
        isProcessAlive: () => false,
        runRefresh: async () => { throw new Error("interrupted refresh"); },
        handleSignals: false
      }),
      /interrupted refresh/
    );
    assert.equal(existsSync(lockPath), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("scheduled refresh removes its owned lock when the process is terminated", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "flight-scheduled-signal-"));
  const lockPath = path.join(root, "work", "refresh.lock");
  const moduleUrl = pathToFileURL(path.join(process.cwd(), "src", "scheduled-refresh.js")).href;
const source = `import { runScheduledRefresh } from ${JSON.stringify(moduleUrl)};
await runScheduledRefresh({
  lockPath: ${JSON.stringify(lockPath)},
  jitterMaxMs: 0,
  runRefresh: () => {
    process.stdout.write("refresh-started\\n");
    return new Promise(() => setInterval(() => {}, 1_000));
  }
});`;
  const child = spawn(process.execPath, ["--input-type=module", "--eval", source], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "ignore"]
  });
  try {
    await waitForOutput(child.stdout, "refresh-started");
    assert.equal(existsSync(lockPath), true);
    child.kill("SIGTERM");
    const result = await waitForExit(child);
    assert.equal(result.signal, null);
    assert.equal(result.code, 143);
    assert.equal(existsSync(lockPath), false);
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    await rm(root, { recursive: true, force: true });
  }
});

async function writeLock(lockPath, data) {
  await import("node:fs/promises").then(({ mkdir }) => mkdir(path.dirname(lockPath), { recursive: true }));
  await writeFile(lockPath, `${JSON.stringify(data)}\n`);
}

async function waitFor(predicate, timeoutMs = 2_000) {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > timeoutMs) throw new Error("Timed out waiting for scheduled refresh state.");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

function waitForExit(child) {
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => resolve({ code, signal }));
  });
}

function waitForOutput(stream, expected, timeoutMs = 2_000) {
  return new Promise((resolve, reject) => {
    let output = "";
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${expected}.`)), timeoutMs);
    stream.setEncoding("utf8");
    stream.on("data", (chunk) => {
      output += chunk;
      if (!output.includes(expected)) return;
      clearTimeout(timer);
      resolve();
    });
  });
}
