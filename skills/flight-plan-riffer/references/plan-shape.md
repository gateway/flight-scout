# Flight Plan Shape Reference

Use this reference when turning a natural-language trip idea into structured plan data.

## Minimum Plan Fields

- `id`: stable slug.
- `name`: human-readable plan name.
- `tripSpecPath`: path to the trip JSON.
- `intent.tripType`: `one-way` or `round-trip`. Round trips retain separate outbound and return date coverage and expand into atomic one-way searches. Provider-native multi-city searches are not supported.
- `intent.naturalLanguage`: original user wording.
- `intent.dateCoverage`: center/start/end and plus-minus days.
- `preferences`: budget, priority, connection minimums, and hard travel rules.
- `routeIdeas`: route dashboards to compare.
- `refreshPolicy`: default mode, stale window, and live flag requirement.
- `watchRules`: optional local price/time targets evaluated after a refresh.

## Search Defaults

- Default currency: `USD`.
- Never compare explicit mixed-currency snapshots as price movement.
- User-provided hotel estimates override defaults when modeling stopovers or alternate-start routes.

## Route Idea Patterns

Round trip:

```json
{
  "id": "origin-destination-round-trip",
  "label": "Origin to Destination round trip",
  "type": "round-trip",
  "originAirports": ["AAA"],
  "destinationAirports": ["BBB"],
  "required": true
}
```

The result pairs compatible outbound and return dates, combines fare and flight time for comparison, and preserves two separate one-way booking links. Always disclose that changes, cancellations, and ticket rules are independent.

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
    "label": "Stopover City",
    "nights": [1, 2],
    "hotelEstimateUsdPerNight": 150
  },
  "required": false,
  "batches": ["one-night-stopover"],
  "focusSearchIds": []
}
```

Alternate start:

```json
{
  "id": "alternate-start-to-destination",
  "label": "Gateway City to Destination",
  "type": "direct-to-final",
  "required": false,
  "batches": ["alternate-start"],
  "focusSearchIds": []
}
```

Separate start before the long-haul:

```json
{
  "id": "origin-gateway-destination",
  "label": "Origin to Gateway City to Destination",
  "type": "alternate-start-stopover",
  "stopover": {
    "label": "Gateway City",
    "nights": [1, 2],
    "hotelEstimateUsdPerNight": 50
  },
  "required": false,
  "batches": ["intentional-stopover"],
  "focusSearchIds": []
}
```

Use this pattern when the user says they are willing to fly to a larger nearby city, stay a night or two, and start the long-haul from there. Keep the origin-to-gateway leg, hotel nights, and gateway-to-final flight separate in the plan so the final comparison can show both savings and logistics.

## Batch Names

Generate new plans with route-neutral batch names:

- `fastest`
- `fewest-layovers`
- `intentional-stopover`
- `one-night-stopover`
- `alternate-start`
- `gateway-compare`
- `cheap-explorer`
- `all-reviewed`

Older saved plans may still contain `skip-tokyo`, `tokyo-stopover`, `tokyo-core`, `bangkok-start`, or `bangkok-stopover`. The runtime accepts those hidden compatibility inputs, but batch discovery does not list them and new plans must not generate them.

## Clarifying Questions

Ask only when the answer materially changes the searches. Good questions:

- Which airport codes should I use for ambiguous cities?
- Is this one-way or round trip? If round trip, what return date or return window should I use?
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

Capture implemented filters as structured constraints:

- `maxStops`: from nonstop/direct/one-stop wording.

Airline inclusion/exclusion, cabin class, fare family, and departure/arrival time windows are not currently enforced by the provider path. Keep them as visible limitations; do not claim the returned flights were filtered by them.

Price and total-time targets can be stored as optional local watch rules:

```json
{
  "watchRules": [
    {
      "id": "target-price-and-time",
      "label": "Target price and travel time",
      "enabled": true,
      "maxPriceUsd": 700,
      "maxDurationMinutes": 960
    }
  ]
}
```

Each configured threshold must match before a combined rule triggers. Rules are evaluated only against complete saved results after a refresh. They do not run searches, monitor in the background, or send external notifications.

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
