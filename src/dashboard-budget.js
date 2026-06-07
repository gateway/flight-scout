import { dateOnly, escapeHtml, formatMinutes, money } from "./html-utils.js";
import { flightActionLinks } from "./dashboard-flight-components.js";
import { metricSignal, signal, signalizeText } from "./dashboard-signals.js";

// Budget sections compare a cleaner origin route against a cheaper alternate-start route.
export function renderBudgetOpportunity({ analysis, current, trip }) {
  const opportunity = budgetAlternateStartOpportunity({ analysis, current, trip });
  if (!opportunity || opportunity.savings <= 0) return "";
  const alternatives = budgetAlternateStartAlternatives({ current, trip, benchmark: opportunity.clean }).slice(0, 7);
  return `<section id="budget-move">
    <h2>Budget Move</h2>
    <article class="flight-card decision-lead budget-lead">
      <div class="lead-head">
        <div>
          <div class="label">Best lower-price path</div>
          <h3>Fly to Bangkok first, then start the long-haul from Bangkok</h3>
        </div>
        <div class="lead-price"><strong>$${money(opportunity.total)}</strong><span>estimated total</span>${flightActionLinks(opportunity.onward)}</div>
      </div>
      <p>This adds a Chiang Mai to Bangkok flight and a hotel estimate, but it is still about ${metricSignal(`$${money(opportunity.savingsVsBest)} cheaper`, "good")} than the current cleaner recommendation.</p>
      <div class="meta">
        <span class="pill">$${money(opportunity.firstLeg.price)} CNX -> Bangkok</span>
        <span class="pill">$${money(opportunity.hotelCost)} hotel estimate</span>
        <span class="pill">$${money(opportunity.onward.price)} Bangkok -> Redmond</span>
        <span class="pill warn">${signal(`Saves $${money(opportunity.savingsVsBest)} vs current best`, "good")}</span>
        <span class="pill">${signal(`Saves $${money(opportunity.savingsVsCheapestOrigin)} vs cheapest CNX-start`, "good")}</span>
      </div>
      <div class="pain-grid">
        <div><span>Get to Bangkok</span><strong>${escapeHtml(opportunity.firstLeg.duration ?? "n/a")}</strong><small>${escapeHtml(opportunity.firstLeg.airline ?? "")}</small></div>
        <div><span>Long-haul</span><strong>${escapeHtml(opportunity.onward.duration ?? "n/a")}</strong><small>${escapeHtml(opportunity.onward.airline ?? "")}</small></div>
        <div><span>Watch</span><strong>${escapeHtml(opportunity.watchLabel)}</strong><small>${escapeHtml(opportunity.watchText)}</small></div>
      </div>
      <p class="small">This is worth checking manually if budget matters more than simplicity. The main risk is the ${signal("tight connection", "bad")} and the extra Bangkok logistics.</p>
    </article>
    ${alternatives.length ? `<div class="section-intro"><h3>Budget options by departure date</h3><p>Sorted by estimated total cost. Each card includes the Bangkok long-haul price plus the current Chiang Mai to Bangkok flight and hotel estimate.</p></div><div class="budget-strip">${alternatives.map(renderBudgetAlternative).join("")}</div>` : ""}
  </section>`;
}

export function budgetAlternateStartOpportunity({ analysis, current, trip }) {
  const flights = current?.rankedFlights ?? [];
  const origin = trip?.origin?.airports?.[0];
  const alternate = trip?.alternateStarts?.[0];
  const destination = trip?.destination?.airports?.[0];
  if (!origin || !alternate?.airports?.length || !destination) return null;
  const alternateAirports = new Set(alternate.airports);
  const firstLeg = cheapestFlight(flights.filter((flight) => flight.departureAirport === origin && alternateAirports.has(flight.arrivalAirport)));
  const onward = cheapestFlight(flights.filter((flight) => alternateAirports.has(flight.departureAirport) && flight.arrivalAirport === destination && flight.tripComplete !== false && flight.destinationComplete !== false));
  const cleanBest = analysis.best?.departureAirport === origin ? analysis.best : bestFullOriginOption(analysis, origin);
  const cheapestOrigin = cheapestFullOriginOption(analysis, origin);
  if (!firstLeg || !onward || !cleanBest) return null;
  const hotelCost = trip.rules?.hotelNightEstimate?.[cleanStartLabel(alternate.label)] ?? trip.rules?.hotelNightEstimate?.Bangkok ?? 0;
  const total = flightCost(firstLeg) + flightCost(onward) + hotelCost;
  const savingsVsBest = cleanBest.price - total;
  const savingsVsCheapestOrigin = cheapestOrigin ? cheapestOrigin.price - total : savingsVsBest;
  const tight = (onward.layovers ?? []).find((layover) => layover.duration < 90 || (["SEA", "SFO", "LAX", "PDX"].includes(layover.id) && layover.duration < 180));
  return {
    firstLeg: { ...firstLeg, price: flightCost(firstLeg) },
    onward: { ...onward, price: flightCost(onward) },
    clean: cleanBest,
    cheapestOrigin,
    hotelCost,
    total,
    savings: savingsVsBest,
    savingsVsBest,
    savingsVsCheapestOrigin,
    watchLabel: tight ? `${tight.id ?? "connection"} ${formatMinutes(tight.duration)}` : "extra logistics",
    watchText: tight ? "tight connection on the long-haul option" : "Chiang Mai to Bangkok flight, hotel, and transfer time"
  };
}

