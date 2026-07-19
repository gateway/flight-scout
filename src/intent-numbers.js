const NUMBER_WORDS = new Map([
  ["one", 1],
  ["two", 2],
  ["three", 3],
  ["four", 4],
  ["five", 5],
  ["six", 6],
  ["seven", 7]
]);

// Date-window and stopover parsers share the same intentionally small number vocabulary.
export function intentNumberPattern() {
  return `\\d+|${[...NUMBER_WORDS.keys()].join("|")}`;
}

export function parseIntentNumber(value) {
  return Number(value) || NUMBER_WORDS.get(String(value).toLowerCase()) || 0;
}
