import { dateOnly, escapeHtml, formatHumanDate, formatMinutes, money } from "./html-utils.js";
import { airportDataMetadataForCode } from "./airport-data.js";

// Pure option projection owns route/date labels, decision copy, and compact supporting blocks.
export function hasFlightDetail(option) {
  if (option?.legs?.length) return true;
  if (option?.kind === "composed-stopover") return Boolean(option.inbound?.legs?.length || option.onward?.legs?.length);
  return option?.kind === "composed-round-trip" && Boolean(option.outbound?.legs?.length || option.returnFlight?.legs?.length);
}

export function flightGoogleFlightsUrl(option) {
  if (!option) return "";
  if (option.kind === "composed-round-trip") return flightGoogleFlightsUrls(option)[0] ?? "";
  if (option.kind !== "composed-stopover") {
    const url = googleFlightsUrlFromParts(option.departureAirport, option.arrivalAirport, optionDate(option));
    if (url) return url;
  }
  return option.googleFlightsUrl ?? "";
}

export function flightGoogleFlightsUrls(option) {
  if (option?.kind !== "composed-round-trip") return [flightGoogleFlightsUrl(option)].filter(Boolean);
  const flights = [option.outbound, option.returnFlight];
  return flights.map((flight, index) => option.googleFlightsUrls?.[index] ?? flight?.googleFlightsUrl ??
    googleFlightsUrlFromParts(flight?.departureAirport, flight?.arrivalAirport, dateOnly(flight?.departureTime)))
    .filter(Boolean);
}

export function bestChoiceSentence(option) {
  if (option.kind === "composed-round-trip") {
    return `${option.routeIdeaLabel ?? option.label ?? "Round trip"} combines $${money(option.outbound.price)} outbound and $${money(option.returnFlight.price)} return fares. These are separate one-way tickets, so compare both ticket rules before booking.`;
  }
  if (option.kind === "composed-stopover") {
    return `${option.routeIdeaLabel} is currently the cleanest value among the tracked choices: ${money(option.inbound.price)} for the first leg, ${option.nights} night stopover, then ${money(option.onward.price)} for the final leg.`;
  }
  if ((option.stops ?? option.layovers?.length ?? 0) === 0) {
    return `${option.routeIdeaLabel} gives the best balance of price, travel time, and simplicity. It is nonstop, so the decision is mostly about price and departure time.`;
  }
  const risk = option.connectionRisk?.level === "tight"
    ? " It is worth checking the tight connection before booking."
    : option.connectionRisk?.level === "unknown"
      ? " Verify the connection time before booking because the provider did not return it."
      : " The connection timing looks reasonable compared with the cheaper or faster tradeoffs.";
  return `${option.routeIdeaLabel} gives the best balance of price, total travel time, stops, and connection risk.${risk}`;
}

export function optionHeadline(option) {
  const label = cleanTitlePart(option.routeIdeaLabel) ?? cleanTitlePart(option.searchTitle) ?? cleanTitlePart(option.title);
  return label ? `${label}: ${optionRouteLine(option)}` : optionRouteLine(option);
}

export function humanOptionLine(option) {
  const label = cleanTitlePart(option.routeIdeaLabel) ?? cleanTitlePart(option.searchTitle) ?? cleanTitlePart(option.title);
  if (option.kind === "composed-round-trip") {
    const outboundDate = formatHumanDate(dateOnly(option.outbound.departureTime));
    const returnDate = formatHumanDate(dateOnly(option.returnFlight.departureTime));
    const outboundRoute = `${option.outbound.departureAirport} -> ${option.outbound.arrivalAirport}`;
    const returnRoute = `${option.returnFlight.departureAirport} -> ${option.returnFlight.arrivalAirport}`;
    return `${label ? `${label}: ` : ""}outbound ${outboundRoute} on ${outboundDate}, return ${returnRoute} on ${returnDate}`;
  }
  const route = option.kind === "composed-stopover"
    ? `${option.inbound.departureAirport} -> ${option.stopoverLabel} -> ${option.onward.arrivalAirport}`
    : `${option.departureAirport ?? "?"} -> ${option.arrivalAirport ?? "?"}`;
  const date = formatHumanDate(optionDate(option));
  return `${label ? `${label}: ` : ""}${route}${date ? ` on ${date}` : ""}`;
}

