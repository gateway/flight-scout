export function compareSnapshots(currentSnapshot, previousSnapshot) {
  if (!currentSnapshot?.rankedFlights || !previousSnapshot?.rankedFlights) {
    return { available: false, changes: [], summary: "No prior snapshot to compare yet.", humanSummary: ["No prior snapshot to compare yet."] };
  }
  const previous = new Map(previousSnapshot.rankedFlights.map((flight) => [comparisonKey(flight), flight]));
  const seenPrevious = new Set();
  const changes = [];
  for (const flight of currentSnapshot.rankedFlights) {
    const key = comparisonKey(flight);
    const old = previous.get(key);
    if (!old) {
      changes.push({
        key,
        searchId: flight.searchId,
        routeFamily: flight.routeFamily,
        title: flight.searchTitle,
        currentCost: totalCost(flight),
        previousCost: null,
        delta: null,
        direction: "new",
        durationMinutes: flight.durationMinutes,
        googleFlightsUrl: flight.googleFlightsUrl
      });
      continue;
    }
    seenPrevious.add(key);
    const currentCost = totalCost(flight);
    const previousCost = totalCost(old);
    if (!Number.isFinite(currentCost) || !Number.isFinite(previousCost)) continue;
    if (!sameKnownCurrency(flight, old)) continue;
    const delta = currentCost - previousCost;
    const durationDelta = (flight.durationMinutes ?? NaN) - (old.durationMinutes ?? NaN);
    changes.push({
      key,
      searchId: flight.searchId,
      routeFamily: flight.routeFamily,
      title: flight.searchTitle,
      currentCost,
      previousCost,
      delta,
      direction: delta < 0 ? "down" : delta > 0 ? "up" : "same",
      tradeoff: tradeoff(delta, durationDelta),
      durationDelta: Number.isFinite(durationDelta) ? durationDelta : null,
      durationMinutes: flight.durationMinutes,
      googleFlightsUrl: flight.googleFlightsUrl
    });
  }
  for (const [key, flight] of previous) {
    if (seenPrevious.has(key)) continue;
    changes.push({
      key,
      searchId: flight.searchId,
      routeFamily: flight.routeFamily,
      title: flight.searchTitle,
      currentCost: null,
      previousCost: totalCost(flight),
      delta: null,
      direction: "disappeared",
      durationMinutes: flight.durationMinutes,
      googleFlightsUrl: flight.googleFlightsUrl
    });
  }
  const sorted = changes.sort((a, b) => Math.abs(b.delta ?? 0) - Math.abs(a.delta ?? 0));
  return {
    available: true,
    changes: sorted,
    currentOptionCount: currentSnapshot.rankedFlights.length,
    previousOptionCount: previousSnapshot.rankedFlights.length,
    matchedOptionCount: seenPrevious.size,
    summary: summarizeChanges(sorted),
    humanSummary: humanMovementSummary(sorted)
  };
}

export function comparisonKey(flight) {
  return [
    flight.searchId,
    flight.departureTime?.slice(0, 10) ?? "",
    flight.airline ?? "",
    (flight.legs ?? []).map((leg) => `${leg.departure_airport?.id}-${leg.arrival_airport?.id}-${leg.flight_number ?? ""}`).join("|")
  ].join("::");
}

function summarizeChanges(changes) {
  if (changes.length === 0) return "No matched flights changed price.";
  const down = changes.filter((change) => change.direction === "down");
  const up = changes.filter((change) => change.direction === "up");
  const same = changes.filter((change) => change.direction === "same");
  const fresh = changes.filter((change) => change.direction === "new");
  const disappeared = changes.filter((change) => change.direction === "disappeared");
  const bestDrop = down.sort((a, b) => a.delta - b.delta)[0];
  if (bestDrop) {
    const target = bestDrop.title ? ` on ${bestDrop.title}` : "";
    return `${down.length} matched option${down.length === 1 ? "" : "s"} got cheaper. Best drop: $${Math.abs(bestDrop.delta)}${target}.`;
  }
  if (up.length > 0) return `${up.length} matched options got more expensive. Largest increase: $${Math.max(...up.map((change) => change.delta))}.`;
  if (same.length > 0) return `${same.length} matched options are unchanged.`;
  if (fresh.length > 0 || disappeared.length > 0) return `${fresh.length} new options and ${disappeared.length} disappeared options.`;
  return "No matched flights changed price.";
}

