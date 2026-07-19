import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("the local FLI environment declares every required CLI runtime package", async () => {
  const requirements = await readFile("src/providers/fli/requirements.txt", "utf8");

  assert.match(requirements, /^flights==0\.9\.0$/m);
  assert.match(requirements, /^click==8\.3\.1$/m);
});
