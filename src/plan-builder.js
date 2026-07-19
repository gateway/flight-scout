import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { slugify } from "./strings.js";
import { watchRulesFromIntent } from "./watch-rules.js";

// Converts validated natural-language intent into the saved plan/trip files that drive
// refreshes, dashboards, date comparison, and the all-plans overview.

export async function createSavedPlanFromIntent({ intent, outputDir, root = process.cwd() }) {
  if (intent.status === "needs-clarification") {
    const lines = intent.clarifications.map((question) => `- ${question}`).join("\n");
    throw new Error(`Clarification needed before saving this plan:\n${lines}`);
  }

  const id = stablePlanId(intent);
  const planDir = path.resolve(root, outputDir ?? path.join("plans", id));
  const planPath = path.join(planDir, "plan.json");
  if (existsSync(planPath)) throw new Error(`Plan already exists: ${planPath}`);
  const tripPath = path.resolve(root, "trips", `${id}.json`);
  const tripSpecPath = relativePlanPath(planDir, tripPath);
  const trip = buildTripSpec(intent);
  const plan = buildPlan({ intent, id, tripSpecPath });

  await mkdir(planDir, { recursive: true });
  await mkdir(path.dirname(tripPath), { recursive: true });
  await writeFile(tripPath, `${JSON.stringify(trip, null, 2)}\n`);
  await writeFile(planPath, `${JSON.stringify(plan, null, 2)}\n`);
  return { planPath, tripPath, plan, trip, intent };
}

export function buildTripSpec(intent) {
  const budget = intent.budget
    ? {
        target: intent.budget.target,
        softMax: intent.budget.softMax,
        hardMax: intent.budget.hardMax,
        payMoreToSaveHour: 45
      }
    : { target: null, softMax: null, hardMax: null, payMoreToSaveHour: 45 };

  return {
    name: `${intent.origin.label} to ${intent.destination.label}`,
    currency: intent.budget?.currency ?? "USD",
    locale: { hl: "en", gl: "us" },
    travelers: { adults: 1, children: 0, infants: 0 },
    budget,
    tripType: intent.tripType === "round-trip" ? "round-trip" : "one-way",
    departureWindow: intent.departureWindow,
    ...(intent.tripType === "round-trip" ? { returnWindow: intent.returnWindow } : {}),
    origin: intent.origin,
    alternateStarts: [],
    destination: intent.destination,
    optionalStops: intent.stopover?.airports?.length ? [{
      label: intent.stopover.label,
      airports: intent.stopover.airports,
      nights: intent.stopover.nights,
      required: intent.stopover.required,
      ...(intent.stopover.hotelEstimateUsdPerNight ? { hotelEstimateUsdPerNight: intent.stopover.hotelEstimateUsdPerNight } : {})
    }] : [],
    gatewayAirports: [],
    routeModes: {
      includeDirectToDestination: true,
      includeGatewaySplit: false,
      includeOptionalStopCombinations: Boolean(intent.stopover?.airports?.length)
    },
    rules: {
      maxSingleTravelDayHours: 26,
      rejectTotalElapsedHoursOver: intent.preferences.rejectTotalElapsedHoursOver ?? 35,
      preferredInternationalToDomesticConnectionMinutes: 180,
      preferredDomesticConnectionMinutes: 90,
      connectionTypesByAirport: {},
      separateTicketMinimumBufferMinutes: 360,
      lastFlightToDestinationPenalty: 25,
      ...(intent.preferences.preferredTotalElapsedHours ? { preferredTotalElapsedHours: intent.preferences.preferredTotalElapsedHours } : {}),
      requestDelayMs: 5000,
      hotelNightEstimate: intent.stopover?.hotelEstimateUsdPerNight
        ? { [intent.stopover.label]: intent.stopover.hotelEstimateUsdPerNight }
        : {}
    }
  };
}

