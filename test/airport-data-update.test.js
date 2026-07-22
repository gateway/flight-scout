import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);
const UPDATE_SCRIPT = fileURLToPath(new URL("../scripts/update-airport-data.mjs", import.meta.url));

test("airport data updater emits a deterministic licensed scheduled-service snapshot", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "flight-airport-data-"));
  try {
    const airports = path.join(root, "airports.csv");
    const countries = path.join(root, "countries.csv");
    const regions = path.join(root, "regions.csv");
    const output = path.join(root, "airports.json");
    const metadata = path.join(root, "airports.meta.json");
    await writeFile(airports, AIRPORTS_CSV);
    await writeFile(countries, COUNTRIES_CSV);
    await writeFile(regions, REGIONS_CSV);

    const args = [
      UPDATE_SCRIPT,
      "--airports", airports,
      "--countries", countries,
      "--regions", regions,
      "--out", output,
      "--meta", metadata,
      "--generated-at", "2026-07-17T00:00:00.000Z"
    ];
    await execFileAsync(process.execPath, args);

    const firstDataText = await readFile(output, "utf8");
    const firstMetaText = await readFile(metadata, "utf8");
    await execFileAsync(process.execPath, args);

    assert.equal(await readFile(output, "utf8"), firstDataText);
    assert.equal(await readFile(metadata, "utf8"), firstMetaText);
    assert.deepEqual(JSON.parse(firstDataText), {
      version: 2,
      airports: [
        ["AAA", "Alpha International", "Alpha", "AA", "Aland", "AA-1", "North", "large_airport", ["MET"], true],
        ["AAB", "Beta City", "Beta", "AA", "Aland", "AA-1", "North", "medium_airport", ["MET"], true]
      ]
    });

    const meta = JSON.parse(firstMetaText);
    assert.deepEqual({
      schemaVersion: meta.schemaVersion,
      source: meta.source,
      license: meta.license,
      generatedAt: meta.generatedAt,
      airportCount: meta.airportCount
    }, {
      schemaVersion: 2,
      source: "OurAirports",
      license: "Public Domain",
      generatedAt: "2026-07-17T00:00:00.000Z",
      airportCount: 2
    });
    assert.match(meta.sourceSha256.airports, /^[a-f0-9]{64}$/);
    assert.match(meta.sourceSha256.countries, /^[a-f0-9]{64}$/);
    assert.match(meta.sourceSha256.regions, /^[a-f0-9]{64}$/);
    assert.match(meta.sourceSha256.serviceOverrides, /^[a-f0-9]{64}$/);
    assert.match(meta.dataSha256, /^[a-f0-9]{64}$/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("airport data updater preserves a service correction for exact lookup", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "flight-airport-service-"));
  try {
    const args = await fixtureArgs(root);
    const airportsPath = path.join(root, "airports.csv");
    const overridesPath = path.join(root, "service-overrides.json");
    await writeFile(airportsPath, `${AIRPORTS_CSV}5,LFPB,large_airport,Paris-Le Bourget Airport,0,0,0,EU,FR,FR-IDF,Paris,yes,LFPB,LBG,LFPB,,,,PAR\n`);
    await writeFile(overridesPath, `${JSON.stringify({ LBG: { scheduledService: false } })}\n`);

    await execFileAsync(process.execPath, [UPDATE_SCRIPT, ...args, "--service-overrides", overridesPath]);

    const snapshot = JSON.parse(await readFile(path.join(root, "airports.json"), "utf8"));
    const leBourget = snapshot.airports.find((airport) => airport[0] === "LBG");
    assert.equal(leBourget?.[9], false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("airport data updater rejects unknown command-line options", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "flight-airport-options-"));
  try {
    const args = await fixtureArgs(root);
    await assert.rejects(
      execFileAsync(process.execPath, [UPDATE_SCRIPT, ...args, "--airprots", "airports.csv"]),
      (error) => {
        assert.match(error.stderr, /Unknown option --airprots/);
        return true;
      }
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("airport data updater rejects duplicate IATA codes", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "flight-airport-duplicates-"));
  try {
    const args = await fixtureArgs(root);
    await writeFile(path.join(root, "airports.csv"), `${AIRPORTS_CSV}5,AAAE,medium_airport,Duplicate Alpha,0,0,0,EU,AA,AA-1,Epsilon,yes,AAAE,AAA,AAAE,,,,\n`);
    await assert.rejects(
      execFileAsync(process.execPath, [UPDATE_SCRIPT, ...args]),
      (error) => {
        assert.match(error.stderr, /Duplicate IATA code AAA/);
        return true;
      }
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

async function fixtureArgs(root) {
  const airports = path.join(root, "airports.csv");
  const countries = path.join(root, "countries.csv");
  const regions = path.join(root, "regions.csv");
  await writeFile(airports, AIRPORTS_CSV);
  await writeFile(countries, COUNTRIES_CSV);
  await writeFile(regions, REGIONS_CSV);
  return [
    "--airports", airports, "--countries", countries, "--regions", regions,
    "--out", path.join(root, "airports.json"), "--meta", path.join(root, "airports.meta.json")
  ];
}

const AIRPORTS_CSV = `id,ident,type,name,latitude_deg,longitude_deg,elevation_ft,continent,iso_country,iso_region,municipality,scheduled_service,icao_code,iata_code,gps_code,local_code,home_link,wikipedia_link,keywords
1,AAAA,large_airport,Alpha International,0,0,0,EU,AA,AA-1,Alpha,yes,AAAA,AAA,AAAA,,,,MET
2,AAAB,medium_airport,Beta City,0,0,0,EU,AA,AA-1,Beta,yes,AAAB,AAB,AAAB,,,,"MET, old field"
3,AAAC,seaplane_base,Water Field,0,0,0,EU,AA,AA-1,Gamma,yes,AAAC,AAC,AAAC,,,,
4,AAAD,medium_airport,No IATA,0,0,0,EU,AA,AA-1,Delta,yes,AAAD,,AAAD,,,,
`;

const COUNTRIES_CSV = `id,code,name,continent,wikipedia_link,keywords
1,AA,Aland,EU,,
`;

const REGIONS_CSV = `id,code,local_code,name,continent,iso_country,wikipedia_link,keywords
1,AA-1,1,North,EU,AA,,
`;
