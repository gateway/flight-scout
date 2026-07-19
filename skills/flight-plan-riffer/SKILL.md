---
name: flight-plan-riffer
description: Turn rough natural-language flight ideas into practical one-way or composed round-trip comparisons with saved plans, date windows, optional stopovers, alternate starts, airport-code clarification, supported constraints, and confirmation-gated local searches. Use when the user wants to riff through a trip idea, compare routes, search plus/minus date ranges, avoid long flights or tight layovers, refresh flight data, or ask for the best choices across saved plans.
---

# Flight Plan Riffer

Use this skill to riff a human travel idea into practical route options and a concrete flight research plan. The goal is not to book flights or ask the user to generate pages; it is to understand intent, compare sensible routes, capture the right searches, avoid unnecessary local FLI searches, and present human-readable tradeoffs.

## Workflow

1. Interpret the user's plain-language plan.
   - Extract origin, destination, date window, trip type, stopovers, alternate starts, USD budget, supported filters, and pain limits.
   - Treat "date A to B" as a set of one-way candidate departure dates unless the user explicitly asks round trip.
   - Treat "plus or minus N days" as a centered date window.
   - Treat "plus or minus a few days" as ambiguous; ask whether they mean plus/minus 2 or 3 days unless the prior context makes it obvious.
   - Treat "I need to be there around X" as a departure-date search window unless the user clearly means an arrival deadline. If arrival deadline changes the search, ask.
   - Treat "cheapest dates", "best days", or "find the cheapest day" as a date-window scan, not a single-date search.
   - Treat "maybe stop in X" as an optional route idea, not a required route.
   - Treat "if X is too expensive, skip it" as a direct route plus a stopover route comparison.
   - Treat "I could stay in X for one or two nights" as an optional alternate-start or stopover route with explicit stay nights and the user's hotel estimate when provided.
   - Treat "under $X" and supported total-time limits as optional local watch targets. They are evaluated against saved results after a refresh; do not promise background monitoring or external notifications.

2. Ask clarifying questions only when needed.
   - Ask no more than 3 short questions if airports, dates, trip type, stopover intent, or hard constraints are unclear.
   - Prefer concrete questions: airport/city ambiguity, date range, one-way confirmation, required vs optional stopover, budget and maximum pain threshold.
   - If the user asks for a round trip, require both outbound and return date windows. Explain that the app compares independently searched one-way tickets and does not imply one protected round-trip booking.
   - If the user asks for provider-native multi-city travel, explain that it is not supported and offer explicit one-way route ideas instead.
   - If the user gives a soft target and a hard limit that could conflict, ask back in plain language before scanning (for example: "Should I treat 11 hours as a nice-to-have and 26 hours as the hard cutoff?").
   - If the user gives no date, ask for a date or date range before creating scan searches.
   - Resolve a date without a year to its next future occurrence; never assume a fixed calendar year.
   - If a flight budget is stated in EUR, GBP, THB, or another non-USD currency, ask for the USD budget before creating a plan. Do not relabel or convert it.
   - If the user gives a date but not flexibility, ask whether they want the exact date or a plus/minus window only when flexibility materially changes the search set.
   - Do not guess when a missing answer would send the wrong searches to the provider.
   - Do not ask if reasonable defaults are clear from the request and can be shown back for confirmation.

3. Create route ideas before fetching data.
   - Include the user's main route.
   - Include alternate starts when the user mentions nearby airports, gateway cities, or getting to a different city before the long-haul flight.
   - Include stopover routes as separate route ideas with explicit stay nights.
   - Include "skip stopover" alternatives when the user says the stopover is optional.
   - When the user can travel to a different starting city first, compare the original start against the alternate start plus the stated transfer and hotel assumptions.
   - Do not present an alternate-start flight by itself as a complete trip unless the user says they will already be at that airport.

4. Convert preferences into enforceable rules.
   - "no long long flights", "brutal", or "painful" -> hard elapsed-time threshold.
   - "max 30 hours" -> `rejectTotalElapsedHoursOver: 30`.
   - "I hate tight layovers" -> increase connection minimums.
   - "worth it only if much cheaper" -> compare dollars saved per added travel hour.
   - "nonstop" and "direct" become the supported stop-count rule.
   - Airline, cabin, fare-family, and time-of-day requests are not provider-enforced yet. Keep them as visible limitations and never claim they were filtered.
   - Keep raw provider data, but exclude hard rejects from recommendations.

