import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";

function responseFor(fixture) {
  const python = path.resolve(process.platform === "win32" ? ".venv/Scripts/python.exe" : ".venv/bin/python");
  return JSON.parse(execFileSync(python, ["test/helpers/fli-transport-probe.py", fixture], {
    encoding: "utf8",
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
    timeout: 10_000
  }));
}

for (const fixture of ["upstream-error", "missing-payload"]) {
  test(`FLI reports ${fixture} as a failed search, not empty inventory`, () => {
    const result = responseFor(fixture);
    assert.equal(result.ok, false);
    assert.equal(result.code, "fli-search-failed");
    assert.equal(result.results, undefined);
    assert.match(result.message, /payload|page|error 13/i);
  });
}

test("FLI preserves a valid empty inventory response", () => {
  const result = responseFor("empty-inventory");
  assert.equal(result.ok, true);
  assert.deepEqual(result.results, []);
  assert.equal(result.debug.rejectedCount, 0);
});
