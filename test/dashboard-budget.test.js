import test from "node:test";
import assert from "node:assert/strict";
import { budgetAlternateStartOpportunity, renderBudgetOpportunity } from "../src/dashboard-budget.js";

test("budget comparison asks to verify an unknown connection duration", () => {
  const clean = {
    departureAirport: "LHR",
    arrivalAirport: "SYD",
    price: 1000,
    routeType: "direct-to-final",
    humanScore: 100
  };
  const scenario = {
    analysis: { best: clean, options: [clean] },
    current: {
      rankedFlights: [
        { departureAirport: "LHR", arrivalAirport: "CDG", price: 50 },
        {
          departureAirport: "CDG",
          arrivalAirport: "SYD",
          price: 600,
          tripComplete: true,
          destinationComplete: true,
          layovers: [{ id: "SIN", duration: null }]
        }
      ]
    },
    trip: {
      origin: { label: "London", airports: ["LHR"] },
      alternateStarts: [{ label: "Paris", airports: ["CDG"] }],
      destination: { label: "Sydney", airports: ["SYD"] },
      rules: { hotelNightEstimate: { Paris: 100 } }
    }
  };
  const opportunity = budgetAlternateStartOpportunity(scenario);
  const html = renderBudgetOpportunity(scenario);

  assert.match(opportunity.watchLabel, /SIN.*unknown/i);
  assert.match(opportunity.watchText, /verif/i);
  assert.doesNotMatch(opportunity.watchText, /tight/i);
  assert.match(html, /verif/i);
  assert.doesNotMatch(html, /main risk is the.*tight connection/i);
});

test("budget comparison uses trip connection geography metadata", () => {
  const clean = {
    departureAirport: "LHR",
    arrivalAirport: "YVR",
    price: 1000,
    routeType: "direct-to-final"
  };
  const scenario = {
    analysis: { best: clean, options: [clean] },
    current: {
      rankedFlights: [
        { departureAirport: "LHR", arrivalAirport: "CDG", price: 50 },
        {
          departureAirport: "CDG",
          arrivalAirport: "YVR",
          price: 600,
          tripComplete: true,
          destinationComplete: true,
          layovers: [{ id: "YUL", duration: 120 }]
        }
      ]
    },
    trip: {
      origin: { label: "London", airports: ["LHR"] },
      alternateStarts: [{ label: "Paris", airports: ["CDG"] }],
      destination: { label: "Vancouver", airports: ["YVR"] },
      rules: {
        hotelNightEstimate: { Paris: 100 },
        preferredDomesticConnectionMinutes: 90,
        preferredInternationalToDomesticConnectionMinutes: 180,
        connectionTypesByAirport: { YUL: "international-to-domestic" }
      }
    }
  };

  const opportunity = budgetAlternateStartOpportunity(scenario);

  assert.match(opportunity.watchLabel, /YUL 2h/);
  assert.match(opportunity.watchText, /tight/i);
});

test("budget comparison preserves known duration when connection geography is unknown", () => {
  const clean = {
    departureAirport: "LHR",
    arrivalAirport: "YVR",
    price: 1000,
    routeType: "direct-to-final"
  };
  const scenario = {
    analysis: { best: clean, options: [clean] },
    current: {
      rankedFlights: [
        { departureAirport: "LHR", arrivalAirport: "CDG", price: 50 },
        {
          departureAirport: "CDG",
          arrivalAirport: "YVR",
          price: 600,
          tripComplete: true,
          destinationComplete: true,
          layovers: [{ id: "YUL", duration: 120 }]
        }
      ]
    },
    trip: {
      origin: { label: "London", airports: ["LHR"] },
      alternateStarts: [{ label: "Paris", airports: ["CDG"] }],
      destination: { label: "Vancouver", airports: ["YVR"] },
      rules: { hotelNightEstimate: { Paris: 100 } }
    }
  };

  const opportunity = budgetAlternateStartOpportunity(scenario);
  const html = renderBudgetOpportunity(scenario);

  assert.match(opportunity.watchLabel, /YUL 2h/i);
  assert.doesNotMatch(opportunity.watchLabel, /time unknown/i);
  assert.match(opportunity.watchText, /connection type needs verification/i);
  assert.match(html, /connection type needs verification/i);
});
