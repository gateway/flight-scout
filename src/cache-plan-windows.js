import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

// Reads only saved plan/trip definitions. Snapshot history is deliberately out
// of scope because cache pruning must never depend on or mutate user history.
export async function loadActivePlanDateRanges(root, { today }) {
  const projectRoot = path.resolve(root);
  const plansRoot = path.join(projectRoot, "plans");
  const ranges = [];
  for (const entry of await readDirectories(plansRoot)) {
    const planPath = path.join(plansRoot, entry.name, "plan.json");
    const plan = await readJson(planPath);
    if (isArchived(plan)) continue;
    const planRanges = await rangesForPlan(plan, planPath, projectRoot);
    if (planRanges.length === 0) {
      throw new Error(`Active plan has no usable date window: ${planPath}`);
    }
    if (latestEnd(planRanges) < today) continue;
    ranges.push(...planRanges);
  }
  return ranges;
}

async function rangesForPlan(plan, planPath, projectRoot) {
  const intentRanges = [plan.intent?.dateCoverage, plan.intent?.returnDateCoverage]
    .filter(Boolean)
    .map((range) => validatedRange(range, planPath));
  if (intentRanges.length > 0) return intentRanges;
  if (typeof plan.tripSpecPath !== "string") return [];
  const tripPath = path.resolve(path.dirname(planPath), plan.tripSpecPath);
  assertContained(projectRoot, tripPath);
  const trip = await readJson(tripPath);
  return [trip.departureWindow, trip.returnWindow]
    .filter(Boolean)
    .map((range) => validatedRange(range, tripPath));
}

function validatedRange(range, sourcePath) {
  const start = range.start ?? range.center;
  const end = range.end ?? range.center;
  if (!isDateOnly(start) || !isDateOnly(end) || start > end) {
    throw new Error(`Invalid active plan date window in ${sourcePath}`);
  }
  return { start, end };
}

function isDateOnly(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function isArchived(plan) {
  return Boolean(plan.archived || plan.hidden || plan.status === "archived");
}

function latestEnd(ranges) {
  return ranges.map((range) => range.end).sort().at(-1);
}

function assertContained(root, candidate) {
  const relative = path.relative(root, candidate);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Plan trip path must remain inside the project root.");
  }
}

async function readDirectories(directory) {
  try {
    return (await readdir(directory, { withFileTypes: true })).filter((entry) => entry.isDirectory());
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}
