import test from "node:test";
import assert from "node:assert/strict";
import { airlineDisplay, displayAirlineName } from "../src/airline-display.js";

test("airlineDisplay uses leg order and friendly names for airline codes", () => {
  const flight = {
    airline: "AS + CI",
    legs: [
      { airline: "CI" },
      { airline: "CI" },
      { airline: "AS" }
    ]
  };

  assert.equal(airlineDisplay(flight), "China Airlines + Alaska Airlines");
});

test("displayAirlineName keeps unknown provider text intact", () => {
  assert.equal(displayAirlineName("Example Air + AS"), "Example Air + Alaska Airlines");
});

test("displayAirlineName expands known airline codes from saved provider data", () => {
  assert.equal(
    displayAirlineName("HV + KL + SK + FI + AF"),
    "Transavia + KLM + SAS + Icelandair + Air France"
  );
});

test("displayAirlineName normalizes known provider aliases", () => {
  assert.equal(
    displayAirlineName("Alaska + American + Delta + United + JAL + THAI + Hong Kong Express"),
    "Alaska Airlines + American Airlines + Delta Air Lines + United Airlines + Japan Airlines + Thai Airways + HK Express"
  );
});
