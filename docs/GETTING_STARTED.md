# Getting Started

This guide walks through the public workflow for creating a flight plan, reviewing the selected searches, running the local FLI search, and opening the dashboard.

## 1. Install

```bash
git clone <your-repo-url>
cd flight-research-agent
npm run setup
```

That creates a project-local Python virtual environment in `.venv`, installs the one direct Python dependency (`flights==0.9.0`), and writes `.env`.

Optional Codex skill install:

```bash
npm run skill:install
```

Use this when you want Codex to interpret rough flight requests with `$flight-plan-riffer`. The installer copies the skill to `~/.codex/skills/flight-plan-riffer`, or to `$CODEX_HOME/skills/flight-plan-riffer` when `CODEX_HOME` is set. It does not install Codex itself.

Claude and other assistants can still use the app through the command-line flow, but they do not automatically load the Codex skill format.

Only use the manual path if you already have a Python environment you want to manage yourself:

```bash
python -m pip install -r src/providers/fli/requirements.txt
echo "FLI_PYTHON=/path/to/your/python" > .env
```

`FLI_PYTHON` is just the Python executable the app should use for local flight searches. Do not commit `.env`.

## 2. Start The Dashboard

```bash
npm run serve
```

Open:

```text
http://127.0.0.1:8765/
```

The root page lists active plans and links to each plan dashboard.

To view the app from another device on your LAN or Tailscale network, start it with:

```bash
npm run serve:lan
```

Then open:

```text
http://<your-computer-ip>:8765/
```

The regular `npm run serve` command binds to `127.0.0.1`, which only accepts same-machine browser traffic.

## 3. Check Intent

If you installed the Codex skill, you can start in Codex with:

> Use `$flight-plan-riffer`. Find one-way flights from Chiang Mai to Tokyo around August 1, plus or minus 2 days. Budget under $800 and under 10 hours if possible.

The skill should repeat back the understood plan and ask for confirmation before local FLI searches run.

Use this from a Codex desktop or CLI session that can access the project folder. In the local Codex desktop app, the assistant can also start the server and open the dashboard when browser tools are available.

The direct CLI path is:

```bash
npm run intent -- "Find one-way flights from Chiang Mai to Bangkok around August 1, plus or minus 3 days. Prefer direct flights and keep it near $100 if possible. Build the plan first so I can review it."
```

Expected output:

- trip type
- origin and destination
- date window
- route ideas
- assumptions
- missing details, if any

If the system cannot resolve the city, airport, dates, trip type, or budget constraints, it should ask concise clarification questions instead of guessing.

## 4. Create A Saved Plan

```bash
npm run plan:new -- "Find one-way flights from Chiang Mai to Bangkok around August 1, plus or minus 3 days. Prefer direct flights and keep it near $100 if possible. Build the plan first so I can review it."
```

Expected output:

- saved plan path
- confirmation that no provider search has run yet
- selected refresh mode
- selected search count
- the command to run when approved

## 5. Check Selected Searches

```bash
npm run plan:refresh-plan -- plans/<plan-id>/plan.json --mode standard
```

This writes a refresh plan and explains which searches would run.

## 6. Run The Local Search

```bash
npm run plan:refresh -- plans/<plan-id>/plan.json --mode standard --live
```

The system will:

- use fresh local cache when possible
- run FLI only for missing or stale searches
- sleep between fresh calls
- write a snapshot
- regenerate the plan dashboard
- update the main plans page

The app uses the local FLI provider by default. The `--live` flag means the reviewed searches should execute. Leave it off when you only want to validate the command path.

## 7. Open Results

```text
http://127.0.0.1:8765/
```

Each plan can generate:

- decision and budget dashboard
- date comparison page
- route evidence page
- refresh history page
- all-plans overview

## Expected Human Read

The dashboard should lead with a short practical summary, for example:

```text
If I were booking this today, I would check the balanced option first. It is not always the absolute cheapest, but it has the cleanest mix of price, total time, and connection risk. The cheapest option is still worth opening if saving money matters more than convenience.
```

That summary should link to the exact flight details when a matching flight card exists.
