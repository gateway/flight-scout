import { escapeAttr, escapeHtml } from "./html-utils.js";
import { optionHeadline, renderCardHead } from "./dashboard-flight-components.js";
import { signal, signalizeText } from "./dashboard-signals.js";
import { movementCounts, renderMovementRead } from "./movement-summary.js";

// Refresh story explains what changed after the latest saved search without exposing debug counters first.
export function renderRefreshStory({ comparison, analysis, pages }) {
  const counts = movementCounts(comparison);
  const newLead = firstNewViableOption(comparison, analysis.options);
  const newHref = newLead?.routeIdeaId && pages?.routes?.href ? `${pages.routes.href}#${newLead.routeIdeaId}` : pages?.routes?.href;
  const cards = [
    `<div class="card best" id="latest-new-option">${newLead ? renderCardHead("New option worth opening", newLead) : `<div class="label">New option worth opening</div><div class="title">No better new lead</div>`}<p class="small">${newLead ? `${escapeHtml(optionHeadline(newLead))} is the strongest new result from this refresh. Open it if you want to see whether the ${signal("lower price", "good")} is worth the routing and connection risk.` : "The refresh found no new option that deserves special attention."}</p>${newHref ? `<a class="btn" href="${escapeAttr(newHref)}">See route options</a>` : ""}</div>`,
    `<div class="card"><div class="label">Since last refresh</div>${renderMovementRead(comparison)}<p class="small">${signalizeText(movementBody(counts))}</p></div>`
  ];
  return `<div class="grid">${cards.join("")}</div>`;
}

function movementBody(counts) {
  const pieces = [];
  if (counts.cheaper) pieces.push(`${counts.cheaper} known flights are cheaper`);
  if (counts.higher) pieces.push(`${counts.higher} are higher`);
  if (counts.newOptions) pieces.push(`${counts.newOptions} new options appeared`);
  if (counts.disappeared) pieces.push(`${counts.disappeared} previous options disappeared`);
  if (pieces.length) return `${pieces.join(", ")} since the previous saved search.`;
  return `${counts.same} known flights did not move in price.`;
}

function firstNewViableOption(comparison, options) {
  const newSearchIds = new Set((comparison.changes ?? []).filter((change) => change.direction === "new").map((change) => change.searchId));
  const candidates = options.filter((option) => newSearchIds.has(option.searchId) && Number.isFinite(option.price));
  return minBy(candidates, (option) => option.price);
}

function minBy(items, score) {
  return items.reduce((best, item) => (score(item) < score(best) ? item : best), items[0] ?? null);
}
