// Owns the reusable long-term route price history visualization.
export function dashboardStylePriceHistory() {
  return `.route-price-history {
  margin: 18px 0;
  padding: 16px 0;
  border-block: 1px solid var(--line);
}
.route-history-head,
.route-history-summary {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 8px 18px;
}
.route-history-head > div { display: grid; gap: 4px; }
.route-history-head > div > strong { color: var(--fg); font-size: 17px; }
.route-history-head > span,
.route-history-summary { color: var(--muted); font-size: 13px; font-weight: 760; }
.history-trend {
  height: 112px;
  display: flex;
  align-items: end;
  gap: clamp(6px, 1.4vw, 14px);
  margin: 16px 0 12px;
}
.history-point {
  min-width: 0;
  height: 100%;
  flex: 1;
  display: grid;
  grid-template-rows: 1fr auto;
  align-items: end;
  gap: 5px;
}
.history-point i {
  width: 100%;
  height: var(--history-level);
  min-height: 8px;
  display: block;
  border-radius: 4px 4px 2px 2px;
  background: color-mix(in oklch, var(--accent) 66%, var(--surface-3));
}
.history-point.cheapest i { background: var(--good); }
.history-point small {
  overflow: hidden;
  color: var(--quiet);
  font: 720 10px/1.2 var(--font-mono);
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.route-history-summary { justify-content: flex-start; }
.route-history-summary .history-good { color: var(--good); }
.route-history-summary .history-warn { color: var(--warn); }
@media (max-width: 560px) {
  .history-trend { gap: 4px; }
  .history-point small { display: none; }
}`;
}
