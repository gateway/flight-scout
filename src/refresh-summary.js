import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { comparisonKey } from "./snapshot-compare.js";
import { dateOnly, formatHumanDate, formatMinutes, money } from "./html-utils.js";
import { evaluateWatchRules } from "./watch-rules.js";
import { analyzeSnapshotDecision } from "./snapshot-decision.js";

// Builds a traveler-readable markdown lowdown from the latest saved snapshots.
// It intentionally consumes existing snapshot/ranking data instead of touching
// providers, so summary generation stays fast and cannot create extra searches.

export async function writeRefreshLowdown({ root = process.cwd(), plans, refreshed = [], outputPath = null }) {
  const activePlans = plans.filter((item) => item.status?.active);
  const analyzed = activePlans.map(analyzePlan).filter(Boolean);
  const targetPath = outputPath ?? path.join(root, "outputs", "latest-refresh-lowdown.md");
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, renderLowdown({ analyzed, refreshed }), "utf8");
  return {
    outputPath: targetPath,
    activePlanCount: activePlans.length,
    refreshedPlanCount: refreshed.length,
    topOption: bestAcrossPlans(preferPrimaryPlans(analyzed))
  };
}

export function analyzePlan(item) {
  const latest = item.latest;
  if (!latest?.rankedFlights?.length) {
    return {
      plan: item.plan,
      latest,
      comparison: item.comparison,
      status: "missing-data",
      movement: movementCounts(item.comparison),
      best: null,
      cheapest: null,
      fastest: null,
      watchAlerts: [],
      newUsable: []
    };
  }
  const viable = viableFlights(latest.rankedFlights);
  const decision = item.decision ?? analyzeSnapshotDecision({ plan: item.plan, trip: item.trip, latest });
  const previousKeys = new Set((item.previous?.rankedFlights ?? []).map(comparisonKey));
  const newUsable = uniqueFlights(viable.filter((flight) => !previousKeys.has(comparisonKey(flight)))).slice(0, 3);
  return {
    plan: item.plan,
    latest,
    comparison: item.comparison,
    status: decision.best ? "ready" : "no-viable-options",
    movement: movementCounts(item.comparison),
    best: decision.best,
    cheapest: decision.cheapest,
    fastest: decision.fastest,
    watchAlerts: evaluateWatchRules(item.plan.watchRules, viable),
    newUsable
  };
}

export function bestAcrossPlans(analyzed) {
  return analyzed
    .flatMap((item) => [item.best, item.cheapest, item.fastest].filter(Boolean).map((flight) => ({ plan: item.plan, flight })))
    .sort((a, b) => optionScore(a.flight) - optionScore(b.flight))[0] ?? null;
}

function renderLowdown({ analyzed, refreshed }) {
  const top = bestAcrossPlans(preferPrimaryPlans(analyzed));
  return `# Latest Flight Refresh Lowdown

Generated: ${new Date().toISOString()}

${refreshed.length ? `Refreshed ${refreshed.length} active plan${refreshed.length === 1 ? "" : "s"}.` : "No refresh records were passed into this summary."}

## Best Practical Option

${top ? renderTopOption(top) : "No decision-ready option is available yet."}

${renderWatchAlerts(analyzed)}

## What Changed

${analyzed.map(renderPlanMovement).join("\n\n")}

## New Options Worth Opening

${renderNewOptions(analyzed)}

## Current Best By Plan

${analyzed.map(renderCurrentPlanRead).join("\n\n")}
`;
}

function renderWatchAlerts(analyzed) {
  const alerts = analyzed.flatMap((item) => (item.watchAlerts ?? []).map((alert) => ({
    plan: item.plan,
    ...alert
  })));
  if (!alerts.length) return "";
  const rows = alerts.map(({ plan, label, outcome, flight }) =>
    `- **${plan.name} — ${outcome === "missed" ? "Target missed" : "Target met"}:** ${label}. ${routeText(flight)} on ${humanDate(flight)}, **$${money(totalCost(flight))}**, **${formatMinutes(duration(flight))}**.${flight.googleFlightsUrl ? ` [Open in Google Flights](${flight.googleFlightsUrl})` : ""}`
  );
  return `## Saved Target Status\n\n${rows.join("\n")}`;
}

function renderTopOption({ plan, flight }) {
  return `I would start with **${plan.name}**: **${routeText(flight)} on ${humanDate(flight)}** for **$${money(totalCost(flight))}**, about **${formatMinutes(duration(flight))}**.

${connectionRead(flight)}${flight.googleFlightsUrl ? `\n\nGoogle Flights: ${flight.googleFlightsUrl}` : ""}`;
}

