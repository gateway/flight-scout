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

That creates a project-local Python virtual environment in `.venv`, installs `flights==0.9.0`, and writes `.env`.

Manual setup is still supported:

```bash
python -m pip install -r src/providers/fli/requirements.txt
FLI_PYTHON=/path/to/your/python
```

The current requirements file pins:

```text
flights==0.9.0
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
- Refresh commands require an explicit `--mode`.
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
