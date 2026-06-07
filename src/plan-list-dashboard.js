import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { dashboardCss } from "./dashboard-styles.js";
import { dateOnly, escapeAttr, escapeHtml, formatDateTime, formatHumanDate, formatMinutes, money } from "./html-utils.js";
import { planDisplaySummary } from "./plan-display.js";
import { hasFlightDetail, optionDate, renderFlightDetailPanel } from "./dashboard-flight-components.js";
import { groupByRouteIdea } from "./dashboard-routes-page.js";
import { renderDrawerScript } from "./dashboard-shell.js";
import { metricSignal, signalizeText } from "./dashboard-signals.js";
import { compareSnapshots } from "./snapshot-compare.js";
import { bestMovementText, movementMiniRows, renderMovementRead } from "./movement-summary.js";
import { coverageText, dateWindowDays } from "./plan-list-coverage.js";
import { renderCrossPlanSummary } from "./plan-list-cross-plan.js";

// Renders the root plans dashboard from saved plan metadata and latest snapshots.
// This is the user's entry point, so it favors skim-friendly summaries over deep details.

export async function writePlanListDashboard({ root = process.cwd(), outputPath }) {
  const plans = await loadSavedPlans(root);
  const html = renderPlanList(plans, { archivedHref: "plans.archived.html" });
  const archiveHtml = renderArchivedPlanList(plans, { activeHref: "plans.dashboard.html" });
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, html);
  await writeFile(path.join(path.dirname(outputPath), "index.html"), html);
  await writeFile(path.join(path.dirname(outputPath), "plans.archived.html"), archiveHtml);
  return outputPath;
}

export async function writeAppIndex({ root = process.cwd(), outputPath, dashboardPrefix = "outputs/" }) {
  const plans = await loadSavedPlans(root);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, renderPlanList(plans, { dashboardPrefix, archivedHref: `${dashboardPrefix}plans.archived.html` }));
  await mkdir(path.join(path.dirname(outputPath), dashboardPrefix), { recursive: true });
  await writeFile(
    path.join(path.dirname(outputPath), dashboardPrefix, "plans.archived.html"),
    renderArchivedPlanList(plans, { activeHref: "/", dashboardPrefix: "" })
  );
  return outputPath;
}

