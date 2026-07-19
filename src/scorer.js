import {
  classifyConnection,
  classifyConnectionDuration,
  CONNECTION_DURATION,
  CONNECTION_TYPE
} from "./connection-duration.js";

export function scoreFlight(flight, rules = {}) {
  const price = flight.price ?? 99999;
  const durationMinutes = flight.durationMinutes ?? 99999;
  const stops = flight.stops ?? 3;
  const durationHours = durationMinutes / 60;
  const budget = rules.budget ?? {};
  const estimatedHotelCost = flight.estimatedHotelCost ?? 0;
  const estimatedTransferCost = flight.estimatedTransferCost ?? 0;
  const estimatedTotalCost = price + estimatedHotelCost + estimatedTransferCost;

  let risk = 0;
  const notes = [];
  const labels = [];

  if (durationHours > (rules.maxSingleTravelDayHours ?? 26)) {
    risk += 40;
    notes.push(`travel day over ${rules.maxSingleTravelDayHours ?? 26}h`);
  }

  if (durationHours > (rules.rejectTotalElapsedHoursOver ?? 35)) {
    risk += 100;
    labels.push("hard-reject");
    notes.push(`over hard ${rules.rejectTotalElapsedHoursOver ?? 35}h threshold`);
  }

  if (stops > 2) {
    risk += 20;
    notes.push("many stops");
  }

  if (flight.destinationComplete === false) {
    risk += 140;
    labels.push("needs-verification");
    notes.push(`partial route result; expected final airport ${flight.expectedArrivalAirports?.join("/")}`);
  }

  if (flight.tripComplete === false) {
    risk += 140;
    labels.push("needs-verification");
    notes.push("atomic or partial result; not a complete origin-to-destination trip");
  }

  if (stops <= 1) {
    risk -= 12;
    notes.push("fewest-layover candidate");
  }

  for (const layover of flight.layovers ?? []) {
    const label = layover.id ?? layover.name ?? "connection";
    const domesticMinimum = rules.preferredDomesticConnectionMinutes ?? 90;
    const baseline = classifyConnectionDuration(layover.duration, domesticMinimum);
    const connection = classifyConnection(layover, rules);
    if (baseline.status === CONNECTION_DURATION.UNKNOWN) {
      if (!labels.includes("needs-verification")) labels.push("needs-verification");
      notes.push(`${label} connection duration needs verification`);
      continue;
    }
    if (baseline.status === CONNECTION_DURATION.TIGHT) {
      risk += 30;
      notes.push(`${label} layover under ${domesticMinimum}m`);
    }
    if (connection.status === CONNECTION_DURATION.UNKNOWN) {
      if (!labels.includes("needs-verification")) labels.push("needs-verification");
      notes.push(`${label} connection type needs verification`);
    } else if (
      connection.connectionType === CONNECTION_TYPE.INTERNATIONAL_TO_DOMESTIC
      && connection.status === CONNECTION_DURATION.TIGHT
    ) {
      risk += 35;
      notes.push(`${label} international-to-domestic connection under ${connection.minimumMinutes}m`);
    }
  }

  if (budget.hardMax && estimatedTotalCost > budget.hardMax) {
    risk += 80;
    labels.push("over-budget");
    notes.push(`over hard budget $${budget.hardMax}`);
  } else if (budget.softMax && estimatedTotalCost > budget.softMax) {
    risk += 25;
    labels.push("near-budget");
  } else if (budget.target && estimatedTotalCost <= budget.target) {
    labels.push("under-budget");
  }

  if (durationHours <= 24 && estimatedTotalCost > (budget.softMax ?? Infinity)) {
    labels.push("expensive-but-fast");
  }
  if (durationHours > 30 && estimatedTotalCost <= (budget.target ?? 0)) {
    labels.push("cheap-but-painful");
  }

  const score = estimatedTotalCost / 35 + durationMinutes / 18 + stops * 14 + risk;
  return {
    score: Math.round(score),
    risk,
    notes,
    labels,
    breakdown: {
      flightPrice: flight.price ?? null,
      estimatedHotelCost,
      estimatedTransferCost,
      estimatedTotalCost,
      durationPenalty: Math.round(durationMinutes / 18),
      stopPenalty: stops * 14,
      riskPenalty: risk
    }
  };
}

export function rankFlights(flights, trip = {}) {
  const rules = { ...(trip.rules ?? trip), budget: trip.budget ?? trip.rules?.budget ?? {} };
  return flights
    .map((flight) => ({ ...flight, scoring: scoreFlight(flight, rules) }))
    .sort((a, b) => a.scoring.score - b.scoring.score);
}

export function isHardRejected(flight) {
  return flight?.scoring?.labels?.includes("hard-reject") ?? false;
}
