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
