import { dateOnly, money } from "./html-utils.js";
import { composeRoundTripOptions } from "./round-trip-options.js";

// Owns the pure route-to-flight projection shared by current dashboard evidence
// and compact historical price analysis.
export function groupByRouteIdea(plan, flights) {
  const groups = new Map((plan.routeIdeas ?? []).map((route) => [route.id, []]));
  const complete = (flights ?? []).filter((flight) => flight.tripComplete !== false && flight.destinationComplete !== false);
  const destinationAirports = new Set(plan.destination?.airports ?? []);
  for (const route of plan.routeIdeas ?? []) {
    if (route.type === "round-trip") {
      groups.get(route.id).push(...composeRoundTripOptions({ route, flights: flights ?? [] }));
      continue;
    }
    groups.get(route.id).push(...composeStopoverOptions(route, flights ?? [], destinationAirports));
  }
  for (const flight of complete) {
    const route = plan.routeIdeas.find((idea) => idea.type !== "round-trip" && matchesRouteIdea(idea, flight));
    if (route) groups.get(route.id).push(flight);
  }
  for (const [key, list] of groups) groups.set(key, list.sort((a, b) => optionScore(a) - optionScore(b)));
  return groups;
}

function composeStopoverOptions(route, flights, destinationAirports) {
  if (!route.stopover) return [];
  const focusIds = route.focusSearchIds ?? [];
  const nights = route.stopover.nights?.[0] ?? 1;
  const inboundByDate = bestByDate(flights.filter((flight) => focusIds.includes(flight.searchId) && !endsAtFinalAirport(flight, destinationAirports)));
  const onwardByDate = bestByDate(flights.filter((flight) => focusIds.includes(flight.searchId) && endsAtFinalAirport(flight, destinationAirports)));
  const options = [];
  for (const [inboundDate, inbound] of inboundByDate) {
    const onward = onwardByDate.get(addDays(inboundDate, nights));
    if (inbound && onward) options.push(composeStopoverOption(route, inbound, onward, nights));
  }
  return options;
}

function composeStopoverOption(route, inbound, onward, nights) {
  const hotelCost = nights * (route.stopover.hotelEstimateUsdPerNight ?? 0);
  const totalCost = (inbound.price ?? 0) + (onward.price ?? 0) + hotelCost;
  return {
    kind: "composed-stopover",
    label: `${inbound.departureAirport} -> ${route.stopover.label} -> ${onward.arrivalAirport} on ${dateOnly(inbound.departureTime)}`,
    summary: `$${money(inbound.price)} to ${route.stopover.label}, ${nights} night stopover, then $${money(onward.price)} to ${onward.arrivalAirport}. Hotel estimate $${money(hotelCost)}.`,
    inbound,
    onward,
    nights,
    stopoverLabel: route.stopover.label,
    totalCost,
    durationMinutes: (inbound.durationMinutes ?? 0) + (onward.durationMinutes ?? 0),
    googleFlightsUrl: onward.googleFlightsUrl ?? inbound.googleFlightsUrl
  };
}

function bestByDate(flights) {
  const byDate = new Map();
  for (const flight of flights) {
    const date = dateOnly(flight.departureTime);
    if (!date) continue;
    const current = byDate.get(date);
    if (!current || optionScore(flight) < optionScore(current)) byDate.set(date, flight);
  }
  return byDate;
}

function endsAtFinalAirport(flight, destinationAirports) {
  if (!destinationAirports?.size) return flight.destinationComplete !== false;
  return destinationAirports.has(flight.arrivalAirport) || (flight.expectedArrivalAirports ?? []).some((airport) => destinationAirports.has(airport));
}

function optionScore(option) {
  if (option.kind === "composed-stopover") return option.totalCost / 35 + option.durationMinutes / 18;
  if (option.kind === "composed-round-trip") return option.totalCost / 35 + option.durationMinutes / 18;
  return option.scoring?.score ?? 99999;
}

function matchesRouteIdea(route, flight) {
  if (flight.routeIdeaId === route.id) return true;
  if ((route.focusSearchIds ?? []).includes(flight.searchId)) return true;
  if ((route.batches ?? []).some((batch) => batch === flight.searchBatch || batch === flight.routeFamily)) return true;
  if (matchesAirports(route.originAirports, flight.departureAirport) && matchesAirports(route.destinationAirports, flight.arrivalAirport)) return true;
  const haystack = `${flight.searchTitle ?? ""} ${flight.routeFamily ?? ""} ${flight.searchBatch ?? ""}`.toLowerCase();
  return routeTokens(route).every((token) => haystack.includes(token));
}

function matchesAirports(expected, actual) {
  return Boolean(expected?.length && actual && expected.includes(actual));
}

function routeTokens(route) {
  return String(`${route.id ?? ""} ${route.label ?? ""}`)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2 && !["the", "and", "with"].includes(token));
}

function addDays(value, days) {
  const [year, month, day] = String(value ?? "").slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return "";
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}
