# Codex Skill Usage

The app and the Codex skill are separate pieces:

- The app stores plans, runs FLI searches, and generates the dashboards.
- The skill helps Codex understand natural-language flight requests and choose the right app commands.

The skill is written for Codex's local skill system. It does not install Codex, Claude, or any other assistant. You need to run it from a Codex environment that can see this project folder and run local commands.

## Install

From the project folder:

```bash
npm run setup
npm run skill:install
```

`npm run setup` creates a project-local Python virtual environment in `.venv`, installs the one direct Python dependency (`flights==0.9.0`), and writes `.env`.

`npm run skill:install` copies `skills/flight-plan-riffer` into your Codex skills folder:

```text
~/.codex/skills/flight-plan-riffer
```

If `CODEX_HOME` is set, it installs there instead:

```text
$CODEX_HOME/skills/flight-plan-riffer
```

Restart Codex or start a new session if the skill does not appear immediately.

## Start The App

```bash
npm run serve
```

Open:

```text
http://127.0.0.1:8765/
```

The skill can ask Codex to start this server when you request it, but the server is still just this local project running on your machine.

## Use The Skill

In Codex, ask with the skill name:

```text
Use $flight-plan-riffer. I need a one-way flight from Bangkok to Redmond around August 1, plus or minus 3 days. Keep it under 26 hours and around $1,200 if possible.
```

Expected behavior:

- If the request is unclear, the skill asks 2-3 concise questions.
- If the request is clear, it repeats the plan back before searching.
- It shows the exact routes and dates it will check.
- It waits for confirmation before running local FLI searches.
- After confirmation, Codex runs the app commands, refreshes the plan, regenerates dashboards, and can open the local dashboard when browser access is available.

## Local Codex App vs Cloud

In the local Codex desktop app, Codex can run the local server and open the dashboard in the in-app browser.

In a cloud or remote Codex environment, the app can still generate plans and HTML files, but the browser view depends on that environment's port forwarding and artifact support. If the dashboard cannot be opened directly, use the generated files under `outputs/`.

## What About Claude?

Claude can use the app as a local command-line project if you give it access to the folder and the commands in [Command Reference](COMMAND_REFERENCE.md). The included `$flight-plan-riffer` skill is not a Claude Desktop plugin and is not automatically loaded by Claude.

If you want Claude Desktop to drive this with the same natural-language flow, build a separate Claude-compatible adapter around the same plan commands. The plan files and dashboard generation do not need to change.

## Manual CLI Flow

You can use the app without the skill:

```bash
npm run plan:new -- "Find one-way flights from Chiang Mai to Tokyo around August 1, plus or minus 2 days. Budget under $800 and under 10 hours if possible."
npm run plan:refresh-plan -- plans/<plan-id>/plan.json --mode standard
npm run plan:refresh -- plans/<plan-id>/plan.json --mode standard --live
npm run plan:dashboard -- plans/<plan-id>/plan.json --mode standard
npm run plan:list-dashboard
```

Use the skill when you want Codex to handle the interpretation and command sequence for you.
