import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("the local FLI environment declares every required runtime package", async () => {
  const requirements = await readFile("src/providers/fli/requirements.txt", "utf8");

  assert.match(requirements, /^flights @ https:\/\/github\.com\/punitarani\/fli\/archive\/[a-f0-9]{40}\.tar\.gz$/m);
  // The adapter only imports fli.core, fli.models, and fli.search, none of which
  // need Click; fli's Click-based terminal CLI is never invoked by this app.
  assert.doesNotMatch(requirements, /click/i);
});