async function loadSavedPlans(root) {
  const plansDir = path.join(root, "plans");
  const plans = [];
  if (!existsSync(plansDir)) return plans;
  for (const entry of await readdir(plansDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const planPath = path.join(plansDir, entry.name, "plan.json");
    const latestPath = path.join(plansDir, entry.name, "latest-snapshot.json");
    if (!existsSync(planPath)) continue;
    const plan = JSON.parse(await readFile(planPath, "utf8"));
    const latest = existsSync(latestPath) ? await loadLatestSnapshot(latestPath) : null;
    const previous = await loadPreviousSnapshot(path.join(plansDir, entry.name), latest?.id);
    plans.push({
      plan,
      latest,
      previous,
      comparison: compareSnapshots(latest, previous),
      dashboardHref: `${plan.id}.dashboard.html`,
      planPath: `plans/${entry.name}/plan.json`,
      status: planStatus(plan)
    });
  }
  return plans.sort((a, b) => a.plan.name.localeCompare(b.plan.name));
}

async function loadLatestSnapshot(latestPath) {
  const latest = JSON.parse(await readFile(latestPath, "utf8"));
  const localRankedPath = path.join(path.dirname(latestPath), "ranked.json");
  const rankedPath = latest.snapshotDir ? path.join(latest.snapshotDir, "ranked.json") : localRankedPath;
  if (rankedPath && existsSync(rankedPath)) {
    latest.rankedFlights = JSON.parse(await readFile(rankedPath, "utf8"));
  }
  return latest;
}

async function loadPreviousSnapshot(planDir, latestId) {
  const snapshotsDir = path.join(planDir, "snapshots");
  if (!existsSync(snapshotsDir)) return null;
  const ids = (await readdir(snapshotsDir, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((id) => id !== latestId)
    .sort()
    .reverse();
  for (const id of ids) {
    const snapshotPath = path.join(snapshotsDir, id, "snapshot.json");
    if (existsSync(snapshotPath)) return loadLatestSnapshot(snapshotPath);
  }
  return null;
}

function renderPlanList(plans, { dashboardPrefix = "", archivedHref = "plans.archived.html" } = {}) {
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
<h2>Active Plans</h2>
<div class="grid">${active.map((item) => renderPlanCard(item, dashboardPrefix)).join("")}</div>
</section>
${renderCrossPlanSummary(active, dashboardPrefix)}
${renderOverview(active, dashboardPrefix)}
${renderDrawerScript()}
${renderPlanListScript()}
</main></body></html>`;
}

function renderArchivedPlanList(plans, { dashboardPrefix = "", activeHref = "plans.dashboard.html" } = {}) {
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
</main></body></html>`;
}

function renderOverview(activePlans, dashboardPrefix) {
  if (!activePlans.length) {
    return `<section id="overview"><h2>Overview</h2><p class="sub">No active plans right now. Archived or past-date plans stay available below.</p></section>`;
  }
  return `<section id="overview">
    <h2>Overview</h2>
    <div class="overview-stack">${activePlans.map((item) => renderPlanOverview(item, dashboardPrefix)).join("")}</div>
  </section>`;
}

function renderPlanCard({ plan, latest, dashboardHref, planPath, status }, dashboardPrefix) {
  return `<div class="card plan-card">
  <div class="plan-card-head">
    <div>
      <div class="label">Plan</div>
      <div class="title">${escapeHtml(plan.name)}</div>
    </div>
    ${planIconLink(`${dashboardPrefix}${dashboardHref}`, "Open dashboard", "▦")}
  </div>
  <p class="small">${escapeHtml(planDisplaySummary(plan))}</p>
  <div class="meta">
    <span class="pill ${status.active ? "good" : "warn"}">${escapeHtml(status.label)}</span>
    <span class="pill">${escapeHtml(dateWindowText(plan))}</span>
    <span class="pill">${escapeHtml(latestRefreshText(latest))}</span>
    <span class="pill">${escapeHtml(coverageText(plan, latest))}</span>
    <span class="pill">${latest ? `${latest.summary?.completeOptions ?? 0} complete options` : "no snapshot"}</span>
  </div>
  ${renderArchiveControl(planPath, status)}
</div>`;
}

function renderArchiveControl(planPath, status) {
  const label = status.active ? "Archive this plan" : "Restore this plan";
  const icon = status.active ? "&#128465;" : "↺";
  return `<div class="plan-card-action">
    <button class="plan-action-icon plan-archive-btn" type="button" data-plan-path="${escapeAttr(planPath)}" data-plan-archive-action="${status.active ? "archive" : "restore"}" data-idle-icon="${escapeAttr(icon)}" aria-label="${escapeAttr(label)}"><span aria-hidden="true">${icon}</span></button>
  </div>`;
}

function renderPlanListScript() {
  return `<script>
document.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-plan-archive-action]");
  if (!button) return;
  const planPath = button.dataset.planPath;
  const action = button.dataset.planArchiveAction;
  const idleIcon = button.dataset.idleIcon;
  button.disabled = true;
  button.textContent = "…";
  try {
    const response = await fetch("/api/plans/archive", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ planPath, restore: action === "restore" })
    });
    if (!response.ok) throw new Error(await response.text());
    window.location.href = action === "restore" ? "/#active-plans" : "/#active-plans";
    window.location.reload();
  } catch (error) {
    button.disabled = false;
    button.innerHTML = '<span aria-hidden="true">' + idleIcon + '</span>';
    alert("This button needs the local flight app server. Use the command fallback, or start it with npm run serve.");
  }
});
</script>`;
}

function renderPlanOverview({ plan, latest, dashboardHref, comparison }, dashboardPrefix) {
  const decisionHref = `${dashboardPrefix}${dashboardHref}`;
  const datesHref = `${dashboardPrefix}${pageHref(plan.id, "dates")}`;
  const routesHref = `${dashboardPrefix}${pageHref(plan.id, "routes")}`;
  return `<article class="flight-card plan-overview-card">
    <div class="card-head">
      <div>
        <div class="label">${escapeHtml(latestRefreshText(latest))}</div>
        <h3>${escapeHtml(plan.name)}</h3>
      </div>
      <div class="card-stat"><strong>${escapeHtml(bestPriceText(latest))}</strong><span>${escapeHtml(bestTimeText(latest))}</span></div>
    </div>
    <div class="overview-row">
      <div>
        <div class="label">Current read</div>
        <p>${currentReadHtml(latest)}</p>
      </div>
      ${planIconLink(decisionHref, "Open current read", "↗")}
    </div>
    <div class="overview-row">
      <div>
        <div class="label">Best decisions right now</div>
        ${renderDecisionMiniRows(latest)}
      </div>
      ${planIconLink(`${decisionHref}#best-current-choice`, "Compare picks", "◇")}
    </div>
    <div class="overview-row">
      <div>
        <div class="label">Since last refresh</div>
        ${renderMovementRead(comparison)}
        ${renderMovementMiniRows(comparison)}
      </div>
      ${planIconLink(`${decisionHref.replace(/\.dashboard\.html$/, ".refresh.html")}`, "Open refresh details", "↻")}
    </div>
    <div class="overview-row">
      <div>
        <div class="label">Route date scan</div>
        ${renderRouteDateMiniScans(plan, latest)}
      </div>
      <div class="overview-action-stack">
        ${planIconLink(datesHref, "Open date scan", "▥")}
        ${planIconLink(routesHref, "Open routes page", "☰")}
      </div>
    </div>
  </article>`;
}

function planIconLink(href, label, icon) {
  return `<a class="plan-action-icon" href="${escapeAttr(href)}" aria-label="${escapeAttr(label)}" title="${escapeAttr(label)}">${escapeHtml(icon)}</a>`;
}

function renderDecisionMiniRows(latest) {
  const summary = latest?.summary;
  const rows = [
    ["Best", summary?.balanced],
    ["Cheapest", summary?.cheapest],
    ["Fastest", summary?.fastest]
  ].filter(([, option]) => option);
  if (!rows.length) return `<p class="small">No decision data yet.</p>`;
  return `<div class="mini-list">${rows.map(([label, option]) => `<div class="mini-row"><span>${escapeHtml(label)}</span><strong>$${money(option.price ?? option.estimatedTotalCost)}</strong><em>${escapeHtml(option.duration ?? formatMinutes(option.durationMinutes) ?? "n/a")}</em><small>${escapeHtml(formatMiniDate(optionDate(option) ?? dateOnly(option.departureTime)) || "n/a")}</small></div>`).join("")}</div>`;
}

function renderMovementMiniRows(comparison) {
  const rows = movementMiniRows(comparison);
  if (!comparison?.available) return `<p class="small">First saved snapshot for this plan.</p>`;
  if (!rows.length) return `<p class="small">${escapeHtml(bestMovementText(comparison) || "Known prices look stable.")}</p>`;
  const footer = bestMovementText(comparison);
  return `<div class="movement-stat-line">${rows.map(([label, value, tone]) => `<span class="movement-${escapeAttr(tone)}">${escapeHtml(label)} <strong>${value}</strong></span>`).join("")}</div>${footer ? `<p class="small">${escapeHtml(footer)}</p>` : ""}`;
}

function renderRouteDateMiniScans(plan, latest) {
  const ranked = latest?.rankedFlights ?? [];
  if (!ranked.length) return `<p class="small">No date scan data yet.</p>`;
  const groups = groupByRouteIdea(plan, ranked);
  const rows = plan.routeIdeas
    .map((route) => renderRouteDateMiniScan(route, routeScanOptions(route, groups.get(route.id) ?? []), plan))
    .filter(Boolean);
  if (!rows.length) return `<p class="small">No complete route prices in this date window yet.</p>`;
  return `<div class="mini-route-scans">${rows.join("")}</div>`;
}

function routeScanOptions(route, options) {
  if (!route.stopover) return options;
  const composed = options.filter((option) => option.kind === "composed-stopover");
  return composed.length ? composed : options.filter((option) => option.tripComplete !== false && option.destinationComplete !== false);
}

function renderRouteDateMiniScan(route, options, plan) {
  const byDate = bestOptionsByDate(options);
  const dates = dateWindowDays(plan);
  const points = (dates.length ? dates : [...byDate.keys()].sort()).map((date) => ({ date, option: byDate.get(date) }));
  const prices = points.map((point) => point.option?.price ?? point.option?.totalCost).filter(Number.isFinite);
  if (!prices.length) return "";
  const low = Math.min(...prices);
  return `<div class="mini-route-scan">
    <div class="mini-route-title">${escapeHtml(route.label)}<span>highlight = lowest complete price</span></div>
    <div class="mini-date-scan">${points.map(({ date, option }) => {
    const price = option?.price ?? option?.totalCost;
    const isBest = Number.isFinite(price) && price === low;
    const content = `
      <span>${escapeHtml(formatMiniDate(date))}</span>
      <strong>${Number.isFinite(price) ? `$${money(price)}` : "n/a"}</strong>
      <em>${escapeHtml(formatMinutes(option?.durationMinutes) ?? option?.duration ?? "")}</em>`;
    if (hasFlightDetail(option)) {
      const title = `${route.label} ${formatHumanDate(date)}: $${money(price)}, ${formatMinutes(option.durationMinutes) ?? option.duration ?? ""}`;
      return `<details class="side-drawer mini-date-drawer">
        <summary class="mini-date-point ${isBest ? "best" : ""}" title="${escapeAttr(title)}">${content}</summary>
        <div class="drawer-panel">${renderFlightDetailPanel(option, "Flight detail")}</div>
      </details>`;
    }
    return `<div class="mini-date-point ${isBest ? "best" : ""}">${content}</div>`;
  }).join("")}</div>
  </div>`;
}

function currentReadText(latest) {
  const balanced = latest?.summary?.balanced;
  const cheapest = latest?.summary?.cheapest;
  if (!balanced) return "No scan data yet. Run a refresh when you are ready to check this plan.";
  const base = `${balanced.departureAirport ?? "?"} -> ${balanced.arrivalAirport ?? "?"} on ${formatHumanDate(dateOnly(balanced.departureTime)) || "the selected date"} is the current clean starting point at $${money(balanced.price ?? balanced.estimatedTotalCost)} and ${balanced.duration ?? formatMinutes(balanced.durationMinutes) ?? "unknown time"}.`;
  if (cheapest && cheapest.searchId !== balanced.searchId) return `${base} The cheapest known option is $${money(cheapest.price ?? cheapest.estimatedTotalCost)}, so check whether that tradeoff is worth it.`;
  return base;
}

function currentReadHtml(latest) {
  const balanced = latest?.summary?.balanced;
  const cheapest = latest?.summary?.cheapest;
  if (!balanced) return signalizeText(currentReadText(latest));
  const route = `${balanced.departureAirport ?? "?"} -> ${balanced.arrivalAirport ?? "?"}`;
  const date = formatHumanDate(dateOnly(balanced.departureTime)) || "the selected date";
  const price = `$${money(balanced.price ?? balanced.estimatedTotalCost)}`;
  const time = balanced.duration ?? formatMinutes(balanced.durationMinutes) ?? "unknown time";
  const base = `${escapeHtml(route)} on ${metricSignal(date, "info")} is the current clean starting point at ${metricSignal(price, "info")} and ${metricSignal(time, "info")}.`;
  if (cheapest && cheapest.searchId !== balanced.searchId) {
    return `${base} The cheapest known option is ${metricSignal(`$${money(cheapest.price ?? cheapest.estimatedTotalCost)}`, "good")}, so check whether that tradeoff is worth it.`;
  }
  return base;
}

function planStatus(plan) {
  if (plan.archived || plan.status === "archived" || plan.hidden) return { active: false, label: "Archived" };
  const end = plan.intent?.dateCoverage?.end;
  if (end && end < todayDate()) return { active: false, label: "Past date" };
  return { active: true, label: "Active" };
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function dateWindowText(plan) {
  const coverage = plan.intent?.dateCoverage;
  if (!coverage?.start || !coverage?.end) return "date window not set";
  return `${coverage.start} to ${coverage.end}`;
}

function bestOptionsByDate(options) {
  const byDate = new Map();
  for (const option of options) {
    const date = optionDate(option) ?? dateOnly(option.departureTime);
    const price = option.price ?? option.totalCost;
    if (!date || !Number.isFinite(price) || !Number.isFinite(option.durationMinutes)) continue;
    const current = byDate.get(date);
    if (!current || optionScore(option) < optionScore(current)) byDate.set(date, option);
  }
  return byDate;
}

function optionScore(option) {
  return Number.isFinite(option.humanScore) ? option.humanScore : (option.price ?? option.totalCost ?? 999999) + ((option.durationMinutes ?? 0) / 20);
}

function formatMiniDate(value) {
  if (!value) return "";
  const [, month, day] = String(value).slice(0, 10).split("-");
  return month && day ? `${Number(month)}/${Number(day)}` : String(value);
}

function latestRefreshText(latest) {
  return latest?.createdAt ? `Last refreshed ${formatDateTime(latest.createdAt)}` : "Not refreshed yet";
}

function bestPriceText(latest) {
  const best = latest?.summary?.balanced;
  return best ? `$${money(best.price ?? best.estimatedTotalCost)}` : "n/a";
}

function bestTimeText(latest) {
  const best = latest?.summary?.balanced;
  return best?.duration ?? formatMinutes(best?.durationMinutes) ?? "no data";
}

function pageHref(planId, page) {
  return `${planId}.${page}.html`;
}

function minBy(items, score) {
  return items.reduce((best, item) => (score(item) < score(best) ? item : best), items[0] ?? null);
}
