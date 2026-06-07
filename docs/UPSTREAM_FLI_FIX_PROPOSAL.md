# Upstream fli Fix Proposal

This note captures the smallest useful upstream contribution candidate found while integrating the low-cost provider.

## Candidate Bug

Some Google Flights rows can arrive without a usable price. A CLI or formatter that assumes every row has a price can crash instead of skipping or displaying the incomplete row safely.

## Minimal Reproduction Shape

Use a Google Flights query that returns mixed rows where at least one row has no price. The exact route can change over time because Google response data is live, so the durable test should use a fixture with one complete row and one missing-price row.

Expected behavior:

- priced rows continue to parse and display
- missing-price rows are skipped or represented as unavailable
- the CLI exits successfully when at least one valid row exists

Actual failure class:

- formatter or parser attempts to format `None`/`null` as a price
- command exits with an exception instead of returning valid rows

## Proposed Upstream Patch Scope

- Add a fixture with one priced row and one missing-price row.
- Add one parser or CLI test proving the command does not crash.
- Guard price formatting and sorting against missing price.
- Keep the patch limited to missing-price handling only.

## Local Workaround In This App

The local adapter in `src/providers/fli/fli_search_adapter.py` skips missing-price rows, records a rejected-count summary, and returns structured JSON. This keeps provider degradation from crashing plan refreshes.

## Do Not Include Upstream

- this app's provider registry
- dashboard code
- personal plan data
- API tokens
- local filesystem paths
