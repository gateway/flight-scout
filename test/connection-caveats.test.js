import assert from "node:assert/strict";
import test from "node:test";
import {
  enrichLayoversWithTimes,
  isOvernightLayover
} from "../src/connection-duration.js";
import {
  connectionCaveatsForOption,
  SEPARATE_TICKET_CAVEAT,
  TRANSIT_REQUIREMENTS_DISCLAIMER
} from "../src/connection-caveats.js";
import { normalizeOption } from "../src/decision-analysis.js";
import { connectionPill, renderAssumptions, renderFlightDetailPanel } from "../src/dashboard-flight-components.js";

test("overnight layover rule requires a four-hour connection across local night hours", () => {
  assert.equal(isOvernightLayover({
    duration: 450,
    arrivalTime: "2026-08-01 23:40",
    departureTime: "2026-08-02 07:10"
  }), true);
  assert.equal(isOvernightLayover({
    duration: 480,
    arrivalTime: "2026-08-01 09:00",
    departureTime: "2026-08-01 17:00"
  }), false);
  assert.equal(isOvernightLayover({
    duration: 239,
    arrivalTime: "2026-08-01 23:40",
    departureTime: "2026-08-02 03:39"
  }), false);
  assert.equal(isOvernightLayover({
    duration: 450,
    arrivalTime: null,
    departureTime: "2026-08-02 07:10"
  }), false);
});

test("layover assembly adds adjacent local times without mutating source data", () => {
  const source = [{ id: "DOH", name: "Doha", duration: 450 }];
  const enriched = enrichLayoversWithTimes(source, overnightLegs("DOH"));

  assert.deepEqual(source, [{ id: "DOH", name: "Doha", duration: 450 }]);
  assert.equal(enriched[0].arrivalTime, "2026-08-01 23:40");
  assert.equal(enriched[0].departureTime, "2026-08-02 07:10");
  assert.equal(enriched[0].overnight, true);
});

test("overnight layovers add a watch signal, pill, and timed drawer line", () => {
  const option = normalizeOption({
    option: baseFlight({
      legs: overnightLegs("DOH"),
      layovers: [{ id: "DOH", name: "Doha", duration: 450 }]
    }),
    route: { id: "primary", label: "Origin to destination" }
  });

  assert.equal(option.connectionRisk.level, "watch");
  assert.equal(option.confidence.level, "Medium");
  assert.match(connectionPill(option), /Overnight at DOH/);
  const panel = renderFlightDetailPanel(option);
  assert.match(panel, /Overnight layover at DOH/);
  assert.match(panel, /arrives 23:40, departs 07:10/);
});

test("composed stopovers always render the shared separate-ticket caveat", () => {
  const option = normalizeOption({
    option: composedStopover(),
    route: { id: "stopover", label: "Origin via Stop City", type: "stopover" }
  });

  assert.equal(option.connectionCaveats.separateTicket, true);
  assert.match(renderAssumptions(option), new RegExp(SEPARATE_TICKET_CAVEAT.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(renderFlightDetailPanel(option), /These legs are separate tickets/);
});

test("composed stopovers retain a stronger visible warning when airports differ", () => {
  const source = composedStopover();
  source.inbound.arrivalAirport = "HND";
  source.onward.departureAirport = "NRT";
  const option = normalizeOption({
    option: source,
    route: { id: "stopover", label: "Origin via Tokyo", type: "stopover" }
  });

  const html = renderAssumptions(option);
  assert.match(html, /Airport change during stopover/);
  assert.match(html, /arrives at HND, but the next ticket departs from NRT/);
});

test("transit notes deduplicate countries and always include the shared disclaimer", () => {
  const option = {
    kind: "flight",
    layovers: [
      { id: "JFK", duration: 180 },
      { id: "SEA", duration: 150 },
      { id: "LHR", duration: 120 }
    ]
  };
  const caveats = connectionCaveatsForOption(option);

  assert.deepEqual(caveats.transitNotes.map((item) => item.isoCountry), ["US", "GB"]);
  assert.equal(caveats.transitDisclaimer, TRANSIT_REQUIREMENTS_DISCLAIMER);
  const panel = renderFlightDetailPanel({
    ...baseFlight({ layovers: option.layovers }),
    connectionCaveats: caveats,
    connectionRisk: { level: "comfortable", shortest: option.layovers[2] },
    travelPain: { totalMinutes: 900, airMinutes: 450, layoverMinutes: 450 },
    assumptions: []
  });
  assert.equal((panel.match(/United States transit/g) ?? []).length, 1);
  assert.match(panel, new RegExp(TRANSIT_REQUIREMENTS_DISCLAIMER.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

function baseFlight(overrides = {}) {
  return {
    searchId: "fixture-2026-08-01",
    price: 700,
    departureAirport: "AAA",
    arrivalAirport: "ZZZ",
    departureTime: "2026-08-01 18:00",
    arrivalTime: "2026-08-02 12:00",
    durationMinutes: 1080,
    stops: 1,
    tripComplete: true,
    destinationComplete: true,
    legs: overnightLegs("DOH"),
    layovers: [{ id: "DOH", name: "Doha", duration: 450 }],
    ...overrides
  };
}

function overnightLegs(connectionAirport) {
  return [
    {
      airline: "Fixture Air",
      duration: 340,
      departure_airport: { id: "AAA", name: "Origin", time: "2026-08-01 18:00" },
      arrival_airport: { id: connectionAirport, name: "Connection", time: "2026-08-01 23:40" }
    },
    {
      airline: "Fixture Air",
      duration: 290,
      departure_airport: { id: connectionAirport, name: "Connection", time: "2026-08-02 07:10" },
      arrival_airport: { id: "ZZZ", name: "Destination", time: "2026-08-02 12:00" }
    }
  ];
}

function composedStopover() {
  return {
    kind: "composed-stopover",
    inbound: baseFlight({ arrivalAirport: "MID", arrivalTime: "2026-08-01 12:00", durationMinutes: 360, legs: [], layovers: [] }),
    onward: baseFlight({ departureAirport: "MID", departureTime: "2026-08-02 10:00", durationMinutes: 600, legs: [], layovers: [] }),
    totalCost: 900,
    durationMinutes: 960,
    nights: 1,
    stopoverLabel: "Stop City"
  };
}
