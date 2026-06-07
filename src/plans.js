import { readFile } from "node:fs/promises";
import path from "node:path";
import { interpretFlightPlanText } from "./plan-intent.js";
import { createSavedPlanFromIntent } from "./plan-builder.js";

export function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function loadPlan(planPath, root = process.cwd()) {
  if (!planPath) throw new Error("Plan path is required.");
  const absolute = path.resolve(root, planPath);
  const plan = JSON.parse(await readFile(absolute, "utf8"));
  validatePlan(plan);
  return { absolute, plan, planDir: path.dirname(absolute) };
}

export function validatePlan(plan) {
  const required = ["id", "name", "tripSpecPath", "routeIdeas"];
  for (const field of required) {
    if (!plan[field]) throw new Error(`Plan is missing required field "${field}".`);
  }
  if (!Array.isArray(plan.routeIdeas) || plan.routeIdeas.length === 0) {
    throw new Error("Plan must include at least one route idea.");
  }
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
  const trip = JSON.parse(await readFile(tripPath, "utf8"));
  return { ...loaded, tripPath, trip };
}

export async function createPlanFromText({ text, outputDir, root = process.cwd() }) {
  const intent = interpretFlightPlanText(text);
  return createSavedPlanFromIntent({ intent, outputDir, root });
}
