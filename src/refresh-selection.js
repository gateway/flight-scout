import { selectBatch } from "./batches.js";
import { buildAtomicLegSearches, buildRoutePlans } from "./planner.js";

// Selects and atomizes route ideas; provider cache state is deliberately outside this owner.
export function selectRefreshCalls({ plan, trip, mode }) {
  const routePlans = buildRoutePlans(trip);
  const atomicSearches = buildAtomicLegSearches(trip, routePlans);
  const catalog = dedupeById([...routePlans, ...atomicSearches]);
  const catalogById = new Map(catalog.map((item) => [item.id, item]));
  const routeIdeas = plan.routeIdeas.map((routeIdea) => withRouteIdeaDefaults(routeIdea, trip, catalogById));
  const selected = selectCalls({ routeIdeas, mode, routePlans, catalogById });
  return atomicProviderSelection(selected, atomicSearches);
}

export function capRefreshCalls(calls, { mode, maxCalls }) {
  return {
    calls: calls.slice(0, maxCalls),
    skippedCalls: calls.slice(maxCalls).map((call) => skippedCall(call, `${mode} mode limits refreshes to ${maxCalls} searches`))
  };
}

function selectCalls({ routeIdeas, mode, routePlans, catalogById }) {
  const selected = [];
  for (const routeIdea of routeIdeas) {
    for (const id of routeIdea.focusSearchIds ?? []) {
      const item = catalogById.get(id);
      if (item) selected.push({ ...item, routeIdeaId: routeIdea.id, refreshReasons: ["decision-critical focus search"] });
    }
    if (mode !== "light") {
      for (const item of dateWindowCoreCalls(routeIdea, routePlans)) {
        selected.push({ ...item, routeIdeaId: routeIdea.id, refreshReasons: ["full date-window coverage"] });
      }
    }
  }
  for (const routeIdea of routeIdeas) {
    if (mode !== "light") {
      for (const batch of routeIdea.batches ?? []) {
        const batchItems = routeIdea.type?.includes("stopover")
          ? dateWindowCoreCalls(routeIdea, routePlans)
          : selectBatch(routePlans, batch);
        for (const item of batchItems) {
          selected.push({ ...item, routeIdeaId: routeIdea.id, refreshReasons: [`route batch: ${batch}`] });
        }
      }
    }
  }
  if (mode === "targeted-deep") {
    for (const item of selectBatch(routePlans, "gateway-compare")) selected.push({ ...item, routeIdeaId: "targeted-gateway-compare", refreshReasons: ["gateway confidence"] });
  }
  if (mode === "deep") {
    for (const item of selectBatch(routePlans, "gateway-compare")) selected.push({ ...item, routeIdeaId: "deep-gateway-compare", refreshReasons: ["gateway confidence"] });
    for (const item of selectBatch(routePlans, "cheap-explorer")) selected.push({ ...item, routeIdeaId: "deep-cheap-explorer", refreshReasons: ["cheap explorer"] });
  }
  return dedupeById(selected);
}

function dateWindowCoreCalls(routeIdea, routePlans) {
  if (routeIdea.type === "round-trip") {
    return routePlans.filter((routePlan) => (
      routeMatchesIdea(routeIdea, routePlan) &&
      routePlan.kind === "one-way" &&
      routePlan.segments.length === 1 &&
      !hasIntentionalStopover(routePlan)
    ));
  }
  if (routeIdea.type === "direct-to-final") {
    return routePlans.filter((routePlan) => (
      routeMatchesIdea(routeIdea, routePlan) &&
      routePlan.kind === "one-way" &&
      routePlan.segments.length === 1 &&
      !hasIntentionalStopover(routePlan)
    ));
  }
  if (routeIdea.type?.includes("stopover") && routeIdea.stopover?.airports?.length) {
    return routePlans.filter((routePlan) => (
      routeMatchesIdea(routeIdea, routePlan) &&
      routePlan.kind === "multi-city" &&
      routePlan.stops.some((stop) => matchesStopover(routeIdea.stopover, stop) && stop.selectedNights > 0) &&
      routePlan.stops.every((stop) => stop.gateway || matchesStopover(routeIdea.stopover, stop)) &&
      !routePlan.stops.some((stop) => stop.gateway)
    ));
  }
  return [];
}

function atomicProviderSelection(routePlans, atomicSearches) {
  const atomicByKey = new Map(atomicSearches.map((search) => [segmentKey(search.segments[0]), search]));
  const calls = [];
  const skippedCalls = [];
  for (const routePlan of routePlans) {
    const segments = routePlan.segments ?? [];
    const atomics = segments.map((segment) => atomicByKey.get(segmentKey(segment)));
    const missingSegments = atomics.filter((atomic) => !atomic).length || (segments.length === 0 ? 1 : 0);
    for (const atomic of atomics.filter(Boolean)) calls.push(selectedAtomicCall(atomic, routePlan));
    if (missingSegments > 0) skippedCalls.push(skippedCall(routePlan, `Skipped because ${missingSegments} route ${missingSegments === 1 ? "segment has" : "segments have"} no provider-compatible atomic search.`));
  }
  return { calls: dedupeById(calls), skippedCalls };
}

