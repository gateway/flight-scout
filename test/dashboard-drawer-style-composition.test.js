import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { dashboardStyleDrawerResponsive } from "../src/styles/dashboard-style-drawer-responsive.js";
import { dashboardStyleDrawerBase } from "../src/styles/dashboard-style-drawer-base.js";
import { dashboardStylePageContent } from "../src/styles/dashboard-style-page-content.js";
import { dashboardStyleResponsive } from "../src/styles/dashboard-style-responsive.js";

test("drawer and responsive CSS stays byte-stable while ownership is extracted", () => {
  const css = dashboardStyleDrawerResponsive();
  const hash = createHash("sha256").update(css).digest("hex");

  assert.equal(css.length, 8008);
  assert.equal(hash, "c82b660e9f5fe2a6a7ad3c01166b798455ce13198c084629c790d5b96caf4154");
});

test("drawer, page content, and viewport rules have focused owners", async () => {
  const facade = await source("dashboard-style-drawer-responsive.js");
  const drawer = dashboardStyleDrawerBase();
  const pageContent = dashboardStylePageContent();
  const responsive = dashboardStyleResponsive();

  assert.ok(lineCount(facade) <= 20, "drawer-responsive facade should only compose owners");
  assert.match(drawer, /\.drawer-panel \.pain-grid/);
  assert.doesNotMatch(drawer, /\.price-row|@media/);
  assert.match(pageContent, /\.price-row/);
  assert.match(pageContent, /\.route-sort/);
  assert.doesNotMatch(pageContent, /@media/);
  assert.deepEqual([...responsive.matchAll(/@media \(max-width: (\d+)px\)/g)].map((match) => match[1]), ["980", "640"]);
  assert.ok(lineCount(await source("dashboard-style-drawer-base.js")) <= 40);
  assert.ok(lineCount(await source("dashboard-style-page-content.js")) <= 180);
  assert.ok(lineCount(await source("dashboard-style-responsive.js")) <= 160);
});

function source(file) {
  return readFile(new URL(`../src/styles/${file}`, import.meta.url), "utf8");
}

function lineCount(text) {
  return text.trimEnd().split(/\r?\n/).length;
}
