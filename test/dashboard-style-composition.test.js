import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { dashboardCss } from "../src/dashboard-styles.js";
import { dashboardStyleActions } from "../src/styles/dashboard-style-actions.js";
import { dashboardStyleCards } from "../src/styles/dashboard-style-cards.js";
import { dashboardStyleDataVisuals } from "../src/styles/dashboard-style-data-visuals.js";
import { dashboardStyleLayout } from "../src/styles/dashboard-style-layout.js";
import { dashboardStyleMetadata } from "../src/styles/dashboard-style-metadata.js";
import { dashboardStylePriceHistory } from "../src/styles/dashboard-style-price-history.js";

const FAMILY_FILES = [
  "dashboard-style-layout.js",
  "dashboard-style-data-visuals.js",
  "dashboard-style-price-history.js",
  "dashboard-style-cards.js",
  "dashboard-style-actions.js",
  "dashboard-style-metadata.js"
];
const STYLES_DIR = new URL("../src/styles/", import.meta.url);

test("dashboard CSS composition stays byte-stable", () => {
  const hash = createHash("sha256").update(dashboardCss()).digest("hex");

  assert.equal(hash, "529444b08123a3fc5c4682e39a0ff175068a0f62f556a11e7d8c25a65aa9666a");
});

test("component theme is assembled from focused family modules without a size exception", async () => {
  const facade = await readSource("dashboard-style-components.js");
  const guard = await readFile(new URL("../scripts/check-file-sizes.mjs", import.meta.url), "utf8");

  assert.ok(lineCount(facade) <= 30, "component facade should only assemble owned families");
  assert.doesNotMatch(guard, /dashboard-style-components\.js/);
  for (const file of FAMILY_FILES) {
    const source = await readSource(file);
    assert.ok(lineCount(source) <= 220, `${file} should remain a focused style owner`);
  }
});

test("each component selector has one family owner", () => {
  const owners = new Map();
  const families = new Map([
    ["layout", dashboardStyleLayout()],
    ["data-visuals", dashboardStyleDataVisuals()],
    ["price-history", dashboardStylePriceHistory()],
    ["cards", dashboardStyleCards()],
    ["actions", dashboardStyleActions()],
    ["metadata", dashboardStyleMetadata()]
  ]);

  for (const [family, css] of families) {
    for (const selector of selectorsFrom(css)) {
      const selectorOwners = owners.get(selector) ?? new Set();
      selectorOwners.add(family);
      owners.set(selector, selectorOwners);
    }
  }

  const shared = [...owners]
    .filter(([, selectorOwners]) => selectorOwners.size > 1)
    .map(([selector, selectorOwners]) => `${selector}: ${[...selectorOwners].join(", ")}`);
  assert.deepEqual(shared, []);
});

test("hero headings wrap long slash-delimited route names on mobile", () => {
  assert.match(dashboardCss(), /h1 \{[^}]*overflow-wrap: break-word;[^}]*word-break: normal;/s);
  assert.doesNotMatch(dashboardCss(), /h1 \{[^}]*overflow-wrap: anywhere;/s);
});

async function readSource(file) {
  return readFile(fileURLToPath(new URL(file, STYLES_DIR)), "utf8");
}

function lineCount(text) {
  return text.trimEnd().split(/\r?\n/).length;
}

function selectorsFrom(css) {
  const selectors = [];
  for (const match of css.matchAll(/(?:^|})\s*([^{}]+)\{/g)) {
    selectors.push(...match[1].split(",").map((selector) => selector.trim()));
  }
  return selectors;
}
