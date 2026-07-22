import { dateOnly, escapeAttr, escapeHtml, formatHumanDate, formatMinutes, money } from "./html-utils.js";
import { hasFlightDetail, optionDate, renderFlightDetailPanel } from "./dashboard-flight-components.js";
import { groupByRouteIdea } from "./dashboard-routes-page.js";
import { metricSignal, signalizeText } from "./dashboard-signals.js";
import { bestMovementText, movementMiniRows, renderMovementRead } from "./movement-summary.js";
import { dateWindowDays } from "./plan-list-coverage.js";
import { latestRefreshText, planIconLink } from "./plan-list-components.js";
import { evaluateWatchRules } from "./watch-rules.js";
import { cheapestCompleteOptionsByDate } from "./date-option-selection.js";
import { renderPriceTrendFragment } from "./dashboard-price-history.js";

// Owns plan-list overview analysis and its compact decision/date-scan presentation.
export function renderOverview(activePlans, dashboardPrefix) {
  if (!activePlans.length) {
    return `<section id="overview"><h2>Overview</h2><p class="sub">No active plans right now. Archived or past-date plans stay available below.</p></section>`;
  }
  return `<section id="overview">
    <h2>Overview</h2>
    <div class="overview-stack">${activePlans.map((item) => renderPlanOverview(item, dashboardPrefix)).join("")}</div>
  </section>`;
}

