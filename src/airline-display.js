const airlineNames = new Map([
  ["4Y", "Discover Airlines"],
  ["7C", "Jeju Air"],
  ["AA", "American Airlines"],
  ["AC", "Air Canada"],
  ["AF", "Air France"],
  ["AK", "AirAsia"],
  ["AS", "Alaska Airlines"],
  ["AY", "Finnair"],
  ["AZ", "ITA Airways"],
  ["B6", "JetBlue"],
  ["BA", "British Airways"],
  ["BI", "Royal Brunei Airlines"],
  ["BR", "EVA Air"],
  ["CA", "Air China"],
  ["CI", "China Airlines"],
  ["CX", "Cathay Pacific"],
  ["CZ", "China Southern Airlines"],
  ["D7", "AirAsia X"],
  ["DD", "Nok Air"],
  ["DL", "Delta Air Lines"],
  ["EK", "Emirates"],
  ["ET", "Ethiopian Airlines"],
  ["EY", "Etihad Airways"],
  ["FD", "Thai AirAsia"],
  ["FI", "Icelandair"],
  ["FZ", "flydubai"],
  ["GK", "Jetstar Japan"],
  ["HU", "Hainan Airlines"],
  ["HV", "Transavia"],
  ["JL", "Japan Airlines"],
  ["JX", "STARLUX Airlines"],
  ["KE", "Korean Air"],
  ["KL", "KLM"],
  ["LH", "Lufthansa"],
  ["LJ", "Jin Air"],
  ["LX", "SWISS"],
  ["MH", "Malaysia Airlines"],
  ["NH", "ANA"],
  ["OS", "Austrian Airlines"],
  ["OZ", "Asiana Airlines"],
  ["PG", "Bangkok Airways"],
  ["PR", "Philippine Airlines"],
  ["QR", "Qatar Airways"],
  ["SK", "SAS"],
  ["SL", "Thai Lion Air"],
  ["TG", "Thai Airways"],
  ["TK", "Turkish Airlines"],
  ["TR", "Scoot"],
  ["UA", "United Airlines"],
  ["UL", "SriLankan Airlines"],
  ["UO", "HK Express"],
  ["VZ", "Thai Vietjet Air"],
  ["WK", "Edelweiss Air"],
  ["WN", "Southwest Airlines"],
  ["WS", "WestJet"],
  ["XJ", "Thai AirAsia X"],
  ["Alaska", "Alaska Airlines"],
  ["American", "American Airlines"],
  ["Delta", "Delta Air Lines"],
  ["Hong Kong Express", "HK Express"],
  ["JAL", "Japan Airlines"],
  ["THAI", "Thai Airways"],
  ["United", "United Airlines"]
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
    .map((part) => canonicalAirlineName(part.trim()))
    .filter(Boolean)
    .join(" + ");
}

function canonicalAirlineName(value) {
  const code = /^[A-Za-z0-9]{2}$/.test(value) ? value.toUpperCase() : value;
  return airlineNames.get(code) ?? airlineNames.get(value) ?? value;
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
