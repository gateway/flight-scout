import { escapeHtml, formatDateTime, formatHumanDate, formatMinutes, money } from "./html-utils.js";
import { airlineDisplay } from "./airline-display.js";
import { hasFlightDetail, humanOptionLine, renderFlightDetailPanel } from "./dashboard-flight-components.js";
import { refreshSpendSummaryText, renderRefreshDecisionCostCheck } from "./dashboard-refresh-ux.js";
import { metricSignal, signal } from "./dashboard-signals.js";

// Page-level renderers for the generated plan dashboard. Shared flight cards, drawers,
// signals, and shell styles live in dedicated modules to keep page assembly readable.

export function createPageRenderers(helpers) {
  const {
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
  } = helpers;

  function renderDecisionBudgetPage({ current, comparison, analysis, refreshPlan, trip, pages }) {
    const history = analysis.snapshotHistory ?? [];
    return `
    <section class="plan-read">
      <h2>Current Read</h2>
      ${renderPlanRead({ analysis, current, trip })}
    </section>
    <section>
      <h2>Best Decision Right Now</h2>
      ${renderDecisionSummary(analysis)}
    </section>
    ${renderBudgetOpportunity({ analysis, current, trip })}
    <section>
      <h2>Worth Checking From the Latest Search</h2>
      ${renderRefreshStory({ comparison, analysis, current, previous: history[1], pages })}
    </section>
    <section>
      <h2>Next Refresh</h2>
      <div class="grid">
        <div class="card"><div class="label">Next ${escapeHtml(refreshPlan?.mode ?? "light")} refresh</div><div class="title">${refreshPlan ? `${refreshPlan.selectedCallCount ?? refreshPlan.calls?.length ?? 0} selected searches` : "Refresh check not loaded"}</div><p class="small">${escapeHtml(refreshSpendSummaryText(refreshPlan))}</p></div>
        <div class="card"><div class="label">Last checked</div><div class="title">${current ? formatDateTime(current.meta.createdAt) : "No snapshot"}</div><p class="small">${current ? `${current.meta.refresh?.mode ?? "import"} run · ${current.meta.refresh?.fliCallCount ?? current.meta.refresh?.liveCallCount ?? 0} selected FLI searches. Previous: ${history[1] ? formatDateTime(history[1].createdAt) : "none"}.` : "Run or import a snapshot before using price movement."}</p></div>
      </div>
    </section>`;
  }

  function renderPlanRead({ analysis, current, trip }) {
    if (!analysis.best) {
      return `<div class="plan-read-panel"><div class="plan-read-line">No decision-ready flights are available yet. Run or import route data and this page will summarize the best current choices.</div></div>`;
    }
    const budget = budgetAlternateStartOpportunity({ analysis, current, trip });
    const best = analysis.best;
    const cheapest = analysis.cheapest && analysis.cheapest !== best ? analysis.cheapest : null;
    const fastest = analysis.fastest && analysis.fastest !== best ? analysis.fastest : null;
    const pieces = [];
    pieces.push(`<div class="plan-read-line">${bestChoiceRead(best, cheapest, trip)}</div>`);
    if (budget && budget.savingsVsBest > 0) {
      pieces.push(`<div class="plan-read-line">If saving money matters more than simplicity, the Bangkok-first path is the one to investigate. It comes out around ${metricSignal(`$${money(budget.total)}`, "good")} after the Bangkok flight and hotel estimate, roughly ${metricSignal(`$${money(budget.savingsVsBest)} less`, "good")} than the cleaner Chiang Mai-start choice.</div>`);
    }
    if (cheapest) {
      pieces.push(`<div class="plan-read-line">${cheapestRead(cheapest, best)}</div>`);
    }
    if (fastest) {
      pieces.push(`<div class="plan-read-line">The fastest option is ${readFlightDetailLink(fastest)} at ${metricSignal(formatMinutes(fastest.durationMinutes), "info")}, but I would only choose it if the higher price and connection timing feel acceptable.</div>`);
    }
    return `<div class="plan-read-panel">${pieces.slice(0, 3).join("")}</div>`;
  }

  function bestChoiceRead(best, cheapest, trip) {
    const label = optionDateLabel(best);
    const airline = airlineDisplay(best);
    const airlineText = airline ? `${escapeHtml(airline)} from ` : "";
    const route = airportRouteText(best);
    const budget = trip?.budget?.hardMax ? `, and comfortably under your <strong>$${money(trip.budget.hardMax)}</strong> target` : "";
    const nonstop = isNonstop(best) ? "nonstop, " : "";
    const cheapestNote = cheapest && cheapest !== best ? " It is not the absolute cheapest flight, but" : " It is the strongest starting point because";
    return `The cleanest option right now is ${readFlightDetailLink(best, label)}. ${airlineText}<strong>${route}</strong> for ${metricSignal(`$${money(best.price)}`, "info")}, taking about ${metricSignal(formatMinutes(best.durationMinutes), "info")}.${cheapestNote} it is ${nonstop}fast${budget}.`;
  }

  function cheapestRead(cheapest, best) {
    const label = optionDateLabel(cheapest);
    const airline = airlineDisplay(cheapest);
    const airlineText = airline ? `${escapeHtml(airline)} is ` : "This option is ";
    const priceDiff = Number.isFinite(best?.price) && Number.isFinite(cheapest.price) ? best.price - cheapest.price : null;
    const timeDiff = Number.isFinite(best?.durationMinutes) && Number.isFinite(cheapest.durationMinutes) ? cheapest.durationMinutes - best.durationMinutes : null;
    const savings = priceDiff > 0 ? ` It saves ${metricSignal(`$${money(priceDiff)}`, "good")}` : "";
    const extraTime = timeDiff > 0 ? ` and adds about ${metricSignal(proseDuration(timeDiff), "warn")}` : timeDiff === 0 ? " with the same travel time" : "";
    const tradeoff = savings || extraTime ? `${savings}${extraTime} versus the cleaner pick.` : " It is worth checking if the departure time works better for you.";
    return `If you want the lowest fare, also check ${readFlightDetailLink(cheapest, label)}. ${airlineText}${metricSignal(`$${money(cheapest.price)}`, "good")} and takes about ${metricSignal(formatMinutes(cheapest.durationMinutes), "info")}.${tradeoff}`;
  }

  function optionDateLabel(option) {
    const date = formatHumanDate(option.departureTime?.slice(0, 10));
    return date || humanOptionLine(option);
  }

  function isNonstop(option) {
    return (option.stops ?? option.layovers?.length ?? 0) === 0;
  }

  function airportRouteText(option) {
    const firstLeg = option.legs?.[0];
    const lastLeg = option.legs?.at(-1);
    const from = airportText(firstLeg?.departure_airport?.name, bestAirportCode(option.departureAirport, firstLeg?.departure_airport?.id));
    const to = airportText(lastLeg?.arrival_airport?.name, bestAirportCode(option.arrivalAirport, lastLeg?.arrival_airport?.id));
    return `${escapeHtml(from)} to ${escapeHtml(to)}`;
  }

  function airportText(name, code) {
    if (!name && !code) return "?";
    if (!name) return code;
    return code ? `${name} (${code})` : name;
  }

  function bestAirportCode(primary, fallback) {
    return primary ?? fallback ?? null;
  }

  function proseDuration(minutes) {
    if (!Number.isFinite(minutes)) return "a little more time";
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
    return formatMinutes(minutes);
  }

  function readFlightDetailLink(option, text = null) {
    const label = escapeHtml(text ?? humanOptionLine(option));
    if (!hasFlightDetail(option)) return `<strong>${label}</strong>`;
    return `<details class="side-drawer inline-read-drawer"><summary><strong>${label}</strong></summary><div class="drawer-panel">${renderFlightDetailPanel(option, "Flight detail")}</div></details>`;
  }

  function renderDatesPage({ plan, current, comparison, analysis }) {
    return `
    <section>
      <h2>Best Dates To Consider</h2>
      ${renderDateHighlights(analysis)}
    </section>
    <section>
      <h2>Route Price Scan</h2>
      <p class="sub">Each row compares one route idea across the searched date window. Lower bars are cheaper; the highlighted bar is the cheapest route-specific date currently found for that route.</p>
      ${renderPriceGraph(plan, analysis)}
    </section>
    <section>
      <h2>Best Option On Each Date</h2>
      <p class="sub">Use this when your departure day matters. Each card shows the best complete option for that date, then compares it against the best flexible-date choice.</p>
      ${renderDateOpportunities(analysis)}
    </section>`;
  }

  function renderRoutesPage({ plan, analysis, refreshPlan }) {
    const analyzedRouteGroups = groupAnalyzedOptions(analysis.options);
    return `
    <section>
      <h2>Route Evidence</h2>
      ${plan.routeIdeas.map((route, index) => renderRoute(route, analyzedRouteGroups.get(route.id) ?? [], refreshPlan, index === 0, plan.routeIdeas.length === 1)).join("")}
    </section>`;
  }

  function renderRefreshPage({ current, comparison, analysis, refreshPlan }) {
    const history = analysis.snapshotHistory ?? [];
    return `
    <section>
      <h2>Refresh Status</h2>
      <div class="grid">
        <div class="card"><div class="label">Latest snapshot</div><div class="title">${current ? formatDateTime(current.meta.createdAt) : "None yet"}</div><p class="small">${current ? `${current.meta.summary.completeOptions} complete options from ${current.meta.summary.totalOptions} total ranked results.` : "Run or import a snapshot before using price movement."}</p></div>
        <div class="card"><div class="label">Next ${escapeHtml(refreshPlan?.mode ?? "light")} refresh</div><div class="title">${refreshPlan ? `${refreshPlan.selectedCallCount ?? refreshPlan.calls?.length ?? 0} selected searches` : "Refresh check not loaded"}</div><p class="small">${escapeHtml(refreshSpendSummaryText(refreshPlan))}</p></div>
        <div class="card"><div class="label">Price movement</div><div class="title">${escapeHtml(comparison.summary)}</div><p class="small">Movement is based on matched flights across saved snapshots, so it is strongest after a refresh of the same route searches.</p></div>
        <div class="card"><div class="label">Refresh workflow</div><div class="title">Manual refresh check</div><p class="small">This static dashboard never calls providers on page load. Run the refresh command to fetch prices; the CLI reuses fresh cache, waits between calls, and writes a new snapshot for this page.</p></div>
      </div>
      ${renderRefreshDecisionCostCheck(refreshPlan)}
      ${renderRefreshGuidance(analysis, refreshPlan)}
      ${renderMovementSummary(comparison)}
      ${renderSnapshotHistory(history)}
      ${refreshPlan ? `<details class="row" style="margin-top:12px"><summary>Refresh call detail</summary>${renderRefreshCallDetail(refreshPlan)}${refreshPlan.skippedCalls?.length ? `<p class="small">${refreshPlan.skippedCalls.length} searches skipped by refresh mode cap.</p>` : ""}</details>` : ""}
    </section>`;
  }

  return {
    decision: renderDecisionBudgetPage,
    dates: renderDatesPage,
    routes: renderRoutesPage,
    refresh: renderRefreshPage
  };
}
