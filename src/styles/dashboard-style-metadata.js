// Owns compact card metadata and status color markers.
export function dashboardStyleMetadata() {
  return `.meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0 10px;
  margin-top: 12px;
}
.flight-card .meta { margin-top: 2px; }
.pill {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  color: var(--muted);
  font-size: 13px;
  font-weight: 760;
  padding: 0 10px 0 0;
}
.pill::before {
  content: "•";
  color: var(--quiet);
  margin-right: 7px;
}
.pill.connection::before,
.pill.good::before,
.pill.warn::before,
.pill.bad::before { content: ""; width: 8px; height: 8px; border-radius: 2px; background: currentColor; margin-right: 7px; }`;
}
