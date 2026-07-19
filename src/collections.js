export function minBy(items, score) {
  return items.reduce((best, item) => (score(item) < score(best) ? item : best), items[0] ?? null);
}
