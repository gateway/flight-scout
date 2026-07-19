import { escapeAttr, escapeHtml, formatHumanDate, money } from "./html-utils.js";

// Present compact route history without duplicating the existing two-snapshot
// comparison. This view answers longer-term questions: direction and lowest seen.
export function renderRoutePriceHistory(history) {
  if (!history?.points?.length) return "";
  const prices = history.points.map((point) => point.price).filter(Number.isFinite);
  if (!prices.length) return "";
  const low = Math.min(...prices);
  const high = Math.max(...prices);
  const range = Math.max(high - low, 1);
  return `<div class="route-price-history">
    <div class="route-history-head">
      <div><span class="label">Price history</span><strong>${history.points.length} saved price${history.points.length === 1 ? "" : "s"}</strong></div>
      <span><strong>Cheapest seen: $${money(history.cheapestPrice)}</strong></span>
    </div>
    <div class="history-trend" role="img" aria-label="${escapeAttr(historyLabel(history))}">
      ${history.points.map((point) => renderPoint(point, history, low, range)).join("")}
    </div>
    ${renderHistorySummary(history)}
  </div>`;
}

function renderHistorySummary(history) {
  if (history.points.length === 1) {
    return `<div class="route-history-summary"><span>Only one saved price so far; price movement will show after the next refresh.</span></div>`;
  }
  return `<div class="route-history-summary">
    <span class="${directionClass(history.direction)}">${escapeHtml(changeText(history.change, "since the previous saved price"))}</span>
    <span class="${directionClass(history.overallDirection)}">${escapeHtml(changeText(history.overallChange, `across all ${history.points.length} saved prices`))}</span>
  </div>`;
}

function renderPoint(point, history, low, range) {
  const level = Math.round(24 + ((point.price - low) / range) * 68);
  const cheapest = point.snapshotId === history.cheapestSnapshotId ? " cheapest" : "";
  const date = formatHumanDate(point.createdAt?.slice(0, 10)) || point.snapshotId;
  return `<span class="history-point${cheapest}" data-history-point style="--history-level:${level}%" title="${escapeAttr(`${date}: $${money(point.price)}`)}"><i></i><small>${escapeHtml(date)}</small></span>`;
}

function changeText(change, period) {
  if (!Number.isFinite(change)) return `More history is needed to compare ${period}`;
  if (change === 0) return `No change ${period}`;
  return `${change < 0 ? "Down" : "Up"} $${money(Math.abs(change))} ${period}`;
}

function historyLabel(history) {
  const count = `${history.points.length} saved price${history.points.length === 1 ? "" : "s"}`;
  return `Price history with ${count}. Cheapest seen $${money(history.cheapestPrice)}.`;
}

function directionClass(direction) {
  if (direction === "down") return "history-good";
  if (direction === "up") return "history-warn";
  return "";
}
