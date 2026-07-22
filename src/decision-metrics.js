import { formatMinutes as formatDisplayMinutes, money } from "./html-utils.js";
import { challengerConcern } from "./decision-copy.js";
import { enrichLayoversWithTimes } from "./connection-duration.js";

// Owns option measurements and tradeoff math shared by normalization and confidence analysis.
export function worthIt(candidate, baseline) {
  if (!candidate || !baseline) return null;
  const priceDelta = candidate.price - baseline.price;
  const timeDelta = candidate.durationMinutes - baseline.durationMinutes;
  const hours = Math.abs(timeDelta) / 60;
  const dollarsPerHour = hours > 0 ? Math.round(Math.abs(priceDelta) / hours) : null;

  if (priceDelta < 0 && timeDelta < 0) {
    return {
      type: "cheaper-and-faster",
      verdict: "check the connection tradeoff",
      sentence: `Saves $${money(Math.abs(priceDelta))} and ${formatAnalysisMinutes(Math.abs(timeDelta))} of travel time, but ${challengerConcern(candidate, baseline)}.`
    };
  }
  if (priceDelta < 0 && timeDelta > 0) {
    const verdict = dollarsPerHour >= 45 ? "worth it if budget matters" : dollarsPerHour >= 25 ? "maybe worth it" : "probably not worth it";
    return {
      type: "cheaper-but-longer",
      verdict,
      sentence: `Saves $${money(Math.abs(priceDelta))}, but adds ${formatAnalysisMinutes(timeDelta)} of travel time. That is about $${dollarsPerHour}/hour for the extra travel.`
    };
  }
  if (priceDelta > 0 && timeDelta < 0) {
    const verdict = dollarsPerHour <= 45 ? "worth it if time matters" : dollarsPerHour <= 90 ? "maybe worth it" : "probably not worth it";
    return {
      type: "faster-but-costlier",
      verdict,
      sentence: `Saves ${formatAnalysisMinutes(Math.abs(timeDelta))}, but costs $${money(priceDelta)} more. That is about $${dollarsPerHour}/hour saved.`
    };
  }
  if (priceDelta < 0) return { type: "cheaper", verdict: "worth it", sentence: `Saves $${money(Math.abs(priceDelta))} without adding travel time.` };
  if (timeDelta < 0) return { type: "faster", verdict: "worth it", sentence: `Saves ${formatAnalysisMinutes(Math.abs(timeDelta))} without increasing price.` };
  if (priceDelta === 0 && timeDelta === 0) return { type: "same", verdict: "same value", sentence: "Same price and travel time as the current best-balanced option." };
  return { type: "worse", verdict: "probably not worth it", sentence: `Costs $${money(priceDelta)} more and adds ${formatAnalysisMinutes(timeDelta)} versus the best-balanced option.` };
}

export function travelPainBreakdown(option) {
  if (option.kind === "composed-round-trip") {
    const outbound = travelPainBreakdown(option.outbound);
    const returning = travelPainBreakdown(option.returnFlight);
    const layovers = optionLayovers(option);
    return {
      totalMinutes: (outbound.totalMinutes ?? 0) + (returning.totalMinutes ?? 0),
      airMinutes: (outbound.airMinutes ?? 0) + (returning.airMinutes ?? 0),
      layoverMinutes: (outbound.layoverMinutes ?? 0) + (returning.layoverMinutes ?? 0),
      stopoverNights: 0,
      dayParts: [
        { label: "Outbound", minutes: outbound.totalMinutes, route: `${option.outbound.departureAirport} -> ${option.outbound.arrivalAirport}` },
        { label: "Return", minutes: returning.totalMinutes, route: `${option.returnFlight.departureAirport} -> ${option.returnFlight.arrivalAirport}` }
      ],
      shortestLayover: shortestLayover(layovers),
      longestLayover: longestLayover(layovers)
    };
  }
  if (option.kind === "composed-stopover") {
    const inbound = travelPainBreakdown(option.inbound);
    const onward = travelPainBreakdown(option.onward);
    const layovers = [...optionLayovers(option.inbound), ...optionLayovers(option.onward)];
    return {
      totalMinutes: (inbound.totalMinutes ?? 0) + (onward.totalMinutes ?? 0),
      airMinutes: (inbound.airMinutes ?? 0) + (onward.airMinutes ?? 0),
      layoverMinutes: (inbound.layoverMinutes ?? 0) + (onward.layoverMinutes ?? 0),
      stopoverNights: option.nights ?? 0,
      dayParts: [
        { label: "First travel day", minutes: inbound.totalMinutes, route: `${option.inbound.departureAirport} -> ${option.inbound.arrivalAirport}` },
        { label: "Stay", nights: option.nights ?? 0, route: option.stopoverLabel },
        { label: "Final travel day", minutes: onward.totalMinutes, route: `${option.onward.departureAirport} -> ${option.onward.arrivalAirport}` }
      ],
      shortestLayover: shortestLayover(layovers),
      longestLayover: longestLayover(layovers)
    };
  }

  const totalMinutes = option.durationMinutes ?? Infinity;
  const airMinutes = optionAirMinutes(option);
  const layoverMinutes = Number.isFinite(totalMinutes) && Number.isFinite(airMinutes) ? Math.max(0, totalMinutes - airMinutes) : null;
  const layovers = optionLayovers(option);
  return {
    totalMinutes,
    airMinutes,
    layoverMinutes,
    stopoverNights: 0,
    dayParts: [],
    shortestLayover: shortestLayover(layovers),
    longestLayover: longestLayover(layovers)
  };
}

