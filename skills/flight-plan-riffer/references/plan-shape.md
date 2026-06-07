# Flight Plan Shape Reference

Use this reference when turning a natural-language trip idea into structured plan data.

## Minimum Plan Fields

- `id`: stable slug.
- `name`: human-readable plan name.
- `tripSpecPath`: path to the trip JSON.
- `intent.tripType`: `one-way`, `round-trip`, or `multi-city`.
- `intent.naturalLanguage`: original user wording.
- `intent.dateCoverage`: center/start/end and plus-minus days.
- `preferences`: budget, priority, connection minimums, and hard travel rules.
- `routeIdeas`: route dashboards to compare.
- `refreshPolicy`: default mode, stale window, and live flag requirement.

## Search Defaults

- Default currency: `USD`.
- Never compare explicit mixed-currency snapshots as price movement.
- User-provided hotel estimates override defaults when modeling stopovers or alternate-start routes.

## Route Idea Patterns

Direct route:

```json
{
  "id": "origin-to-destination",
  "label": "Origin to Destination",
  "type": "direct-to-final",
  "required": true,
  "batches": ["fastest"],
  "focusSearchIds": []
}
```

Optional stopover:

```json
{
  "id": "origin-stopover-destination",
  "label": "Origin to Stopover to Destination",
  "type": "stopover",
  "stopover": {
    "label": "Tokyo",
    "nights": [1, 2],
    "hotelEstimateUsdPerNight": 150
  },
  "required": false,
  "batches": ["tokyo-core"],
  "focusSearchIds": []
}
```

Alternate start:

```json
{
  "id": "alternate-start-to-destination",
  "label": "Bangkok to Destination",
  "type": "direct-to-final",
  "required": false,
  "batches": ["bangkok-start"],
  "focusSearchIds": []
}
```

Separate start before the long-haul:

```json
{
  "id": "origin-bangkok-destination",
  "label": "Origin to Bangkok to Destination",
  "type": "alternate-start-stopover",
  "stopover": {
    "label": "Bangkok",
    "nights": [1, 2],
    "hotelEstimateUsdPerNight": 50
  },
  "required": false,
  "batches": ["bangkok-stopover"],
  "focusSearchIds": []
}
```

Use this pattern when the user says they are willing to fly to a larger nearby city, stay a night or two, and start the long-haul from there. Keep the origin-to-gateway leg, hotel nights, and gateway-to-final flight separate in the plan so the final comparison can show both savings and logistics.

## Clarifying Questions

Ask only when the answer materially changes the searches. Good questions:

- Which airport codes should I use for ambiguous cities?
- Is this one-way, round-trip, or multi-city?
- Is the stopover required, optional, or only if cheap enough?
- What is the date window or plus/minus range?
- What is the maximum travel time or layover pain you want to allow?

## Viability Rules

Convert preference language into rules before refreshing:

- `rejectTotalElapsedHoursOver`: hard maximum elapsed time.
- `maxSingleTravelDayHours`: threshold for watch-list long travel days.
- `preferredDomesticConnectionMinutes`: domestic layover minimum.
- `preferredInternationalToDomesticConnectionMinutes`: gateway layover minimum.
- `hardMaxBudget`: exclude over-budget options from recommendations.
- `softMaxBudget`: watch-list over-budget options.
- Value-of-time threshold: dollars per hour used for worth-it math.

## Filter Rules

Capture filters as structured constraints or visible assumptions:

- `maxStops`: from nonstop/direct/one-stop wording.
- `preferredAirlines` and `excludedAirlines`.
- `cabinClass`: economy, premium economy, business, first.
- `departureTimeWindow` and `arrivalTimeWindow`.
- `excludeBasicEconomy` when supported by the active provider.
- `targetPrice` or `alertBelowPrice` for future watch/refresh behavior.

Recommendations must use viability classification:

- `recommended`: can compete for best/cheapest/fastest/balanced.
- `watch`: show with warnings.
- `hidden-by-preference`: incomplete or not comparable.
- `hard-reject`: keep in raw data but do not recommend.

## Refresh Mode Selection

- `light`: current leaders and missing critical legs.
- `standard`: active date window and route ideas.
- `targeted-deep`: broader gateway/route confidence without full exploratory coverage.
- `deep`: full exploration only after explicit confirmation.

Always show a search check before live refresh. Report selected searches, FLI searches, cache hits, and skipped searches.
