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

  assert.equal(airlineDisplay(flight), "China Airlines + Alaska");
});

test("displayAirlineName keeps unknown provider text intact", () => {
  assert.equal(displayAirlineName("Example Air + AS"), "Example Air + Alaska");
});
