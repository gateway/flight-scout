const GENERIC_BATCHES = {
  fastest: {
    description: "Lowest-segment routes without a declared stopover.",
    select: (plans) => sortFastest(plans.filter((plan) => (
      plan.segments.length === 1 || (hasGateway(plan) && !hasDeclaredStopover(plan))
    )))
  },
  "fewest-layovers": {
    description: "No intentional stopover, then gateway split routes with the fewest planned segments.",
    select: (plans) => sortByDateAndComplexity(plans.filter((plan) => !hasIntentionalStopover(plan)))
  },
  "intentional-stopover": {
    description: "Routes with at least one declared overnight stopover.",
    select: (plans) => sortByDateAndComplexity(plans.filter(hasIntentionalStopover))
  },
  "one-night-stopover": {
    description: "Routes with exactly one planned stopover night and no gateway split.",
    select: (plans) => sortByDateAndComplexity(plans.filter((plan) => (
      !hasGateway(plan) && plannedStopoverNights(plan) === 1
    )))
  },
  "alternate-start": {
    description: "Routes that begin at a declared alternate origin.",
    select: (plans) => sortByDateAndComplexity(plans.filter((plan) => (
      plan.segments[0]?.from.routeRole === "alternate-start"
    )))
  },
  "gateway-compare": {
    description: "Compare routes through each declared gateway in user priority order.",
    select: (plans) => sortByDateAndComplexity(plans.filter(hasGateway))
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

// Hidden compatibility inputs keep old saved plans readable without advertising
// personal-route terminology to new plans or public batch discovery.
const LEGACY_BATCH_ALIASES = {
  "skip-tokyo": legacyBatch("Omit the second declared stopover.", (plan) => !hasStopoverAtOrder(plan, 1)),
  "tokyo-stopover": legacyBatch("Use the second declared stopover.", (plan) => hasOvernightStopoverAtOrder(plan, 1)),
  "tokyo-core": legacyBatch("Use one night at the second declared stopover without a gateway.", (plan) => (
    hasOvernightStopoverAtOrder(plan, 1, 1) && !hasGateway(plan)
  )),
  "bangkok-start": legacyBatch("Begin at a declared alternate origin.", (plan) => (
    plan.segments[0]?.from.routeRole === "alternate-start"
  )),
  "bangkok-stopover": legacyBatch("Use the first declared stopover.", (plan) => hasOvernightStopoverAtOrder(plan, 0))
};

export const BATCHES = GENERIC_BATCHES;

export function listBatches() {
  return Object.entries(BATCHES).map(([name, batch]) => ({ name, description: batch.description }));
}

export function selectBatch(plans, batchName) {
  if (!batchName) return plans;
  const batch = BATCHES[batchName] ?? LEGACY_BATCH_ALIASES[batchName];
  if (!batch) {
    const known = Object.keys(BATCHES).join(", ");
    throw new Error(`Unknown batch "${batchName}". Known batches: ${known}`);
  }
  return batch.select(plans);
}

function hasIntentionalStopover(plan) {
  return plan.stops.some((stop) => isIntentionalStopover(stop) && stop.selectedNights > 0);
}

function hasDeclaredStopover(plan) {
  return plan.stops.some(isIntentionalStopover);
}

function hasGateway(plan) {
  return plan.stops.some((stop) => stop.routeRole === "gateway" || stop.gateway === true);
}

function isIntentionalStopover(stop) {
  if (stop.routeRole) return stop.routeRole === "intentional-stopover";
  return stop.gateway !== true;
}

function hasStopoverAtOrder(plan, routeOrder) {
  return plan.stops.some((stop) => isIntentionalStopover(stop) && stop.routeOrder === routeOrder);
}

function hasOvernightStopoverAtOrder(plan, routeOrder, selectedNights = null) {
  return plan.stops.some((stop) => isIntentionalStopover(stop) && stop.routeOrder === routeOrder && (
    selectedNights === null ? stop.selectedNights > 0 : stop.selectedNights === selectedNights
  ));
}

function legacyBatch(description, predicate) {
  return {
    description: `Compatibility alias: ${description}`,
    select: (plans) => sortByDateAndComplexity(plans.filter(predicate))
  };
}

function sortByDateAndComplexity(plans) {
  return [...plans].sort((a, b) => (
    a.startDate.localeCompare(b.startDate) ||
    a.segments.length - b.segments.length ||
    plannedStopoverNights(a) - plannedStopoverNights(b) ||
    originOrder(a) - originOrder(b) ||
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
  const origin = plan.segments[0]?.from;
  return Number.isInteger(origin?.routeOrder) ? origin.routeOrder : Number.MAX_SAFE_INTEGER;
}

function plannedStopoverNights(plan) {
  return plan.stops.reduce((sum, stop) => (
    sum + (isIntentionalStopover(stop) ? stop.selectedNights ?? 0 : 0)
  ), 0);
}

function gatewayOrder(plan) {
  const gateway = plan.stops.find((stop) => stop.routeRole === "gateway" || stop.gateway);
  return Number.isInteger(gateway?.routeOrder) ? gateway.routeOrder : Number.MAX_SAFE_INTEGER;
}
