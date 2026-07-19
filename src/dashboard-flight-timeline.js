import { displayAirlineName } from "./airline-display.js";
import { escapeAttr, escapeHtml, formatMinutes } from "./html-utils.js";

// Timeline rendering owns leg, amenity, stopover-break, and layover signal markup.
export function renderDrawerTimeline(option) {
  if (option.kind === "composed-stopover") return renderComposedDrawerTimeline(option);
  if (option.kind === "composed-round-trip") return renderRoundTripTimeline(option);
  return renderFlightTimeline(option);
}

function renderRoundTripTimeline(option) {
  return renderTimelineParts([
    { label: "Outbound", flight: option.outbound },
    { label: "Return", flight: option.returnFlight }
  ]);
}

function renderComposedDrawerTimeline(option) {
  return renderTimelineParts([
    { label: `Flight to ${option.stopoverLabel}`, flight: option.inbound },
    { label: `After ${option.nights} night${option.nights === 1 ? "" : "s"}`, flight: option.onward }
  ]);
}

function renderTimelineParts(input) {
  const parts = input.filter((part) => part.flight?.legs?.length);
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

function layoverClass(layover) {
  const minutes = layover?.duration;
  if (!Number.isFinite(minutes)) return "layover-neutral";
  if (minutes < 90) return "layover-tight";
  if (minutes < 180) return "layover-watch";
  if (minutes >= 360) return "layover-long";
  return "layover-good";
}
