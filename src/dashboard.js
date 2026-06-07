import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { compareSnapshots } from "./snapshot-compare.js";
import { analyzeDecision, worthIt } from "./decision-analysis.js";
import { escapeAttr, escapeHtml, formatDateTime, money } from "./html-utils.js";
import { renderPageShell } from "./dashboard-shell.js";
import { createPageRenderers } from "./dashboard-pages.js";
import { bestChoiceSentence, connectionPill, optionDate, renderAssumptions, renderCardHead, renderPainBreakdown } from "./dashboard-flight-components.js";
import { signalizeText } from "./dashboard-signals.js";
import { renderBudgetOpportunity, budgetAlternateStartOpportunity } from "./dashboard-budget.js";
import { renderDateHighlights, renderPriceGraph, renderDateOpportunities } from "./dashboard-date-page.js";
import { groupByRouteIdea, renderRoute } from "./dashboard-routes-page.js";
import { renderRefreshStory } from "./dashboard-refresh-story.js";

export async function writePlanDashboard({ plan, planDir, trip = null, snapshots = [], refreshPlan = null, outputPath }) {
  const [current, previous] = snapshots;
  const comparison = compareSnapshots(current, previous);
  const ranked = current?.rankedFlights ?? [];
  const routeGroups = groupByRouteIdea(plan, ranked);
  const analysis = analyzeDecision({ plan, trip, routeGroups, current, refreshPlan });
  analysis.snapshotHistory = snapshots.map((snapshot) => snapshot.meta);
  const pages = planPagePaths(plan, outputPath);
  const context = { plan, current, comparison, routeGroups, analysis, refreshPlan, trip, pages };
  const html = render(context, "decision");
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, html);
  await writeFile(pages.dates.path, render(context, "dates"));
  await writeFile(pages.routes.path, render(context, "routes"));
  await writeFile(pages.refresh.path, render(context, "refresh"));
  await writeFile(path.join(planDir, "latest-dashboard.html"), html);
  return outputPath;
}

function planPagePaths(plan, outputPath) {
  const dir = path.dirname(outputPath);
  const basename = path.basename(outputPath);
  const stem = basename.endsWith(".dashboard.html") ? basename.slice(0, -".dashboard.html".length) : basename.replace(/\.html$/i, "");
  const pageFile = (suffix) => suffix === "dashboard" ? basename : `${stem}.${suffix}.html`;
  return {
    decision: { path: outputPath, href: pageFile("dashboard"), label: "Decision + Budget" },
    dates: { path: path.join(dir, pageFile("dates")), href: pageFile("dates"), label: "Date Compare" },
    routes: { path: path.join(dir, pageFile("routes")), href: pageFile("routes"), label: "Routes" },
    refresh: { path: path.join(dir, pageFile("refresh")), href: pageFile("refresh"), label: "Refresh" }
  };
}

function render(context, page) {
  const body = createPageRenderers({
    renderDecisionSummary,
    renderBudgetOpportunity,
    renderRefreshStory,
    renderDateHighlights,
    renderPriceGraph,
    renderDateOpportunities,
    groupAnalyzedOptions,
    renderRoute,
    renderRefreshGuidance,
    renderMovementSummary,
    renderSnapshotHistory,
    renderRefreshCallDetail,
    budgetAlternateStartOpportunity
  })[page](context);
  return renderPageShell(context, page, body);
}

function renderMovementSummary(comparison) {
  const lines = comparison.humanSummary ?? [];
  if (!lines.length) return "";
  return `<div class="row refresh-guidance">
    <div class="label">What changed</div>
    ${lines.map((line) => `<p class="small">${signalizeText(line)}</p>`).join("")}
  </div>`;
}

function renderSnapshotHistory(history) {
  if (!history.length) return "";
  return `<details class="row" style="margin-top:12px" open>
    <summary>Refresh history</summary>
    <div class="history-list">${history.map((item) => `<div class="history-item">
      <strong>${escapeHtml(formatDateTime(item.createdAt))}</strong>
      <div class="small">${escapeHtml(item.source ?? "snapshot")} · ${escapeHtml(item.refresh?.mode ?? "import")} · ${item.refresh?.fliCallCount ?? item.refresh?.liveCallCount ?? 0} selected FLI searches · ${item.refresh?.cacheHitCount ?? 0} cache hits</div>
      <div class="small">${item.summary?.completeOptions ?? 0} complete options from ${item.summary?.totalOptions ?? 0} total. <a href="${escapeAttr(snapshotHref(item))}">Open snapshot</a></div>
    </div>`).join("")}</div>
  </details>`;
}

