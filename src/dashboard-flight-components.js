import { dateOnly, escapeAttr, escapeHtml, formatHumanDate, formatMinutes, money } from "./html-utils.js";
import { displayAirlineName } from "./airline-display.js";

// Shared flight card, action, and drawer rendering used by every dashboard page.
function renderCardHead(label, option, options = {}) {
  return `<div class="card-head">
    <div>
      <div class="label">${escapeHtml(label)}</div>
      ${renderOptionTitle(option, options)}
    </div>
    <div class="card-stat"><strong>$${money(option.price ?? option.totalCost)}</strong><span>${escapeHtml(formatMinutes(option.durationMinutes) ?? option.duration ?? "")}</span>${flightActionLinks(option)}</div>
  </div>`;
}

function renderOptionTitle(option, { hideRouteLabel = false } = {}) {
  const label = cleanTitlePart(option.routeIdeaLabel) ?? cleanTitlePart(option.searchTitle) ?? cleanTitlePart(option.title);
  const route = optionRouteLine(option);
  if (!label || hideRouteLabel) return `<h3>${escapeHtml(route)}</h3>`;
  return `<h3><span class="title-main">${escapeHtml(label)}</span><span class="title-route">${escapeHtml(route)}</span></h3>`;
}

function flightActionLinks(option) {
  const actions = [flightDetailDrawer(option), flightIconLink(option)].filter(Boolean).join("");
  return actions ? `<span class="card-actions">${actions}</span>` : "";
}

function flightIconLink(option) {
  const url = flightGoogleFlightsUrl(option);
  if (!url) return "";
  return `<a class="icon-link" target="_blank" rel="noopener" href="${escapeAttr(url)}" aria-label="Open in Google Flights" title="Open in Google Flights">↗</a>`;
}

function flightDetailDrawer(option) {
  if (!hasFlightDetail(option)) return "";
  return `<details class="side-drawer card-detail-drawer"><summary class="icon-link" aria-label="Open flight detail" title="Open flight detail">☰</summary><div class="drawer-panel">${renderFlightDetailPanel(option, "Flight detail")}</div></details>`;
}

function hasFlightDetail(option) {
  if (option?.legs?.length) return true;
  return option?.kind === "composed-stopover" && (option.inbound?.legs?.length || option.onward?.legs?.length);
}

function renderFlightDetailPanel(option, label = "Flight detail") {
  const googleFlightsUrl = flightGoogleFlightsUrl(option);
  return `<div class="drawer-head">
    <div><span class="label">${escapeHtml(label)}</span>
    <strong>${escapeHtml(optionHeadline(option))}</strong></div>
    <div class="drawer-head-actions">
      ${googleFlightsUrl ? `<a class="btn drawer-btn drawer-head-link" target="_blank" rel="noopener" href="${escapeAttr(googleFlightsUrl)}">Open in Google Flights</a>` : ""}
      <button class="drawer-close" type="button" aria-label="Close flight detail">×</button>
    </div>
  </div>
  <div class="drawer-facts">
    <div><span>Total</span><strong>${escapeHtml(formatMinutes(option.durationMinutes) ?? option.duration ?? "n/a")}</strong></div>
    <div><span>Price</span><strong>$${money(option.price ?? option.totalCost)}</strong></div>
    <div><span>Date</span><strong>${escapeHtml(optionDate(option) ?? "n/a")}</strong></div>
    <div><span>Stops</span><strong>${escapeHtml(stopCountText(option))}</strong></div>
  </div>
  ${renderDrawerTimeline(option)}
  ${renderPainBreakdown(option)}
  ${renderDrawerAdvice(option)}`;
}

function renderDrawerTimeline(option) {
  if (option.kind === "composed-stopover") return renderComposedDrawerTimeline(option);
  return renderFlightTimeline(option);
}

function renderComposedDrawerTimeline(option) {
  const parts = [
    { label: `Flight to ${option.stopoverLabel}`, flight: option.inbound },
    { label: `After ${option.nights} night${option.nights === 1 ? "" : "s"}`, flight: option.onward }
  ].filter((part) => part.flight?.legs?.length);
  return `<div class="flight-timeline composed-timeline">${parts.map((part, index) => `
    ${index > 0 ? `<div class="stopover-break">${escapeHtml(part.label)}</div>` : `<div class="stopover-break first">${escapeHtml(part.label)}</div>`}
    ${renderFlightTimeline(part.flight).replace(/^<div class="flight-timeline">/, "").replace(/<\/div>$/, "")}
  `).join("")}</div>`;
}

