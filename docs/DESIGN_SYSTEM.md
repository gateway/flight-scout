# Dashboard Design System

This file is the source of truth for generated dashboard UI. Do not introduce a new card, route row, drawer, or signal style unless this file is updated in the same change.

## Pages

- `Decision + Budget`: the main human read, current recommendation, budget alternative, and latest-search story.
- `Date Compare`: date-window visual scan, route-specific price bars, and best balanced option per date.
- `Routes`: route evidence cards with side-card details and Google Flights links.
- `Refresh`: selected search check, refresh guidance, price movement, and snapshot history.
- `All plans`: saved-plan entry point served from `/`, with Active plans as the only main nav anchor and Overview rendered as a skim section below active plans.
- `Archived plans`: separate generated page at `outputs/plans.archived.html`; restore controls live there instead of cluttering the active plans page.

There is no separate compact report page. `Decision + Budget` is the canonical overview.

## Shared Components

- `flight-card`: the only recommendation/evidence card shell.
- `card-head`: card title area with route/date on the left and price/time/action icons on the right.
- `card-stat`: upper-right price and total-time block.
- `card-actions`: side-card icon and Google Flights icon.
- `pain-grid`: compact Total/Air/Layovers facts.
- `side-drawer`: reusable right-side flight detail drawer.
- `route-sort`: text-link sorting controls for route evidence cards.

Cards should not create local one-off price/time layouts. Use `renderCardHead` unless the component is not a flight option.

## Signal Styles

Use semantic signal classes through `src/dashboard-signals.js`:

- `good`: savings, cheaper prices, clean connections.
- `warn`: extra time, higher cost, longer waits, watch items.
- `bad`: tight connections, hard risks, avoid language.
- `info`: stable facts or selected baseline context.

Highlight only decision-changing phrases. Do not increase normal paragraph size just to make a phrase stand out.

## Wording Rules

- Say `extra travel first`, `get to Bangkok`, or `starts in Bangkok` instead of `positioning`.
- Say `flight detail` or `route evidence`, not `decision evidence`.
- Say `refresh check` or `refresh plan`, not `preview` in generated HTML.
- Do not render `Compact report`.
- Do not use vague labels like `worth it` without context; use phrases such as `Lower price, similar travel time` or `Faster, but costs more`.

## Guardrails

- Keep generated pages on shared CSS from `src/styles/`.
- Do not make section-level panels that wrap cards. Sections can group content, but visible borders/backgrounds belong on actual cards, drawers, route rows, or repeated items.
- Prefer extracting a module over growing `src/dashboard.js`.
- Reuse `flight-card`, `card-head`, `card-stat`, `side-drawer`, and signal helpers before adding classes.
- Run `npm run guard:bloat` and `npm test` after dashboard changes.
