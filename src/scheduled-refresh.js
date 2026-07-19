import { randomUUID } from "node:crypto";
import {
  existsSync,
  readFileSync,
  unlinkSync
} from "node:fs";
import { mkdir, open, readFile, rm, stat } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_SCHEDULE_JITTER_MS = 5 * 60 * 1000;
const DEFAULT_STALE_LOCK_MS = 6 * 60 * 60 * 1000;

// Runs one cron-friendly refresh while an ownership-checked local lock prevents
// overlap. This module never loops, creates timers beyond jitter, or calls a provider.
export async function runScheduledRefresh({
  lockPath,
  runRefresh,
  jitterMaxMs = DEFAULT_SCHEDULE_JITTER_MS,
  random = Math.random,
  sleep = delay,
  now = () => Date.now(),
  pid = process.pid,
  isProcessAlive = processIsAlive,
  staleAfterMs = DEFAULT_STALE_LOCK_MS,
  handleSignals = true,
  processRef = process
}) {
  const lock = await acquireRefreshLock({ lockPath, now, pid, isProcessAlive, staleAfterMs });
  if (!lock) return { status: "skipped-overlap", jitterMs: 0, refresh: null };
  const removeSignalHandlers = handleSignals ? installSignalCleanup(lock, processRef) : () => {};
  const jitterMs = boundedJitter(jitterMaxMs, random);
  try {
    if (jitterMs > 0) await sleep(jitterMs);
    const refresh = await runRefresh();
    return { status: "completed", jitterMs, refresh };
  } finally {
    removeSignalHandlers();
    await lock.release();
  }
}

export async function acquireRefreshLock({
  lockPath,
  now = () => Date.now(),
  pid = process.pid,
  isProcessAlive = processIsAlive,
  staleAfterMs = DEFAULT_STALE_LOCK_MS,
  openFile = open
}) {
  if (!lockPath) throw new Error("Scheduled refresh lock path is required.");
  await mkdir(path.dirname(lockPath), { recursive: true });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const token = `${pid}:${now()}:${randomUUID()}`;
    let handle = null;
    try {
      handle = await openFile(lockPath, "wx", 0o600);
      try {
        await handle.writeFile(`${JSON.stringify({ pid, token, acquiredAt: new Date(now()).toISOString() })}\n`);
      } finally {
        await handle.close();
      }
      return lockHandle(lockPath, token);
    } catch (error) {
      if (handle) {
        await rm(lockPath, { force: true });
        throw error;
      }
      if (error.code !== "EEXIST") throw error;
      if (await existingLockIsActive(lockPath, { now, isProcessAlive, staleAfterMs })) return null;
      await rm(lockPath, { force: true });
    }
  }
  return null;
}

function lockHandle(lockPath, token) {
  return {
    async release() {
      if (await ownsLock(lockPath, token)) await rm(lockPath, { force: true });
    },
    releaseSync() {
      if (!ownsLockSync(lockPath, token)) return;
      try {
        unlinkSync(lockPath);
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }
  };
}

async function existingLockIsActive(lockPath, { now, isProcessAlive, staleAfterMs }) {
  try {
    const owner = JSON.parse(await readFile(lockPath, "utf8"));
    if (Number.isInteger(owner.pid) && owner.pid > 0) return isProcessAlive(owner.pid);
  } catch {
    // A recent malformed lock is preserved; only an old one is safe to reclaim.
  }
  const details = await stat(lockPath);
  return now() - details.mtimeMs < staleAfterMs;
}

async function ownsLock(lockPath, token) {
  try {
    return JSON.parse(await readFile(lockPath, "utf8")).token === token;
  } catch {
    return false;
  }
}

function ownsLockSync(lockPath, token) {
  if (!existsSync(lockPath)) return false;
  try {
    return JSON.parse(readFileSync(lockPath, "utf8")).token === token;
  } catch {
    return false;
  }
}

function installSignalCleanup(lock, processRef) {
  const handlers = new Map();
  for (const [signal, exitCode] of [["SIGINT", 130], ["SIGTERM", 143]]) {
    const handler = () => {
      lock.releaseSync();
      processRef.exit(exitCode);
    };
    handlers.set(signal, handler);
    processRef.once(signal, handler);
  }
  return () => handlers.forEach((handler, signal) => processRef.off(signal, handler));
}

function boundedJitter(maximum, random) {
  if (!Number.isInteger(maximum) || maximum < 0) throw new Error("Scheduled refresh jitter must be a non-negative integer.");
  const fraction = Math.min(1, Math.max(0, Number(random()) || 0));
  return Math.min(maximum, Math.floor(fraction * (maximum + 1)));
}

function processIsAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code !== "ESRCH";
  }
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