export function humanMovementSummary(changes) {
  const changed = changes.filter((change) => Number.isFinite(change.delta) && change.delta !== 0);
  const newOptions = changes.filter((change) => change.direction === "new");
  const disappeared = changes.filter((change) => change.direction === "disappeared");
  const cheaper = changed.filter((change) => change.delta < 0).sort((a, b) => a.delta - b.delta);
  const pricier = changed.filter((change) => change.delta > 0).sort((a, b) => b.delta - a.delta);
  const byDate = bestDateMovements(changed);
  const lines = [];
  if (cheaper[0]) lines.push(`Best drop: ${describeChange(cheaper[0])}.`);
  if (pricier[0]) lines.push(`Largest increase: ${describeChange(pricier[0])}.`);
  if (byDate[0]) lines.push(`Date summary: ${byDate[0]}.`);
  if (newOptions.length) lines.push(`${newOptions.length} new options appeared in the refreshed data.`);
  if (disappeared.length) lines.push(`${disappeared.length} previous options disappeared from the refreshed data.`);
  if (!lines.length) lines.push("No meaningful price movement yet.");
  return lines;
}

function bestDateMovements(changes) {
  const totals = new Map();
  for (const change of changes) {
    const date = departureDate(change);
    if (!date) continue;
    const current = totals.get(date) ?? { down: 0, up: 0, count: 0 };
    if (change.delta < 0) current.down += Math.abs(change.delta);
    if (change.delta > 0) current.up += change.delta;
    current.count += 1;
    totals.set(date, current);
  }
  return [...totals.entries()]
    .map(([date, value]) => {
      const optionCount = `${value.count} changed option${value.count === 1 ? "" : "s"}`;
      if (!value.down) return `${date}: $${Math.round(value.up)} more expensive across ${optionCount}`;
      if (!value.up) return `${date}: $${Math.round(value.down)} cheaper across ${optionCount}`;
      return `${date}: $${Math.round(value.down)} cheaper across ${optionCount}, $${Math.round(value.up)} more expensive elsewhere`;
    })
    .sort();
}

function describeChange(change) {
  const route = change.title ?? change.searchId ?? "route";
  const date = departureDate(change);
  const datedRoute = date && !route.includes(date) ? `${route} on ${date}` : route;
  if (change.delta < 0) return `${datedRoute} is $${Math.abs(change.delta)} cheaper`;
  return `${datedRoute} is $${change.delta} more expensive`;
}

function departureDate(change) {
  return change.title?.match(/\b20\d{2}-\d{2}-\d{2}\b/)?.[0] ?? change.key?.match(/\b20\d{2}-\d{2}-\d{2}\b/)?.[0] ?? null;
}

function tradeoff(delta, durationDelta) {
  if (!Number.isFinite(delta) || !Number.isFinite(durationDelta) || delta === 0 || durationDelta === 0) return null;
  if (delta < 0 && durationDelta > 0) return "cheaper-but-longer";
  if (delta > 0 && durationDelta < 0) return "more-expensive-but-faster";
  return null;
}

function totalCost(flight) {
  return flight.scoring?.breakdown?.estimatedTotalCost ?? flight.price ?? NaN;
}

function sameKnownCurrency(current, previous) {
  const currentCurrency = currencyOf(current);
  const previousCurrency = currencyOf(previous);
  return !currentCurrency || !previousCurrency || currentCurrency === previousCurrency;
}

function currencyOf(flight) {
  return flight.providerCurrency ?? flight.currency ?? null;
}
