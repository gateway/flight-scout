import test from "node:test";
import assert from "node:assert/strict";
import { bestChoiceRationale } from "../src/decision-copy.js";

test("best-choice rationale names the connection reason instead of claiming the pick is fast", () => {
  const best = {
    connectionRisk: { level: "comfortable", shortest: { id: "AMS", duration: 200 } },
    confidence: { level: "High" },
    stops: 1
  };
  const cheaperAndFaster = {
    connectionRisk: { level: "tight", shortest: { id: "ARN", duration: 65 } },
    confidence: { level: "Low" },
    stops: 1
  };

  assert.equal(
    bestChoiceRationale({ best, cheapest: cheaperAndFaster, fastest: cheaperAndFaster }),
    "It wins because its shortest connection is a comfortable 3h 20m at AMS; the cheaper and faster option depends on a tight 1h 5m connection at ARN and has lower confidence."
  );
});

test("best-choice rationale separates distinct cheaper and faster concerns", () => {
  const best = {
    connectionRisk: { level: "comfortable", shortest: { id: "AMS", duration: 200 } },
    confidence: { level: "High" },
    stops: 1
  };
  const cheapest = {
    connectionRisk: { level: "tight", shortest: { id: "FRA", duration: 85 } },
    confidence: { level: "Low" },
    stops: 2
  };
  const fastest = {
    connectionRisk: { level: "tight", shortest: { id: "ARN", duration: 65 } },
    confidence: { level: "Low" },
    stops: 1
  };

  assert.equal(
    bestChoiceRationale({ best, cheapest, fastest }),
    "It wins because its shortest connection is a comfortable 3h 20m at AMS; the cheaper option depends on a tight 1h 25m connection at FRA, has lower confidence, and adds more stops; the faster option depends on a tight 1h 5m connection at ARN and has lower confidence."
  );
});
