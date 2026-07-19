// Composes independently searched one-way results without implying that the
// provider or airline offers one protected round-trip ticket.
export function composeRoundTripOptions({ route, flights }) {
  const complete = (flights ?? []).filter(isCompleteFlight);
  const outbound = bestByDateAndAirportPair(complete.filter((flight) => matchesDirection(
    flight,
    route.originAirports,
    route.destinationAirports
  )));
  const returning = bestByDateAndAirportPair(complete.filter((flight) => matchesDirection(
    flight,
    route.destinationAirports,
    route.originAirports
  )));

  const options = [];
  for (const outboundFlight of outbound) {
    for (const returnFlight of returning) {
      if (!isReverseAirportPair(outboundFlight, returnFlight)) continue;
      if (!isChronological(outboundFlight, returnFlight)) continue;
      options.push(composeOption(route, outboundFlight, returnFlight));
    }
  }
  return options;
}

// A city-level search can contain several airports. Retaining one candidate per
// date and exact pair prevents a cheaper airport from hiding the only compatible
// return while still avoiding duplicate same-pair results.
function bestByDateAndAirportPair(flights) {
  const byDate = new Map();
  for (const flight of flights) {
    const date = String(flight.departureTime ?? "").slice(0, 10);
    if (!date) continue;
    const key = `${date}|${flight.departureAirport}|${flight.arrivalAirport}`;
    const current = byDate.get(key);
    if (!current || optionScore(flight) < optionScore(current)) byDate.set(key, flight);
  }
  return [...byDate.values()];
}

function isReverseAirportPair(outbound, returnFlight) {
  return outbound.departureAirport === returnFlight.arrivalAirport &&
    outbound.arrivalAirport === returnFlight.departureAirport;
}

function optionScore(flight) {
  return Number.isFinite(flight.scoring?.score)
    ? flight.scoring.score
    : flight.price / 35 + flight.durationMinutes / 18;
}

function isChronological(outbound, returnFlight) {
  const arrival = parseFlightTime(outbound.arrivalTime);
  const returning = parseFlightTime(returnFlight.departureTime);
  if (arrival && returning) return returning >= arrival;
  return String(returnFlight.departureTime ?? "").slice(0, 10) >=
    String(outbound.departureTime ?? "").slice(0, 10);
}

function parseFlightTime(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value.includes("T") ? value : value.replace(" ", "T"));
  return Number.isNaN(parsed.valueOf()) ? null : parsed;
}

function composeOption(route, outbound, returnFlight) {
  const totalCost = outbound.price + returnFlight.price;
  return {
    kind: "composed-round-trip",
    label: route.label,
    summary: `$${outbound.price} outbound and $${returnFlight.price} return.`,
    outbound,
    returnFlight,
    totalCost,
    durationMinutes: outbound.durationMinutes + returnFlight.durationMinutes,
    separateTickets: true,
    bookingWarning: "This comparison combines two separately booked one-way tickets. Changes, cancellations, and ticket rules are independent.",
    googleFlightsUrls: [outbound.googleFlightsUrl, returnFlight.googleFlightsUrl].filter(Boolean)
  };
}

function isCompleteFlight(flight) {
  return flight?.tripComplete !== false &&
    flight?.destinationComplete !== false &&
    Number.isFinite(flight?.price) &&
    Number.isFinite(flight?.durationMinutes);
}

function matchesDirection(flight, expectedOrigins = [], expectedDestinations = []) {
  return expectedOrigins.includes(flight.departureAirport) &&
    expectedDestinations.includes(flight.arrivalAirport);
}
