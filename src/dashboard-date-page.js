import { worthIt } from "./decision-analysis.js";
import { escapeAttr, escapeHtml, formatHumanDate, formatMinutes, money } from "./html-utils.js";
import { connectionPill, flightActionLinks, hasFlightDetail, optionDate, optionHeadline, optionRouteLine, renderCardHead, renderFlightDetailPanel, renderPainBreakdown } from "./dashboard-flight-components.js";
import { metricSignal, signal, signalizeText } from "./dashboard-signals.js";

// Date comparison components answer date-window questions without duplicating route-card layouts.
export function renderPriceGraph(plan, analysis) {
  const rows = plan.routeIdeas.map((route) => priceGraphRow(route, analysis.options.filter((option) => option.routeIdeaId === route.id))).filter(Boolean);
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
      ${renderCardHead("Best option on this date", best, { hideRouteLabel: compactRoute })}
      <p>${dateOpportunitySummary(item, analysis.best, deltaFromBest, compactRoute)}</p>
      <div class="meta">
        <span class="pill">${escapeHtml(formatHumanDate(optionDate(best) ?? item.date))}</span>
        ${dateComparisonSignal(best, analysis.best, deltaFromBest)}
        ${connectionPill(best)}
      </div>
      ${renderCheapestForDateNote(item, compactRoute)}
      ${renderPainBreakdown(best)}
    </article>`;
  }).join("")}</div>`;
}

function priceGraphRow(route, options) {
  const byDate = new Map();
  for (const option of options) {
    const date = optionDate(option);
    if (!date || !Number.isFinite(option.price)) continue;
    const current = byDate.get(date);
    if (!current || option.humanScore < current.humanScore) byDate.set(date, option);
  }
  const points = [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, option]) => ({ date, price: option.price, duration: option.durationMinutes, option }));
  if (!points.length) return null;
  const best = points.reduce((winner, point) => point.price < winner.price ? point : winner, points[0]);
  return { route, points, best };
}

function renderPriceGraphRow(row, min, max) {
  const range = Math.max(1, max - min);
  const coverageText = `${row.points.length} complete date${row.points.length === 1 ? "" : "s"}`;
  const coverageNote = row.points.length === 1
    ? "Only one date currently has the complete saved route data needed for this comparison."
    : "Click any date to see the flight detail.";
  return `<article class="price-row">
    <div class="price-row-head">
      <div><div class="label">${escapeHtml(row.route.label)}</div><strong>${escapeHtml(formatShortDate(row.best.date))} · $${money(row.best.price)}</strong><small>${escapeHtml(formatMinutes(row.best.duration))} cheapest complete option found for this route</small></div>
      <div class="price-row-meta"><strong>${escapeHtml(coverageText)}</strong><small>${escapeHtml(coverageNote)}</small></div>
    </div>
    <div class="price-bars">${row.points.map((point) => {
      const height = 22 + ((point.price - min) / range) * 58;
      return renderPricePoint(row, point, point === row.best, height);
    }).join("")}</div>
  </article>`;
}

function renderPricePoint(row, point, isBest, height) {
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
  </article>`;
}

function sameOption(a, b) {
  return Boolean(a && b && optionKey(a) === optionKey(b));
}

function dateOpportunitySummary(item, currentBest, deltaFromBest, compactRoute = false) {
  const option = item.balanced;
  const route = compactRoute ? "" : ` Route: ${escapeHtml(option.routeIdeaLabel ?? optionRouteLine(option))}.`;
  const date = formatHumanDate(item.date) || item.date;
  const bestDate = formatHumanDate(optionDate(currentBest)) || "the best flexible date";
  const duration = metricSignal(formatMinutes(option.durationMinutes), "info");
  if (sameOption(option, currentBest)) {
    return `If your dates are flexible, start with ${signal(date, "info")}. It has the strongest mix across the whole window at ${metricSignal(`$${money(option.price)}`, "info")} and ${duration}.${route}`;
  }
  if (!Number.isFinite(deltaFromBest) || deltaFromBest === 0) {
    return `${signal(date, "info")} is tied on price with ${signal(bestDate, "info")}. Choose between them by departure time, airport path, and connection comfort.${route}`;
  }
  if (deltaFromBest < 0) {
    return `${signal(date, "info")} is ${metricSignal(`$${money(Math.abs(deltaFromBest))} cheaper`, "good")} than ${signal(bestDate, "info")}, but ranks lower overall because the timing, route, or connection profile is less clean.${route}`;
  }
  return `${signal(date, "info")} costs ${metricSignal(`$${money(deltaFromBest)} more`, "warn")} than ${signal(bestDate, "info")}. Use it if this departure date works better for your schedule.${route}`;
}

function dateComparisonSignal(option, currentBest, deltaFromBest) {
  if (sameOption(option, currentBest)) return metricSignal("best flexible date", "good");
  if (!Number.isFinite(deltaFromBest) || deltaFromBest === 0) return metricSignal("same price as best date", "info");
  if (deltaFromBest < 0) return metricSignal(`$${money(Math.abs(deltaFromBest))} cheaper than best date`, "good");
  return metricSignal(`$${money(deltaFromBest)} more than best date`, "warn");
}

function renderCheapestForDateNote(item, compactRoute = false) {
  const balanced = item.balanced;
  const cheapest = item.cheapest;
  if (!cheapest) return "";
  if (sameOption(balanced, cheapest)) {
    return `<div class="date-note"><strong>${signal("Also cheapest that day", "good")}:</strong> this balanced pick is the lowest complete fare we found for ${escapeHtml(formatShortDate(item.date))}.</div>`;
  }
  const cheapestLine = compactRoute
    ? `${optionRouteLine(cheapest)}, $${money(cheapest.price)}, ${escapeHtml(formatMinutes(cheapest.durationMinutes) ?? "")}`
    : `${escapeHtml(cheapest.routeIdeaLabel ?? optionRouteLine(cheapest))}, $${money(cheapest.price)}, ${escapeHtml(formatMinutes(cheapest.durationMinutes) ?? "")}`;
  return `<div class="date-note">
    <strong>Cheapest that day:</strong> ${escapeHtml(cheapestLine)}.
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
  if (cheapest.connectionRisk?.level === "tight" && shortest) reasons.push(`tight ${shortest.id ?? shortest.name} connection`);
  if (cheapest.connectionRisk?.level === "watch" && shortest) reasons.push(`short ${shortest.id ?? shortest.name} connection`);
  if (cheapest.assumptions?.length) reasons.push("extra travel before the long-haul flight");
  if (cheapest.confidence?.level === "Low") reasons.push("lower confidence");
  if (!reasons.length) reasons.push("worse overall mix of price, time, stops, and connection risk");
  return `The balanced pick wins because the cheaper option has ${reasons.slice(0, 3).join(", ")}.`;
}

function minBy(items, score) {
  return items.reduce((best, item) => (score(item) < score(best) ? item : best), items[0] ?? null);
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
