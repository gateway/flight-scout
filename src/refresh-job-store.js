const TERMINAL_STATUSES = new Set(["complete", "failed"]);

export const DEFAULT_TERMINAL_JOB_LIMIT = 100;
export const DEFAULT_TERMINAL_JOB_MAX_AGE_MS = 24 * 60 * 60 * 1_000;

// Active refreshes are never evicted. Terminal records are bounded on ordinary
// store operations so the local server needs no background cleanup timer.
export function createRefreshJobStore({
  now = Date.now,
  maxTerminalJobs = DEFAULT_TERMINAL_JOB_LIMIT,
  terminalMaxAgeMs = DEFAULT_TERMINAL_JOB_MAX_AGE_MS
} = {}) {
  const entries = new Map();
  let counter = 0;

  function create(fields) {
    const nowMs = Number(now());
    cleanup(nowMs);
    const timestamp = new Date(nowMs).toISOString();
    const id = `refresh-${nowMs}-${++counter}`;
    const job = { ...fields, id, createdAt: timestamp, updatedAt: timestamp };
    entries.set(id, { job, order: counter, updatedAtMs: nowMs });
    return job;
  }

  function get(id) {
    cleanup(Number(now()));
    return entries.get(id)?.job ?? null;
  }

  function update(id, patch) {
    const nowMs = Number(now());
    cleanup(nowMs);
    const entry = entries.get(id);
    if (!entry) return null;
    const mutablePatch = { ...patch };
    delete mutablePatch.id;
    delete mutablePatch.createdAt;
    delete mutablePatch.updatedAt;
    Object.assign(entry.job, mutablePatch, { updatedAt: new Date(nowMs).toISOString() });
    entry.updatedAtMs = nowMs;
    cleanup(nowMs);
    return entries.get(id)?.job ?? null;
  }

  function cleanup(nowMs) {
    const terminal = [];
    for (const [id, entry] of entries) {
      if (!TERMINAL_STATUSES.has(entry.job.status)) continue;
      if (nowMs - entry.updatedAtMs > terminalMaxAgeMs) {
        entries.delete(id);
        continue;
      }
      terminal.push([id, entry]);
    }
    if (terminal.length <= maxTerminalJobs) return;
    terminal.sort((left, right) =>
      left[1].updatedAtMs - right[1].updatedAtMs || left[1].order - right[1].order
    );
    for (const [id] of terminal.slice(0, terminal.length - maxTerminalJobs)) entries.delete(id);
  }

  return { create, get, update };
}
