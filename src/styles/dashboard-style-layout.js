// Owns shared page sections, typography, and top-level component grids.
export function dashboardStyleLayout() {
  return `section {
  margin-top: 18px;
  padding: clamp(18px, 3vw, 28px);
  border: 1px solid var(--line);
  border-radius: 20px;
  background: color-mix(in oklch, var(--surface) 91%, transparent);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.035);
}
#overview,
#active-plans,
#best-across-plans {
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}
h2 {
  margin: 0 0 14px;
  color: var(--fg);
  font-family: var(--font-display);
  font-size: clamp(25px, 2.4vw, 34px);
  line-height: 1.04;
}
h3 {
  margin: 6px 0 8px;
  color: var(--fg);
  font-family: var(--font-display);
  line-height: 1.12;
}
p { margin: 0; color: var(--muted); }
.small { color: var(--muted); font-size: 13px; }
.title { color: var(--fg); font-size: 20px; font-weight: 840; margin-top: 6px; }

.grid,
.decision-stack,
.budget-strip,
.date-strip,
.price-graph,
.history-list {
  display: grid;
  gap: 12px;
}
.grid { grid-template-columns: repeat(auto-fit, minmax(270px, 1fr)); }
.decision-stack { grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr); align-items: stretch; }
.decision-list { grid-template-columns: 1fr; }
.budget-strip { grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
.date-strip { grid-template-columns: 1fr; }
.price-graph { grid-template-columns: 1fr; }
.overview-stack {
  display: grid;
  gap: 14px;
}
.overview-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 14px;
  align-items: start;
  padding: 13px 0;
  border-top: 1px solid var(--line);
}
.overview-row:first-of-type { margin-top: 8px; }
.overview-row p { max-width: none; }
.overview-action-stack {
  display: grid;
  gap: 8px;
  justify-items: end;
}`;
}
