# Assistant Skill Usage

The app and the skill are separate pieces:

- The app stores plans, runs FLI searches, and generates the dashboards.
- The skill helps an assistant understand natural-language flight requests and choose the right app commands.

The skill uses the shared local SKILL.md format that both Codex and Claude Code load. It does not install any assistant. You need an assistant session that can see this project folder and run local commands.

## Install

From the project folder:

```bash
npm run setup
npm run skill:install
```

`npm run setup` creates a project-local Python virtual environment in `.venv`, installs the pinned flight-search runtime, and writes `.env`.

`npm run skill:install` copies `skills/flight-plan-riffer` into every assistant skills folder found on your machine:

```text
~/.codex/skills/flight-plan-riffer     (Codex; honors CODEX_HOME)
~/.claude/skills/flight-plan-riffer    (Claude Code; honors CLAUDE_HOME)
```

Force a single target with `npm run skill:install -- --codex` or `-- --claude`.

Start a new assistant session if the skill does not appear immediately. Invoke it with `$flight-plan-riffer` in Codex or `/flight-plan-riffer` in Claude Code.

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

> Use `$flight-plan-riffer`. I need a one-way flight from Bangkok to Redmond around August 1, plus or minus 3 days. Keep it under 26 hours and around $1,200 if possible.

Expected behavior:

- If the request is unclear, the skill asks 2-3 concise questions.
- If the request is clear, it repeats the plan back before searching.
- It shows the exact routes and dates it will check.
- It waits for confirmation before running local FLI searches.
- After confirmation, Codex runs the app commands, refreshes the plan, regenerates dashboards, and can open the local dashboard when browser access is available.
- When you provide a price target or total-time limit, the saved plan can show a local watch alert after a refreshed flight satisfies it.

For an existing set of plans, use language like:

> Use `$flight-plan-riffer`. Refresh all active flight plans with the latest data, rebuild the dashboards, and tell me what changed.

The skill should map that to the fresh all-plan refresh path, then summarize the best practical option, cheapest option, fastest reasonable option, any new option worth opening, and whether prices mostly moved higher or lower.

Saved watch targets are checked only when results are refreshed. Flight Scout does not run a background monitor or send external notifications.

The skill can compare one-way travel, stopovers, alternate starts, and round trips. Round trips are built from independent outbound and return one-way searches, so the result must say that the tickets are booked separately and show both booking links. Provider-native multi-city searches remain unsupported.

## Local Codex App vs Cloud

In the local Codex desktop app, Codex can run the local server and open the dashboard in the in-app browser.

In a cloud or remote Codex environment, the app can still generate plans and HTML files, but the browser view depends on that environment's port forwarding and artifact support. If the dashboard cannot be opened directly, use the generated files under `outputs/`.

## What About Other Assistants?

Claude Code loads the same skill directly; after `npm run skill:install`, invoke it with `/flight-plan-riffer` in a session that can see this project folder.

Any other assistant can use the app as a local command-line project if you give it access to the folder and the commands in [Command Reference](COMMAND_REFERENCE.md). Claude Desktop without Claude Code does not load local skills.

## Manual CLI Flow

You can use the app without the skill:

```bash
npm run plan:new -- "Find one-way flights from Chiang Mai to Tokyo around August 1, plus or minus 2 days. Budget under $800 and under 10 hours if possible."
npm run plan:refresh-plan -- plans/<plan-id>/plan.json --mode standard
npm run plan:refresh -- plans/<plan-id>/plan.json --mode standard --live
npm run plan:dashboard -- plans/<plan-id>/plan.json --mode standard
npm run plan:refresh-latest
npm run plan:list-dashboard
```

Use the skill when you want Codex to handle the interpretation and command sequence for you.
