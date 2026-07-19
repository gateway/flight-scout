import { dashboardCss } from "./dashboard-styles.js";
import { escapeAttr } from "./html-utils.js";
import { renderDrawerScript } from "./dashboard-shell.js";
import { renderCrossPlanSummary } from "./plan-list-cross-plan.js";
import { renderRefreshAllButton, renderRefreshOverlay, renderRefreshScript } from "./browser-refresh-controls.js";
import { renderPlanCard, renderPlanListScript } from "./plan-list-components.js";
import { renderOverview } from "./plan-list-overview.js";

// Composes complete plan-list documents from already-loaded view data.
export function renderPlanList(plans, { dashboardPrefix = "", archivedHref = "plans.archived.html", lowdownHref = "latest-refresh-lowdown.md", hasLowdown = false } = {}) {
  const active = plans.filter((item) => item.status.active);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Flight Plans</title>
<style>${dashboardCss()}</style>
</head>
<body><main>
<nav class="top-nav">
  <a class="nav-link primary" href="#active-plans">Active plans</a>
  <a class="nav-link" href="${escapeAttr(archivedHref)}">Archived plans</a>
</nav>
<div class="eyebrow">Flight research</div>
<h1>Plans</h1>
<section id="active-plans">
<div class="section-head">
  <h2>Active Plans</h2>
  <div class="section-actions">${hasLowdown ? `<a class="btn" href="${escapeAttr(lowdownHref)}">Latest lowdown</a>` : ""}${renderRefreshAllButton(active.length)}</div>
</div>
<div class="grid">${active.map((item) => renderPlanCard(item, dashboardPrefix)).join("")}</div>
</section>
${renderCrossPlanSummary(active, dashboardPrefix)}
${renderOverview(active, dashboardPrefix)}
${renderDrawerScript()}
${renderPlanListScript()}
${renderRefreshOverlay()}
${renderRefreshScript()}
</main></body></html>`;
}

export function renderArchivedPlanList(plans, { dashboardPrefix = "", activeHref = "plans.dashboard.html" } = {}) {
  const archived = plans.filter((item) => !item.status.active);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Archived Flight Plans</title>
<style>${dashboardCss()}</style>
</head>
<body><main>
<nav class="top-nav">
  <a class="nav-link" href="${escapeAttr(activeHref)}">Active plans</a>
  <a class="nav-link primary" href="#archived-plans">Archived plans</a>
</nav>
<div class="eyebrow">Flight research</div>
<h1>Archived Plans</h1>
<section id="archived-plans">
${archived.length
    ? `<div class="grid">${archived.map((item) => renderPlanCard(item, dashboardPrefix)).join("")}</div>`
    : `<p class="sub">No archived plans right now.</p>`}
</section>
${renderPlanListScript()}
${renderRefreshOverlay()}
${renderRefreshScript()}
</main></body></html>`;
}
