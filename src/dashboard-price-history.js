import { escapeAttr, escapeHtml, formatHumanDate, money } from "./html-utils.js";
import { assessCurrentPrice } from "./price-history.js";
import { renderPriceSparkline } from "./dashboard-sparkline.js";

// Keeps price-history language and visual semantics identical across dashboard pages.
export function renderPriceHistoryPanel(series, { className = "plan-price-history", label = "Price Changes" } = {}) {
  const view = priceHistoryView(series);
  if (!view) return "";
  return `<div class="${escapeAttr(className)}" data-price-status="${escapeAttr(view.assessment.status)}">
    <div class="price-history-copy">
      <div><span class="label">${escapeHtml(label)}</span><strong>${escapeHtml(view.assessment.sentence)}</strong></div>
      <span>${view.assessment.observationCount} saved check${view.assessment.observationCount === 1 ? "" : "s"}</span>
    </div>
    <div class="price-history-detail"><strong>Cheapest seen: $${money(view.lowest.cheapestCompletePrice)} on ${escapeHtml(formatHumanDate(view.lowest.createdAt?.slice(0, 10)) || "an earlier check")}</strong><span>${escapeHtml(view.deltaText)}</span></div>
    <div class="price-history-chart">
      <div class="price-history-chart-label"><span>Earlier checks</span><span>Latest check</span></div>
      ${renderPriceSparkline(view.series, { value: (point) => point.cheapestCompletePrice, label: priceHistoryChartLabel(view) })}
    </div>
  </div>`;
}

export function renderPriceTrendFragment(series) {
  const view = priceHistoryView(series);
  if (!view) return "";
  return `<div class="price-trend-fragment" data-price-status="${escapeAttr(view.assessment.status)}">
    ${renderPriceSparkline(view.series, { compact: true, value: (point) => point.cheapestCompletePrice, label: `Price trend with ${view.series.length} saved checks` })}
    <span><strong>${escapeHtml(statusLabel(view.assessment.status))}</strong><small>Lowest seen: $${money(view.lowest.cheapestCompletePrice)}</small></span>
  </div>`;
}

export function routeHistorySeries(history) {
  return (history?.points ?? []).map((point) => ({
    ...point,
    cheapestCompletePrice: point.price
  }));
}

function priceHistoryView(series) {
  const usable = (series ?? []).filter((point) => Number.isFinite(point.cheapestCompletePrice));
  if (!usable.length) return null;
  const assessment = assessCurrentPrice(usable);
  const lowest = usable.reduce((winner, point) => point.cheapestCompletePrice < winner.cheapestCompletePrice ? point : winner, usable[0]);
  const delta = assessment.currentPrice - lowest.cheapestCompletePrice;
  return {
    series: usable,
    assessment,
    lowest,
    deltaText: delta === 0 ? "Current price matches that low." : `Current price is $${money(delta)} above that low.`
  };
}

function priceHistoryChartLabel(view) {
  const firstDate = formatHumanDate(view.series[0]?.createdAt?.slice(0, 10)) || "the first saved check";
  const latestDate = formatHumanDate(view.series.at(-1)?.createdAt?.slice(0, 10)) || "the latest saved check";
  return `Price changes across ${view.series.length} saved checks from ${firstDate} through ${latestDate}; latest price $${money(view.assessment.currentPrice)}`;
}

function statusLabel(status) {
  return ({
    "insufficient-history": "History starting",
    "delta-only": "Two-check change",
    "lowest-seen": "Lowest seen",
    "near-low": "Near saved low",
    middle: "Middle of saved range",
    "near-high": "Near saved high",
    "highest-seen": "Highest seen"
  })[status] ?? "Saved price trend";
}
