import { classifyCandidate, viabilityRulesFrom, VIABILITY } from "./viability.js";
import { dateOnly } from "./html-utils.js";
import { confidenceLabel, connectionRiskSummary } from "./decision-confidence.js";
import {
  humanPainScore,
  optionDurationMinutes,
  optionLayovers,
  optionLegs,
  optionPrice,
  travelPainBreakdown
} from "./decision-metrics.js";

// Owns the raw-option to decision-option projection used by every selector and renderer.
export function normalizeOptions({ plan, trip = null, routeGroups, refreshBySearchId = new Map() }) {
  const options = [];
  for (const route of plan.routeIdeas ?? []) {
    for (const option of routeGroups.get(route.id) ?? []) {
      const normalized = normalizeOption({ option, route, trip, plan, refreshBySearchId });
      if (normalized.isEvaluable && normalized.viability.status !== VIABILITY.HARD_REJECT && normalized.viability.status !== VIABILITY.HIDDEN) options.push(normalized);
    }
  }
  return options.sort((a, b) => a.humanScore - b.humanScore);
}

export function normalizeOption({ option, route, trip = null, plan = null, refreshBySearchId = new Map() }) {
  const price = optionPrice(option);
  const durationMinutes = optionDurationMinutes(option);
  const legs = optionLegs(option);
  const layovers = optionLayovers(option);
  const travelPain = travelPainBreakdown(option);
  const assumptions = extraTravelAssumptions({ option, route, trip });
  const connectionRisk = connectionRiskSummary(layovers);
  const confidence = confidenceLabel({ option, price, durationMinutes, connectionRisk, assumptions, refreshBySearchId });
  const humanScore = humanPainScore({ option, price, durationMinutes, connectionRisk, assumptions, confidence });
  const viability = classifyCandidate(option, viabilityRulesFrom({ trip, plan }));

  return {
    ...option,
    routeIdeaId: route.id,
    routeIdeaLabel: route.label,
    routeSummary: route.summary ?? "",
    routeType: route.type ?? "",
    price,
    durationMinutes,
    date: optionDate(option),
    routeLine: optionRouteLine(option),
    legs,
    layovers,
    travelPain,
    assumptions,
    connectionRisk,
    confidence,
    humanScore,
    viability,
    isHardRejected: viability.status === VIABILITY.HARD_REJECT,
    isEvaluable: Number.isFinite(price) && Number.isFinite(durationMinutes)
  };
}

function extraTravelAssumptions({ option, route, trip }) {
  const assumptions = [];
  if (option.kind === "composed-round-trip") {
    assumptions.push({
      level: "warning",
      label: "Separate one-way tickets",
      text: option.bookingWarning
    });
  }
  if (!trip?.origin?.airports?.length) return assumptions;
  const primary = new Set(trip.origin.airports);
  const departure = option.kind === "composed-stopover"
    ? option.inbound.departureAirport
    : option.kind === "composed-round-trip"
      ? option.outbound.departureAirport
      : option.departureAirport;
  if (departure && !primary.has(departure)) {
    const alternate = (trip.alternateStarts ?? []).find((item) => (item.airports ?? []).includes(departure));
    const startLabel = cleanStartLabel(alternate?.label ?? departure);
    const primaryLabel = trip.origin.label ?? "the main starting city";
    assumptions.push({
      level: "warning",
      label: `Starts in ${startLabel}`,
      text: alternate
        ? `This option starts in ${startLabel}, not ${primaryLabel}. Use it only if you will already be there, or add the flight, hotel, transfer time, and hassle to get from ${primaryLabel} to ${startLabel}.`
        : `This option starts outside ${primaryLabel}. Add the time and cost to get there before comparing it with routes from ${primaryLabel}.`
    });
  }
  if (route.type?.includes("alternate-start") && option.kind !== "composed-stopover") {
    assumptions.push({ level: "warning", label: "Extra travel first", text: "This is not a simple door-to-door route from your main starting city. Add the extra flight, hotel, transfer time, and hassle before treating the price as the real total." });
  }
  return assumptions;
}

function cleanStartLabel(value) {
  return String(value ?? "alternate start").replace(/\s+start$/i, "");
}

function optionRouteLine(option) {
  if (option.kind === "composed-stopover") return `${option.inbound.departureAirport ?? "?"} -> ${option.stopoverLabel ?? "stopover"} -> ${option.onward.arrivalAirport ?? "?"}`;
  if (option.kind === "composed-round-trip") return `${option.outbound.departureAirport ?? "?"} -> ${option.outbound.arrivalAirport ?? "?"} -> ${option.returnFlight.arrivalAirport ?? "?"}`;
  return `${option.departureAirport ?? "?"} -> ${option.arrivalAirport ?? "?"}`;
}

function optionDate(option) {
  if (option.kind === "composed-stopover") return dateOnly(option.inbound.departureTime);
  if (option.kind === "composed-round-trip") return dateOnly(option.outbound.departureTime);
  return dateOnly(option.departureTime);
}
