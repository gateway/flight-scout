# FLI And Refresh Usage

The app should always show which searches it selected before it runs local FLI searches.

## Default Search Path

Flight scans use the local FLI adapter through `src/providers/fli/fli_search_adapter.py`.

The adapter asks Google Flights for:

- `currency: USD`
- `language: en-US`
- `country: US`

That keeps results consistent even when the user is physically outside the United States.

## FLI Install

Use the setup command:

```bash
npm run setup
```

That creates a project-local Python virtual environment in `.venv`, installs the pinned flight-search runtime, and writes `.env`.

Manual setup is still supported:

```bash
python -m pip install -r src/providers/fli/requirements.txt
FLI_PYTHON=/path/to/your/python
```

The current requirements file pins:

```text
flights==0.9.0
click==8.3.1
```

The local adapter imports the package as `fli`, which is expected for the `flights` Python package.

## Refresh Modes

`light`

Checks the searches most likely to change the current decision.

`standard`

Checks the active date window and main route ideas.

`targeted-deep`

Expands around challengers, stopovers, or routes that are close to becoming the best answer.

`deep`

Broad search mode. Use only when you intentionally want more coverage.

## Guardrails

- Local FLI execution requires `--live`.
- Individual plan refresh commands require an explicit `--mode`; the all-plan summary commands default to `standard`.
- The refresh plan shows selected searches and cache hits.
- Cached searches are reused when they are fresh enough.
- The app sleeps between fresh FLI searches.
- Source setup, rate-limit, or adapter errors are caught and reported instead of continuing to repeat failed searches.
- A scan must produce complete destination options before it is treated as successful; FLI failures should not fall back to unrelated stale cache data.

## Normal Workflow

```bash
npm run plan:refresh-plan -- plans/<plan-id>/plan.json --mode standard
npm run plan:refresh -- plans/<plan-id>/plan.json --mode standard
npm run plan:refresh -- plans/<plan-id>/plan.json --mode standard --live
```

The first command explains the selected searches. The second confirms the command path without local searches. The third runs FLI discovery.

`npm run plan:refresh-summary` reuses fresh cache data and may run missing or stale searches before rebuilding every active plan. `npm run plan:refresh-latest` forces fresh searches for every active plan. Neither command is a saved-data-only report.

## Local Cache Maintenance

Provider cache cleanup is always preview-first:

```bash
npm run cache:prune
```

The command defaults to files older than 30 days and protects every active plan's departure and return windows. It does not inspect or remove snapshots. See `docs/COMMAND_REFERENCE.md` for the explicit confirmed deletion form.

## Optional Scheduling

Flight Scout provides one cron-friendly command:

```bash
npm run plan:refresh-scheduled -- --mode standard --jitter-ms 300000
```

Each invocation performs at most one cache-aware pass over active plans, rebuilds the dashboards and lowdown, then exits. A local ownership lock prevents overlapping scheduled runs. The random delay is bounded by `--jitter-ms`; use `0` when the external scheduler already supplies jitter. Interrupted runs release their owned lock, and stale locks from dead processes are reclaimed.

Flight Scout does not install a schedule or run an always-on process. Use cron, `launchd`, or another local scheduler only when periodic refresh is wanted. Archived plans are never selected by the scheduled command.

FLI accepts atomic one-way searches. The app can compare a stopover, alternate start, or round trip by combining one-way result sets locally. Round-trip dashboards show the combined fare and travel time but keep outbound and return booking links separate and warn that ticket rules are independent. The app never sends or claims provider-native round-trip or multi-city work.
