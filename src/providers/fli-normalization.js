import { PROVIDERS } from "./provider-types.js";

// Maps raw adapter results into the stable flight shape consumed by analysis and dashboards.
export function normalizeFliResults(search, rawResult, source = "live") {
  const timestamp = rawResult.searchTimestamp ?? new Date().toISOString();
  return (rawResult.results ?? []).map((flight) => {
    const legs = (flight.legs ?? []).map(normalizeFliLeg);
    const layovers = normalizeFliLayovers(flight.layovers, legs);
    const expectedAirports = expectedArrivalAirports(search, flight);
    const tripStartComplete = tripStartAirports(search, flight).includes(flight.departureAirport);
    const tripEndComplete = tripEndAirports(search, flight).includes(flight.arrivalAirport);
    return {
      searchId: search.id,
      searchTitle: search.title,
      searchBatch: search.batch ?? null,
      routeFamily: search.routeFamily ?? null,
      googleFlightsUrl: googleFlightsUrlForFlight(search, flight),
      cacheFile: search.cacheFile ?? null,
      source,
      provider: PROVIDERS.FLI,
      providerCurrency: rawResult.currency ?? flight.currency ?? null,
      searchTimestamp: timestamp,
      bucket: "fli",
      price: numericPrice(flight.price),
      airline: flight.airline || null,
      departureAirport: flight.departureAirport ?? null,
      arrivalAirport: flight.arrivalAirport ?? null,
      expectedArrivalAirports: expectedAirports,
      destinationComplete: expectedAirports.includes(flight.arrivalAirport),
      tripStartComplete,
      tripEndComplete,
      tripComplete: tripStartComplete && tripEndComplete,
      departureTime: flight.departureTime ?? null,
      arrivalTime: flight.arrivalTime ?? null,
      duration: formatDuration(flight.durationMinutes),
      durationMinutes: flight.durationMinutes ?? null,
      stops: flight.stops ?? Math.max(0, legs.length - 1),
      legs,
      layovers,
      bookingToken: flight.bookingToken ?? null,
      raw: flight
    };
  });
}

function expectedArrivalAirports(search, flight) {
  return nonEmptyAirports(
    search.segments?.at(-1)?.to?.airports,
    search.finalTripAirports,
    splitAirportCodes(search.input?.arrival_id),
    [flight.arrivalAirport]
  );
}

function tripStartAirports(search, flight) {
  return nonEmptyAirports(
    search.tripStartAirports,
    search.segments?.at(0)?.from?.airports,
    splitAirportCodes(search.input?.departure_id),
    [flight.departureAirport]
  );
}

function tripEndAirports(search, flight) {
  return nonEmptyAirports(
    search.finalTripAirports,
    search.segments?.at(-1)?.to?.airports,
    splitAirportCodes(search.input?.arrival_id),
    [flight.arrivalAirport]
  );
}

function nonEmptyAirports(...candidates) {
  for (const candidate of candidates) {
    const airports = (candidate ?? []).filter(Boolean);
    if (airports.length) return airports;
  }
  return [];
}

function splitAirportCodes(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  return value.split(",").map((code) => code.trim()).filter(Boolean);
}

function googleFlightsUrlForFlight(search, flight) {
  const from = flight.departureAirport;
  const to = flight.arrivalAirport;
  const date = flightDatePrefix(flight.departureTime) ?? search.input?.outbound_date;
  if (!from || !to || !date) return search.googleFlightsUrl ?? null;
  const params = new URLSearchParams({
    hl: "en",
    curr: "USD",
    q: `one way flights from ${from} to ${to} departing ${date}`
  });
  return `https://www.google.com/travel/flights?${params.toString()}`;
}

function flightDatePrefix(value) {
  if (typeof value !== "string") return null;
  return value.slice(0, 10);
}

function normalizeFliLeg(leg) {
  return {
    airline: leg.airlineName ?? leg.airline ?? null,
    flight_number: leg.flightNumber ?? null,
    duration: leg.durationMinutes ?? null,
    departure_airport: {
      id: leg.departureAirport ?? null,
      name: leg.departureAirportName ?? leg.departureAirport ?? null,
      time: leg.departureTime ?? null
    },
    arrival_airport: {
      id: leg.arrivalAirport ?? null,
      name: leg.arrivalAirportName ?? leg.arrivalAirport ?? null,
      time: leg.arrivalTime ?? null
    },
    airplane: leg.airplane ?? null,
    travel_class: leg.travelClass ?? null,
    extensions: leg.extensions ?? []
  };
}

function numericPrice(value) {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^0-9.]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeFliLayovers(layovers, legs) {
  const provided = (layovers ?? []).filter(Boolean).map((layover) => ({
    id: layover.id ?? layover.airport ?? null,
    name: layover.name ?? layover.airportName ?? layover.id ?? layover.airport ?? null,
    duration: layover.duration ?? layover.durationMinutes ?? null
  }));
  return provided.length ? provided : deriveLayoversFromLegs(legs);
}

function deriveLayoversFromLegs(legs) {
  const layovers = [];
  for (let index = 0; index < legs.length - 1; index += 1) {
    const current = legs[index];
    const next = legs[index + 1];
    const arrival = parseLocalDateTime(current.arrival_airport?.time);
    const departure = parseLocalDateTime(next.departure_airport?.time);
    const duration = arrival && departure ? Math.round((departure - arrival) / 60000) : null;
    layovers.push({
      id: current.arrival_airport?.id ?? next.departure_airport?.id ?? null,
      name: current.arrival_airport?.name ?? next.departure_airport?.name ?? null,
      duration: Number.isFinite(duration) && duration >= 0 ? duration : null
    });
  }
  return layovers;
}

function parseLocalDateTime(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.valueOf()) ? null : parsed;
}

function formatDuration(minutes) {
  if (!Number.isFinite(minutes)) return null;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours}h ${remainder}m`;
}
