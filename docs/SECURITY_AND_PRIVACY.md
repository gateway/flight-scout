# Security And Privacy

Flight searches can contain personal travel dates, home airports, destination airports, and budget preferences. Treat generated data as private by default.

## Never Commit

- `.env`
- `cache/`
- `outputs/`
- `plans/`
- `trips/`
- raw snapshots
- personal route reports
- local absolute paths
- task notes that describe private travel plans

The repository `.gitignore` excludes those paths for public use.

## Safe To Commit

- source code under `src/`
- tests under `test/`
- public docs under `docs/`
- sanitized examples under `examples/`
- `.env.example`
- `package.json`

## Local Environment

Use the setup script locally:

```bash
npm run setup
```

The setup script writes `.env`. `FLI_PYTHON` is a local executable path, not a secret, but it can reveal a personal directory structure. Keep it in `.env`, not committed docs or examples.

Do not paste secrets, private local paths, screenshots of personal dashboards, or generated trip JSON into committed docs or examples.

## Before Publishing

Run:

```bash
rg -n "api key|secret|sk-|AIza|token=|/Users/|/home/" .
```

Review any matches manually. Placeholder names are acceptable; real token values, private local paths, and generated trip data are not.

## Generated HTML

Generated dashboards are meant for local review. They can contain personal trip data and should not be published unless intentionally sanitized.
