export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

export function escapeAttr(value) {
  return escapeHtml(value);
}

export function money(value) {
  return Number.isFinite(value) ? Number(value).toLocaleString("en-US") : "n/a";
}

export function dateOnly(value) {
  return value?.slice(0, 10) ?? null;
}

export function formatHumanDate(value) {
  if (!value) return "";
  const [year, month, day] = String(value).slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return String(value);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric"
  });
}

export function formatMinutes(minutes) {
  if (!Number.isFinite(minutes)) return null;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export function formatDateTime(value) {
  return value ? value.replace("T", " ").replace(/\.\d{3}Z$/, " UTC") : "";
}
