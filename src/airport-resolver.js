const AIRPORT_ALIASES = [
  { aliases: ["chiang mai", "cnx"], label: "Chiang Mai", airports: ["CNX"] },
  { aliases: ["bangkok"], label: "Bangkok", airports: ["BKK", "DMK"], assumption: "Bangkok can mean BKK or DMK, so both airports will be checked." },
  { aliases: ["bkk"], label: "Bangkok", airports: ["BKK"] },
  { aliases: ["dmk"], label: "Bangkok Don Mueang", airports: ["DMK"] },
  { aliases: ["tokyo"], label: "Tokyo", airports: ["HND", "NRT"], assumption: "Tokyo can mean HND or NRT, so both airports will be checked." },
  { aliases: ["hnd"], label: "Tokyo Haneda", airports: ["HND"] },
  { aliases: ["nrt"], label: "Tokyo Narita", airports: ["NRT"] },
  { aliases: ["redmond", "bend", "rdm"], label: "Redmond/Bend", airports: ["RDM"] },
  { aliases: ["seattle", "sea"], label: "Seattle", airports: ["SEA"] },
  { aliases: ["san francisco", "sfo"], label: "San Francisco", airports: ["SFO"] },
  { aliases: ["los angeles", "lax"], label: "Los Angeles", airports: ["LAX"] },
  { aliases: ["portland", "pdx"], label: "Portland", airports: ["PDX"] }
];

export function resolveAirportPlace(value) {
  const cleaned = cleanPlace(value);
  if (!cleaned) return { status: "missing", input: value, place: null, questions: [] };

  const alias = AIRPORT_ALIASES.find((entry) => entry.aliases.includes(cleaned)) ?? findAliasInside(cleaned);
  if (alias) {
    return {
      status: "resolved",
      input: value,
      place: { label: alias.label, airports: alias.airports },
      questions: [],
      assumptions: alias.assumption ? [alias.assumption] : []
    };
  }

  const codeMatches = [...cleaned.toUpperCase().matchAll(/\b[A-Z]{3}\b/g)].map((match) => match[0]);
  if (codeMatches.length) {
    return {
      status: "resolved",
      input: value,
      place: { label: codeMatches.join(","), airports: codeMatches },
      questions: [],
      assumptions: []
    };
  }

  return {
    status: "unresolved",
    input: value,
    place: null,
    questions: [`Which airport should I use for "${String(value).trim()}"? Airport codes like CNX, BKK, or RDM work best.`],
    assumptions: []
  };
}

export function knownPlacePattern() {
  return AIRPORT_ALIASES
    .flatMap((entry) => entry.aliases)
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .join("|");
}

export function airportLabelForCodes(codes) {
  const codeSet = new Set(codes ?? []);
  const exact = AIRPORT_ALIASES.find((entry) => entry.airports.length === codeSet.size && entry.airports.every((airport) => codeSet.has(airport)));
  return exact?.label ?? [...codeSet].join(",");
}

function cleanPlace(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\b(?:direct|nonstop|one way|one-way|flight|flights|from|to|get|me|find|best|routes?|prices?)\b/g, " ")
    .replace(/[^a-z0-9, ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findAliasInside(cleaned) {
  return AIRPORT_ALIASES.find((entry) => entry.aliases.some((alias) => {
    const pattern = new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(alias)}(?:$|[^a-z0-9])`);
    return pattern.test(cleaned);
  }));
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
