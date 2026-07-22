import { readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { addDays, dateRange } from "./dates.js";
import { loadPlanTrip } from "./plans.js";
import { rebuildPlanWindowArtifacts } from "./plan-window-rebuild.js";
import { DEFAULT_REFRESH_BUDGET } from "./refresh-budget.js";

// Persists one bounded date-window change while preserving plan identity and saved snapshots.
export async function extendPlanWindow({
  root = process.cwd(),
  planPath,
  direction,
  days,
  maxWindowDays = DEFAULT_REFRESH_BUDGET.maxWindowDays,
  rebuild = rebuildPlanWindowArtifacts
}) {
  if (!["earlier", "later"].includes(direction)) throw extensionError("INVALID_DIRECTION", "Direction must be earlier or later.", 400);
  if (!Number.isInteger(days) || days < 1) throw extensionError("INVALID_DAYS", "Days must be a positive integer.", 400);

  const loaded = await loadPlanTrip(planPath, root);
  const current = loaded.trip.departureWindow ?? loaded.plan.intent?.dateCoverage;
  if (!current?.start || !current?.end) throw extensionError("MISSING_DATE_WINDOW", "Plan has no date window to extend.", 409);
  const start = direction === "earlier" ? addDays(current.start, -days) : current.start;
  const end = direction === "later" ? addDays(current.end, days) : current.end;
  if (dateRange(start, end).length > maxWindowDays) {
    throw extensionError("WINDOW_CAP_EXCEEDED", `Date windows cannot exceed ${maxWindowDays} days.`, 409);
  }

  const coverage = updatePlanCoverage(loaded.plan.intent?.dateCoverage ?? {}, start, end);
  const departureWindow = updateTripWindow(loaded.trip.departureWindow ?? {}, start, end);
  const plan = { ...loaded.plan, intent: { ...(loaded.plan.intent ?? {}), dateCoverage: coverage } };
  const trip = { ...loaded.trip, departureWindow };
  const [originalPlan, originalTrip] = await Promise.all([
    readFile(loaded.absolute, "utf8"),
    readFile(loaded.tripPath, "utf8")
  ]);
  try {
    await writeJsonAtomic(loaded.absolute, plan);
    await writeJsonAtomic(loaded.tripPath, trip);
    await rebuild({ ...loaded, root, planPath, plan, trip });
  } catch (error) {
    // A plan and its trip specification are one logical contract; restore both if derived output fails.
    const rollback = await Promise.allSettled([
      writeTextAtomic(loaded.absolute, originalPlan),
      writeTextAtomic(loaded.tripPath, originalTrip)
    ]);
    const rollbackFailure = rollback.find((result) => result.status === "rejected");
    if (rollbackFailure) {
      throw new AggregateError([error, rollbackFailure.reason], "Window extension failed and could not restore both date contracts.");
    }
    throw error;
  }
  return { planId: plan.id, direction, daysAdded: days, departureWindow: { start, end } };
}

function updatePlanCoverage(current, start, end) {
  return { ...current, center: originalCenter(current, start, end), start, end, plusMinusDays: null };
}

function updateTripWindow(current, start, end) {
  return { ...current, center: originalCenter(current, start, end), start, end, mode: "range", days: null };
}

function originalCenter(current, start, end) {
  if (current.center) return current.center;
  const windowDays = dateRange(start, end).length;
  return addDays(start, Math.floor((windowDays - 1) / 2));
}

async function writeJsonAtomic(file, value) {
  return writeTextAtomic(file, `${JSON.stringify(value, null, 2)}\n`);
}

async function writeTextAtomic(file, value) {
  const temporary = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.tmp`);
  try {
    await writeFile(temporary, value);
    await rename(temporary, file);
  } finally {
    await rm(temporary, { force: true });
  }
}

function extensionError(code, message, statusCode) {
  return Object.assign(new Error(message), { code, statusCode });
}
