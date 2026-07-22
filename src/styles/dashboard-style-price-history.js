// Owns the reusable long-term route price history visualization.
export function dashboardStylePriceHistory() {
  return `.route-price-history {
  margin: 18px 0;
  padding: 16px 0;
  border-block: 1px solid var(--line);
}
.plan-price-history {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(180px, 280px);
  gap: 12px 24px;
  align-items: center;
  margin-top: 18px;
  padding-top: 18px;
  border-top: 1px solid var(--line);
}
.price-history-copy,
.price-history-detail {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 6px 16px;
}
.price-history-copy > div { display: grid; gap: 4px; }
.price-history-copy strong { color: var(--fg); font-size: 15px; }
.price-history-copy > span,
.price-history-detail { color: var(--muted); font-size: 13px; font-weight: 760; }
.price-history-detail { grid-column: 1; justify-content: flex-start; }
.price-history-detail strong { color: var(--good); }
.price-history-chart {
  grid-column: 2;
  grid-row: 1 / span 2;
  display: grid;
  gap: 5px;
  align-self: stretch;
}
.price-history-chart-label {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  color: var(--quiet);
  font: 760 11px/1.2 var(--font-body);
}
.price-sparkline {
  width: 100%;
  height: 72px;
  overflow: visible;
}
.price-sparkline.compact {
  width: 112px;
  height: 34px;
}
.price-trend-fragment {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-top: 1px solid var(--line);
}
.price-trend-fragment > span { display: grid; gap: 2px; }
.price-trend-fragment strong { color: var(--fg); font-size: 13px; }
.price-trend-fragment small { color: var(--muted); font-size: 12px; }
@media (max-width: 700px) {
  .plan-price-history { grid-template-columns: 1fr; }
  .price-history-chart { grid-column: 1; grid-row: auto; }
}
`;
}
