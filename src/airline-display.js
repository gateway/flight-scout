const airlineNames = new Map([
  ["AS", "Alaska"],
  ["BR", "EVA Air"],
  ["CI", "China Airlines"],
  ["CX", "Cathay Pacific"],
  ["DL", "Delta"],
  ["FD", "Thai AirAsia"],
  ["JL", "Japan Airlines"],
  ["KE", "Korean Air"],
  ["NH", "ANA"],
  ["PG", "Bangkok Airways"],
  ["QR", "Qatar Airways"],
  ["SL", "Thai Lion Air"],
  ["TG", "Thai Airways"],
  ["UO", "HK Express"]
]);

export function airlineDisplay(option) {
  const ordered = orderedAirlines(option);
  if (ordered.length) return ordered.map(displayAirlineName).join(" + ");
  return displayAirlineName(option?.airline);
}

export function displayAirlineName(value) {
  if (!value) return "";
  return String(value)
    .split(/\s*\+\s*/)
    .map((part) => airlineNames.get(part.trim()) ?? part.trim())
    .filter(Boolean)
    .join(" + ");
}

function orderedAirlines(option) {
  const seen = new Set();
  const result = [];
  for (const leg of option?.legs ?? []) {
    const airline = leg.airline;
    if (!airline || seen.has(airline)) continue;
    seen.add(airline);
    result.push(airline);
  }
  return result;
}
