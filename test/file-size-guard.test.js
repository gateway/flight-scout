import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const guardPath = fileURLToPath(new URL("../scripts/check-file-sizes.mjs", import.meta.url));

test("file-size guard rejects a production module above 300 lines", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "flight-size-guard-"));
  try {
    await mkdir(path.join(root, "src"), { recursive: true });
    await writeFile(path.join(root, "src", "oversized.js"), numberedLines(301));

    const result = await runGuard(root);

    assert.equal(result.code, 1);
    assert.match(result.stderr, /src\/oversized\.js: 301 lines, max 300/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("file-size guard allows production and test files at their exact ceilings", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "flight-size-boundary-"));
  try {
    await mkdir(path.join(root, "src"), { recursive: true });
    await mkdir(path.join(root, "test"), { recursive: true });
    await writeFile(path.join(root, "src", "bounded.js"), numberedLines(300));
    await writeFile(path.join(root, "test", "bounded.test.js"), numberedLines(450));

    const result = await runGuard(root);

    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /passed for 2 JavaScript files/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

function numberedLines(count) {
  return Array.from({ length: count }, (_, index) => `export const line${index} = ${index};`).join("\n");
}

function runGuard(cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [guardPath], { cwd });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}
