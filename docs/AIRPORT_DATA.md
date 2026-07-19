# Airport Data

Flight Scout bundles a compact airport snapshot so city and airport-code resolution works offline. The snapshot contains scheduled-service airports with three-letter IATA codes and is not downloaded while the app is running.

## Source And License

- Source: [OurAirports data downloads](https://ourairports.com/data/)
- Data dictionary: [OurAirports data dictionary](https://ourairports.com/help/data-dictionary.html)
- License: Public Domain
- Included files: airports, countries, and regions
- Generated snapshot: `data/airports.json`
- Provenance and checksums: `data/airports.meta.json`

The generated snapshot keeps only large, medium, and small airports that advertise scheduled service and a valid IATA code. It stores the fields needed for code validation, city resolution, country-aware disambiguation, metro-airport expansion, and connection geography.

## Updating The Snapshot

Run the updater from the project root:

```bash
node scripts/update-airport-data.mjs
```

The updater downloads the three official CSV files, writes the snapshot atomically, and records SHA-256 checksums for every source and the generated data. Review both generated files before committing an update, then run:

```bash
node --test test/airport-data-update.test.js test/airport-resolver.test.js
npm test
npm run release:audit
```

OurAirports publishes updates nightly. Flight Scout does not need every nightly change; refresh the bundled snapshot for a release that needs updated airport coverage or metadata.

## Resolution Boundaries

- Curated aliases remain authoritative for familiar ambiguous requests such as Bangkok or Tokyo.
- Explicit IATA codes are validated against the snapshot.
- A city with multiple countries or unrelated regions remains unresolved unless the user supplies enough geography.
- Metro keywords may add large nearby airports, but do not add secondary medium airports that the user did not name.
- Airport data helps interpret a request. It does not prove that an airline serves a route on a requested date.
