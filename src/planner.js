import { addDays, dateRange } from "./dates.js";

// Expands a saved trip definition into concrete one-way and multi-city FLI searches.
// Keep this file provider-neutral; provider adapters translate the `input` shape as needed.

function powersetInOrder(items) {
  const sets = [[]];
  for (const item of items) {
    const current = sets.map((set) => [...set, item]);
    sets.push(...current);
  }
  return sets;
}

function airportString(group) {
  return group.airports.join(",");
}

function primaryAirport(group) {
  return group.airports[0];
}

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function makeSearchId(parts) {
  return slug(parts.filter(Boolean).join("-"));
}

function expandNightChoices(stops) {
  if (stops.length === 0) return [[]];
  const [first, ...rest] = stops;
  const tails = expandNightChoices(rest);
  return first.nights.flatMap((nights) => tails.map((tail) => [{ ...first, selectedNights: nights }, ...tail]));
}

function buildSegments(origin, stops, destination, startDate) {
  const nodes = [origin, ...stops, destination];
  let date = startDate;
  const segments = [];
  for (let i = 0; i < nodes.length - 1; i += 1) {
    segments.push({
      from: nodes[i],
      to: nodes[i + 1],
      date
    });
    if (stops[i]) {
      date = addDays(date, stops[i].selectedNights);
    }
  }
  return segments;
}

function asMultiCityJson(segments) {
  return JSON.stringify(segments.map((segment) => ({
    departure_id: airportString(segment.from),
    arrival_id: airportString(segment.to),
    date: segment.date
  })));
}

function providerInputForSegments(trip, segments) {
  if (segments.length === 1) {
    const [segment] = segments;
    return baseProviderInput(trip, {
      departure_id: airportString(segment.from),
      arrival_id: airportString(segment.to),
      outbound_date: segment.date
    });
  }
  return baseProviderInput(trip, { multi_city_json: asMultiCityJson(segments) });
}

function googleFlightsQuery(segments) {
  const [segment] = segments;
  const text = `one way flights from ${primaryAirport(segment.from)} to ${primaryAirport(segment.to)} departing ${segment.date}`;
  return googleFlightsSearchUrl(text);
}

function googleFlightsSearchUrl(text) {
  const params = new URLSearchParams({
    hl: "en",
    curr: "USD",
    q: text
  });
  return `https://www.google.com/travel/flights?${params.toString()}`;
}

function routeFamily({ origin, stops, gateway }) {
  const labels = stops.map((stop) => stop.label);
  if (gateway) return "gateway-split";
  if (origin.label.includes("Bangkok start") && labels.includes("Tokyo")) return "bangkok-start-tokyo";
  if (origin.label.includes("Bangkok start")) return "bangkok-start";
  if (labels.includes("Bangkok") && labels.includes("Tokyo")) return "bangkok-plus-tokyo";
  if (labels.includes("Tokyo")) return "tokyo-stopover";
  if (labels.includes("Bangkok")) return "bangkok-stopover";
  return "direct-ish";
}

function priorityForPlan({ stops, gateway }) {
  if (stops.length === 0 && !gateway) return "fastest";
  if (gateway && stops.length === 0) return "fewest-layovers";
  if (stops.some((stop) => stop.selectedNights > 0)) return "comfort-stopover";
  return "price-explorer";
}

function baseProviderInput(trip, override) {
  return {
    adults: trip.travelers?.adults ?? 1,
    children: trip.travelers?.children ?? 0,
    infants: trip.travelers?.infants ?? 0,
    currency: trip.currency ?? "USD",
    hl: trip.locale?.hl ?? "en",
    gl: trip.locale?.gl ?? "us",
    fetch_booking_options: false,
    ...override
  };
}