export function humanPainScore({ option, price, durationMinutes, connectionRisk, assumptions, confidence }) {
  const stops = optionStops(option);
  const tightPenalty = connectionRisk.level === "tight" ? 180 : 0;
  const watchPenalty = connectionRisk.level === "watch" ? 60 : 0;
  const longPenalty = durationMinutes > 30 * 60 ? 120 : 0;
  const stopoverPenalty = option.kind === "composed-stopover" ? 35 : option.kind === "composed-round-trip" ? 60 : 0;
  const assumptionPenalty = assumptions.length * 45;
  const confidencePenalty = confidence?.level === "Low" ? 120 : confidence?.level === "Medium" ? 45 : 0;
  return price / 25 + durationMinutes / 12 + stops * 35 + tightPenalty + watchPenalty + longPenalty + stopoverPenalty + assumptionPenalty + confidencePenalty;
}

export function optionPrice(option) {
  return isComposed(option) ? option.totalCost : option.scoring?.breakdown?.estimatedTotalCost ?? option.estimatedTotalCost ?? option.price ?? Infinity;
}

export function optionDurationMinutes(option) {
  return isComposed(option) ? option.durationMinutes : option.durationMinutes ?? Infinity;
}

export function optionStops(option) {
  if (option.kind === "composed-stopover") return (option.inbound.stops ?? 0) + (option.onward.stops ?? 0) + 1;
  if (option.kind === "composed-round-trip") return (option.outbound.stops ?? 0) + (option.returnFlight.stops ?? 0);
  return option.stops ?? 0;
}

export function optionLegs(option) {
  if (option.kind === "composed-stopover") return [...(option.inbound.legs ?? []), ...(option.onward.legs ?? [])];
  if (option.kind === "composed-round-trip") return [...(option.outbound.legs ?? []), ...(option.returnFlight.legs ?? [])];
  return option.legs ?? [];
}

export function optionLayovers(option) {
  if (!option) return [];
  if (option.kind === "composed-stopover") {
    return [...flightLayovers(option.inbound), ...flightLayovers(option.onward)];
  }
  if (option.kind === "composed-round-trip") {
    return [...flightLayovers(option.outbound), ...flightLayovers(option.returnFlight)];
  }
  return flightLayovers(option);
}

function isComposed(option) {
  return option.kind === "composed-stopover" || option.kind === "composed-round-trip";
}

function flightLayovers(flight) {
  return enrichLayoversWithTimes(flight?.layovers ?? [], flight?.legs ?? []);
}

export function shortestLayover(layovers) {
  return [...(layovers ?? [])].filter((layover) => Number.isFinite(layover.duration)).sort((a, b) => a.duration - b.duration)[0] ?? null;
}

export function longestLayover(layovers) {
  return [...(layovers ?? [])].filter((layover) => Number.isFinite(layover.duration)).sort((a, b) => b.duration - a.duration)[0] ?? null;
}

function optionAirMinutes(option) {
  const legs = option.legs ?? [];
  if (!legs.length) return option.durationMinutes ?? Infinity;
  return legs.reduce((sum, leg) => sum + (Number(leg.duration) || 0), 0);
}

// Analysis sentences need text for missing durations; renderers may omit the same value.
function formatAnalysisMinutes(minutes) {
  return formatDisplayMinutes(minutes) ?? "n/a";
}
