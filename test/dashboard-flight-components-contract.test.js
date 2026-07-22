import assert from "node:assert/strict";
import test from "node:test";
import * as components from "../src/dashboard-flight-components.js";

test("shared flight-component facade preserves its public exports", () => {
  assert.deepEqual(Object.keys(components).sort(), [
    "bestChoiceSentence",
    "cleanTitlePart",
    "connectionPill",
    "flightActionLinks",
    "flightDetailDrawer",
    "flightGoogleFlightsUrl",
    "flightIconLink",
    "hasFlightDetail",
    "humanOptionLine",
    "optionDate",
    "optionHeadline",
    "optionRouteLine",
    "renderAssumptions",
    "renderCardHead",
    "renderCardSummaryRow",
    "renderFlightDetailPanel",
    "renderPainBreakdown"
  ]);
});

test("shared flight components preserve card actions and drawer timeline markup", () => {
  const option = contractFlight();
  const actions = components.flightActionLinks(option);
  const panel = components.renderFlightDetailPanel(option);

  assert.equal(
    actions,
    '<span class="card-actions"><details class="side-drawer card-detail-drawer"><summary class="icon-link" aria-label="Open flight detail" title="Open flight detail">☰</summary><div class="drawer-panel">' +
      panel +
      '</div></details><a class="icon-link" target="_blank" rel="noopener" href="https://www.google.com/travel/flights?hl=en&amp;curr=USD&amp;q=one+way+flights+from+LHR+to+KEF+departing+2027-09-25" aria-label="Open in Google Flights" title="Open in Google Flights">↗</a></span>'
  );
  assert.match(panel, /class="drawer-head"/);
  assert.match(panel, /class="drawer-head-actions"/);
  assert.match(panel, /class="drawer-facts"/);
  assert.match(panel, /class="flight-timeline"/);
  assert.equal((panel.match(/class="timeline-leg"/g) ?? []).length, 2);
  assert.match(panel, /class="timeline-layover layover-watch"/);
  assert.match(panel, /<strong>2h 0m layover<\/strong><span>Amsterdam \(AMS\)<\/span>/);
  assert.match(panel, /class="timeline-amenities"/);
  assert.match(panel, /class="pain-grid"/);
  assert.match(panel, /class="drawer-advice"/);
  assert.match(panel, /The shortest connection is 2h 0m at AMS/);
  assert.match(panel, /Separate ticket: Recheck baggage between tickets/);
  assert.ok(!panel.includes("drawer-footer"));
});

function contractFlight() {
  const layover = { duration: 120, id: "AMS", name: "Amsterdam" };
  return {
    routeIdeaLabel: "London to Reykjavik",
    price: 520,
    durationMinutes: 360,
    departureAirport: "LHR",
    arrivalAirport: "KEF",
    departureTime: "2027-09-25 10:00",
    stops: 1,
    legs: [
      {
        duration: 60,
        airline: "Fixture Air",
        travel_class: "Economy",
        airplane: "A320",
        flight_number: "FA 10",
        departure_airport: { time: "2027-09-25 10:00", name: "London Heathrow", id: "LHR" },
        arrival_airport: { time: "2027-09-25 11:00", name: "Amsterdam", id: "AMS" },
        extensions: ["Average legroom", "In-seat power"]
      },
      {
        duration: 120,
        airline: "North Air",
        travel_class: "Economy",
        airplane: "A321",
        flight_number: "NA 20",
        departure_airport: { time: "2027-09-25 13:00", name: "Amsterdam", id: "AMS" },
        arrival_airport: { time: "2027-09-25 15:00", name: "Keflavik", id: "KEF" },
        extensions: []
      }
    ],
    layovers: [layover],
    connectionRisk: { level: "watch", shortest: layover },
    travelPain: { totalMinutes: 360, airMinutes: 180, layoverMinutes: 120 },
    assumptions: [{ label: "Separate ticket", text: "Recheck baggage between tickets" }]
  };
}
