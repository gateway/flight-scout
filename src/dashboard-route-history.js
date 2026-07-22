import { renderPriceHistoryPanel, routeHistorySeries } from "./dashboard-price-history.js";

// Present compact route history without duplicating the existing two-snapshot
// comparison. This view answers longer-term questions: direction and lowest seen.
export function renderRoutePriceHistory(history) {
  return renderPriceHistoryPanel(routeHistorySeries(history), {
    className: "route-price-history",
    label: "Price Changes"
  });
}
