import test from "node:test";
import assert from "node:assert/strict";
import { enrichFlights } from "../src/cli-support.js";

test("ordinary hotel labels retain their nightly estimate", () => {
  const [flight] = enrichFlights([{
    searchTitle: "Chiang Mai -> Bangkok 2n -> Redmond"
  }], {
    rules: {
      hotelNightEstimate: { Bangkok: 50 }
    }
  });

  assert.equal(flight.estimatedHotelCost, 100);
});

test("hotel labels with regular-expression metacharacters are matched literally", () => {
  const [flight] = enrichFlights([{
    searchTitle: "London -> St. John's (North) [A]+? 2n -> Sydney"
  }], {
    rules: {
      hotelNightEstimate: {
        "St. John's (North) [A]+?": 50
      }
    }
  });

  assert.equal(flight.estimatedHotelCost, 100);
});
