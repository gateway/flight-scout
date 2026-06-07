export function parseDateOnly(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function formatDateOnly(date) {
  return date.toISOString().slice(0, 10);
}

export function addDays(value, days) {
  const date = typeof value === "string" ? parseDateOnly(value) : new Date(value);
  date.setUTCDate(date.getUTCDate() + days);
  return formatDateOnly(date);
}

export function dateRange(start, end) {
  const dates = [];
  let cursor = parseDateOnly(start);
  const last = parseDateOnly(end);
  while (cursor <= last) {
    dates.push(formatDateOnly(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}
