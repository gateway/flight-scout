import { escapeAttr, escapeHtml, formatMinutes, money } from "./html-utils.js";
import { renderDrawerTimeline } from "./dashboard-flight-timeline.js";
import {
  flightGoogleFlightsUrl,
  flightGoogleFlightsUrls,
  optionDate,
  optionHeadline,
  renderPainBreakdown
} from "./dashboard-flight-option.js";

// Drawer composition owns facts and booking advice while timeline markup remains independently testable.
export function renderFlightDetailPanel(option, label = "Flight detail") {
  const googleFlightsUrl = flightGoogleFlightsUrl(option);
  const roundTripUrls = option.kind === "composed-round-trip" ? flightGoogleFlightsUrls(option) : [];
  const dateFact = drawerDateFact(option);
  return `<div class="drawer-head">
    <div><span class="label">${escapeHtml(label)}</span>
    <strong>${escapeHtml(optionHeadline(option))}</strong></div>
    <div class="drawer-head-actions">
      ${roundTripUrls.length ? renderRoundTripLinks(roundTripUrls) : googleFlightsUrl ? `<a class="btn drawer-btn drawer-head-link" target="_blank" rel="noopener" href="${escapeAttr(googleFlightsUrl)}">Open in Google Flights</a>` : ""}
      <button class="drawer-close" type="button" aria-label="Close flight detail">×</button>
    </div>
  </div>
  <div class="drawer-facts">
    <div><span>Total</span><strong>${escapeHtml(formatMinutes(option.durationMinutes) ?? option.duration ?? "n/a")}</strong></div>
    <div><span>Price</span><strong>$${money(option.price ?? option.totalCost)}</strong></div>
    <div><span>${escapeHtml(dateFact.label)}</span><strong>${escapeHtml(dateFact.value)}</strong></div>
    <div><span>Stops</span><strong>${escapeHtml(stopCountText(option))}</strong></div>
  </div>
  ${renderDrawerTimeline(option)}
  ${renderPainBreakdown(option)}
  ${renderDrawerAdvice(option)}`;
}

function drawerDateFact(option) {
  if (option.kind === "composed-round-trip") {
    const outboundDate = optionDate(option) ?? "n/a";
    const returnDate = optionDate(option.returnFlight) ?? "n/a";
    return { label: "Dates", value: `${outboundDate} to ${returnDate}` };
  }
  return { label: "Date", value: optionDate(option) ?? "n/a" };
}

function stopCountText(option) {
  if (option.kind === "composed-stopover" || option.kind === "composed-round-trip") {
    const flights = option.kind === "composed-round-trip"
      ? [option.outbound, option.returnFlight]
      : [option.inbound, option.onward];
    const stops = flights.map((flight) => flight?.layovers?.length ?? flight?.stops ?? 0);
    return stops.map((count) => `${count} stop${count === 1 ? "" : "s"}`).join(" + ");
  }
  const count = option.stops ?? option.layovers?.length ?? 0;
  if (!count) return "Nonstop";
  return `${count} stop${count === 1 ? "" : "s"}`;
}

function renderDrawerAdvice(option) {
  const notes = [];
  const shortest = option.connectionRisk?.shortest;
  if (option.connectionRisk?.level === "unknown" && shortest) {
    notes.push(`The connection time at ${shortest.id ?? shortest.name} was not returned. Verify it before booking.`);
  } else if (shortest?.duration < 90) {
    notes.push(`The ${formatMinutes(shortest.duration)} connection at ${shortest.id ?? shortest.name} is tight. Check whether you are comfortable risking a missed connection before booking.`);
  } else if (shortest?.duration < 180) {
    notes.push(`The shortest connection is ${formatMinutes(shortest.duration)} at ${shortest.id ?? shortest.name}. That is workable, but still worth reviewing carefully.`);
  }
  for (const item of option.assumptions ?? []) notes.push(`${item.label}: ${item.text}`);
  if (option.kind === "composed-stopover") {
    const finalStop = option.onward?.arrivalAirport ? ` to ${option.onward.arrivalAirport}` : "";
    notes.push(`This is a split trip: fly to ${option.stopoverLabel}, stay ${option.nights} night${option.nights === 1 ? "" : "s"}, then take the separate flight${finalStop}. Compare the real total with hotel and transfer time included.`);
  }
  const warningAlreadyShown = (option.assumptions ?? []).some((item) => item.text === option.bookingWarning);
  if (option.kind === "composed-round-trip" && option.bookingWarning && !warningAlreadyShown) notes.push(option.bookingWarning);
  if (!notes.length) return "";
  return `<div class="drawer-advice"><span>Before booking</span>${notes.map((note) => `<p>${escapeHtml(note)}</p>`).join("")}</div>`;
}

function renderRoundTripLinks(urls) {
  const labels = ["Open outbound", "Open return"];
  return urls.map((url, index) => `<a class="btn drawer-btn drawer-head-link" target="_blank" rel="noopener" href="${escapeAttr(url)}">${labels[index]}</a>`).join("");
}