function selectedAtomicCall(atomic, routePlan) {
  return {
    ...atomic,
    routeIdeaId: routePlan.routeIdeaId,
    routeFamily: routePlan.routeFamily ?? null,
    priority: routePlan.priority ?? null,
    refreshReasons: routePlan.refreshReasons ?? []
  };
}

function skippedCall(call, reason) {
  return { id: call.id, routeIdeaId: call.routeIdeaId, title: call.title, reason };
}

function segmentKey(segment) {
  return `${(segment?.from?.airports ?? []).join(",")}|${(segment?.to?.airports ?? []).join(",")}|${segment?.date ?? ""}`;
}

function routeMatchesIdea(routeIdea, routePlan) {
  if (routeIdea.type === "round-trip") return roundTripMatchesIdea(routeIdea, routePlan);
  if (routeIdea.originAirports?.length && !sharesAny(routePlan.segments[0]?.from?.airports, routeIdea.originAirports)) return false;
  if (routeIdea.destinationAirports?.length && !sharesAny(routePlan.segments.at(-1)?.to?.airports, routeIdea.destinationAirports)) return false;
  if (routeIdea.stopover?.airports?.length) return routePlan.stops.some((stop) => matchesStopover(routeIdea.stopover, stop));
  return true;
}

function roundTripMatchesIdea(routeIdea, routePlan) {
  const from = routePlan.segments[0]?.from?.airports;
  const to = routePlan.segments.at(-1)?.to?.airports;
  const outbound = sharesAny(from, routeIdea.originAirports) && sharesAny(to, routeIdea.destinationAirports);
  const returning = sharesAny(from, routeIdea.destinationAirports) && sharesAny(to, routeIdea.originAirports);
  return outbound || returning;
}

// Legacy plans are normalized in memory from trip/catalog metadata; labels never drive substring matching.
function withRouteIdeaDefaults(routeIdea, trip, catalogById) {
  const alternateStarts = trip.alternateStarts ?? [];
  const optionalStops = trip.optionalStops ?? [];
  const focusedOrigin = inferFocusedOriginAirports(routeIdea, catalogById);
  const focusedStopover = inferFocusedStopoverAirports(routeIdea, catalogById);
  const inferredAlternate = routeIdea.type?.includes("alternate-start") && alternateStarts.length === 1
    ? alternateStarts[0].airports
    : null;
  const stopover = routeIdea.stopover
    ? {
        ...routeIdea.stopover,
        airports: routeIdea.stopover.airports?.length
          ? routeIdea.stopover.airports
          : (focusedStopover ?? inferLegacyStopoverAirports(routeIdea.stopover, optionalStops))
      }
    : null;
  return {
    ...routeIdea,
    originAirports: routeIdea.originAirports?.length
      ? routeIdea.originAirports
      : (focusedOrigin ?? inferredAlternate ?? trip.origin?.airports ?? []),
    destinationAirports: routeIdea.destinationAirports?.length
      ? routeIdea.destinationAirports
      : (trip.destination?.airports ?? []),
    ...(stopover ? { stopover } : {})
  };
}

function inferFocusedOriginAirports(routeIdea, catalogById) {
  const signatures = new Map();
  for (const id of routeIdea.focusSearchIds ?? []) {
    const airports = catalogById.get(id)?.segments?.[0]?.from?.airports;
    if (airports?.length) signatures.set(airports.join(","), airports);
  }
  return signatures.size === 1 ? [...signatures.values()][0] : null;
}

function inferFocusedStopoverAirports(routeIdea, catalogById) {
  const signatures = new Map();
  for (const id of routeIdea.focusSearchIds ?? []) {
    for (const stop of catalogById.get(id)?.stops ?? []) {
      if (stop.routeRole === "intentional-stopover" && stop.airports?.length) signatures.set(stop.airports.join(","), stop.airports);
    }
  }
  return signatures.size === 1 ? [...signatures.values()][0] : null;
}

function inferLegacyStopoverAirports(stopover, optionalStops) {
  if (Number.isInteger(stopover.routeOrder) && optionalStops[stopover.routeOrder]) return optionalStops[stopover.routeOrder].airports ?? [];
  const exact = optionalStops.find((candidate) => candidate.label === stopover.label);
  if (exact) return exact.airports ?? [];
  return optionalStops.length === 1 ? (optionalStops[0].airports ?? []) : [];
}

function matchesStopover(stopover, stop) {
  return stop.routeRole === "intentional-stopover" && sharesAny(stop.airports, stopover.airports);
}

function sharesAny(left = [], right = []) {
  const values = new Set(left);
  return right.some((value) => values.has(value));
}

function hasIntentionalStopover(routePlan) {
  return routePlan.stops.some((stop) => !stop.gateway && stop.selectedNights > 0);
}

function dedupeById(items) {
  const byId = new Map();
  for (const item of items) {
    const existing = byId.get(item.id);
    if (!existing) {
      byId.set(item.id, { ...item, refreshReasons: [...new Set(item.refreshReasons ?? [])] });
      continue;
    }
    byId.set(item.id, {
      ...existing,
      refreshReasons: [...new Set([...(existing.refreshReasons ?? []), ...(item.refreshReasons ?? [])])]
    });
  }
  return [...byId.values()];
}