function renderFlightTimeline(option) {
  const legs = option.legs ?? [];
  if (!legs.length) return "";
  return `<div class="flight-timeline">${legs.map((leg, index) => `${renderTimelineLeg(leg)}${renderTimelineLayover(option.layovers?.[index])}`).join("")}</div>`;
}

function renderTimelineLeg(leg) {
  const amenities = (leg.extensions ?? []).filter(Boolean).slice(0, 5);
  return `<div class="timeline-leg">
    <div class="airline-mark">${leg.airline_logo ? `<img src="${escapeAttr(leg.airline_logo)}" alt="">` : escapeHtml((leg.airline ?? "?").slice(0, 2))}</div>
    <div class="timeline-rail"><span></span><i></i><span></span></div>
    <div class="timeline-main">
      <div class="leg-duration">Flight time: ${escapeHtml(formatMinutes(leg.duration) ?? "n/a")}${leg.overnight ? " · Overnight" : ""}</div>
      <div class="timeline-time"><strong>${escapeHtml(timePart(leg.departure_airport?.time))}</strong><span>${escapeHtml(leg.departure_airport?.name ?? "")} (${escapeHtml(leg.departure_airport?.id ?? "")})</span></div>
      <div class="timeline-time"><strong>${escapeHtml(timePart(leg.arrival_airport?.time))}</strong><span>${escapeHtml(leg.arrival_airport?.name ?? "")} (${escapeHtml(leg.arrival_airport?.id ?? "")})</span></div>
      <div class="flight-meta">${escapeHtml([displayAirlineName(leg.airline), leg.travel_class, leg.airplane, leg.flight_number].filter(Boolean).join(" · "))}</div>
    </div>
    ${amenities.length ? `<div class="timeline-amenities"><span>Onboard</span>${amenities.map((item) => `<div>${escapeHtml(item)}</div>`).join("")}</div>` : ""}
  </div>`;
}

function renderTimelineLayover(layover) {
  if (!layover) return "";
  return `<div class="timeline-layover ${layoverClass(layover)}"><strong>${escapeHtml(formatMinutes(layover.duration) ?? "n/a")} layover</strong><span>${escapeHtml(layover.name ?? layover.id ?? "")}${layover.id ? ` (${escapeHtml(layover.id)})` : ""}</span></div>`;
}

function timePart(value) {
  return String(value ?? "").split(" ").slice(1).join(" ") || String(value ?? "");
}

function stopCountText(option) {
  if (option.kind === "composed-stopover") {
    const stops = [option.inbound, option.onward].map((flight) => flight?.layovers?.length ?? flight?.stops ?? 0);
    return stops.map((count) => `${count} stop${count === 1 ? "" : "s"}`).join(" + ");
  }
  const count = option.stops ?? option.layovers?.length ?? 0;
  if (!count) return "Nonstop";
  return `${count} stop${count === 1 ? "" : "s"}`;
}

function layoverClass(layover) {
  const minutes = layover?.duration;
  if (!Number.isFinite(minutes)) return "layover-neutral";
  if (minutes < 90) return "layover-tight";
  if (minutes < 180) return "layover-watch";
  if (minutes >= 360) return "layover-long";
  return "layover-good";
}

function bestChoiceSentence(option) {
  if (option.kind === "composed-stopover") {
    return `${option.routeIdeaLabel} is currently the cleanest value among the tracked choices: ${money(option.inbound.price)} for the first leg, ${option.nights} night stopover, then ${money(option.onward.price)} for the final leg.`;
  }
  if ((option.stops ?? option.layovers?.length ?? 0) === 0) {
    return `${option.routeIdeaLabel} gives the best balance of price, travel time, and simplicity. It is nonstop, so the decision is mostly about price, departure time, and which Bangkok airport works best for you.`;
  }
  const risk = option.connectionRisk?.level === "tight" ? " It is worth checking the tight connection before booking." : " The connection timing looks reasonable compared with the cheaper or faster tradeoffs.";
  return `${option.routeIdeaLabel} gives the best balance of price, total travel time, stops, and connection risk.${risk}`;
}

function optionHeadline(option) {
  const label = cleanTitlePart(option.routeIdeaLabel) ?? cleanTitlePart(option.searchTitle) ?? cleanTitlePart(option.title);
  return label ? `${label}: ${optionRouteLine(option)}` : optionRouteLine(option);
}

