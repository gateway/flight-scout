import { addDays, dateRange } from "./dates.js";
import { DEFAULT_REFRESH_BUDGET } from "./refresh-budget.js";

// Detects when the uniquely cheapest complete date sits at a search-window boundary.
export function detectWindowEdgeSuggestion({
  departureWindow,
  pricesByDate,
  maxWindowDays = DEFAULT_REFRESH_BUDGET.maxWindowDays,
  addDays: requestedDays = 2
}) {
  const { start, end } = departureWindow ?? {};
  if (!start || !end) return null;
  const windowDates = safeDateRange(start, end);
  if (!windowDates || windowDates.length >= maxWindowDays) return null;

  const prices = normalizePrices(pricesByDate);
  if (prices.length < 2) return null;
  prices.sort((left, right) => left.price - right.price || left.date.localeCompare(right.date));
  if (prices[0].price === prices[1].price) return null;

  const edge = prices[0];
  const direction = edge.date === start ? "earlier" : edge.date === end ? "later" : null;
  if (!direction) return null;

  const addCount = Math.min(Math.max(1, requestedDays), maxWindowDays - windowDates.length);
  const dates = Array.from({ length: addCount }, (_, index) => direction === "earlier"
    ? addDays(start, -(addCount - index))
    : addDays(end, index + 1));
  return {
    direction,
    addDays: addCount,
    edgeDate: edge.date,
    edgePrice: edge.price,
    runnerUpPrice: prices[1].price,
    dates
  };
}

function normalizePrices(pricesByDate) {
  const entries = pricesByDate instanceof Map
    ? [...pricesByDate.entries()]
    : Object.entries(pricesByDate ?? {});
  return entries.flatMap(([date, value]) => {
    const price = typeof value === "number" ? value : value?.price ?? value?.totalCost;
    return /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(price) ? [{ date, price }] : [];
  });
}

function safeDateRange(start, end) {
  try {
    const dates = dateRange(start, end);
    return dates.length && dates.length <= 366 ? dates : null;
  } catch {
    return null;
  }
}