function renderRefreshCallDetail(refreshPlan) {
  return `<div class="history-list">${(refreshPlan.calls ?? []).map((call) => `<div class="history-item">
    <strong>${escapeHtml(call.id)}</strong>
    <div class="small">${escapeHtml(call.cache.status)} · ${escapeHtml((call.refreshReasons ?? []).join(", ") || "refresh candidate")}</div>
  </div>`).join("")}</div>`;
}

function snapshotHref(item) {
  return `../plans/${item.planId}/snapshots/${item.id}/snapshot.json`;
}

function renderDecisionSummary(analysis) {
  if (!analysis.best) {
    return `<div class="flight-card decision-lead"><div class="label">No ranked options yet</div><p>Run or import route data before this dashboard can recommend a practical trip.</p></div>`;
  }
  const cards = [
    renderDecisionLead(analysis.best, analysis.dateCoverage),
    renderTradeoffCard("Lowest price", analysis.cheapest, analysis.best),
    renderTradeoffCard("Shortest travel time", analysis.fastest, analysis.best),
    analysis.stopover ? renderTradeoffCard("Best stopover", analysis.stopover, analysis.best) : ""
  ];
  return `<div class="decision-stack">${cards.filter(Boolean).join("")}</div>`;
}

function renderDecisionLead(option, coverage) {
  return `<article class="flight-card decision-lead" id="best-current-choice">
    ${renderCardHead("Best current choice", option)}
    <p>${escapeHtml(bestChoiceSentence(option))}</p>
    <div class="meta">
      <span class="pill">${escapeHtml(optionDate(option) ?? "")}</span>
      ${connectionPill(option)}
      ${coverage ? `<span class="pill">${escapeHtml(coverage)}</span>` : ""}
    </div>
    ${renderPainBreakdown(option)}
    ${renderAssumptions(option)}
  </article>`;
}

function renderTradeoffCard(label, option, best) {
  if (!option) return "";
  const tradeoff = worthIt(option, best);
  const contextLabel = tradeoffContextLabel(tradeoff);
  return `<article class="flight-card decision-card">
    ${renderCardHead(label, option)}
    <p>${signalizeText(tradeoff?.sentence ?? "Comparable to the current best-balanced option.")}</p>
    <div class="meta">
      ${connectionPill(option)}
      ${contextLabel ? `<span class="pill">${escapeHtml(contextLabel)}</span>` : ""}
    </div>
    ${renderPainBreakdown(option)}
    ${renderAssumptions(option)}
  </article>`;
}

function tradeoffContextLabel(tradeoff) {
  if (!tradeoff) return "";
  if (tradeoff.type === "cheaper") return "Lower price, similar travel time";
  if (tradeoff.type === "faster") return "Faster without extra cost";
  if (tradeoff.type === "cheaper-but-longer") return "Cheaper, but more travel time";
  if (tradeoff.type === "faster-but-costlier") return "Faster, but costs more";
  if (tradeoff.type === "same") return "Same value";
  return "Worse tradeoff";
}

function renderRefreshGuidance(analysis, refreshPlan) {
  if (!refreshPlan || !analysis.refreshGuidance.length) return "";
  return `<div class="row refresh-guidance">
    <div class="label">Refresh guidance</div>
    <p class="small">Refresh only the searches most likely to change the decision.</p>
    <div class="meta">${analysis.refreshGuidance.map((item) => `<span class="pill">${escapeHtml(item.reason)}: ${escapeHtml(refreshStatusText(item))}</span>`).join("")}</div>
  </div>`;
}

function refreshStatusText(item) {
  if (item.cacheStatus === "unknown") return "not in current refresh plan";
  return item.cacheStatus;
}

function groupAnalyzedOptions(options) {
  const groups = new Map();
  for (const option of options) {
    groups.set(option.routeIdeaId, [...(groups.get(option.routeIdeaId) ?? []), option]);
  }
  return groups;
}