export function buildRoutePlans(trip) {
  const plans = [];
  const starts = dateRange(trip.departureWindow.start, trip.departureWindow.end);
  const origins = [trip.origin, ...(trip.alternateStarts ?? [])];
  const optionalStops = trip.routeModes?.includeOptionalStopCombinations === false
    ? []
    : trip.optionalStops ?? [];

  for (const origin of origins) {
    for (const startDate of starts) {
      const stopSets = powersetInOrder(optionalStops);
      for (const stopSet of stopSets) {
        const validStopSet = stopSet.filter((stop) => !sharesAirport(origin, stop));
        for (const stops of expandNightChoices(validStopSet)) {
          const stopLabel = stops.length
            ? stops.map((stop) => `${stop.label} ${stop.selectedNights}n`).join(" + ")
            : "no intentional stopover";
          const directSegments = buildSegments(origin, stops, trip.destination, startDate);
          plans.push({
            id: makeSearchId([origin.label, stopLabel, trip.destination.label, startDate]),
            kind: directSegments.length === 1 ? "one-way" : "multi-city",
            routeFamily: routeFamily({ origin, stops }),
            priority: priorityForPlan({ stops }),
            title: `${origin.label} -> ${trip.destination.label}, ${stopLabel}, depart ${startDate}`,
            startDate,
            stops,
            segments: directSegments,
            input: providerInputForSegments(trip, directSegments),
            googleFlightsUrl: googleFlightsQuery(directSegments)
          });

          if (trip.routeModes?.includeGatewaySplit !== false) {
            for (const gateway of trip.gatewayAirports ?? []) {
              const gatewayNode = { label: gateway, airports: [gateway], selectedNights: 0, gateway: true };
              const gatewaySegments = buildSegments(origin, [...stops, gatewayNode], trip.destination, startDate);
              const gatewayStops = [...stops, gatewayNode];
              plans.push({
                id: makeSearchId([origin.label, stopLabel, "gateway", gateway, trip.destination.label, startDate]),
                kind: "gateway-split",
                routeFamily: routeFamily({ origin, stops, gateway: true }),
                priority: priorityForPlan({ stops, gateway: true }),
                title: `${origin.label} -> ${trip.destination.label} via ${gateway}, ${stopLabel}, depart ${startDate}`,
                startDate,
                stops: gatewayStops,
                segments: gatewaySegments,
                input: providerInputForSegments(trip, gatewaySegments),
                googleFlightsUrl: googleFlightsQuery(gatewaySegments)
              });
            }
          }
        }
      }

      if (trip.routeModes?.includeGatewaySplit !== false && optionalStops.length === 0) {
        for (const gateway of trip.gatewayAirports ?? []) {
          const gatewayNode = { label: gateway, airports: [gateway], selectedNights: 0, gateway: true };
          const segments = buildSegments(origin, [gatewayNode], trip.destination, startDate);
          plans.push({
            id: makeSearchId([origin.label, "gateway", gateway, trip.destination.label, startDate]),
            kind: "gateway-split",
            title: `${origin.label} -> ${gateway} -> ${trip.destination.label}, depart ${startDate}`,
            startDate,
            stops: [gatewayNode],
            segments,
            input: providerInputForSegments(trip, segments),
            googleFlightsUrl: googleFlightsQuery(segments)
          });
        }
      }
    }
  }

  return dedupePlans(plans);
}

function sharesAirport(a, b) {
  const airports = new Set(a.airports ?? []);
  return (b.airports ?? []).some((airport) => airports.has(airport));
}

export function buildAtomicLegSearches(trip, routePlans) {
  const seen = new Set();
  const searches = [];
  for (const plan of routePlans) {
    for (const segment of plan.segments) {
      const key = `${airportString(segment.from)}|${airportString(segment.to)}|${segment.date}`;
      if (seen.has(key)) continue;
      seen.add(key);
      searches.push({
        id: makeSearchId(["one-way", airportString(segment.from), airportString(segment.to), segment.date]),
        kind: "one-way",
        title: `${airportString(segment.from)} -> ${airportString(segment.to)} on ${segment.date}`,
        segments: [segment],
        input: baseProviderInput(trip, {
          departure_id: airportString(segment.from),
          arrival_id: airportString(segment.to),
          outbound_date: segment.date
        }),
        googleFlightsUrl: googleFlightsQuery([segment])
      });
    }
  }
  return searches;
}

function dedupePlans(plans) {
  const seen = new Set();
  return plans.filter((plan) => {
    const key = JSON.stringify(plan.input);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