function humanOptionLine(option) {
  const label = cleanTitlePart(option.routeIdeaLabel) ?? cleanTitlePart(option.searchTitle) ?? cleanTitlePart(option.title);
  const route = option.kind === "composed-stopover"
    ? `${option.inbound.departureAirport} -> ${option.stopoverLabel} -> ${option.onward.arrivalAirport}`
    : `${option.departureAirport ?? "?"} -> ${option.arrivalAirport ?? "?"}`;
  const date = formatHumanDate(optionDate(option));
  return `${label ? `${label}: ` : ""}${route}${date ? ` on ${date}` : ""}`;
}

function cleanTitlePart(value) {
  const text = String(value ?? "").trim();
  if (!text || text.toLowerCase() === "undefined" || text.toLowerCase() === "null") return null;
  return text;
}

function optionRouteLine(option) {
  const date = formatHumanDate(optionDate(option));
  if (option.kind === "composed-stopover") return `${option.inbound.departureAirport} -> ${option.stopoverLabel} -> ${option.onward.arrivalAirport} on ${date}`;
  return `${option.departureAirport ?? "?"} -> ${option.arrivalAirport ?? "?"} on ${date || "unknown date"}`;
}

function optionDate(option) {
  return dateOnly(option.kind === "composed-stopover" ? option.inbound.departureTime : option.departureTime);
}

function flightGoogleFlightsUrl(option) {
  if (!option) return "";
  if (option.kind !== "composed-stopover") {
    const url = googleFlightsUrlFromParts(option.departureAirport, option.arrivalAirport, optionDate(option));
    if (url) return url;
  }
  return option.googleFlightsUrl ?? "";
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

function connectionPill(option) {
  const layover = option.connectionRisk?.shortest;
  if (!layover) return "";
  const className = option.connectionRisk?.level === "tight" ? "bad" : option.connectionRisk?.level === "watch" ? "warn" : "good";
  return `<span class="pill connection ${className}">${escapeHtml(layover.id ?? layover.name ?? "layover")} ${escapeHtml(formatMinutes(layover.duration) ?? "")}</span>`;
}

function renderPainBreakdown(option) {
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

function renderAssumptions(option) {
  if (!option.assumptions?.length) return "";
  return `<div class="assumption-list">${option.assumptions.map((item) => `<p><strong>${escapeHtml(item.label)}:</strong> ${escapeHtml(item.text)}</p>`).join("")}</div>`;
}

function renderDrawerAdvice(option) {
  const notes = [];
  const shortest = option.connectionRisk?.shortest;
  if (shortest?.duration < 90) {
    notes.push(`The ${formatMinutes(shortest.duration)} connection at ${shortest.id ?? shortest.name} is tight. Check whether you are comfortable risking a missed connection before booking.`);
  } else if (shortest?.duration < 180) {
    notes.push(`The shortest connection is ${formatMinutes(shortest.duration)} at ${shortest.id ?? shortest.name}. That is workable, but still worth reviewing carefully.`);
  }
  for (const item of option.assumptions ?? []) {
    if (item.label?.toLowerCase().includes("starts in")) {
      notes.push("This option starts in Bangkok. Only treat it as a real savings if you are already there, or if the extra Chiang Mai to Bangkok flight, hotel, transfers, and hassle still keep the total worthwhile.");
    } else if (item.label?.toLowerCase().includes("extra travel")) {
      notes.push("There is extra travel before this long-haul flight. Compare the real total, not just the Bangkok-to-Redmond ticket price.");
    } else {
      notes.push(`${item.label}: ${item.text}`);
    }
  }
  if (option.kind === "composed-stopover") {
    notes.push(`This is a split trip: fly to ${option.stopoverLabel}, stay ${option.nights} night${option.nights === 1 ? "" : "s"}, then take the separate flight home. Compare the real total with hotel and transfer time included.`);
  }
  if (!notes.length) return "";
  return `<div class="drawer-advice"><span>Before booking</span>${notes.map((note) => `<p>${escapeHtml(note)}</p>`).join("")}</div>`;
}


export {
  renderCardHead,
  flightActionLinks,
  flightIconLink,
  flightDetailDrawer,
  hasFlightDetail,
  renderFlightDetailPanel,
  flightGoogleFlightsUrl,
  bestChoiceSentence,
  optionHeadline,
  humanOptionLine,
  cleanTitlePart,
  optionRouteLine,
  optionDate,
  connectionPill,
  renderPainBreakdown,
  renderAssumptions
};
