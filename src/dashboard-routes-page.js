import { dateOnly, escapeAttr, escapeHtml, formatMinutes, money } from "./html-utils.js";
import { airlineDisplay } from "./airline-display.js";
import { connectionPill, renderAssumptions, renderCardHead, renderPainBreakdown } from "./dashboard-flight-components.js";

// Route Evidence owns route grouping, composed stopovers, and route-level card rendering.
export function renderRoute(route, flights, refreshPlan, open = false, compactRoute = false) {
  const top = flights.slice(0, 8);
  const missing = missingRefreshCalls(refreshPlan, route.id);
  const lead = top[0];
  return `<details class="route" id="${escapeHtml(route.id)}" ${open ? "open" : ""}>
    <summary><h3>${escapeHtml(route.label)}</h3></summary>
    <p class="sub">${escapeHtml(route.summary ?? "")}</p>
    <div class="meta">
      ${routeStatusPills(route, lead)}
      ${route.stopover ? `<span class="pill warn">separate stopover legs</span><span class="pill">${escapeHtml(route.stopover.label)} ${escapeHtml((route.stopover.nights ?? []).join("/") || "?")} night</span>` : ""}
    </div>
    ${top.length ? `${renderRouteSortControls()}<div class="route-options" data-route-options>${top.map((option, index) => renderTripOption(option, compactRoute, index)).join("")}</div>` : renderMissingRoute(route, missing)}
  </details>`;
}

export function groupByRouteIdea(plan, flights) {
  const groups = new Map(plan.routeIdeas.map((route) => [route.id, []]));
  const complete = flights.filter((flight) => flight.tripComplete !== false && flight.destinationComplete !== false);
  for (const route of plan.routeIdeas) {
    groups.get(route.id).push(...composeStopoverOptions(route, flights));
  }
  for (const flight of complete) {
    const route = plan.routeIdeas.find((idea) => matchesRouteIdea(idea, flight));
    if (route) groups.get(route.id).push(flight);
  }
  for (const [key, list] of groups) {
    groups.set(key, list.sort((a, b) => optionScore(a) - optionScore(b)));
  }
  return groups;
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
  const title = route.type?.includes("alternate-start") ? "Needs Chiang Mai to Bangkok data" : "Needs more data";
  return `<div class="row"><strong>${escapeHtml(title)}</strong><p class="small">${escapeHtml(reason)}</p></div>`;
}

function renderFlightRow(flight, compactRoute = false, rank = 0) {
  const layoverText = (flight.layovers ?? []).map((layover) => `${layover.id ?? layover.name ?? "Layover"} ${formatMinutes(layover.duration)}`).join(" | ");
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

function composeStopoverOptions(route, flights) {
  if (!route.stopover) return [];
  const focusIds = route.focusSearchIds ?? [];
  const nights = route.stopover.nights?.[0] ?? 1;
  const inboundByDate = bestByDate(flights.filter((flight) => focusIds.includes(flight.searchId) && !endsAtFinalAirport(flight)));
  const onwardByDate = bestByDate(flights.filter((flight) => focusIds.includes(flight.searchId) && endsAtFinalAirport(flight)));
  const options = [];
  for (const [inboundDate, inbound] of inboundByDate) {
    const onward = onwardByDate.get(addDays(inboundDate, nights));
    if (!inbound || !onward) continue;
    options.push(composeStopoverOption(route, inbound, onward, nights));
  }
  return options;
}

function composeStopoverOption(route, inbound, onward, nights) {
  const hotelCost = nights * (route.stopover.hotelEstimateUsdPerNight ?? 0);
  const totalCost = (inbound.price ?? 0) + (onward.price ?? 0) + hotelCost;
  return {
    kind: "composed-stopover",
    label: `${inbound.departureAirport} -> ${route.stopover.label} -> ${onward.arrivalAirport} on ${dateOnly(inbound.departureTime)}`,
    summary: `$${money(inbound.price)} to ${route.stopover.label}, ${nights} night stopover, then $${money(onward.price)} home. Hotel estimate $${money(hotelCost)}.`,
    inbound,
    onward,
    nights,
    stopoverLabel: route.stopover.label,
    totalCost,
    durationMinutes: (inbound.durationMinutes ?? 0) + (onward.durationMinutes ?? 0),
    googleFlightsUrl: onward.googleFlightsUrl ?? inbound.googleFlightsUrl
  };
}

function bestByDate(flights) {
  const byDate = new Map();
  for (const flight of flights) {
    const date = dateOnly(flight.departureTime);
    if (!date) continue;
    const current = byDate.get(date);
    if (!current || optionScore(flight) < optionScore(current)) byDate.set(date, flight);
  }
  return byDate;
}

function endsAtFinalAirport(flight) {
  return flight.arrivalAirport === "RDM" || (flight.expectedArrivalAirports ?? []).includes("RDM");
}

function optionScore(option) {
  if (option.kind === "composed-stopover") return option.totalCost / 35 + option.durationMinutes / 18;
  return option.scoring?.score ?? 99999;
}

function missingRefreshCalls(refreshPlan, routeIdeaId) {
  return (refreshPlan?.calls ?? []).filter((call) => call.routeIdeaId === routeIdeaId && call.cache.status === "missing");
}

function matchesRouteIdea(route, flight) {
  if ((route.focusSearchIds ?? []).includes(flight.searchId)) return true;
  if ((route.batches ?? []).some((batch) => batch === flight.searchBatch || batch === flight.routeFamily)) return true;
  const haystack = `${flight.searchTitle ?? ""} ${flight.routeFamily ?? ""} ${flight.searchBatch ?? ""}`.toLowerCase();
  return routeTokens(route).every((token) => haystack.includes(token));
}

function routeTokens(route) {
  return String(`${route.id ?? ""} ${route.label ?? ""}`)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2 && !["the", "and", "with"].includes(token));
}

function tightLayoverClass(flight) {
  return (flight.layovers ?? []).some((layover) => Number(layover.duration) < 90) ? "bad" : "";
}

function isSeparateStopover(flight) {
  return ["tokyo-stopover", "bangkok-stopover"].includes(flight.routeFamily) || /tokyo|bangkok \d+n/i.test(flight.searchTitle ?? "");
}

function addDays(value, days) {
  const [year, month, day] = String(value ?? "").slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return "";
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}
