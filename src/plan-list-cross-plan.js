import { connectionPill, optionDate, renderAssumptions } from "./dashboard-flight-components.js";
import { metricSignal } from "./dashboard-signals.js";
import { dateOnly, escapeAttr, escapeHtml, formatHumanDate, formatMinutes, money } from "./html-utils.js";
import { airlineDisplay } from "./airline-display.js";
import { renderMovementRead } from "./movement-summary.js";
import { coverageText } from "./plan-list-coverage.js";

export function renderCrossPlanSummary(activePlans, dashboardPrefix) {
  const picks = crossPlanPicks(activePlans);
  if (!picks.length) return `<section id="best-across-plans"><h2>Best Across Plans</h2><p class="sub">No scanned plan data yet.</p></section>`;
  return `<section id="best-across-plans">
    <h2>Best Across Plans</h2>
    <div class="decision-stack cross-plan-stack">${picks.map((pick) => renderCrossPlanPick(pick, dashboardPrefix)).join("")}</div>
  </section>`;
}

function crossPlanPicks(activePlans) {
  const byPlan = [];
  for (const item of activePlans) {
    const summary = item.decision ?? {};
    const options = [];
    for (const [kind, option] of [["Best balance", summary.best], ["Lowest price", summary.cheapest], ["Shortest travel time", summary.fastest]]) {
      if (!option) continue;
      options.push({ kind, option, item, key: optionKey(option) });
    }
    const bestForPlan = options.sort((a, b) => crossPlanScore(a) - crossPlanScore(b))[0];
    if (bestForPlan) byPlan.push(bestForPlan);
  }
  return byPlan.sort((a, b) => crossPlanScore(a) - crossPlanScore(b)).slice(0, 3);
}

function renderCrossPlanPick({ kind, option, item }, dashboardPrefix) {
  const price = option.price ?? option.estimatedTotalCost;
  const duration = option.duration ?? formatMinutes(option.durationMinutes) ?? "n/a";
  const date = optionDate(option) ?? dateOnly(option.departureTime);
  const dashboardHref = `${dashboardPrefix}${item.dashboardHref}`;
  return `<article class="flight-card decision-card cross-plan-card">
    <div class="card-head">
      <div>
        <div class="label">${escapeHtml(kind)}</div>
        <h3>${escapeHtml(item.plan.name)}</h3>
        <div class="route-line">${escapeHtml(optionRouteText(option))}</div>
      </div>
      <div class="card-stat"><strong>$${money(price)}</strong><span>${escapeHtml(duration)}</span></div>
    </div>
    <p>${escapeHtml(crossPlanWhy(kind, option, item))}</p>
    <div class="meta">
      <span>${metricSignal(formatHumanDate(date) || date || "date n/a", "info")}</span>
      <span>${connectionSignal(option)}</span>
      <span>${coverageSignal(item)}</span>
    </div>
    ${renderAssumptions(option)}
    <div class="cross-plan-action-row">
      <div class="meta cross-plan-movement">
        ${renderMovementRead(item.comparison)}
      </div>
      <div class="overview-action-stack">
        ${planIconLink(`${dashboardHref}#best-current-choice`, "Open plan decision", "↗")}
        ${planIconLink(`${dashboardPrefix}${item.plan.id}.dates.html`, "Open date compare", "▥")}
      </div>
    </div>
  </article>`;
}

function optionKey(option) {
  return [
    option.searchId ?? "",
    option.departureTime ?? "",
    option.airline ?? "",
    option.departureAirport ?? "",
    option.arrivalAirport ?? ""
  ].join("::");
}

function crossPlanScore({ kind, option }) {
  const price = option.price ?? option.estimatedTotalCost ?? 999999;
  const duration = option.durationMinutes ?? 999999;
  const kindPenalty = kind === "Best balance" ? 0 : kind === "Lowest price" ? 30 : 60;
  return price + duration / 18 + kindPenalty;
}

function optionRouteText(option) {
  const route = `${option.departureAirport ?? "?"} -> ${option.arrivalAirport ?? "?"}`;
  const display = airlineDisplay(option);
  const airline = display ? ` · ${display}` : "";
  return `${route}${airline}`;
}

function crossPlanWhy(kind, option, item) {
  const price = `$${money(option.price ?? option.estimatedTotalCost)}`;
  const duration = option.duration ?? formatMinutes(option.durationMinutes) ?? "unknown time";
  const date = formatHumanDate(optionDate(option) ?? dateOnly(option.departureTime)) || "the selected date";
  if (kind === "Lowest price") return `${price} on ${date}. This is the cheapest known option in ${item.plan.name}, so compare the savings against timing and connection risk.`;
  if (kind === "Shortest travel time") return `${duration} on ${date}. This is the fastest known option in ${item.plan.name}, so check whether the higher fare or tighter routing is worth it.`;
  return `${price} and ${duration} on ${date}. This is the cleanest current balance for ${item.plan.name}.`;
}

function connectionSignal(option) {
  if (option.connectionRisk) return connectionPill(option.connectionRisk);
  if (option.stops === 0) return metricSignal("nonstop", "good");
  return metricSignal(`${option.stops ?? "some"} stop${option.stops === 1 ? "" : "s"}`, "info");
}

function coverageSignal(item) {
  const text = coverageText(item.plan, item.latest);
  if (text.startsWith("all ")) return metricSignal(text, "good");
  if (text.includes("/")) return metricSignal(text, "warn");
  return metricSignal(text, "info");
}

function planIconLink(href, label, icon) {
  return `<a class="plan-action-icon" href="${escapeAttr(href)}" aria-label="${escapeAttr(label)}" title="${escapeAttr(label)}">${escapeHtml(icon)}</a>`;
}
