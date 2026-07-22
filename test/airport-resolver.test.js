import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { airportMetadataForCode, resolveAirportPlace } from "../src/airport-resolver.js";

test("airport resolver expands an unambiguous city through scheduled airport data", () => {
  assert.deepEqual(resolveAirportPlace("London, United Kingdom").place, {
    label: "London",
    airports: ["LGW", "LHR", "LTN", "STN", "LCY"]
  });
  assert.deepEqual(resolveAirportPlace("Sydney, Australia").place, {
    label: "Sydney",
    airports: ["SYD"]
  });
});

test("airport resolver uses metro keywords without merging unrelated same-name cities", () => {
  assert.deepEqual(resolveAirportPlace("New York").place, {
    label: "New York",
    airports: ["JFK", "LGA", "EWR"]
  });
  assert.equal(resolveAirportPlace("Springfield").status, "unresolved");
});

test("airport resolver validates explicit uppercase IATA codes against airport data", () => {
  assert.deepEqual(resolveAirportPlace("JFK").place, {
    label: "JFK",
    airports: ["JFK"]
  });
  assert.equal(resolveAirportPlace("ZZZ").status, "unresolved");
  assert.deepEqual(resolveAirportPlace("Keflavik, Iceland KEF").place, {
    label: "Keflavik",
    airports: ["KEF"]
  });
});

test("airport resolver exposes country metadata without changing the place contract", () => {
  assert.deepEqual(airportMetadataForCode("TPE"), {
    code: "TPE",
    name: "Taiwan Taoyuan International Airport",
    municipality: "Taoyuan",
    isoCountry: "TW",
    country: "Taiwan",
    isoRegion: "TW-TAO",
    region: "Taoyuan City",
    type: "large_airport"
  });
  assert.equal(airportMetadataForCode("ZZZ"), null);
});

test("airport resolver covers common international cities without route-specific aliases", () => {
  const cases = new Map([
    ["Berlin, Germany", ["BER"]],
    ["Singapore", ["SIN"]],
    ["Toronto, Canada", ["YYZ", "YTZ"]]
  ]);
  for (const [input, airports] of cases) {
    assert.deepEqual(resolveAirportPlace(input).place?.airports, airports, input);
  }
});

test("airport resolver prefers dataset-qualified places over substring aliases", () => {
  assert.deepEqual(resolveAirportPlace("Portland, Maine").place, {
    label: "Portland",
    airports: ["PWM"]
  });
  assert.deepEqual(resolveAirportPlace("Redmond, Oregon").place, {
    label: "Redmond",
    airports: ["RDM"]
  });
  assert.equal(resolveAirportPlace("Georgetown, Taiwan").status, "unresolved");
});

test("airport resolver keeps dataset-backed multi-airport cities after alias removal", () => {
  assert.deepEqual(resolveAirportPlace("Paris").place, {
    label: "Paris",
    airports: ["CDG", "ORY"]
  });
  assert.deepEqual(resolveAirportPlace("Bangkok").place, {
    label: "Bangkok",
    airports: ["BKK", "DMK"]
  });
  assert.deepEqual(resolveAirportPlace("Tokyo").place, {
    label: "Tokyo",
    airports: ["HND", "NRT"]
  });
});

test("airport data cold load stays within the CLI startup budget", () => {
  const resolverUrl = new URL("../src/airport-resolver.js", import.meta.url).href;
  const script = [
    "const started = performance.now();",
    `const resolver = await import(${JSON.stringify(resolverUrl)});`,
    "const result = resolver.resolveAirportPlace('London, United Kingdom');",
    "console.log(JSON.stringify({ elapsed: performance.now() - started, airports: result.place.airports }));"
  ].join("\n");
  const output = execFileSync(process.execPath, ["--input-type=module", "--eval", script], { encoding: "utf8" });
  const result = JSON.parse(output);

  assert.deepEqual(result.airports, ["LGW", "LHR", "LTN", "STN", "LCY"]);
  assert.ok(result.elapsed < 500, `cold airport resolution took ${result.elapsed.toFixed(1)}ms`);
});