function renderPlanMovement(item) {
  const movement = item.movement;
  const label = movementLabel(movement);
  const changed = [
    `cheaper: ${movement.down}`,
    `higher: ${movement.up}`,
    `new: ${movement.new}`,
    `no longer showing: ${movement.disappeared}`
  ].join(" · ");
  return `### ${item.plan.name}

${label}. ${changed}.`;
}

function renderNewOptions(analyzed) {
  const options = uniquePlanFlights(analyzed.flatMap((item) => item.newUsable.map((flight) => ({ plan: item.plan, flight }))));
  if (!options.length) return "No new decision-ready flights jumped out from this refresh.";
  return options
    .sort((a, b) => optionScore(a.flight) - optionScore(b.flight))
    .slice(0, 6)
    .map(({ plan, flight }) => `- **${plan.name}:** ${routeText(flight)} on ${humanDate(flight)}, **$${money(totalCost(flight))}**, **${formatMinutes(duration(flight))}**. ${connectionRead(flight)}`)
    .join("\n");
}

function renderCurrentPlanRead(item) {
  if (!item.best) return `### ${item.plan.name}\n\nNo decision-ready flight is available in the latest snapshot.`;
  const rows = [
    ["Best balance", item.best],
    ["Cheapest practical", item.cheapest],
    ["Fastest practical", item.fastest]
  ];
  return `### ${item.plan.name}

${rows.map(([label, flight]) => `- **${label}:** ${routeText(flight)} on ${humanDate(flight)}, **$${money(totalCost(flight))}**, **${formatMinutes(duration(flight))}**.`).join("\n")}`;
}

function movementCounts(comparison) {
  const changes = comparison?.changes ?? [];
  return {
    down: changes.filter((change) => change.direction === "down").length,
    up: changes.filter((change) => change.direction === "up").length,
    same: changes.filter((change) => change.direction === "same").length,
    new: changes.filter((change) => change.direction === "new").length,
    disappeared: changes.filter((change) => change.direction === "disappeared").length
  };
}

function movementLabel({ down, up, new: fresh }) {
  if (down > up * 2 && down > 0) return "Mostly better than the last refresh";
  if (up > down * 2 && up > 0) return "Mostly higher than the last refresh";
  if (fresh > 0 && down === 0 && up === 0) return "New options appeared";
  if (down || up || fresh) return "Mixed movement";
  return "No meaningful price movement";
}

function preferPrimaryPlans(analyzed) {
  const primary = analyzed.filter((item) => item.plan?.primary === true);
  return primary.length ? primary : analyzed;
}

function uniqueFlights(flights) {
  const seen = new Set();
  return flights.filter((flight) => {
    const key = humanFlightKey(flight);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function uniquePlanFlights(options) {
  const seen = new Set();
  return options.filter(({ plan, flight }) => {
    const key = `${plan.id ?? plan.name}:${humanFlightKey(flight)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function humanFlightKey(flight) {
  return [
    flight.departureAirport,
    flight.arrivalAirport,
    dateOnly(flight.departureTime),
    totalCost(flight),
    duration(flight)
  ].join("|");
}

function viableFlights(flights) {
  return flights.filter((flight) => {
    if (flight.tripComplete === false || flight.destinationComplete === false) return false;
    if ((flight.scoring?.labels ?? []).includes("hard-reject")) return false;
    return Number.isFinite(totalCost(flight)) && Number.isFinite(duration(flight));
  });
}

function optionScore(flight) {
  return (flight.scoring?.score ?? 0) + totalCost(flight) / 1000 + duration(flight) / 600;
}

function totalCost(flight) {
  return flight.scoring?.breakdown?.estimatedTotalCost ?? flight.estimatedTotalCost ?? flight.price ?? NaN;
}

function duration(flight) {
  return flight.durationMinutes ?? NaN;
}

function humanDate(flight) {
  return formatHumanDate(dateOnly(flight.departureTime)) || dateOnly(flight.departureTime) || "the selected date";
}

function routeText(flight) {
  return `${flight.departureAirport ?? "?"} -> ${flight.arrivalAirport ?? "?"}`;
}

function connectionRead(flight) {
  const layovers = flight.layovers ?? [];
  if (!layovers.length) return "No layover risk flagged.";
  const shortest = [...layovers].sort((a, b) => Number(a.duration ?? Infinity) - Number(b.duration ?? Infinity))[0];
  const minutes = Number(shortest.duration);
  const label = shortest.id ?? shortest.name ?? "connection";
  if (!Number.isFinite(minutes)) return "Connection timing needs verification.";
  if (minutes < 90) return `Watch the ${label} connection: only ${formatMinutes(minutes)}. Verify it before booking.`;
  if (minutes >= 360) return `Longest wait is ${formatMinutes(minutes)} at ${label}; not risky, but it adds drag.`;
  return `Connection timing looks workable; shortest layover is ${formatMinutes(minutes)} at ${label}.`;
}
