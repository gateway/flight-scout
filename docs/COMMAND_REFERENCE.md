# Command Reference

Most users should start with the README and the Codex skill. This page is for direct CLI usage, debugging, and release verification.

## Setup

```bash
npm run setup
npm run skill:install
```

## Local App

```bash
npm run serve
```

Open:

```text
http://127.0.0.1:8765/
```

Open from another device on your LAN or Tailscale network:

```bash
npm run serve:lan
```

Then open:

```text
http://<your-computer-ip>:8765/
```

## Intent And Plan Creation

Check what the app understands:

```bash
npm run intent -- "Find one-way flights from Chiang Mai to Bangkok around August 1, plus or minus 3 days. Prefer direct flights and keep it near $100 if possible."
```

Create a saved plan:

```bash
npm run plan:new -- "Find one-way flights from Chiang Mai to Bangkok around August 1, plus or minus 3 days. Prefer direct flights and keep it near $100 if possible."
```

## Search Check And Refresh

Review selected searches:

```bash
npm run plan:refresh-plan -- plans/<plan-id>/plan.json --mode standard
```

Validate the refresh path without provider requests:

```bash
npm run plan:refresh -- plans/<plan-id>/plan.json --mode standard
```

Run the reviewed local FLI search:

```bash
npm run plan:refresh -- plans/<plan-id>/plan.json --mode standard --live
```

Refresh every active saved plan, rebuild the dashboards, and write a markdown lowdown:

```bash
npm run plan:refresh-summary
```

Force a fresh local refresh for every active saved plan. Use this when you want the latest prices right now:

```bash
npm run plan:refresh-latest
```

Run one cache-aware active-plan refresh suitable for cron or `launchd`:

```bash
npm run plan:refresh-scheduled -- --mode standard --jitter-ms 300000
```

This command exits after one pass. It skips archived plans, waits for a random delay up to the configured jitter bound, and skips the pass when another scheduled refresh owns the local lock. Cron or `launchd` controls repetition; Flight Scout does not install or run a background daemon.

Output:

- `index.html` and `outputs/plans.dashboard.html`
- Per-plan dashboard pages under `outputs/`
- `outputs/latest-refresh-lowdown.md`

## Dashboards

Regenerate one plan dashboard:

```bash
npm run plan:dashboard -- plans/<plan-id>/plan.json --mode standard
```

Regenerate the root plans dashboard:

```bash
npm run plan:list-dashboard
```

Archive or restore a plan:

```bash
npm run plan:archive -- plans/<plan-id>/plan.json
npm run plan:archive -- plans/<plan-id>/plan.json --restore
```

## Snapshots

List snapshots:

```bash
npm run plan:snapshots -- plans/<plan-id>/plan.json
```

Compare the two newest snapshots for a plan:

```bash
npm run plan:compare -- plans/<plan-id>/plan.json
```

## Cache Maintenance

Preview provider cache files older than 30 days:

```bash
npm run cache:prune
```

Choose a different age without deleting anything:

```bash
npm run cache:prune -- --older-than-days 45
```

The preview lists files eligible for removal, files protected by active departure or return dates, and files skipped by safety checks. It never reads or deletes snapshot history. After reviewing the preview, delete only the eligible files with the exact confirmation phrase:

```bash
npm run cache:prune -- --older-than-days 45 --apply --confirm "DELETE STALE CACHE"
```

Malformed cache names, unknown provider suffixes, symlinks, out-of-root cache directories, and cache entries inside active plan windows are never deletion candidates. If active plan metadata cannot be read safely, the command stops without deleting anything.

## Options

- `--mode <name>` selects `light`, `standard`, `targeted-deep`, or `deep` refresh planning on plan creation, refresh, and dashboard commands.
- `--live` executes the selected local searches with `plan:refresh`; without it, that command is a dry run.
- `--refresh` reruns saved searches on refresh commands. `--force` is its alias.
- `--max-runs <number>` caps fresh searches with a positive integer on `plan:refresh` and `plan:refresh-summary`.
- `--jitter-ms <number>` sets the non-negative maximum random delay for `plan:refresh-scheduled`; the default is five minutes.
- `--baseline-ranked <file>` imports ranked JSON through `plan:refresh` instead of running searches.
- `--out <path>` sets the intent file, new-plan directory, or generated dashboard path on the commands that create those artifacts.
- `--restore` restores a plan when used with `plan:archive`.
- `--older-than-days <number>` changes the 30-day cache age threshold for `cache:prune`.
- `--apply --confirm "DELETE STALE CACHE"` explicitly enables deletion after a cache preview.

Unknown options, removed no-op options, missing values, and invalid `--max-runs` values fail with a concise error.

## Search Shape

Provider work is always one-way. Stopover, alternate-start, and round-trip plans are composed from provider-supported one-way legs. Round-trip comparisons pair compatible outbound and return date results, total their fares and travel time, show both booking links, and disclose that they are separate tickets. Provider-native multi-city work is not supported.

## Verification

```bash
npm test
npm run guard:bloat
npm run release:audit
```
