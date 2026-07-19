import { escapeAttr, escapeHtml, formatMinutes } from "./html-utils.js";
import { airlineDisplay } from "./airline-display.js";
import { connectionPill, renderAssumptions, renderCardHead, renderPainBreakdown } from "./dashboard-flight-components.js";
import { groupByRouteIdea } from "./route-options.js";
import { renderRoutePriceHistory } from "./dashboard-route-history.js";
import { minBy } from "./collections.js";

export { groupByRouteIdea } from "./route-options.js";

// Route Evidence owns route grouping, composed stopovers, and route-level card rendering.
export function renderRoute(route, flights, refreshPlan, open = false, compactRoute = false, priceHistory = null) {
  const displayed = selectRouteOptions(flights);
  const missing = missingRefreshCalls(refreshPlan, route.id);
  const lead = displayed[0]?.option;
  return `<details class="route" id="${escapeHtml(route.id)}" ${open ? "open" : ""}>
    <summary><h3>${escapeHtml(route.label)}</h3></summary>
    <p class="sub">${escapeHtml(route.summary ?? "")}</p>
    <div class="meta">
      ${routeStatusPills(route, lead)}
      ${route.stopover ? `<span class="pill warn">separate stopover legs</span><span class="pill">${escapeHtml(route.stopover.label)} ${escapeHtml((route.stopover.nights ?? []).join("/") || "?")} night</span>` : ""}
    </div>
    ${renderRoutePriceHistory(priceHistory)}
    ${displayed.length ? `${renderRouteSortControls()}<div class="route-options" data-route-options>${displayed.map(({ option, rank }) => renderTripOption(option, compactRoute, rank)).join("")}</div>` : renderMissingRoute(route, missing)}
  </details>`;
}

function selectRouteOptions(flights, limit = 8) {
  const complete = flights.filter((option) =>
    option.tripComplete !== false &&
    option.destinationComplete !== false &&
    Number.isFinite(option.price ?? option.totalCost) &&
    Number.isFinite(option.durationMinutes)
  );
  const selected = flights.slice(0, limit);
  for (const leader of [
    minBy(complete, (option) => option.price ?? option.totalCost),
    minBy(complete, (option) => option.durationMinutes)
  ]) {
    if (leader && !selected.includes(leader)) selected.push(leader);
  }
  return selected.map((option) => ({ option, rank: flights.indexOf(option) }));
}

function renderRouteSortControls() {
  return `<div class="route-sort" aria-label="Sort route options">
    <span>Sort by</span>
    <button type="button" class="route-sort-link active" data-sort-route="best">Best</button>
    <button type="button" class="route-sort-link" data-sort-route="cheapest">Cheapest</button>
    <button type="button" class="route-sort-link" data-sort-route="fastest">Fastest</button>
  </div>`;
}

function renderTripOption(option, compactRoute = false, rank = 0) {
  return option.kind === "composed-stopover" ? renderComposedStopover(option, compactRoute, rank) : renderFlightRow(option, compactRoute, rank);
}

function renderComposedStopover(option, compactRoute = false, rank = 0) {
  return `<article class="flight-card route-option"${routeOptionSortAttrs(option, rank)}>
    ${renderCardHead("Route option", option, { hideRouteLabel: compactRoute })}
    <p class="path">${escapeHtml(option.summary)}</p>
    <div class="meta">
      <span class="pill">Leg 1 ${escapeHtml(option.inbound.duration ?? "")}</span>
      <span class="pill">Leg 2 ${escapeHtml(option.onward.duration ?? "")}</span>
      <span class="pill warn">${escapeHtml(option.stopoverLabel)} ${option.nights} night</span>
    </div>
    ${renderPainBreakdown(option)}
    ${renderAssumptions(option)}
  </article>`;
}

