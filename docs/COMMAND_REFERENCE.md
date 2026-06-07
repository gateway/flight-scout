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

## Verification

```bash
npm test
npm run guard:bloat
npm run release:audit
```