export function cleanTitlePart(value) {
  const text = String(value ?? "").trim();
  if (!text || text.toLowerCase() === "undefined" || text.toLowerCase() === "null") return null;
  return text;
}

export function optionRouteLine(option) {
  const date = formatHumanDate(optionDate(option));
  if (option.kind === "composed-stopover") return `${option.inbound.departureAirport} -> ${option.stopoverLabel} -> ${option.onward.arrivalAirport} on ${date}`;
  if (option.kind === "composed-round-trip") {
    const returnDate = formatHumanDate(dateOnly(option.returnFlight.departureTime));
    return `${option.outbound.departureAirport} -> ${option.outbound.arrivalAirport} -> ${option.returnFlight.arrivalAirport}, ${date} to ${returnDate}`;
  }
  return `${option.departureAirport ?? "?"} -> ${option.arrivalAirport ?? "?"} on ${date || "unknown date"}`;
}

export function optionDate(option) {
  if (option.kind === "composed-stopover") return dateOnly(option.inbound.departureTime);
  if (option.kind === "composed-round-trip") return dateOnly(option.outbound.departureTime);
  return dateOnly(option.departureTime);
}

export function connectionPill(option) {
  const layover = option.connectionRisk?.shortest;
  const overnight = option.connectionCaveats?.overnightLayovers?.[0];
  if (!layover && !overnight) return "";
  const pills = [];
  if (layover) {
    const unknown = option.connectionRisk?.level === "unknown";
    const className = option.connectionRisk?.level === "tight" ? "bad" : option.connectionRisk?.level === "watch" || unknown ? "warn" : "good";
    const timing = unknown ? "time unknown" : formatMinutes(layover.duration) ?? "";
    pills.push(`<span class="pill connection ${className}">${escapeHtml(connectionPlaceLabel(layover))} · ${escapeHtml(timing)} layover</span>`);
  }
  if (overnight) {
    pills.push(`<span class="pill connection warn overnight">Overnight at ${escapeHtml(overnight.id ?? overnight.name ?? "connection")}</span>`);
  }
  return pills.join("");
}

export function connectionPlaceLabel(layover) {
  const code = String(layover?.id ?? "").toUpperCase();
  const airport = code ? airportDataMetadataForCode(code) : null;
  const city = airport?.municipality?.replace(/\s*\([^)]*\)\s*$/, "").trim();
  if (city && code) return `${city} (${code})`;
  if (layover?.name && code && layover.name !== code) return `${layover.name} (${code})`;
  return code || layover?.name || "Connection";
}

export function renderPainBreakdown(option) {
  const pain = option.travelPain;
  if (!pain) return "";
  if (pain.dayParts?.length) {
    return `<div class="pain-grid">${pain.dayParts.map((part) => `<div><span>${escapeHtml(part.label)}</span><strong>${part.nights ? `${part.nights} night` : formatMinutes(part.minutes)}</strong><small>${escapeHtml(part.route ?? "")}</small></div>`).join("")}</div>`;
  }
  return `<div class="pain-grid">
    <div><span>Total</span><strong>${escapeHtml(formatMinutes(pain.totalMinutes))}</strong></div>
    <div><span>Air</span><strong>${escapeHtml(formatMinutes(pain.airMinutes))}</strong></div>
    <div><span>Layovers</span><strong>${escapeHtml(formatMinutes(pain.layoverMinutes))}</strong></div>
  </div>`;
}

export function renderAssumptions(option) {
  if (!option.assumptions?.length) return "";
  return `<div class="assumption-list">${option.assumptions.map((item) => `<p><strong>${escapeHtml(item.label)}:</strong> ${escapeHtml(item.text)}</p>`).join("")}</div>`;
}

function googleFlightsUrlFromParts(from, to, date) {
  if (!from || !to || !date) return "";
  const params = new URLSearchParams({
    hl: "en",
    curr: "USD",
    q: `one way flights from ${from} to ${to} departing ${date}`
  });
  return `https://www.google.com/travel/flights?${params.toString()}`;
}
