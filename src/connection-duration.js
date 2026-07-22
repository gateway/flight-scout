// Shared duration semantics keep missing provider timing out of tight-connection math.
export const CONNECTION_DURATION = Object.freeze({
  UNKNOWN: "unknown",
  TIGHT: "tight",
  ACCEPTABLE: "acceptable"
});

export const CONNECTION_TYPE = Object.freeze({
  UNKNOWN: "unknown",
  DOMESTIC: "domestic",
  INTERNATIONAL_TO_DOMESTIC: "international-to-domestic"
});

export const OVERNIGHT_LAYOVER_MINUTES = 240;

export function classifyConnectionDuration(durationMinutes, minimumMinutes) {
  if (!Number.isFinite(durationMinutes)) {
    return { status: CONNECTION_DURATION.UNKNOWN, durationMinutes: null, minimumMinutes };
  }
  return {
    status: durationMinutes < minimumMinutes ? CONNECTION_DURATION.TIGHT : CONNECTION_DURATION.ACCEPTABLE,
    durationMinutes,
    minimumMinutes
  };
}

// Uses local clock text directly; converting through Date would apply the machine timezone.
export function isOvernightLayover(layover = {}) {
  if (!Number.isFinite(layover.duration) || layover.duration < OVERNIGHT_LAYOVER_MINUTES) return false;
  const arrival = localClockMinutes(layover.arrivalTime);
  const departure = localClockMinutes(layover.departureTime);
  if (!Number.isFinite(arrival) || !Number.isFinite(departure)) return false;
  const arrivesLate = arrival >= 22 * 60;
  const arrivesBeforeDawn = arrival <= 6 * 60;
  const departsBeforeDawn = departure <= 6 * 60;
  const crossesMidnight = departure < arrival;
  return arrivesLate || arrivesBeforeDawn || departsBeforeDawn || crossesMidnight;
}

// Layovers from older providers may omit their endpoint times even when the leg data has them.
export function enrichLayoversWithTimes(layovers = [], legs = []) {
  return layovers.map((layover, index) => {
    const arrivalTime = layover.arrivalTime ?? legs[index]?.arrival_airport?.time ?? null;
    const departureTime = layover.departureTime ?? legs[index + 1]?.departure_airport?.time ?? null;
    const enriched = { ...layover, arrivalTime, departureTime };
    return { ...enriched, overnight: isOvernightLayover(enriched) };
  });
}

export function localConnectionTime(value) {
  if (typeof value !== "string") return null;
  const match = value.match(/(?:T|\s|^)(\d{1,2}:\d{2})(?::\d{2})?(?:\s|$|[+-]|Z)/);
  return match?.[1] ?? null;
}

// Geography is explicit because airport names and codes do not reliably reveal
// whether a traveler must clear immigration before the next domestic flight.
export function classifyConnection(layover = {}, rules = {}) {
  const connectionType = resolveConnectionType(layover, rules);
  const domesticMinimum = rules.preferredDomesticConnectionMinutes ?? 90;
  const internationalToDomesticMinimum = rules.preferredInternationalToDomesticConnectionMinutes ?? 180;
  if (!Number.isFinite(layover.duration)) {
    return {
      status: CONNECTION_DURATION.UNKNOWN,
      connectionType,
      durationMinutes: null,
      minimumMinutes: null,
      verification: "duration"
    };
  }

  if (connectionType === CONNECTION_TYPE.INTERNATIONAL_TO_DOMESTIC) {
    return {
      ...classifyConnectionDuration(layover.duration, internationalToDomesticMinimum),
      connectionType,
      verification: null
    };
  }
  if (connectionType === CONNECTION_TYPE.DOMESTIC) {
    return {
      ...classifyConnectionDuration(layover.duration, domesticMinimum),
      connectionType,
      verification: null
    };
  }

  const baseline = classifyConnectionDuration(layover.duration, domesticMinimum);
  if (baseline.status === CONNECTION_DURATION.TIGHT) {
    return { ...baseline, connectionType, verification: null };
  }
  return {
    status: CONNECTION_DURATION.UNKNOWN,
    connectionType,
    durationMinutes: layover.duration,
    minimumMinutes: null,
    verification: "type"
  };
}

function resolveConnectionType(layover, rules) {
  const value = layover.connectionType ?? rules.connectionTypesByAirport?.[layover.id];
  return value === CONNECTION_TYPE.DOMESTIC || value === CONNECTION_TYPE.INTERNATIONAL_TO_DOMESTIC
    ? value
    : CONNECTION_TYPE.UNKNOWN;
}

function localClockMinutes(value) {
  if (typeof value !== "string") return null;
  const match = value.match(/(?:T|\s|^)(\d{1,2}):(\d{2})(?::\d{2})?(?:\s|$|[+-]|Z)/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}
