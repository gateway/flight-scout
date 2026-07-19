import { escapeAttr } from "./html-utils.js";
import { renderFlightDetailPanel } from "./dashboard-flight-drawer.js";
import { flightGoogleFlightsUrl, hasFlightDetail } from "./dashboard-flight-option.js";

// Shared action controls keep drawer and Google Flights behavior identical on every card family.
export function flightActionLinks(option) {
  const actions = [flightDetailDrawer(option), flightIconLink(option)].filter(Boolean).join("");
  return actions ? `<span class="card-actions">${actions}</span>` : "";
}

export function flightIconLink(option) {
  // A composed round trip has two independent booking destinations. The drawer
  // labels both; a single external-link icon would silently open only one leg.
  if (option?.kind === "composed-round-trip") return "";
  const url = flightGoogleFlightsUrl(option);
  if (!url) return "";
  return `<a class="icon-link" target="_blank" rel="noopener" href="${escapeAttr(url)}" aria-label="Open in Google Flights" title="Open in Google Flights">↗</a>`;
}

export function flightDetailDrawer(option) {
  if (!hasFlightDetail(option)) return "";
  return `<details class="side-drawer card-detail-drawer"><summary class="icon-link" aria-label="Open flight detail" title="Open flight detail">☰</summary><div class="drawer-panel">${renderFlightDetailPanel(option, "Flight detail")}</div></details>`;
}
