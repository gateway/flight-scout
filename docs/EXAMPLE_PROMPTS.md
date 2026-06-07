# Example Prompts

These examples are intentionally generic and safe to share. They show the kind of natural-language requests the system is designed to parse before building a saved plan.

## Simple One-Way Search

```text
Find one-way flights from Chiang Mai to Bangkok around August 1, plus or minus 3 days. Prefer direct flights and keep it near $100 if possible. Build the plan first so I can review it.
```

Expected behavior:

- interpret this as one-way
- search CNX to Bangkok airports, usually BKK and DMK
- use July 29 through August 4 for date coverage
- prefer nonstop or direct options
- show the selected searches before scanning

Scan after review:

```bash
npm run plan:refresh -- plans/<plan-id>/plan.json --mode standard --live
```

## Flexible Date Budget Search

```text
Find me the cheapest reasonable one-way flight from San Francisco to New York around September 10, plus or minus 2 days. Avoid overnight layovers and anything over 10 hours.
```

Expected behavior:

- build a five-day date window
- reject or demote long travel days
- show cheapest, fastest, and balanced choices
- flag tight or inconvenient connections

## Alternate Start Comparison

```text
Compare flying from City A versus starting from a nearby larger airport to get to City B around August 1, plus or minus 3 days. I am willing to add a hotel near the larger airport only if it saves at least $300.
```

Expected behavior:

- create route ideas for both starting points
- estimate extra Bangkok travel and hotel assumptions
- show whether the cheaper start is actually worth the hassle
- keep both choices visible in the dashboard

## Nearby City With Hotel Stay

> I need to fly from Chiang Mai to Redmond, Oregon around August 1, plus or minus a few days. I do not want anything over 26 hours total. I am also open to flying from Chiang Mai to Bangkok, staying in Bangkok for one or two nights at about $50 per night, and then flying Bangkok to Redmond if that makes the whole trip cheaper or cleaner.

Expected behavior:

- ask whether "a few days" means plus/minus 2 or plus/minus 3 if that is not clear
- compare Chiang Mai to Redmond against Chiang Mai to Bangkok plus hotel nights plus Bangkok to Redmond
- include the hotel estimate when comparing total cost
- reject routes over the stated total-time limit
- show the route plan back first and wait for confirmation before searching

## Optional Stopover

```text
Find a one-way trip from City A to City B around August 1, plus or minus 3 days. Also test stopping in a preferred stopover city for 1 or 2 nights, but only if the total cost is not much higher and the travel days are easier.
```

Expected behavior:

- create a direct-to-final route idea
- create Tokyo stopover route ideas
- compare the stopover as two travel days, not one giant elapsed trip
- show first leg, stayover, second leg, total cost, and tradeoffs

## Hard Connection Rules

```text
Find flights from a major international airport to a smaller regional airport around August 1, plus or minus 3 days. Do not show options with international-to-domestic connections under 3 hours or domestic connections under 90 minutes.
```

Expected behavior:

- apply connection thresholds before recommendations
- color-code or flag risky connection times
- keep rejected options out of the decision cards

## What The Skill Should Ask

If the prompt is unclear, the skill should ask two or three direct questions, such as:

- Which airport or city did you mean?
- Is this one-way, round-trip, or a multi-city style trip?
- What is the maximum travel time or maximum budget?

It should show the selected searches and wait for the user to confirm the scan.
