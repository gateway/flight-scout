import { addDays, dateRange } from "./dates.js";
import { slugify } from "./strings.js";

// Expands a trip into route-analysis plans. Multi-segment plans describe composition only;
// buildAtomicLegSearches derives the one-way work accepted by provider manifests.

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

function makeSearchId(parts) {
  return slugify(parts.filter(Boolean).join("-"));
}

function withRouteRole(group, routeRole, routeOrder) {
  return {
    ...group,
    routeRole,
    routeOrder
  };
}

function gatewayNode(gateway, configuredGateways) {
  return withRouteRole({
    label: gateway,
    airports: [gateway],
    selectedNights: 0,
    gateway: true
  }, "gateway", configuredGateways.indexOf(gateway));
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

function routeFamily({ origin, stops }) {
  if (stops.some((stop) => stop.routeRole === "gateway")) return "gateway-split";
  const stopoverCount = stops.filter((stop) => stop.routeRole === "intentional-stopover").length;
  if (origin.routeRole === "alternate-start" && stopoverCount > 0) return "alternate-start-stopover";
  if (stopoverCount > 1) return "multiple-stopovers";
  if (stopoverCount === 1) return "stopover";
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
  if (trip.tripType === "round-trip") return buildRoundTripRoutePlans(trip);
  return buildOneWayRoutePlans(trip);
}

function buildOneWayRoutePlans(trip) {
  const plans = [];
  const starts = dateRange(trip.departureWindow.start, trip.departureWindow.end);
  const origins = [
    withRouteRole(trip.origin, "primary-origin", 0),
    ...(trip.alternateStarts ?? []).map((origin, index) => (
      withRouteRole(origin, "alternate-start", index + 1)
    ))
  ];
  const optionalStops = trip.routeModes?.includeOptionalStopCombinations === false
    ? []
    : (trip.optionalStops ?? []).map((stop, index) => (
      withRouteRole(stop, "intentional-stopover", index)
    ));

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
              const gatewayStop = gatewayNode(gateway, trip.gatewayAirports ?? []);
              const gatewaySegments = buildSegments(origin, [...stops, gatewayStop], trip.destination, startDate);
              const gatewayStops = [...stops, gatewayStop];
              plans.push({
                id: makeSearchId([origin.label, stopLabel, "gateway", gateway, trip.destination.label, startDate]),
                kind: "gateway-split",
                routeFamily: routeFamily({ origin, stops: gatewayStops }),
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
    }
  }

  return dedupePlans(plans);
}

// FLI accepts one travel direction per call. Round trips therefore remain two
// explicit one-way date sets; composition happens only after results are saved.
function buildRoundTripRoutePlans(trip) {
  if (!trip.returnWindow?.start || !trip.returnWindow?.end) {
    throw new Error("Round-trip planning requires a return date window.");
  }
  return [
    ...directionalDirectPlans({
      trip,
      direction: "outbound",
      from: withRouteRole(trip.origin, "primary-origin", 0),
      to: trip.destination,
      window: trip.departureWindow
    }),
    ...directionalDirectPlans({
      trip,
      direction: "return",
      from: withRouteRole(trip.destination, "return-origin", 0),
      to: trip.origin,
      window: trip.returnWindow
    })
  ];
}

function directionalDirectPlans({ trip, direction, from, to, window }) {
  return dateRange(window.start, window.end).map((date) => {
    const segments = buildSegments(from, [], to, date);
    return {
      id: makeSearchId([direction, from.label, to.label, date]),
      kind: "one-way",
      direction,
      routeFamily: `round-trip-${direction}`,
      priority: "fastest",
      title: `${from.label} -> ${to.label}, ${direction}, depart ${date}`,
      startDate: date,
      stops: [],
      segments,
      input: providerInputForSegments(trip, segments),
      googleFlightsUrl: googleFlightsQuery(segments)
    };
  });
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
        ...(plan.direction ? { direction: plan.direction } : {}),
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
