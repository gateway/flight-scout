export function dashboardStyleDrawerResponsive() {
  return `  color: var(--accent);
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 860;
  letter-spacing: .08em;
  text-transform: uppercase;
}
.stopover-break.first { border-top: 0; margin-top: 0; }
.drawer-panel .pain-grid { padding: 0 26px; }
.drawer-panel .assumption-list,
.drawer-panel .drawer-advice { margin: 14px 26px; }

.price-row {
  overflow: hidden;
  padding: 18px;
  background:
    linear-gradient(180deg, color-mix(in oklch, var(--surface-3) 48%, transparent), color-mix(in oklch, var(--surface-2) 72%, transparent)),
    var(--surface-2);
}
.price-row-head {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  gap: 18px;
  margin-bottom: 14px;
}
.price-row-head strong { display: block; color: var(--fg); font-size: 21px; margin-top: 4px; letter-spacing: 0; }
.price-row-head small { display: block; color: var(--quiet); margin-top: 3px; }
.price-row-meta {
  min-width: 150px;
  padding-left: 18px;
  border-left: 1px solid var(--line);
  text-align: right;
}
.price-bars {
  position: relative;
  display: grid;
  grid-template-columns: repeat(7, minmax(72px, 1fr));
  gap: 10px;
  align-items: end;
  padding-top: 18px;
  border-top: 1px solid color-mix(in oklch, var(--line) 84%, transparent);
}
.price-bars::before,
.price-bars::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  pointer-events: none;
}
.price-bars::before {
  top: 76px;
  border-top: 1px dashed color-mix(in oklch, var(--quiet) 36%, transparent);
}
.price-bars::after {
  bottom: 52px;
  border-top: 1px solid color-mix(in oklch, var(--accent) 20%, var(--line));
}
.price-detail-drawer {
  min-width: 0;
  margin: 0;
}
.price-bars:has(.price-detail-drawer:only-child) {
  grid-template-columns: minmax(120px, 180px);
}
.price-bar {
  position: relative;
  min-height: 166px;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-items: center;
  gap: 6px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--fg);
  padding: 8px 4px 0;
  text-decoration: none;
  transition: background 180ms cubic-bezier(0.23, 1, 0.32, 1), transform 180ms cubic-bezier(0.23, 1, 0.32, 1);
}
.price-bar:hover {
  background: color-mix(in oklch, var(--accent) 8%, transparent);
  transform: translateY(-2px);
}
.price-bar.best {
  background: color-mix(in oklch, var(--accent) 10%, transparent);
}
.bar-fill {
  width: 100%;
  max-width: 44px;
  display: block;
  min-height: 12px;
  border: 1px solid color-mix(in oklch, var(--accent) 42%, transparent);
  border-radius: 8px 8px 3px 3px;
  background:
    linear-gradient(180deg, color-mix(in oklch, var(--accent) 78%, white), color-mix(in oklch, var(--accent) 72%, var(--surface-2))),
    var(--accent);
  box-shadow: 0 10px 24px color-mix(in oklch, var(--accent) 16%, transparent);
}
.price-bar.best .bar-fill {
  border-color: color-mix(in oklch, var(--good) 72%, var(--accent));
  background:
    linear-gradient(180deg, color-mix(in oklch, var(--good) 74%, white), var(--good)),
    var(--good);
}
.price-bar strong { font-size: 15px; line-height: 1; font-variant-numeric: tabular-nums; }
.price-bar small { color: var(--muted); font-size: 11px; font-weight: 800; text-align: center; }
.price-bar em {
  color: var(--quiet);
  font-family: var(--font-mono);
  font-size: 10px;
  font-style: normal;
  font-weight: 780;
  letter-spacing: 0.03em;
}

.route { margin: 16px 0 26px; }
.route > summary {
  cursor: pointer;
  list-style: none;
  padding: 16px;
  margin-bottom: 10px;
}
.route > summary h3 { display: inline; font-size: 20px; margin: 0 0 4px; }
.route-sort {
  display: flex;
  align-items: center;
  gap: 16px;
  margin: 18px 0 10px;
  color: var(--muted);
  font-size: 14px;
  font-weight: 800;
}
.route-sort-link {
  appearance: none;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--fg);
  cursor: pointer;
  font: inherit;
  padding: 2px 0 5px;
}
.route-sort-link:hover,
.route-sort-link.active {
  border-color: var(--accent);
  color: var(--accent);
}
.route-option { margin: 12px 0; }
.flight-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 14px;
  align-items: start;
  margin: 10px 0;
  padding: 14px 0;
  border-top: 1px solid var(--line);
}
.flight-row strong { display: block; color: var(--fg); font-size: 20px; }
.path,
.movement { color: var(--muted); margin-top: 5px; }
.actions { display: flex; gap: 8px; align-items: center; }
.leg { border-top: 1px solid var(--line); padding-top: 12px; margin-top: 12px; }
.history-list { margin-top: 12px; }
.history-item { border-top: 1px solid var(--line); padding-top: 10px; }
.history-item:first-child { border-top: 0; padding-top: 0; }
.history-item a { color: var(--accent); font-weight: 800; }

@media (max-width: 980px) {
  main { width: min(100% - 24px, 1380px); }
  .top-nav { grid-template-columns: repeat(3, minmax(0, 1fr)); position: static; }
  .decision-stack,
  .pain-grid,
  .flight-row,
  .lead-head,
  .card-head,
  .hero-status { grid-template-columns: 1fr; }
  .lead-price,
  .card-stat { text-align: left; margin-top: 4px; }
  .actions,
  .card-actions { justify-content: flex-start; }
  .drawer-facts { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .drawer-facts div:nth-child(odd) { border-left: 0; padding-left: 0; }
  .timeline-leg { grid-template-columns: 38px 18px minmax(0, 1fr); }
  .timeline-amenities { grid-column: 3; }
  .timeline-time span,
  .timeline-layover span { white-space: normal; }
  .timeline-layover { margin-left: 56px; }
  .date-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .price-row-head { grid-template-columns: 1fr; }
  .price-row-meta { padding-left: 0; border-left: 0; text-align: left; }
  .price-bars { overflow-x: auto; padding-bottom: 6px; }
  .price-detail-drawer { min-width: 74px; }
}

@media (max-width: 640px) {
  main { width: min(100% - 20px, 1380px); padding-top: 12px; }
  .top-nav { grid-template-columns: repeat(2, minmax(0, 1fr)); border-radius: 14px; }
  .nav-link { justify-content: start; }
  .hero,
  section { border-radius: 16px; padding: 18px; }
  h1 { font-size: clamp(36px, 12vw, 54px); }
  .grid,
  .budget-strip,
  .date-strip { grid-template-columns: 1fr; }
  .price-bars { grid-template-columns: repeat(7, 74px); }
}`;
}
