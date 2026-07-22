import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { jsonReadWarning, readJsonFile } from "./json-files.js";

export const PRICE_HISTORY_THRESHOLDS = Object.freeze({
  nearLowRatio: 0.1,
  nearHighRatio: 0.1
});

const HISTORY_SUMMARY_FIELDS = [
  "cheapestCompletePrice",
  "fastestCompleteDurationMinutes",
  "bestPrice",
  "currency",
  "mixedCurrency",
  "cheapestByDate"
];

// Derive compact fields once so new dashboards can read history from metadata alone.
export function derivePriceHistorySummary(rankedFlights) {
  const complete = rankedFlights.filter(isCompleteOption);
  const priced = complete.filter((flight) => Number.isFinite(totalPrice(flight)));
  const currencies = new Set(priced.map(currencyForFlight).filter(Boolean));
  const mixedCurrency = currencies.size > 1;
  const cheapestByDate = {};

  for (const flight of priced) {
    const date = departureDate(flight);
    const price = totalPrice(flight);
    if (!date) continue;
    cheapestByDate[date] = Math.min(cheapestByDate[date] ?? Infinity, price);
  }

  return {
    cheapestCompletePrice: minimum(priced.map(totalPrice)),
    fastestCompleteDurationMinutes: minimum(complete.map((flight) => flight.durationMinutes)),
    bestPrice: totalPrice(priced[0]) ?? null,
    currency: mixedCurrency ? null : [...currencies][0] ?? null,
    mixedCurrency,
    cheapestByDate
  };
}

// Legacy snapshots are enriched in memory only; saved research remains immutable.
export async function buildPriceHistory(planDir, { onWarning = () => {} } = {}) {
  const root = path.join(planDir, "snapshots");
  if (!existsSync(root)) return [];
  const entries = await readdir(root, { withFileTypes: true });
  const points = [];

  for (const entry of entries.filter((item) => item.isDirectory()).sort((left, right) => left.name.localeCompare(right.name))) {
    const snapshotDir = path.join(root, entry.name);
    try {
      const meta = await readJsonFile(path.join(snapshotDir, "snapshot.json"));
      const summary = await historySummary(snapshotDir, meta.summary);
      if (meta.summary?.completeOptions === 0 || !Number.isFinite(summary.cheapestCompletePrice)) continue;
      if (summary.mixedCurrency) continue;
      points.push({
        snapshotId: meta.id ?? entry.name,
        createdAt: meta.createdAt ?? null,
        cheapestCompletePrice: summary.cheapestCompletePrice,
        bestPrice: summary.bestPrice,
        cheapestByDate: summary.cheapestByDate,
        currency: summary.currency
      });
    } catch (error) {
      onWarning(jsonReadWarning(error, { code: "price-history-read-failed", snapshotDir }));
    }
  }

  const latestCurrency = points.findLast((point) => point.currency)?.currency ?? null;
  return latestCurrency
    ? points.filter((point) => !point.currency || point.currency === latestCurrency)
    : points;
}

export function assessCurrentPrice(series) {
  const usable = series.filter((point) => Number.isFinite(point.cheapestCompletePrice));
  const observationCount = usable.length;
  if (observationCount === 0) {
    return assessment("insufficient-history", "No saved price checks yet.", usable);
  }

  const first = usable[0];
  const current = usable.at(-1);
  const firstDate = formatCheckDate(first.createdAt);
  const currency = current.currency ?? first.currency ?? "USD";
  if (observationCount === 1) {
    return assessment(
      "insufficient-history",
      `Only one saved check so far; price history builds with each refresh. 1 check since ${firstDate}.`,
      usable
    );
  }

  if (observationCount === 2) {
    const previous = usable[0];
    return assessment(
      "delta-only",
      `${formatPrice(current.cheapestCompletePrice, currency)} now vs ${formatPrice(previous.cheapestCompletePrice, currency)} on ${formatCheckDate(previous.createdAt)}, across 2 checks since ${firstDate}.`,
      usable
    );
  }

  const prices = usable.map((point) => point.cheapestCompletePrice);
  const lowest = Math.min(...prices);
  const highest = Math.max(...prices);
  const currentPrice = current.cheapestCompletePrice;
  const status = priceBand(currentPrice, lowest, highest);
  const description = {
    "lowest-seen": "the lowest this plan has seen",
    "near-low": "near the low end of this plan's saved prices",
    middle: "in the middle of this plan's saved price range",
    "near-high": "near the high end of this plan's saved prices",
    "highest-seen": "the highest this plan has seen"
  }[status];
  return assessment(
    status,
    `Today's ${formatPrice(currentPrice, currency)} is ${description} across ${observationCount} checks since ${firstDate}.`,
    usable
  );
}

async function historySummary(snapshotDir, summary = {}) {
  if (HISTORY_SUMMARY_FIELDS.every((field) => Object.hasOwn(summary, field))) return summary;
  const rankedFlights = await readJsonFile(path.join(snapshotDir, "ranked.json"));
  return derivePriceHistorySummary(rankedFlights);
}

function assessment(status, sentence, series) {
  const prices = series.map((point) => point.cheapestCompletePrice);
  return {
    status,
    sentence,
    observationCount: series.length,
    currentPrice: prices.at(-1) ?? null,
    firstCheckedAt: series[0]?.createdAt ?? null,
    minPrice: prices.length ? Math.min(...prices) : null,
    maxPrice: prices.length ? Math.max(...prices) : null
  };
}

function priceBand(current, lowest, highest) {
  if (current === lowest) return "lowest-seen";
  if (current === highest) return "highest-seen";
  if (current <= lowest * (1 + PRICE_HISTORY_THRESHOLDS.nearLowRatio)) return "near-low";
  if (current >= highest * (1 - PRICE_HISTORY_THRESHOLDS.nearHighRatio)) return "near-high";
  return "middle";
}

function isCompleteOption(flight) {
  return flight.tripComplete !== false && flight.destinationComplete !== false;
}

function totalPrice(flight) {
  const value = flight?.scoring?.breakdown?.estimatedTotalCost ?? flight?.price;
  return Number.isFinite(value) ? value : null;
}

function currencyForFlight(flight) {
  const value = flight.providerCurrency ?? flight.currency;
  return typeof value === "string" && value.trim() ? value.trim().toUpperCase() : null;
}

function departureDate(flight) {
  const value = flight.departureTime ?? flight.legs?.[0]?.departure_airport?.time;
  const match = typeof value === "string" ? value.match(/^\d{4}-\d{2}-\d{2}/) : null;
  return match?.[0] ?? null;
}

function minimum(values) {
  const finite = values.filter(Number.isFinite);
  return finite.length ? Math.min(...finite) : null;
}

function formatPrice(value, currency) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0
    }).format(value);
  } catch {
    return `$${Math.round(value).toLocaleString("en-US")}`;
  }
}

function formatCheckDate(value) {
  if (!value) return "the first saved check";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", timeZone: "UTC" }).format(date);
}