function renderBudgetAlternative(item) {
  return `<article class="flight-card budget-option">
    <div class="card-head">
      <div><div class="label">${escapeHtml(item.date)}</div><h3>${escapeHtml(item.onward.airline ?? "Unknown airline")}</h3></div>
      <div class="card-stat"><strong>$${money(item.total)}</strong><span>${escapeHtml(item.onward.duration ?? "n/a")}</span>${flightActionLinks(item.onward)}</div>
    </div>
    <p>Bangkok -> Redmond · ${escapeHtml(item.onward.duration ?? "n/a")}</p>
    <div class="meta">
      <span class="pill">$${money(item.onward.price)} BKK -> RDM</span>
      <span class="pill">$${money(item.firstLegEstimate)} CNX -> BKK + hotel</span>
      ${item.savings > 0 ? `<span class="pill good">${signal(`Saves $${money(item.savings)}`, "good")}</span>` : `<span class="pill warn">${signal(`$${money(Math.abs(item.savings))} more`, "warn")}</span>`}
    </div>
    <p class="small">${signalizeText(item.watchText)}</p>
  </article>`;
}

function budgetAlternateStartAlternatives({ current, trip, benchmark }) {
  const flights = current?.rankedFlights ?? [];
  const alternate = trip?.alternateStarts?.[0];
  const destination = trip?.destination?.airports?.[0];
  if (!alternate?.airports?.length || !destination) return [];
  const alternateAirports = new Set(alternate.airports);
  const hotelCost = trip.rules?.hotelNightEstimate?.[cleanStartLabel(alternate.label)] ?? trip.rules?.hotelNightEstimate?.Bangkok ?? 0;
  const knownFirstLeg = cheapestFlight(flights.filter((flight) => trip.origin?.airports?.includes(flight.departureAirport) && alternateAirports.has(flight.arrivalAirport)));
  const firstLegEstimate = Number.isFinite(flightCost(knownFirstLeg)) ? flightCost(knownFirstLeg) + hotelCost : hotelCost;
  const byDate = new Map();
  for (const flight of flights) {
    if (!alternateAirports.has(flight.departureAirport) || flight.arrivalAirport !== destination || flight.tripComplete === false || flight.destinationComplete === false) continue;
    const date = dateOnly(flight.departureTime);
    if (!date) continue;
    const existing = byDate.get(date);
    if (!existing || flightCost(flight) < flightCost(existing)) byDate.set(date, flight);
  }
  return [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, onward]) => {
    const total = flightCost(onward) + firstLegEstimate;
    const tight = (onward.layovers ?? []).find((layover) => layover.duration < 90 || (["SEA", "SFO", "LAX", "PDX"].includes(layover.id) && layover.duration < 180));
    return {
      date,
      onward: { ...onward, price: flightCost(onward) },
      firstLegEstimate,
      total,
      savings: (benchmark?.price ?? Infinity) - total,
      watchText: tight ? `Watch ${tight.id ?? "connection"} ${formatMinutes(tight.duration)} connection.` : "No short connection flagged in this option."
    };
  }).sort((a, b) => a.total - b.total);
}

function cleanStartLabel(value) {
  return String(value ?? "").replace(/\s+start$/i, "");
}

function cheapestFullOriginOption(analysis, origin) {
  return minBy((analysis.options ?? []).filter((option) => option.departureAirport === origin && option.routeType === "direct-to-final"), (option) => option.price);
}

function bestFullOriginOption(analysis, origin) {
  return minBy((analysis.options ?? []).filter((option) => option.departureAirport === origin && option.routeType === "direct-to-final"), (option) => option.humanScore);
}

function cheapestFlight(flights) {
  return minBy(flights.filter((flight) => Number.isFinite(flightCost(flight))), (flight) => flightCost(flight));
}

function flightCost(flight) {
  return flight?.scoring?.breakdown?.estimatedTotalCost ?? flight?.estimatedTotalCost ?? flight?.price ?? Infinity;
}

function minBy(items, score) {
  return items.reduce((best, item) => (score(item) < score(best) ? item : best), items[0] ?? null);
}
