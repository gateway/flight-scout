import { worthIt } from "./decision-analysis.js";
import { escapeAttr, escapeHtml, formatHumanDate, formatMinutes, money } from "./html-utils.js";
import { connectionPill, flightActionLinks, hasFlightDetail, optionDate, optionHeadline, optionRouteLine, renderAssumptions, renderCardHead, renderCardSummaryRow, renderFlightDetailPanel, renderPainBreakdown } from "./dashboard-flight-components.js";
import { connectionPlaceLabel } from "./dashboard-flight-option.js";
import { metricSignal, signalizeText } from "./dashboard-signals.js";
import { minBy } from "./collections.js";
import { cheapestCompleteOptionsByDate } from "./date-option-selection.js";
import { dateWindowDays } from "./plan-list-coverage.js";

// Date comparison components answer date-window questions without duplicating route-card layouts.
export function renderPriceGraph(plan, analysis) {
  const rows = plan.routeIdeas.map((route) => priceGraphRow(route, analysis.options.filter((option) => option.routeIdeaId === route.id), plan)).filter(Boolean);
  if (!rows.length) return `<p class="sub">No date-level prices are available yet.</p>`;
  const allPrices = rows.flatMap((row) => row.points.map((point) => point.price)).filter(Number.isFinite);
  const min = Math.min(...allPrices);
  const max = Math.max(...allPrices);
  return `<div class="price-graph">${rows.map((row) => renderPriceGraphRow(row, min, max)).join("")}</div>`;
}

export function renderDateHighlights(analysis) {
  const options = decisionReadyOptions(analysis);
  if (!options.length) return `<p class="sub">No date-level choices are available yet.</p>`;
  const cheapest = minBy(options, (option) => option.price);
  const fastest = minBy(options, (option) => option.durationMinutes);
  const best = analysis.best ?? minBy(options, (option) => option.humanScore);
  const cards = uniqueOptions([
    ["Best balanced date", best, "The cleanest overall mix of price, travel time, and connection risk."],
    ["Cheapest date", cheapest, dateHighlightReason(cheapest, best)],
    ["Fastest date", fastest, dateHighlightReason(fastest, best)]
  ]);
  const compactRoute = hasSingleRouteContext(analysis);
  return `<div class="grid">${cards.map(([label, option, reason], index) => renderDateHighlightCard(label, option, reason, index === 0, compactRoute)).join("")}</div>`;
}

export function renderDateOpportunities(analysis) {
  if (!analysis.dateOpportunities.length) return `<p class="sub">No date-window options are available yet.</p>`;
  const compactRoute = hasSingleRouteContext(analysis);
  return `<div class="date-strip">${analysis.dateOpportunities.map((item) => {
    const best = item.balanced;
    const deltaFromBest = analysis.best ? best.price - analysis.best.price : 0;
    return `<article class="flight-card date-card ${sameOption(best, analysis.best) ? "best" : ""}">
      ${renderCardHead(null, best, { hideRouteLabel: compactRoute, hideActions: true })}
      ${renderCardSummaryRow(dateOpportunitySummary(item, analysis.best, deltaFromBest), best)}
      <div class="meta">
        ${connectionPill(best)}
      </div>
      ${renderCheapestForDateNote(item, compactRoute)}
      ${renderPainBreakdown(best)}
      ${renderAssumptions(best)}
    </article>`;
  }).join("")}</div>`;
}

function priceGraphRow(route, options, plan) {
  const byDate = cheapestCompleteOptionsByDate(options);
  const expectedDates = dateWindowDays(plan);
  const dates = expectedDates.length ? expectedDates : [...byDate.keys()].sort();
  const points = dates.map((date) => {
    const option = byDate.get(date);
    return option ? {
      date,
      price: option.price ?? option.totalCost,
      duration: option.durationMinutes,
      option
    } : { date, price: null, duration: null, option: null, needsData: true };
  });
  const complete = points.filter((point) => Number.isFinite(point.price));
  if (!complete.length) return null;
  const best = complete.reduce((winner, point) => point.price < winner.price ? point : winner, complete[0]);
  return { route, points, best };
}

function renderPriceGraphRow(row, min, max) {
  const range = Math.max(1, max - min);
  const completeCount = row.points.filter((point) => Number.isFinite(point.price)).length;
  const coverageText = `${completeCount}/${row.points.length} dates with results`;
  const coverageNote = completeCount === 1
    ? "Only one date currently has the complete saved route data needed for this comparison."
    : "Click any date to see the flight detail.";
  return `<article class="price-row">
    <div class="price-row-head">
      <div><div class="label">${escapeHtml(row.route.label)}</div><strong>${escapeHtml(formatShortDate(row.best.date))} · $${money(row.best.price)}</strong><small>${escapeHtml(formatMinutes(row.best.duration))} cheapest complete option found for this route</small></div>
      <div class="price-row-meta"><strong>${escapeHtml(coverageText)}</strong><small>${escapeHtml(coverageNote)}</small></div>
    </div>
    <div class="price-bars">${row.points.map((point) => {
      if (point.needsData) return renderPricePoint(row, point, false, 0);
      const height = 22 + ((point.price - min) / range) * 58;
      return renderPricePoint(row, point, point === row.best, height);
    }).join("")}</div>
  </article>`;
}

