import assert from "node:assert/strict";
import test from "node:test";
import { renderPriceSparkline } from "../src/dashboard-sparkline.js";

test("shared sparkline renders one titled SVG point per saved observation", () => {
  const html = renderPriceSparkline([
    { createdAt: "2026-09-01T08:00:00.000Z", price: 1000 },
    { createdAt: "2026-09-02T08:00:00.000Z", price: 850 },
    { createdAt: "2026-09-03T08:00:00.000Z", price: 900 }
  ]);

  assert.match(html, /class="price-sparkline"/);
  assert.equal((html.match(/data-price-history-point/g) ?? []).length, 3);
  assert.match(html, /<title>September 1, 2026: \$1,000<\/title>/);
  assert.match(html, /<title>September 2, 2026: \$850<\/title>/);
  assert.match(html, /var\(--accent\)/);
});
