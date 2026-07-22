import { escapeAttr, escapeHtml } from "./html-utils.js";
import { optionHeadline, renderAssumptions, renderCardHead } from "./dashboard-flight-components.js";
import { signal } from "./dashboard-signals.js";
import { minBy } from "./collections.js";

// Refresh story explains what changed after the latest saved search without exposing debug counters first.
export function renderRefreshStory({ comparison, analysis, pages }) {
  const newLead = firstNewViableOption(comparison, analysis.options);
  const newHref = newLead?.routeIdeaId && pages?.routes?.href ? `${pages.routes.href}#${newLead.routeIdeaId}` : pages?.routes?.href;
  const cards = [
    `<div class="card best" id="latest-new-option">${newLead ? renderCardHead("New option worth opening", newLead) : `<div class="label">New option worth opening</div><div class="title">No better new lead</div>`}<p class="small">${newLead ? `${escapeHtml(optionHeadline(newLead))} is the strongest new result from this refresh. Open it if you want to see whether the ${signal("lower price", "good")} is worth the routing and connection risk.` : "The refresh found no new option that deserves special attention."}</p>${newLead ? renderAssumptions(newLead) : ""}${newHref ? `<a class="btn" href="${escapeAttr(newHref)}">See route options</a>` : ""}</div>`
  ];
  return `<div class="grid">${cards.join("")}</div>`;
}

function firstNewViableOption(comparison, options) {
  const newSearchIds = new Set((comparison.changes ?? []).filter((change) => change.direction === "new").map((change) => change.searchId));
  const candidates = options.filter((option) => newSearchIds.has(option.searchId) && Number.isFinite(option.price));
  return minBy(candidates, (option) => option.price);
}
