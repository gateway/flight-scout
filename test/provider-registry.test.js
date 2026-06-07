import test from "node:test";
import assert from "node:assert/strict";
import { createProviderRegistry } from "../src/providers/provider-registry.js";
import { PROVIDERS } from "../src/providers/provider-types.js";

test("provider registry returns known providers and rejects unknown providers", () => {
  const registry = createProviderRegistry([
    { id: PROVIDERS.FLI, label: "fli" }
  ]);

  assert.equal(registry.has(PROVIDERS.FLI), true);
  assert.equal(registry.get(PROVIDERS.FLI).label, "fli");
  assert.throws(() => registry.get("missing-provider"), /Unknown flight data provider/);
});

test("provider registry rejects duplicate provider ids", () => {
  assert.throws(
    () => createProviderRegistry([{ id: "same" }, { id: "same" }]),
    /Duplicate provider id/
  );
});
