import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

// Guard reusable dashboard renderers against stale route-specific prose.
test("reusable dashboard renderers do not contain stale route-specific copy", async () => {
  const files = [
    "src/dashboard-budget.js",
    "src/dashboard-flight-components.js",
    "src/dashboard-pages.js",
    "src/dashboard-routes-page.js"
  ];
  const bannedPhrases = [
    "which Bangkok airport",
    "Bangkok-to-Redmond",
    "Bangkok logistics",
    "Chiang Mai-start",
    "CNX-start",
    "Needs Chiang Mai to Bangkok data",
    "BKK -> RDM",
    "CNX -> BKK"
  ];

  for (const file of files) {
    const source = await readFile(path.join(root, file), "utf8");
    for (const phrase of bannedPhrases) {
      assert.ok(!source.includes(phrase), `${file} should not contain stale route-specific copy: ${phrase}`);
    }
  }
});
