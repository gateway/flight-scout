import test from "node:test";
import assert from "node:assert/strict";
import { renderRefreshDecisionCostCheck } from "../src/dashboard-refresh-ux.js";
import { humanizeRefreshReason } from "../src/refresh-plan-presentation.js";

test("refresh cards translate internal selection reasons into plain language", () => {
  const html = renderRefreshDecisionCostCheck({
    explanation: "Refresh the active date window.",
    fliCallCount: 1,
    selectedCallCount: 1,
    calls: [{
      id: "one-way-sea-kef-2026-09-25",
      title: "Seattle to Keflavik on September 25",
      refreshReasons: ["route batch: fastest", "full date-window coverage"],
      cache: { status: "missing" },
      provider: { fliLive: true }
    }],
    warnings: []
  });

  assert.match(html, /fastest route candidates/i);
  assert.match(html, /all dates in your search window/i);
  assert.doesNotMatch(html, /route batch:|full date-window coverage/i);
});

test("unknown refresh reason identifiers fall back to readable words", () => {
  assert.equal(humanizeRefreshReason("new-provider-check"), "new provider check");
  assert.equal(humanizeRefreshReason(), "selected for this refresh");
});
