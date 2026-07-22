import { formatMinutes, money } from "./html-utils.js";
import { connectionPill, renderAssumptions, renderCardHead, renderPainBreakdown } from "./dashboard-flight-components.js";
import { metricSignal } from "./dashboard-signals.js";

// Renders saved-target outcomes with the same flight-card and drawer components
// used by decision cards. This status UI never performs provider work.
export function renderWatchAlerts(alerts = []) {
  if (!alerts.length) return "";
  return `<section id="watch-alerts">
    <h2>Saved Target Status</h2>
    <div class="decision-stack">${alerts.map(renderAlert).join("")}</div>
  </section>`;
}

function renderAlert({ label, outcome = "met", matched, misses = {}, flight }) {
  const met = outcome === "met";
  const outcomeLabel = met ? "Target met" : "Target missed";
  const labelText = label && !/^saved target/i.test(label) ? `${outcomeLabel}: ${label}` : outcomeLabel;
  return `<article class="flight-card decision-card ${met ? "watch-target-card" : "watch-alert-card"}">
    <span class="watch-outcome-marker" aria-hidden="true">${met ? "✓" : "!"}</span>
    ${renderCardHead(labelText, flight)}
    <p>${thresholdSentence({ outcome, matched, misses, flight })}</p>
    <div class="meta">${connectionPill(flight)}</div>
    ${renderPainBreakdown(flight)}
    ${renderAssumptions(flight)}
  </article>`;
}

function thresholdSentence({ outcome, matched, misses, flight }) {
  if (outcome === "missed") return missedThresholdSentence(matched, misses, flight);
  const facts = [];
  if (matched.maxPriceUsd) {
    facts.push(`${metricSignal(`$${money(flight.price)}`, "good")} is within your $${money(matched.maxPriceUsd)} price target`);
  }
  if (matched.maxDurationMinutes) {
    facts.push(`${metricSignal(formatMinutes(flight.durationMinutes), "good")} is within your ${formatMinutes(matched.maxDurationMinutes)} travel-time target`);
  }
  return `${facts.join(" and ")}.`;
}

function missedThresholdSentence(matched, misses, flight) {
  const facts = [];
  if (misses.priceUsd) {
    facts.push(`${metricSignal(`$${money(flight.price)}`, "bad")} is $${money(misses.priceUsd)} over your $${money(matched.maxPriceUsd)} price target`);
  }
  if (misses.durationMinutes) {
    facts.push(`${metricSignal(formatMinutes(flight.durationMinutes), "bad")} is ${formatMinutes(misses.durationMinutes)} over your ${formatMinutes(matched.maxDurationMinutes)} travel-time target`);
  }
  return `${facts.join(" and ")}.`;
}
