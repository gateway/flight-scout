---
name: flight-plan-riffer
description: Turn rough natural-language flight ideas into saved flight research plans with route ideas, date windows, cheapest-date scans, optional stopovers, alternate starts, airport-code clarification, filters, viability rules, FLI-first provider strategy, and confirmation-gated refresh strategy. Use when the user wants to brainstorm or create a flight plan, compare routes, include or skip stopovers, search plus/minus date ranges, avoid long flights or tight layovers, track price drops, refresh flight data, or build/update a local flight-research-agent plan/dashboard.
---

# Flight Plan Riffer

Use this skill to convert a human travel riff into a concrete flight research plan. The goal is not to book flights; it is to understand intent, capture the right searches, avoid unnecessary local FLI searches, and present human-readable tradeoffs.

## Workflow

1. Interpret the user's plain-language plan.
   - Extract origin, destination, date window, trip type, passenger count, stopovers, alternate starts, budget, filters, watch/alert rules, and pain limits.
   - Treat "date A to B" as a set of one-way candidate departure dates unless the user explicitly asks round trip.
   - Treat "plus or minus N days" as a centered date window.
   - Treat "cheapest dates", "best days", or "find the cheapest day" as a date-window scan, not a single-date search.
   - Treat "maybe stop in X" as an optional route idea, not a required route.
   - Treat "if X is too expensive, skip it" as a direct route plus a stopover route comparison.
   - Treat "watch this", "track this", "tell me if it drops", or "under $X" as saved plan metadata for future refresh comparison.

2. Ask clarifying questions only when needed.
   - Ask no more than 3 short questions if airports, dates, trip type, stopover intent, or hard constraints are unclear.
   - Prefer concrete questions: airport/city ambiguity, date range, one-way vs round-trip, required vs optional stopover, budget and maximum pain threshold.
   - If the user gives a soft target and a hard limit that could conflict, ask back in plain language before scanning (for example: "Should I treat 11 hours as a nice-to-have and 26 hours as the hard cutoff?").
   - If the user gives no date, ask for a date or date range before creating scan searches.
   - If the user gives a date but not flexibility, ask whether they want the exact date or a plus/minus window only when flexibility materially changes the search set.
   - Do not guess when a missing answer would send the wrong searches to the provider.
   - Do not ask if reasonable defaults are clear from the request and can be shown back for confirmation.

3. Create route ideas before fetching data.
   - Include the user's main route.
   - Include alternate starts when the user mentions nearby airports, gateway cities, or getting to a different city before the long-haul flight.
   - Include stopover routes as separate route ideas with explicit stay nights.
   - Include "skip stopover" alternatives when the user says the stopover is optional.

4. Convert preferences into enforceable rules.
   - "no long long flights", "brutal", or "painful" -> hard elapsed-time threshold.
   - "max 30 hours" -> `rejectTotalElapsedHoursOver: 30`.
   - "I hate tight layovers" -> increase connection minimums.
   - "worth it only if much cheaper" -> compare dollars saved per added travel hour.
   - "nonstop", "direct", "one stop max", "avoid airline X", "only airline X", "leave after 8am", "arrive before midnight", "exclude basic economy", and cabin class should become explicit provider filters or visible assumptions.
   - Keep raw provider data, but exclude hard rejects from recommendations.

5. Plan refreshes before local FLI searches.
   - Always describe the search check before FLI searches.
   - Use the built-in local FLI search path. The user should not need to ask for this.
   - Use `light` for decision leaders, `standard` for the active date window, `targeted-deep` for broader but controlled coverage, and `deep` only after explicit confirmation.
   - Surface the number of date/route searches, which dates will be checked, whether existing saved data can be reused, and why the mode fits the request.
   - Always request and display USD. Do not compare mixed-currency snapshots; if old data is not USD, mark the comparison as not directly comparable.
   - After a scan, verify the new snapshot has complete options for the requested destination before calling the scan successful. If FLI searches fail or the dashboard would show no decision-ready flights, stop and report the setup issue instead of falling back to stale cache data.
   - When regenerating a snapshot from a selected refresh plan, aggregate only the searches selected for that refresh so unrelated old cache files cannot fake results for the current plan.

