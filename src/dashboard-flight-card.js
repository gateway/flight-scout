import { escapeHtml, formatMinutes, money } from "./html-utils.js";
import { flightActionLinks } from "./dashboard-flight-actions.js";
import { cleanTitlePart, optionRouteLine } from "./dashboard-flight-option.js";

// Card-head composition stays separate from drawer internals so all page cards share one layout contract.
export function renderCardHead(label, option, options = {}) {
  return `<div class="card-head">
    <div>
      <div class="label">${escapeHtml(label)}</div>
      ${renderOptionTitle(option, options)}
    </div>
    <div class="card-stat"><strong>$${money(option.price ?? option.totalCost)}</strong><span>${escapeHtml(formatMinutes(option.durationMinutes) ?? option.duration ?? "")}</span>${flightActionLinks(option)}</div>
  </div>`;
}

function renderOptionTitle(option, { hideRouteLabel = false } = {}) {
  const label = cleanTitlePart(option.routeIdeaLabel) ?? cleanTitlePart(option.searchTitle) ?? cleanTitlePart(option.title);
  const route = optionRouteLine(option);
  if (!label || hideRouteLabel) return `<h3>${escapeHtml(route)}</h3>`;
  return `<h3><span class="title-main">${escapeHtml(label)}</span><span class="title-route">${escapeHtml(route)}</span></h3>`;
}
