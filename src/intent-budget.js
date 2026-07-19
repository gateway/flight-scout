const CURRENCY_ALIASES = [
  ["EUR", "€|\\beuros?\\b"],
  ["GBP", "£|\\b(?:pounds?|sterling)\\b"],
  ["THB", "฿|\\bbaht\\b"],
  ["JPY", "¥|\\byen\\b"],
  ["CAD", "c\\$"],
  ["AUD", "a\\$"],
  ["NZD", "nz\\$"],
  ["SGD", "s\\$"],
  ["HKD", "hk\\$"],
  ["CNY", "\\b(?:rmb|yuan)\\b"],
  ["KRW", "₩|\\bwon\\b"],
  ["INR", "₹|\\brupees?\\b"]
];
const ISO_CURRENCIES = new Set(Intl.supportedValuesOf("currency"));

// Flight Scout operates in USD; unsupported budget currencies stop plan creation
// instead of being relabeled or converted without an exchange-rate contract.
export function parseFlightBudget(text) {
  const unsupportedCurrency = unsupportedBudgetCurrency(text);
  if (unsupportedCurrency) {
    return {
      budget: null,
      clarification: `I can compare flight budgets in USD. What USD budget should I use instead of ${unsupportedCurrency}?`
    };
  }

  return { budget: parseUsdBudget(text), clarification: null };
}

function parseUsdBudget(text) {
  const contextualLimit = text.match(/(?:budget|cost|price|fare)[^.]{0,30}(?:under|less than|no more than|max(?:imum)?|does(?:n't| not)? cost more than)\s+\$?\s*([0-9][0-9,]*)/i);
  const rangeMatch = firstNonHotelMoneyRange(text);
  if (rangeMatch) {
    const low = Number(rangeMatch[1].replaceAll(",", ""));
    const high = Number(rangeMatch[2].replaceAll(",", ""));
    if (Number.isFinite(low) && Number.isFinite(high)) {
      return {
        target: Math.max(low, high),
        softMax: Math.max(low, high),
        hardMax: Math.round(Math.max(low, high) * 1.2),
        currency: "USD",
        range: [Math.min(low, high), Math.max(low, high)],
        hard: false
      };
    }
  }
  const moneyMatch = firstNonHotelMoney(text);
  const valueText = contextualLimit?.[1] ?? (moneyMatch ? (moneyMatch[1] ?? moneyMatch[2]) : null);
  if (!valueText) return null;
  const value = Number(valueText.replaceAll(",", ""));
  if (!Number.isFinite(value)) return null;
  const hard = Boolean(contextualLimit) || isHardMoneyMatch(text, moneyMatch);
  return {
    target: value,
    softMax: hard ? value : Math.round(value * 1.1),
    hardMax: hard ? value : Math.round(value * 1.3),
    currency: "USD",
    hard
  };
}

function firstNonHotelMoneyRange(text) {
  const contextual = text.match(/(?:budget|cost|price|fare)[^.]{0,40}?\$?\s*([0-9][0-9,]*)\s*(?:-|to)\s*\$?\s*([0-9][0-9,]*)/i);
  if (contextual) return contextual;
  return [...text.matchAll(/\$\s*([0-9][0-9,]*)\s*(?:-|to)\s*\$?\s*([0-9][0-9,]*)/gi)].find((match) => !isHotelContext(text, match)) ?? null;
}

function firstNonHotelMoney(text) {
  return [...text.matchAll(/\$\s*([0-9][0-9,]*)|([0-9][0-9,]*)\s*(?:usd|dollars?)/gi)]
    .find((match) => !isHotelContext(text, match)) ?? null;
}

function isHotelContext(text, match) {
  const start = match.index ?? 0;
  const context = text.slice(Math.max(0, start - 45), Math.min(text.length, start + match[0].length + 45)).toLowerCase();
  return /\b(hotel|room|per night|\/night|nightly)\b/.test(context);
}

function isHardMoneyMatch(text, match) {
  if (!match) return false;
  const start = match.index ?? 0;
  const before = text.slice(Math.max(0, start - 35), start).toLowerCase();
  return /(?:under|less than|no more than|max(?:imum)?|does(?:n't| not)? cost more than)\s*$/.test(before);
}

function unsupportedBudgetCurrency(text) {
  for (const [currency, pattern] of CURRENCY_ALIASES) {
    for (const match of text.matchAll(new RegExp(pattern, "gi"))) {
      if (!isHotelCurrencyContext(text, match)) return currency;
    }
  }
  return unsupportedIsoBudgetCurrency(text);
}

function unsupportedIsoBudgetCurrency(text) {
  const currencyNearAmount = /(?:\b([a-z]{3})\s*(?=[0-9])|[0-9][0-9,]*(?:\.[0-9]+)?\s*([a-z]{3})\b)/gi;
  for (const match of text.matchAll(currencyNearAmount)) {
    const currency = (match[1] ?? match[2]).toUpperCase();
    if (currency !== "USD" && ISO_CURRENCIES.has(currency) && !isHotelCurrencyContext(text, match)) return currency;
  }
  return null;
}

function isHotelCurrencyContext(text, match) {
  const start = match.index ?? 0;
  const before = text.slice(Math.max(0, start - 40), start).toLowerCase();
  const after = text.slice(start + match[0].length, start + match[0].length + 25).toLowerCase();
  return /(?:hotel|room)[^.,;]{0,35}$/.test(before) || /(?:per night|\/night|nightly)/.test(after);
}