6. Present results like a human decision aid.
   - Lead with the best practical choice, not raw cheapest.
   - Show cheapest, fastest, best balance, and best stopover as tradeoffs.
   - Explain total travel time, air time, layovers, stopover nights, and tight connection risk.
   - Keep "View" links to Google Flights or provider verification pages.
   - Use the shared dashboard semantic highlight vocabulary for decision-changing phrases:
     - `text-signal-good` / `metric-signal-good` for savings, cheaper dates, and under-budget results.
     - `text-signal-warn` / `metric-signal-warn` for extra cost, added travel time, long waits, or logistics tradeoffs.
     - `text-signal-bad` / `metric-signal-bad` for tight or risky connections and avoid-worthy constraints.
     - `text-signal-info` / `metric-signal-info` for stable facts such as best-balanced, same price, or key time/price facts.
   - Do not invent one-off highlight colors, underlines, pill styles, or inline CSS for generated plan pages. If emphasis is needed, add it through the shared renderer/CSS classes so every page stays visually consistent.
   - Do not mention external tool brands, booking platforms, or provider internals unless the user asks. The user experience is the local flight research agent.

7. Analyze saved plans when the user asks for current recommendations.
   - If the user asks for "top options", "best across my current plans", "compare all active plans", or similar, do not create a new plan by default.
   - Read the saved active plans and their latest snapshots, then compare current best balance, cheapest, fastest, date coverage, and refresh movement.
   - Start with the top 3 practical options across active plans. For each option, include price, total time, date, route path, connection risk, and why it is worth checking.
   - If the latest data is stale, incomplete, or missing expected date coverage, say that plainly and recommend a focused refresh before treating the answer as final.
   - Only run a refresh when the user explicitly asks to update data.

## Pre-Scan Reply Contract

If the request is unclear, ask up to 3 concise questions and stop.

If the request is clear, reply with:

1. A short, human "plan check" in 3-6 bullets: trip type, route ideas, date window, constraints, and optional stopovers.
2. A plain-English search check: the exact dates/routes that would be checked, how many searches that means, whether it can reuse saved data, and what will be skipped.
3. A clear next step asking for confirmation before running FLI searches.

If you create or update a plan from prior chat context, still repeat the interpreted plan back before any scan. Separate "nice-to-have" preferences from hard filters so the user can catch mistakes before FLI searches run.

For FLI scans, still show what will run before starting. Do not run local searches until the user explicitly confirms.

### Tone Rules

- Write like a practical travel assistant, not an internal CLI.
- Avoid internal implementation phrases about scan setup, provider paths, unknown cache state, or provider work in user-facing replies.
- Prefer phrasing like:
  - "Here is how I would set this up before searching."
  - "I would check these 5 departure dates: July 30, July 31, August 1, August 2, and August 3."
  - "I will use saved data if we already have it; otherwise I will search only these dates."
  - "I will skip broad gateway experiments unless you ask for them."
  - "Say yes and I’ll run this search."
- When asking questions, keep them direct and useful:
  - "Should 25 hours be a hard cutoff, or should I show slightly longer flights if they are much cheaper?"
  - "Should I search both Tokyo airports, HND and NRT?"
  - "Do you want plus/minus 2 days or plus/minus 3 days?"

## Local Project Pattern

When working in `flight-research-agent`, prefer the existing plan/dashboard commands:

```bash
npm run plan:new -- 'one way Chiang Mai to Bend around Aug 1 plus or minus 3, maybe Tokyo one night if worth it, no long long flights'
npm run plan:refresh-plan -- plans/<plan-id>/plan.json --mode light
npm run plan:refresh-plan -- plans/<plan-id>/plan.json --mode targeted-deep
npm run plan:refresh-plan -- plans/<plan-id>/plan.json --mode standard
npm run plan:dashboard -- plans/<plan-id>/plan.json --mode light
```

Use single quotes around natural-language shell arguments, especially when the text includes `$1,100` style budgets, so the shell does not expand `$1` before Node receives the request.

Do not run local FLI searches without explicit user confirmation.

The dashboard server is separate from the skill. If the user wants to view dashboards and the server is not running, start it with:

```bash
npm run serve
```

In the local Codex desktop app, open `http://127.0.0.1:8765/` in the in-app browser after dashboards are generated. In cloud or remote environments, generate the HTML pages and report the `outputs/` paths if direct browser viewing is not available.

For saved-plan analysis, use the root plans dashboard as the first source of truth after regeneration:

```bash
npm run plan:list-dashboard
```

Then read the active plan snapshots under `plans/<plan-id>/latest-snapshot.json` when a text answer is needed.

## Reference

Read [references/plan-shape.md](references/plan-shape.md) when creating or updating a plan structure, route ideas, viability rules, or refresh strategy.