function buildPlan({ intent, id, tripSpecPath }) {
  return {
    id,
    name: `${intent.origin.label} to ${intent.destination.label}`,
    primary: false,
    createdAt: new Date().toISOString(),
    tripSpecPath,
    intent: {
      tripType: intent.tripType === "round-trip" ? "round-trip" : "one-way",
      naturalLanguage: intent.raw,
      noLiveRequested: intent.noLive,
      dateCoverage: {
        center: intent.departureWindow.center ?? intent.departureWindow.start,
        plusMinusDays: intent.departureWindow.mode === "plus-minus" ? intent.departureWindow.days : 0,
        start: intent.departureWindow.start,
        end: intent.departureWindow.end
      },
      ...(intent.tripType === "round-trip" ? {
        returnDateCoverage: {
          center: intent.returnWindow.center ?? intent.returnWindow.start,
          plusMinusDays: intent.returnWindow.mode === "plus-minus" ? intent.returnWindow.days : 0,
          start: intent.returnWindow.start,
          end: intent.returnWindow.end
        }
      } : {}),
      assumptions: intent.assumptions
    },
    preferences: {
      currency: intent.budget?.currency ?? "USD",
      targetBudget: intent.budget?.target ?? null,
      softMaxBudget: intent.budget?.softMax ?? null,
      hardMaxBudget: intent.budget?.hardMax ?? null,
      budgetSensitivity: intent.preferences.budgetSensitivity,
      priority: intent.preferences.priority,
      directRequired: intent.directness.required,
      maxStops: intent.directness.maxStops,
      ...(intent.preferences.preferredTotalElapsedHours ? { preferredTotalElapsedHours: intent.preferences.preferredTotalElapsedHours } : {}),
      ...(intent.preferences.rejectTotalElapsedHoursOver ? { rejectTotalElapsedHoursOver: intent.preferences.rejectTotalElapsedHoursOver } : {})
    },
    watchRules: watchRulesFromIntent(intent),
    routeIdeas: routeIdeasFromIntent(intent),
    refreshPolicy: {
      defaultMode: "standard",
      staleAfterHours: 24,
      requiresLiveFlag: true
    }
  };
}

function routeIdeasFromIntent(intent) {
  const routeId = slugify(`${intent.origin.label}-to-${intent.destination.label}`);
  const ideas = [{
    id: routeId,
    label: `${intent.origin.label} to ${intent.destination.label}`,
    summary: routeSummary(intent),
    type: intent.tripType === "round-trip" ? "round-trip" : "direct-to-final",
    required: true,
    batches: intent.directness.requested ? ["fewest-layovers", "fastest"] : ["fastest"],
    originAirports: intent.origin.airports,
    destinationAirports: intent.destination.airports
  }];

  if (intent.stopover?.airports?.length) {
    ideas.push({
      id: slugify(`${intent.origin.label}-${intent.stopover.label}-${intent.destination.label}`),
      label: `${intent.origin.label} to ${intent.stopover.label} to ${intent.destination.label}`,
      summary: `Compare the ${intent.stopover.label} stopover against the direct route.`,
      type: "stopover",
      required: intent.stopover.required,
      stopover: {
        label: intent.stopover.label,
        airports: intent.stopover.airports,
        routeOrder: 0,
        nights: intent.stopover.nights,
        ...(intent.stopover.hotelEstimateUsdPerNight ? { hotelEstimateUsdPerNight: intent.stopover.hotelEstimateUsdPerNight } : {})
      },
      batches: ["fastest"],
      originAirports: intent.origin.airports,
      destinationAirports: intent.destination.airports
    });
  }
  return ideas;
}

function routeSummary(intent) {
  const parts = [`Search ${intent.origin.label} to ${intent.destination.label}`];
  if (intent.tripType === "round-trip") parts.push("pair outbound and return one-way tickets");
  if (intent.directness.required) parts.push("direct/nonstop only if available");
  if (intent.budget?.hardMax) parts.push(`under $${intent.budget.hardMax}`);
  if (intent.preferences.preferredTotalElapsedHours) parts.push(`prefer under ${intent.preferences.preferredTotalElapsedHours}h`);
  if (intent.preferences.rejectTotalElapsedHoursOver) parts.push(`ignore over ${intent.preferences.rejectTotalElapsedHoursOver}h`);
  return `${parts.join(", ")}.`;
}

function stablePlanId(intent) {
  const date = intent.departureWindow.center ?? intent.departureWindow.start;
  const stopover = intent.stopover?.airports?.length ? `via-${intent.stopover.label}` : "";
  return slugify([intent.origin.label, "to", intent.destination.label, stopover, date].filter(Boolean).join("-"));
}

function relativePlanPath(planDir, targetPath) {
  const relative = path.relative(planDir, targetPath);
  return relative.startsWith(".") ? relative : `./${relative}`;
}
