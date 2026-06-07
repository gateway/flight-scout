const TOKYO_AIRPORTS = new Set(["HND", "NRT"]);
const BANGKOK_AIRPORTS = new Set(["BKK", "DMK"]);

export const BATCHES = {
  fastest: {
    description: "Direct-ish and lowest-segment routes from CNX/BKK to RDM.",
    select: (plans) => sortFastest(plans.filter((plan) => (
      (plan.routeFamily === "direct-ish" && plan.segments.length === 1) ||
      (plan.routeFamily === "bangkok-start" && plan.segments.length === 1) ||
      (plan.kind === "gateway-split" && plan.stops.length <= 1)
    )))
  },
  "fewest-layovers": {
    description: "No intentional stopover, then gateway split routes with the fewest planned segments.",
    select: (plans) => sortByDateAndComplexity(plans.filter((plan) => !hasIntentionalStopover(plan)))
  },
  "skip-tokyo": {
    description: "Routes that do not intentionally stop in Tokyo.",
    select: (plans) => sortByDateAndComplexity(plans.filter((plan) => !touchesAirports(plan, TOKYO_AIRPORTS)))
  },
  "tokyo-stopover": {
    description: "Routes with an intentional one- or two-night Tokyo stopover.",
    select: (plans) => sortByDateAndComplexity(plans.filter((plan) => (
      plan.stops.some((stop) => stop.label === "Tokyo" && stop.selectedNights > 0)
    )))
  },
  "tokyo-core": {
    description: "Core one-night Tokyo comparison without gateway-split noise.",
    select: (plans) => sortByDateAndComplexity(plans.filter((plan) => (
      plan.kind !== "gateway-split" &&
      ["tokyo-stopover", "bangkok-start-tokyo"].includes(plan.routeFamily) &&
      plan.stops.some((stop) => stop.label === "Tokyo" && stop.selectedNights === 1)
    )))
  },
  "bangkok-start": {
    description: "Assume the long-haul search starts from Bangkok.",
    select: (plans) => sortByDateAndComplexity(plans.filter((plan) => plan.segments[0]?.from.label.includes("Bangkok start")))
  },
  "bangkok-stopover": {
    description: "CNX to Bangkok, overnight, then long-haul.",
    select: (plans) => sortByDateAndComplexity(plans.filter((plan) => (
      plan.stops.some((stop) => stop.label === "Bangkok" && stop.selectedNights > 0)
    )))
  },
  "gateway-compare": {
    description: "Force comparison through SEA, SFO, LAX, and PDX.",
    select: (plans) => sortByDateAndComplexity(plans.filter((plan) => plan.kind === "gateway-split"))
  },
  "cheap-explorer": {
    description: "Broader lower-price exploration after fastest routes are known.",
    select: (plans) => sortByDateAndComplexity(plans.filter((plan) => plan.priority === "price-explorer"))
  },
  "all-reviewed": {
    description: "Controlled full research run. Must be paired with --max-runs.",
    select: (plans) => sortByDateAndComplexity(plans)
  }
};

export function listBatches() {
  return Object.entries(BATCHES).map(([name, batch]) => ({ name, description: batch.description }));
}

export function selectBatch(plans, batchName) {
  if (!batchName) return plans;
  const batch = BATCHES[batchName];
  if (!batch) {
    const known = Object.keys(BATCHES).join(", ");
    throw new Error(`Unknown batch "${batchName}". Known batches: ${known}`);
  }
  return batch.select(plans);
}

function hasIntentionalStopover(plan) {
  return plan.stops.some((stop) => !stop.gateway && stop.selectedNights > 0);
}

function touchesAirports(plan, airports) {
  return plan.segments.some((segment) => (
    segment.from.airports.some((airport) => airports.has(airport)) ||
    segment.to.airports.some((airport) => airports.has(airport))
  ));
}

function sortByDateAndComplexity(plans) {
  return [...plans].sort((a, b) => (
    a.startDate.localeCompare(b.startDate) ||
    a.segments.length - b.segments.length ||
    plannedStopoverNights(a) - plannedStopoverNights(b) ||
    gatewayOrder(a) - gatewayOrder(b) ||
    a.id.localeCompare(b.id)
  ));
}

function sortFastest(plans) {
  return [...plans].sort((a, b) => (
    a.segments.length - b.segments.length ||
    a.startDate.localeCompare(b.startDate) ||
    originOrder(a) - originOrder(b) ||
    gatewayOrder(a) - gatewayOrder(b) ||
    a.id.localeCompare(b.id)
  ));
}

function originOrder(plan) {
  const origin = plan.segments[0]?.from.label ?? "";
  if (origin.includes("Bangkok")) return 0;
  if (origin.includes("Chiang Mai")) return 1;
  return 2;
}

function plannedStopoverNights(plan) {
  return plan.stops.reduce((sum, stop) => sum + (stop.gateway ? 0 : stop.selectedNights ?? 0), 0);
}

function gatewayOrder(plan) {
  const order = ["SEA", "SFO", "LAX", "PDX"];
  const gateway = plan.stops.find((stop) => stop.gateway)?.airports?.[0];
  return gateway ? order.indexOf(gateway) : -1;
}
