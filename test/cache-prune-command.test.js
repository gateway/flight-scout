import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, stat, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { runCachePrune } from "../src/commands/cache-prune-command.js";

const CLI_PATH = fileURLToPath(new URL("../src/cli.js", import.meta.url));

test("cache prune command previews stale files and explains that nothing was deleted", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "flight-cache-command-"));
  const cacheFile = path.join(root, "cache", "one-way-lhr-syd-2026-09-23.fli.json");
  const lines = [];
  try {
    await mkdir(path.dirname(cacheFile), { recursive: true });
    await writeFile(cacheFile, "{}\n");
    const old = new Date(Date.now() - 45 * 86_400_000);
    await utimes(cacheFile, old, old);

    const report = await runCachePrune({}, { root, log: (line) => lines.push(line) });

    assert.equal(report.mode, "dry-run");
    assert.equal(report.eligible.length, 1);
    assert.match(lines.join("\n"), /dry run/i);
    assert.match(lines.join("\n"), /1 stale cache file/i);
    assert.match(lines.join("\n"), /nothing was deleted/i);
    await assert.doesNotReject(() => stat(cacheFile));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("cache prune CLI previews and then applies the same disposable deletion set", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "flight-cache-cli-"));
  const cacheFile = path.join(root, "cache", "one-way-lhr-syd-2026-09-23.fli.json");
  try {
    await mkdir(path.dirname(cacheFile), { recursive: true });
    await writeFile(cacheFile, "{}\n");
    const old = new Date(Date.now() - 45 * 86_400_000);
    await utimes(cacheFile, old, old);

    const preview = runCli(root, ["cache:prune", "--older-than-days", "30"]);
    assert.equal(preview.status, 0, preview.stderr);
    assert.match(preview.stdout, /1 stale cache file eligible/i);
    await assert.doesNotReject(() => stat(cacheFile));

    const applied = runCli(root, [
      "cache:prune", "--older-than-days", "30", "--apply", "--confirm", "DELETE STALE CACHE"
    ]);
    assert.equal(applied.status, 0, applied.stderr);
    assert.match(applied.stdout, /1 stale cache file deleted/i);
    await assert.rejects(() => stat(cacheFile), /ENOENT/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

function runCli(root, args) {
  return spawnSync(process.execPath, [CLI_PATH, ...args], {
    cwd: root,
    encoding: "utf8"
  });
}
