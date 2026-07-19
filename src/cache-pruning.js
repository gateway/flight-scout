import { lstat, readdir, realpath, unlink } from "node:fs/promises";
import path from "node:path";
import { loadActivePlanDateRanges } from "./cache-plan-windows.js";

const FLI_CACHE_SUFFIX = ".fli.json";
export const CACHE_PRUNE_CONFIRMATION = "DELETE STALE CACHE";

// Owns the safety boundary for cache inspection and deletion. Dry-run is the
// default so callers must opt into every destructive invocation explicitly.
export async function pruneProviderCache({
  root = process.cwd(),
  olderThanDays,
  now = new Date(),
  apply = false,
  confirmation = null,
  protectedDateRanges
}) {
  assertPositiveDays(olderThanDays);
  if (apply && confirmation !== CACHE_PRUNE_CONFIRMATION) {
    throw new Error(`Cache deletion requires the exact confirmation "${CACHE_PRUNE_CONFIRMATION}".`);
  }
  const projectRoot = path.resolve(root);
  const cacheRoot = await verifiedCacheRoot(projectRoot);
  const eligible = [];
  const protectedFiles = [];
  const skipped = [];
  if (!cacheRoot) return emptyReport({ apply, eligible, protectedFiles, skipped });
  const activeRanges = protectedDateRanges ?? await loadActivePlanDateRanges(projectRoot, {
    today: now.toISOString().slice(0, 10)
  });
  for (const entry of await readCacheEntries(cacheRoot)) {
    const candidate = path.resolve(cacheRoot, entry.name);
    if (path.dirname(candidate) !== cacheRoot) continue;
    const relativePath = path.join("cache", entry.name);
    if (entry.isSymbolicLink()) {
      skipped.push({ relativePath, reason: "symbolic-link" });
      continue;
    }
    if (entry.isFile() && !entry.name.endsWith(FLI_CACHE_SUFFIX)) {
      skipped.push({ relativePath, reason: "unknown-provider-suffix" });
      continue;
    }
    if (!entry.isFile()) continue;
    const metadata = await lstat(candidate);
    if (metadata.isSymbolicLink() || !isOlderThan(metadata.mtimeMs, now, olderThanDays)) continue;
    const searchDates = parseSearchDates(entry.name);
    if (searchDates.length === 0) {
      skipped.push({ relativePath, reason: "unparseable-search-date" });
      continue;
    }
    const item = {
      relativePath,
      ageDays: roundedDays(now.getTime() - metadata.mtimeMs)
    };
    if (containsProtectedDate(searchDates, activeRanges)) protectedFiles.push(item);
    else eligible.push(item);
  }
  const deleted = apply ? await deleteEligibleFiles(cacheRoot, eligible, skipped) : [];
  return {
    mode: apply ? "apply" : "dry-run",
    eligible,
    protected: protectedFiles,
    skipped,
    deleted
  };
}

async function deleteEligibleFiles(cacheRoot, eligible, skipped) {
  const deleted = [];
  for (const item of eligible) {
    const filename = path.basename(item.relativePath);
    const candidate = path.join(cacheRoot, filename);
    let metadata;
    try {
      metadata = await lstat(candidate);
    } catch (error) {
      if (error.code === "ENOENT") {
        skipped.push({ relativePath: item.relativePath, reason: "changed-before-delete" });
        continue;
      }
      throw error;
    }
    if (metadata.isSymbolicLink() || !metadata.isFile()) {
      skipped.push({ relativePath: item.relativePath, reason: "changed-before-delete" });
      continue;
    }
    await unlink(candidate);
    deleted.push(item);
  }
  return deleted;
}

async function verifiedCacheRoot(projectRoot) {
  const cacheRoot = path.join(projectRoot, "cache");
  let metadata;
  try {
    metadata = await lstat(cacheRoot);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
  const [projectReal, cacheReal] = await Promise.all([realpath(projectRoot), realpath(cacheRoot)]);
  if (metadata.isSymbolicLink() || !metadata.isDirectory() || cacheReal !== path.join(projectReal, "cache")) {
    throw new Error("Cache directory must be a real directory inside the project root.");
  }
  return cacheReal;
}

function emptyReport({ apply, eligible, protectedFiles, skipped }) {
  return {
    mode: apply ? "apply" : "dry-run",
    eligible,
    protected: protectedFiles,
    skipped,
    deleted: []
  };
}

async function readCacheEntries(cacheRoot) {
  try {
    return await readdir(cacheRoot, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

function assertPositiveDays(value) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("olderThanDays must be a positive number.");
  }
}

function isOlderThan(modifiedMs, now, olderThanDays) {
  return now.getTime() - modifiedMs > olderThanDays * 86_400_000;
}

function roundedDays(milliseconds) {
  return Math.round(milliseconds / 86_400_000 * 10) / 10;
}

function containsProtectedDate(dates, ranges) {
  return dates.some((date) => ranges.some(({ start, end }) => (
    typeof start === "string" && typeof end === "string" && date >= start && date <= end
  )));
}

function parseSearchDates(filename) {
  return (filename.match(/\d{4}-\d{2}-\d{2}/g) ?? []).filter((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  });
}
