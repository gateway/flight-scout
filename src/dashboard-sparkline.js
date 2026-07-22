import { escapeAttr, escapeHtml, formatHumanDate, money } from "./html-utils.js";

// Renders the one dependency-free price trend used by every dashboard surface.
export function renderPriceSparkline(points, {
  className = "",
  compact = false,
  value = (point) => point.price ?? point.cheapestCompletePrice,
  label = "Saved price history"
} = {}) {
  const usable = points.filter((point) => Number.isFinite(value(point)));
  if (!usable.length) return "";
  const width = compact ? 112 : 240;
  const height = compact ? 34 : 64;
  const padding = compact ? 4 : 7;
  const values = usable.map(value);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const range = Math.max(high - low, 1);
  const coordinates = usable.map((point, index) => ({
    point,
    price: value(point),
    x: usable.length === 1 ? width / 2 : padding + (index / (usable.length - 1)) * (width - padding * 2),
    y: padding + ((high - value(point)) / range) * (height - padding * 2)
  }));
  const path = coordinates.map(({ x, y }) => `${round(x)},${round(y)}`).join(" ");
  const classes = ["price-sparkline", compact ? "compact" : "", className].filter(Boolean).join(" ");
  return `<svg class="${escapeAttr(classes)}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeAttr(label)}" style="color:var(--accent)">
    <polyline points="${path}" fill="none" stroke="var(--accent)" stroke-width="${compact ? 2 : 3}" stroke-linecap="round" stroke-linejoin="round"></polyline>
    ${coordinates.map(({ point, price, x, y }) => `<g data-price-history-point><title>${escapeHtml(pointTitle(point, price))}</title><circle cx="${round(x)}" cy="${round(y)}" r="${compact ? 2.5 : 4}" fill="var(--surface)" stroke="var(--accent)" stroke-width="2"></circle></g>`).join("")}
  </svg>`;
}

function pointTitle(point, price) {
  const date = formatHumanDate(point.createdAt?.slice(0, 10)) || point.snapshotId || "Saved check";
  return `${date}: $${money(price)}`;
}

function round(value) {
  return Math.round(value * 10) / 10;
}
