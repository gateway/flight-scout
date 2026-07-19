import { readFile } from "node:fs/promises";
import path from "node:path";
import { interpretFlightPlanText } from "./plan-intent.js";
import { createSavedPlanFromIntent } from "./plan-builder.js";
import { validateWatchRules } from "./watch-rules.js";
export { slugify } from "./strings.js";

export async function loadPlan(planPath, root = process.cwd()) {
  if (!planPath) throw new Error("Plan path is required.");
  const absolute = path.resolve(root, planPath);
  const plan = JSON.parse(await readFile(absolute, "utf8"));
  validatePlan(plan);
  return {
    absolute,
    plan: {
      ...plan,
      primary: plan.primary ?? false,
      watchRules: plan.watchRules ?? []
    },
    planDir: path.dirname(absolute)
  };
}

export function validatePlan(plan) {
  const required = ["id", "name", "tripSpecPath", "routeIdeas"];
  for (const field of required) {
    if (!plan[field]) throw new Error(`Plan is missing required field "${field}".`);
  }
  if (!Array.isArray(plan.routeIdeas) || plan.routeIdeas.length === 0) {
    throw new Error("Plan must include at least one route idea.");
  }
  if (plan.primary !== undefined && typeof plan.primary !== "boolean") {
    throw new Error('Plan field "primary" must be a boolean when provided.');
  }
  if (plan.watchRules !== undefined && !Array.isArray(plan.watchRules)) {
    throw new Error('Plan field "watchRules" must be an array when provided.');
  }
  validateWatchRules(plan.watchRules);
  for (const route of plan.routeIdeas) {
    if (!route.id || !route.label) {
      throw new Error("Every route idea needs an id and label.");
    }
  }
}

export function resolveFromPlan(planDir, relativePath) {
  return path.resolve(planDir, relativePath);
}

export async function loadPlanTrip(planPath, root = process.cwd()) {
  const loaded = await loadPlan(planPath, root);
  const tripPath = resolveFromPlan(loaded.planDir, loaded.plan.tripSpecPath);
  const savedTrip = JSON.parse(await readFile(tripPath, "utf8"));
  const trip = {
    ...savedTrip,
    rules: {
      ...(savedTrip.rules ?? {}),
      connectionTypesByAirport: { ...(savedTrip.rules?.connectionTypesByAirport ?? {}) }
    }
  };
  return { ...loaded, tripPath, trip };
}

export async function createPlanFromText({ text, outputDir, root = process.cwd() }) {
  const intent = interpretFlightPlanText(text);
  return createSavedPlanFromIntent({ intent, outputDir, root });
}