5. Plan refreshes before local FLI searches.
   - Always describe the search check before FLI searches.
   - Use the built-in local FLI search path. The user should not need to ask for this.
   - Use `light` for decision leaders, `standard` for the active date window, `targeted-deep` for broader but controlled coverage, and `deep` only after explicit confirmation.
   - Surface the number of date/route searches, which dates will be checked, whether existing saved data can be reused, and why the mode fits the request.
   - Always request and display USD. Do not compare mixed-currency snapshots; if old data is not USD, mark the comparison as not directly comparable.
   - After a scan, verify the new snapshot has complete options for the requested destination before calling the scan successful. If FLI searches fail or the dashboard would show no decision-ready flights, stop and report the setup issue instead of falling back to stale cache data.
   - When regenerating a snapshot from a selected refresh plan, aggregate only the searches selected for that refresh so unrelated old cache files cannot fake results for the current plan.

6. Present results like a human travel assistant.
   - Lead with the best practical choice, not raw cheapest.
   - Show cheapest, fastest, best balance, and best stopover as tradeoffs.
   - Explain total travel time, air time, layovers, stopover nights, and tight connection risk.
   - Surface any saved price/time watch target that the refreshed results now satisfy.
   - Keep "View" links to Google Flights or provider verification pages when the app renders results.
   - For round trips, state the combined fare and flight time, label outbound and return separately, show both one-way booking links, and keep the separate-ticket warning visible.
   - Use the shared dashboard semantic highlight vocabulary for decision-changing phrases:
     - `text-signal-good` / `metric-signal-good` for savings, cheaper dates, and under-budget results.
     - `text-signal-warn` / `metric-signal-warn` for extra cost, added travel time, long waits, or logistics tradeoffs.
     - `text-signal-bad` / `metric-signal-bad` for tight or risky connections and avoid-worthy constraints.
     - `text-signal-info` / `metric-signal-info` for stable facts such as best-balanced, same price, or key time/price facts.
   - Do not invent one-off highlight colors, underlines, pill styles, or inline CSS for generated plan pages. If emphasis is needed, add it through the shared renderer/CSS classes so every page stays visually consistent.
   - Do not mention external tool brands, booking platforms, or provider internals unless the user asks. The user experience is the local flight research agent.
   - Do not lead with implementation output. The user is asking for route thinking; saved pages are only the place results appear after a confirmed search.

7. Analyze saved plans when the user asks for current recommendations.
   - If the user asks for "top options", "best across my current plans", "compare all active plans", or similar, do not create a new plan by default.
   - Read the saved active plans and their latest snapshots, then compare current best balance, cheapest, fastest, date coverage, and refresh movement.
   - Start with the top 3 practical options across active plans. For each option, include price, total time, date, route path, connection risk, and why it is worth checking.
   - If the latest data is stale, incomplete, or missing expected date coverage, say that plainly and recommend a focused refresh before treating the answer as final.
   - Only run a refresh when the user explicitly asks to update data.
   - When the user asks to refresh all active plans and summarize what changed, use the project’s combined refresh summary path so the data refresh, dashboard rebuild, and markdown lowdown happen in one pass.
   - If the user says "latest prices", "current prices", "today", "this morning", "right now", "ready to book", or similar, treat it as a fresh local refresh request. Use `npm run plan:refresh-latest`, not a saved-data-only summary.
   - If the user only asks what the saved plans currently say, regenerate the plans dashboard if needed and read the saved snapshots without running a refresh command.
   - After a refresh, answer from `outputs/latest-refresh-lowdown.md` first, then use snapshots only for extra detail the lowdown does not cover.
   - Do not open or verify the browser after every refresh. Use browser verification only when UI code changed, the user asks to see the page, the server state is uncertain, or the generated pages appear broken.

## Pre-Scan Reply Contract

If the request is unclear, ask up to 3 concise questions and stop.

If the request is clear, reply with:

1. A short, human "plan check" in 3-6 bullets: trip type, route ideas, date window, constraints, and optional stopovers.
2. A plain-English search check: the exact dates/routes that would be checked, how many searches that means, whether it can reuse saved data, and what will be skipped.
3. A clear next step asking for confirmation before running FLI searches.

If you create or update a plan from prior chat context, still repeat the interpreted plan back before any scan. Separate "nice-to-have" preferences from hard filters so the user can catch mistakes before FLI searches run.