function renderMissingRoute(route, missing) {
  const reason = missing.length
    ? `Missing cached data for ${missing.map((call) => call.id).join(", ")}. Run a light live refresh when ready.`
    : "No complete or composed options are available in the current snapshot.";
  const title = route.type?.includes("alternate-start") ? "Needs starting-city data" : "Needs more data";
  return `<div class="row"><strong>${escapeHtml(title)}</strong><p class="small">${escapeHtml(reason)}</p></div>`;
}

function renderFlightRow(flight, compactRoute = false, rank = 0) {
  const layovers = flight.layovers ?? [];
  const layoverText = duplicatesConnectionPill(layovers, flight.connectionRisk?.shortest)
    ? ""
    : layovers.map((layover) => `${layover.id ?? layover.name ?? "Layover"} ${formatMinutes(layover.duration) ?? "time unknown"}`).join(" | ");
  const airline = airlineDisplay(flight) || "Unknown airline";
  return `<article class="flight-card route-option"${routeOptionSortAttrs(flight, rank)}>
    ${renderCardHead("Route option", flight, { hideRouteLabel: compactRoute })}
    <p class="path">${escapeHtml(airline)} · depart ${escapeHtml(flight.departureTime ?? "")} · arrive ${escapeHtml(flight.arrivalTime ?? "")}</p>
    <div class="meta">
      <span class="pill">${escapeHtml(stopCountBrief(flight))}</span>
      ${connectionPill(flight)}
      ${layoverText ? `<span class="pill ${tightLayoverClass(flight)}">${escapeHtml(layoverText)}</span>` : ""}
      ${isSeparateStopover(flight) ? `<span class="pill warn">separate stopover legs</span>` : ""}
    </div>
    ${flight.travelPain ? renderPainBreakdown(flight) : ""}
    ${flight.assumptions ? renderAssumptions(flight) : ""}
  </article>`;
}

function duplicatesConnectionPill(layovers, shortest) {
  if (layovers.length !== 1 || !shortest) return false;
  const [layover] = layovers;
  const sameAirport = (layover.id && shortest.id && layover.id === shortest.id) ||
    (layover.name && shortest.name && layover.name === shortest.name);
  return Boolean(sameAirport && layover.duration === shortest.duration);
}

function routeOptionSortAttrs(option, rank) {
  const price = option.price ?? option.totalCost;
  const duration = option.durationMinutes;
  return ` data-rank="${escapeAttr(rank)}" data-price="${escapeAttr(Number.isFinite(price) ? price : 999999)}" data-duration="${escapeAttr(Number.isFinite(duration) ? duration : 999999)}"`;
}

function stopCountBrief(flight) {
  const count = flight.stops ?? flight.layovers?.length ?? 0;
  return count === 0 ? "Nonstop" : `${count} stop${count === 1 ? "" : "s"}`;
}

function routeStatusPills(route, lead) {
  if (!lead) return `<span class="pill bad">Needs data</span>`;
  const pills = [];
  if (lead.assumptions?.length) pills.push(`<span class="pill warn">Extra travel first</span>`);
  if (lead.connectionRisk?.level === "tight") pills.push(`<span class="pill bad">Tight connection risk</span>`);
  if (!pills.length && route.type?.includes("stopover")) pills.push(`<span class="pill warn">Compare stopover cost</span>`);
  if (!pills.length) pills.push(`<span class="pill good">Route has complete options</span>`);
  return pills.join("");
}

function missingRefreshCalls(refreshPlan, routeIdeaId) {
  return (refreshPlan?.calls ?? []).filter((call) => call.routeIdeaId === routeIdeaId && call.cache.status === "missing");
}

function tightLayoverClass(flight) {
  return (flight.layovers ?? []).some((layover) => Number(layover.duration) < 90) ? "bad" : "";
}

function isSeparateStopover(flight) {
  return String(flight.routeFamily ?? "").includes("stopover") || /stopover|\b\d+n\b/i.test(flight.searchTitle ?? "");
}