function renderPlanOverview({ plan, latest, decision, dashboardHref, comparison, priceHistory }, dashboardPrefix) {
  const decisionHref = `${dashboardPrefix}${dashboardHref}`;
  const datesHref = `${dashboardPrefix}${pageHref(plan.id, "dates")}`;
  const routesHref = `${dashboardPrefix}${pageHref(plan.id, "routes")}`;
  return `<article class="flight-card plan-overview-card">
    <div class="card-head">
      <div>
        <div class="label">${escapeHtml(latestRefreshText(latest))}</div>
        <h3>${escapeHtml(plan.name)}</h3>
      </div>
      <div class="card-stat"><strong>${escapeHtml(bestPriceText(decision))}</strong><span>${escapeHtml(bestTimeText(decision))}</span></div>
    </div>
    <div class="overview-row">
      <div>
        <div class="label">Current read</div>
        <p>${currentReadHtml(decision)}</p>
      </div>
      ${planIconLink(decisionHref, "Open current read", "↗")}
    </div>
    ${renderWatchAlertRow(plan, latest, decisionHref)}
    <div class="overview-row">
      <div>
        <div class="label">Best decisions right now</div>
        ${renderDecisionMiniRows(decision)}
      </div>
      ${planIconLink(`${decisionHref}#best-current-choice`, "Compare picks", "◇")}
    </div>
    <div class="overview-row">
      <div>
        <div class="label">Since last refresh</div>
        ${renderMovementRead(comparison)}
        ${renderMovementMiniRows(comparison)}
      </div>
      ${planIconLink(decisionHref.replace(/\.dashboard\.html$/, ".refresh.html"), "Open refresh details", "↻")}
    </div>
    ${renderPriceTrendFragment(priceHistory)}
    <div class="overview-row">
      <div>
        <div class="label">Route date scan</div>
        ${renderRouteDateMiniScans(plan, latest)}
      </div>
      <div class="overview-action-stack">
        ${planIconLink(datesHref, "Open date scan", "▥")}
        ${planIconLink(routesHref, "Open routes page", "☰")}
      </div>
    </div>
  </article>`;
}

function renderWatchAlertRow(plan, latest, decisionHref) {
  const alerts = evaluateWatchRules(plan.watchRules, latest?.rankedFlights ?? []);
  if (!alerts.length) return "";
  const hasMiss = alerts.some((alert) => alert.outcome === "missed");
  return `<div class="overview-row watch-outcome-${hasMiss ? "missed" : "met"}">
    <div>
      <div class="label">Saved target status</div>
      <div class="mini-list">${alerts.map(({ label, outcome, flight }) => `<div class="mini-row"><span>${escapeHtml(outcome === "missed" ? "Target missed" : "Target met")}: ${escapeHtml(label ?? "Saved target")}</span><strong>$${money(flight.price ?? flight.estimatedTotalCost)}</strong><em>${escapeHtml(formatMinutes(flight.durationMinutes) ?? "n/a")}</em><small>${escapeHtml(formatMiniDate(dateOnly(flight.departureTime)) || "n/a")}</small></div>`).join("")}</div>
    </div>
    ${planIconLink(`${decisionHref}#watch-alerts`, "Open target status", hasMiss ? "!" : "✓")}
  </div>`;
}

function renderDecisionMiniRows(decision) {
  const rows = [
    ["Best", decision?.best],
    ["Cheapest", decision?.cheapest],
    ["Fastest", decision?.fastest]
  ].filter(([, option]) => option);
  if (!rows.length) return `<p class="small">No decision data yet.</p>`;
  return `<div class="mini-list">${rows.map(([label, option]) => `<div class="mini-row"><span>${escapeHtml(label)}</span><strong>$${money(option.price ?? option.estimatedTotalCost)}</strong><em>${escapeHtml(option.duration ?? formatMinutes(option.durationMinutes) ?? "n/a")}</em><small>${escapeHtml(formatMiniDate(optionDate(option) ?? dateOnly(option.departureTime)) || "n/a")}</small></div>`).join("")}</div>`;
}

function renderMovementMiniRows(comparison) {
  const rows = movementMiniRows(comparison);
  if (!comparison?.available) return `<p class="small">First saved snapshot for this plan.</p>`;
  if (!rows.length) return `<p class="small">${escapeHtml(bestMovementText(comparison) || "Known prices look stable.")}</p>`;
  const footer = bestMovementText(comparison);
  return `<div class="movement-stat-line">${rows.map(([label, value, tone]) => `<span class="movement-${escapeAttr(tone)}">${escapeHtml(label)} <strong>${value}</strong></span>`).join("")}</div>${footer ? `<p class="small">${escapeHtml(footer)}</p>` : ""}`;
}

function renderRouteDateMiniScans(plan, latest) {
  const ranked = latest?.rankedFlights ?? [];
  if (!ranked.length) return `<p class="small">No date scan data yet.</p>`;
  const groups = groupByRouteIdea(plan, ranked);
  const rows = overviewRouteIdeas(plan)
    .map((route) => renderRouteDateMiniScan(route, routeScanOptions(route, groups.get(route.id) ?? []), plan))
    .filter(Boolean);
  if (!rows.length) return `<p class="small">No complete route prices in this date window yet.</p>`;
  return `<div class="mini-route-scans">${rows.join("")}</div>`;
}

function overviewRouteIdeas(plan) {
  const ideas = plan.routeIdeas ?? [];
  const distinctive = ideas.filter((route) => route.type !== "direct-to-final");
  return distinctive.length ? distinctive : ideas;
}

function routeScanOptions(route, options) {
  if (!route.stopover) return options;
  const composed = options.filter((option) => option.kind === "composed-stopover");
  return composed.length ? composed : options.filter((option) => option.tripComplete !== false && option.destinationComplete !== false);
}

function renderRouteDateMiniScan(route, options, plan) {
  const byDate = cheapestCompleteOptionsByDate(options);
  const dates = dateWindowDays(plan);
  const points = (dates.length ? dates : [...byDate.keys()].sort()).map((date) => ({ date, option: byDate.get(date) }));
  const prices = points.map((point) => point.option?.price ?? point.option?.totalCost).filter(Number.isFinite);
  if (!prices.length) return "";
  const low = Math.min(...prices);
  return `<div class="mini-route-scan">
    <div class="mini-route-title">${escapeHtml(route.label)}<span>highlight = lowest complete price</span></div>
    <div class="mini-date-scan">${points.map(({ date, option }) => renderDatePoint({ date, option, route, low })).join("")}</div>
  </div>`;
}

function renderDatePoint({ date, option, route, low }) {
  const price = option?.price ?? option?.totalCost;
  const isBest = Number.isFinite(price) && price === low;
  const content = `
      <span>${escapeHtml(formatMiniDate(date))}</span>
      <strong>${Number.isFinite(price) ? `$${money(price)}` : "n/a"}</strong>
      <em>${escapeHtml(formatMinutes(option?.durationMinutes) ?? option?.duration ?? "")}</em>`;
  if (!hasFlightDetail(option)) return `<div class="mini-date-point ${isBest ? "best" : ""}">${content}</div>`;
  const title = `${route.label} ${formatHumanDate(date)}: $${money(price)}, ${formatMinutes(option.durationMinutes) ?? option.duration ?? ""}`;
  return `<details class="side-drawer mini-date-drawer">
        <summary class="mini-date-point ${isBest ? "best" : ""}" title="${escapeAttr(title)}">${content}</summary>
        <div class="drawer-panel">${renderFlightDetailPanel(option, "Flight detail")}</div>
      </details>`;
}

function currentReadText(decision) {
  const balanced = decision?.best;
  const cheapest = decision?.cheapest;
  if (!balanced) return "No scan data yet. Run a refresh when you are ready to check this plan.";
  const base = `${balanced.departureAirport ?? "?"} -> ${balanced.arrivalAirport ?? "?"} on ${formatHumanDate(dateOnly(balanced.departureTime)) || "the selected date"} is the current clean starting point at $${money(balanced.price ?? balanced.estimatedTotalCost)} and ${balanced.duration ?? formatMinutes(balanced.durationMinutes) ?? "unknown time"}.`;
  if (cheapest && cheapest.searchId !== balanced.searchId) return `${base} The cheapest known option is $${money(cheapest.price ?? cheapest.estimatedTotalCost)}, so check whether that tradeoff is worth it.`;
  return base;
}

function currentReadHtml(decision) {
  const balanced = decision?.best;
  const cheapest = decision?.cheapest;
  if (!balanced) return signalizeText(currentReadText(decision));
  const route = `${balanced.departureAirport ?? "?"} -> ${balanced.arrivalAirport ?? "?"}`;
  const date = formatHumanDate(dateOnly(balanced.departureTime)) || "the selected date";
  const price = `$${money(balanced.price ?? balanced.estimatedTotalCost)}`;
  const time = balanced.duration ?? formatMinutes(balanced.durationMinutes) ?? "unknown time";
  const base = `${escapeHtml(route)} on ${metricSignal(date, "info")} is the current clean starting point at ${metricSignal(price, "info")} and ${metricSignal(time, "info")}.`;
  if (cheapest && cheapest.searchId !== balanced.searchId) {
    return `${base} The cheapest known option is ${metricSignal(`$${money(cheapest.price ?? cheapest.estimatedTotalCost)}`, "good")}, so check whether that tradeoff is worth it.`;
  }
  return base;
}

function formatMiniDate(value) {
  if (!value) return "";
  const [, month, day] = String(value).slice(0, 10).split("-");
  return month && day ? `${Number(month)}/${Number(day)}` : String(value);
}

function bestPriceText(decision) {
  const best = decision?.best;
  return best ? `$${money(best.price ?? best.estimatedTotalCost)}` : "n/a";
}

function bestTimeText(decision) {
  const best = decision?.best;
  return best?.duration ?? formatMinutes(best?.durationMinutes) ?? "no data";
}

function pageHref(planId, page) {
  return `${planId}.${page}.html`;
}