For FLI scans, still show what will run before starting. Do not run local searches until the user explicitly confirms.

Do not ask the user to request HTML, dashboards, or report generation. The skill's job is route reasoning, search planning, confirmation, and then using the app's normal outputs after an approved search.

### Tone Rules

- Write like a practical travel assistant, not an internal CLI.
- Avoid internal implementation phrases about scan setup, provider paths, unknown cache state, or provider work in user-facing replies.
- Say "I understand the route ideas as..." or "I would compare..." before talking about saved plans.
- Prefer phrasing like:
  - "Here is how I would set this up before searching."
  - "I would check these 5 departure dates: July 30, July 31, August 1, August 2, and August 3."
  - "I will use saved data if we already have it; otherwise I will search only these dates."
  - "I will skip broad gateway experiments unless you ask for them."
  - "Say yes and I’ll run this search."
- When asking questions, keep them direct and useful:
  - "Should 25 hours be a hard cutoff, or should I show slightly longer flights if they are much cheaper?"
  - "Should I search every passenger airport for that city, or only the airport you named?"
  - "Do you want plus/minus 2 days or plus/minus 3 days?"

## Example Interpretation Pattern

For a request like "I need to fly from City A to City B around September 10, plus or minus a few days. Nothing over 18 hours. I might start from nearby City C after a one-night stay if it helps," reply before searching:

- Confirm this is a one-way trip from City A to City B around September 10.
- Ask whether "a few days" means plus/minus 2 or plus/minus 3 if not already clear.
- Compare the original start against City A -> City C + one hotel night + City C -> City B.
- Use the user's hotel estimate in the route tradeoff math.
- Treat over 18 hours total travel time as a hard reject unless the user changes it.
- Wait for confirmation before searching.

## Local Project Pattern

When working in `flight-scout`, prefer the existing plan/dashboard commands:

```bash
npm run plan:new -- 'one way from City A to City B around September 10 plus or minus 2 days, optional stopover in City C for one night, under 18 hours'
npm run plan:refresh-plan -- plans/<plan-id>/plan.json --mode light
npm run plan:refresh-plan -- plans/<plan-id>/plan.json --mode targeted-deep
npm run plan:refresh-plan -- plans/<plan-id>/plan.json --mode standard
npm run plan:refresh-summary
npm run plan:refresh-latest
npm run plan:refresh-scheduled -- --mode standard --jitter-ms 300000
npm run plan:dashboard -- plans/<plan-id>/plan.json --mode light
```

Use `plan:refresh-scheduled` only when the user explicitly wants local scheduling. It performs one cache-aware active-plan pass and exits; cron or `launchd` owns repetition. Never describe it as an always-on monitor, and never include archived plans.

Use single quotes around natural-language shell arguments, especially when the text includes `$1,100` style budgets, so the shell does not expand `$1` before Node receives the request.

Do not run local FLI searches without explicit user confirmation.

The dashboard server is separate from the skill. If the user wants to view saved results and the server is not running, start it with:

```bash
npm run serve
```

In the local Codex desktop app, open `http://127.0.0.1:8765/` in the in-app browser after saved results are generated. In cloud or remote environments, report the generated output paths if direct browser viewing is not available.

For saved-plan analysis, use the root plans dashboard as the first source of truth after regeneration:

```bash
npm run plan:list-dashboard
```

Then read the active plan snapshots under `plans/<plan-id>/latest-snapshot.json` when a text answer is needed.

When the user says something like "refresh all active plans and tell me what changed", prefer:

```bash
npm run plan:refresh-latest
```

That command forces fresh local searches for the active saved plans, regenerates the dashboards, and writes `outputs/latest-refresh-lowdown.md`. Use that markdown plus the refreshed snapshots for the final human-readable answer.

If the user asks for a saved-data summary without current prices, regenerate the dashboard without refreshing:

```bash
npm run plan:list-dashboard
```

### Post-Refresh Reply Contract

After `npm run plan:refresh-latest`, keep the answer short and useful:

1. Best practical option today.
2. Cheapest option worth opening.
3. Fastest reasonable option if it matters.
4. Any new option that could change the decision.
5. What mostly moved higher or lower since the last refresh.

Do not paste the whole lowdown unless the user asks. Link to the dashboard and markdown lowdown when helpful.

## Reference

Read [references/plan-shape.md](references/plan-shape.md) when creating or updating a plan structure, route ideas, viability rules, or refresh strategy.
