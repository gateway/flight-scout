import test from "node:test";
import assert from "node:assert/strict";
import { minBy } from "../src/collections.js";
import { dateOnly, formatMinutes, money } from "../src/html-utils.js";
import { slugify } from "../src/strings.js";
import { slugify as planSlugify } from "../src/plans.js";

test("minBy returns null for no candidates and preserves the first minimum", () => {
  assert.equal(minBy([], (item) => item.score), null);

  const first = { id: "first", score: 2 };
  const tied = { id: "tied", score: 2 };
  const higher = { id: "higher", score: 3 };
  assert.equal(minBy([higher, first, tied], (item) => item.score), first);
});

test("slugify creates stable lowercase identifiers from labels", () => {
  assert.equal(slugify("  Tokyo / Redmond (2026)  "), "tokyo-redmond-2026");
  assert.equal(slugify("---"), "");
  assert.equal(planSlugify("Tokyo / Redmond"), "tokyo-redmond");
});

test("shared display formatters preserve date, money, and duration edge behavior", () => {
  assert.equal(money(1234), "1,234");
  assert.equal(money(Number.NaN), "n/a");
  assert.equal(dateOnly("2026-08-01T09:30:00Z"), "2026-08-01");
  assert.equal(dateOnly(null), null);
  assert.equal(formatMinutes(125), "2h 5m");
  assert.equal(formatMinutes(Number.NaN), null);
});
