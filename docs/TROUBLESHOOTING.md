# Troubleshooting

Use this when a plan does not scan, a dashboard looks empty, or provider output does not look right.

## The Local Provider Cannot Run

Symptom:

```text
Could not run /path/to/python.
```

Fix:

```bash
npm run setup
```

If you manage Python manually, install the dependency and point `.env` at that Python:

```bash
python -m pip install -r src/providers/fli/requirements.txt
FLI_PYTHON=/path/to/your/python
```

Run a dry refresh before executing the selected searches:

```bash
npm run plan:refresh -- plans/<plan-id>/plan.json --mode standard
```

## A Scan Ran But The Dashboard Has No Flights

The app treats a scan as useful only when it produces complete options that reach the destination airport. If FLI searches fail or return partial data, the dashboard should not pretend the scan succeeded.

Check:

```bash
npm run plan:snapshots -- plans/<plan-id>/plan.json
```

You want to see complete options greater than zero.

## The Refresh Selects Too Many Searches

Check the search plan first:

```bash
npm run plan:refresh-plan -- plans/<plan-id>/plan.json --mode light
```

Use `light` or `standard` before `deep`.

The default local search path should use FLI.

## Prices Are In The Wrong Currency

The app requests USD from both providers. If a provider returns another currency, the comparison layer ignores mixed-currency price movement instead of treating it as a real fare change.

For local scans, confirm the provider input includes:

```text
currency: USD
hl: en-US
gl: US
```

## Google Flights Links Need Final Verification

Generated links are research shortcuts, not booking guarantees. Before buying, verify:

- fare still exists
- baggage rules
- separate-ticket risk
- airport changes
- connection times
- final airline or travel-provider checkout price

## Provider Search Fails

If source setup, rate-limit, or account errors appear, use the normal FLI path and avoid broad searches until the issue is clear:

```bash
npm run plan:refresh -- plans/<plan-id>/plan.json --mode standard --live
```


## The Main Plans Page Looks Stale

Regenerate it:

```bash
npm run plan:list-dashboard
```

Then reload:

```text
http://127.0.0.1:8765/
```

## The Local Server Is Not Running

Start it:

```bash
npm run serve
```

Open:

```text
http://127.0.0.1:8765/
```

## Phone Or Tailscale Device Cannot Open The Dashboard

`npm run serve` listens on `127.0.0.1`, which only works from the same computer.

Use:

```bash
npm run serve:lan
```

Then open:

```text
http://<your-computer-ip>:8765/
```

For Tailscale, use the computer's Tailscale IP or MagicDNS name. If it still does not load, check that macOS firewall allows incoming connections for Node.