function renderPricePoint(row, point, isBest, height) {
  if (point.needsData) {
    return `<div class="price-bar needs-data" title="${escapeAttr(`${row.route.label} ${formatHumanDate(point.date)}: no saved result`)}">
      <span class="bar-fill" style="height:8px"></span>
      <strong>needs data</strong>
      <small>${escapeHtml(formatShortDate(point.date))}</small>
    </div>`;
  }
  const content = `
    <span class="bar-fill" style="height:${Math.round(height)}px"></span>
    <strong>$${money(point.price)}</strong>
    <small>${escapeHtml(formatShortDate(point.date))}</small>
    <em>${escapeHtml(formatMinutes(point.duration) ?? "")}</em>`;
  const title = `${row.route.label} ${formatHumanDate(point.date)}: $${money(point.price)}, ${formatMinutes(point.duration)}`;
  if (!hasFlightDetail(point.option)) {
    return `<a class="price-bar ${isBest ? "best" : ""}" href="#${escapeAttr(row.route.id)}" title="${escapeAttr(title)}">${content}</a>`;
  }
  return `<details class="side-drawer price-detail-drawer">
    <summary class="price-bar ${isBest ? "best" : ""}" title="${escapeAttr(title)}">${content}</summary>
    <div class="drawer-panel">${renderFlightDetailPanel(point.option, "Flight detail")}</div>
  </details>`;
}

function decisionReadyOptions(analysis) {
  return (analysis.options ?? []).filter((option) =>
    Number.isFinite(option.price) &&
    Number.isFinite(option.durationMinutes) &&
    option.viability?.status !== "hard-reject"
  );
}

function uniqueOptions(cards) {
  const seen = new Set();
  return cards.filter(([, option]) => {
    if (!option) return false;
    const key = optionKey(option);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function optionKey(option) {
  return [option.routeIdeaId, optionDate(option), option.price, option.durationMinutes].join("|");
}

function dateHighlightReason(option, best) {
  if (!option || !best) return "Worth checking against the other dates.";
  const tradeoff = worthIt(option, best);
  return tradeoff?.sentence ?? "Worth checking against the current best-balanced date.";
}

function renderDateHighlightCard(label, option, reason, primary = false, compactRoute = false) {
  return `<article class="card flight-card ${primary ? "best" : ""}">
    <div class="card-head">
      <div><div class="label">${escapeHtml(label)}</div><div class="title">${escapeHtml(optionDate(option) ?? "unknown date")}</div></div>
      <div class="card-stat"><strong>$${money(option.price)}</strong><span>${escapeHtml(formatMinutes(option.durationMinutes))}</span>${flightActionLinks(option)}</div>
    </div>
    <p class="path">${escapeHtml(compactRoute ? optionRouteLine(option) : optionHeadline(option))}</p>
    <div class="meta">
      ${connectionPill(option)}
    </div>
    <p class="small">${signalizeText(reason)}</p>
    ${renderAssumptions(option)}
  </article>`;
}

function sameOption(a, b) {
  return Boolean(a && b && optionKey(a) === optionKey(b));
}

function dateOpportunitySummary(item, currentBest, deltaFromBest) {
  const option = item.balanced;
  const bestDate = formatHumanDate(optionDate(currentBest)) || "the best flexible date";
  if (sameOption(option, currentBest)) {
    return "Best overall date for the strongest mix of price, travel time, and connection comfort.";
  }
  if (!Number.isFinite(deltaFromBest) || deltaFromBest === 0) {
    return `Same price as ${metricSignal(bestDate, "info")}. Compare departure time and connection comfort.`;
  }
  if (deltaFromBest < 0) {
    return `${metricSignal(`$${money(Math.abs(deltaFromBest))} cheaper`, "good")} than ${escapeHtml(bestDate)}, but its timing or connection is less comfortable overall.`;
  }
  return `${metricSignal(`$${money(deltaFromBest)} more`, "warn")} than ${escapeHtml(bestDate)}. Choose it if this departure date fits your schedule better.`;
}

function renderCheapestForDateNote(item, compactRoute = false) {
  const balanced = item.balanced;
  const cheapest = item.cheapest;
  if (!cheapest) return "";
  if (sameOption(balanced, cheapest)) return "";
  const cheapestLine = compactRoute
    ? `$${money(cheapest.price)} · ${escapeHtml(formatMinutes(cheapest.durationMinutes) ?? "")}`
    : `${escapeHtml(cheapest.routeIdeaLabel ?? optionRouteLine(cheapest))} · $${money(cheapest.price)} · ${escapeHtml(formatMinutes(cheapest.durationMinutes) ?? "")}`;
  return `<div class="date-note">
    <strong>Cheapest alternative:</strong> ${cheapestLine}.
    <span>${signalizeText(whyBalancedBeatsCheapest(balanced, cheapest))}</span>
  </div>`;
}

function hasSingleRouteContext(analysis) {
  const routeIds = new Set((analysis.options ?? []).map((option) => option.routeIdeaId).filter(Boolean));
  return routeIds.size === 1;
}

function whyBalancedBeatsCheapest(balanced, cheapest) {
  const reasons = [];
  const extraTime = cheapest.durationMinutes - balanced.durationMinutes;
  if (extraTime > 90) reasons.push(`${formatMinutes(extraTime)} longer`);
  const shortest = cheapest.connectionRisk?.shortest;
  if (cheapest.connectionRisk?.level === "tight" && shortest) reasons.push(`tight ${connectionPlaceLabel(shortest)} connection`);
  if (cheapest.connectionRisk?.level === "watch" && shortest) reasons.push(`short ${connectionPlaceLabel(shortest)} connection`);
  if (cheapest.assumptions?.length) reasons.push("extra travel before the long-haul flight");
  if (cheapest.confidence?.level === "Low") reasons.push("less complete flight detail");
  if (!reasons.length) reasons.push("worse overall mix of price, time, stops, and connection risk");
  return `Tradeoff: ${reasons.slice(0, 3).join(", ")}.`;
}

function formatShortDate(value) {
  if (!value) return "";
  const [year, month, day] = String(value).slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return String(value);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric"
  });
}
