export function dashboardStyleComponents() {
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
.budget-strip { grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
.date-strip { grid-template-columns: repeat(3, minmax(0, 1fr)); }
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
}
.mini-list,
.mini-bars,
.mini-route-scans,
.mini-date-scan {
  display: grid;
  gap: 7px;
  margin-top: 6px;
}
.mini-row,
.mini-bar-row {
  display: grid;
  grid-template-columns: 76px 82px 70px 56px;
  gap: 10px;
  align-items: center;
  color: var(--muted);
  font-size: 13px;
  font-weight: 760;
}
.mini-row strong,
.mini-bar-row strong { color: var(--fg); font-variant-numeric: tabular-nums; }
.mini-row em,
.mini-bar-row em {
  color: var(--quiet);
  font-style: normal;
  font-variant-numeric: tabular-nums;
}
.mini-row small {
  color: var(--quiet);
  font-size: 12px;
  font-weight: 820;
  text-align: right;
}
.movement-read {
  display: grid;
  gap: 4px;
  margin: 7px 0 8px;
  max-width: 760px;
}
.movement-read strong {
  color: var(--fg);
  font-size: 16px;
  line-height: 1.2;
}
.movement-read span {
  color: var(--muted);
  font-size: 14px;
  line-height: 1.45;
}
.movement-read-good strong { color: var(--good); }
.movement-read-warn strong { color: var(--warn); }
.movement-read-info strong { color: var(--accent); }
.movement-read-bad strong { color: var(--bad); }
.movement-stat-line {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 18px;
  margin-top: 8px;
  color: var(--muted);
  font: 780 13px/1.4 var(--font-body);
}
.movement-stat-line strong {
  color: var(--fg);
  font-variant-numeric: tabular-nums;
}
.movement-stat-line .movement-good strong { color: var(--good); }
.movement-stat-line .movement-warn strong { color: var(--warn); }
.movement-stat-line .movement-info strong { color: var(--accent); }
.mini-bar-row {
  grid-template-columns: minmax(130px, 1fr) 70px minmax(70px, 150px) 70px;
}
.mini-bar-row i {
  display: block;
  height: 8px;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--accent), var(--good));
}
.mini-route-scans {
  gap: 12px;
}
.mini-route-scan {
  display: grid;
  gap: 6px;
}
.mini-route-title {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  color: var(--muted);
  font-size: 13px;
  font-weight: 860;
}
.mini-route-title span {
  color: var(--quiet);
  font-size: 11px;
  font-weight: 760;
  text-align: right;
}
.mini-date-scan {
  grid-template-columns: repeat(auto-fit, minmax(76px, 1fr));
}
.mini-date-point {
  display: block;
  min-height: 62px;
  width: 100%;
  padding: 8px 7px;
  border: 1px solid var(--line);
  border-radius: 11px;
  background: color-mix(in oklch, var(--surface) 58%, transparent);
  color: inherit;
  cursor: default;
  text-align: left;
  text-decoration: none;
}
.mini-date-drawer { margin: 0; }
.mini-date-drawer .mini-date-point { cursor: pointer; }
.mini-date-drawer summary::-webkit-details-marker { display: none; }
.mini-date-point.best {
  border-color: color-mix(in oklch, var(--accent) 70%, var(--line));
  background: color-mix(in oklch, var(--accent) 13%, var(--surface));
}
.mini-date-drawer .mini-date-point:hover {
  border-color: color-mix(in oklch, var(--accent) 72%, var(--line));
  background: color-mix(in oklch, var(--accent) 16%, var(--surface));
}
.mini-date-point span,
.mini-date-point em {
  display: block;
  color: var(--quiet);
  font-size: 11px;
  font-weight: 820;
  line-height: 1.2;
}
.mini-date-point strong {
  display: block;
  color: var(--fg);
  font-size: 15px;
  font-weight: 900;
  line-height: 1.25;
  margin: 4px 0 3px;
  font-variant-numeric: tabular-nums;
}

.card,
.row,
.flight-card,
.budget-option,
.date-card,
.price-row,
.route > summary,
.plan-read-panel {
  position: relative;
  border: 1px solid color-mix(in oklch, var(--line) 94%, transparent);
  border-radius: 15px;
  background: color-mix(in oklch, var(--surface-2) 73%, transparent);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.035);
}
.card,
.row,
.flight-card,
.budget-option,
.date-card,
.price-row { padding: 16px; }
.plan-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}
.plan-card-action {
  display: grid;
  justify-items: end;
  gap: 8px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--line);
}
.plan-action-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border: 1px solid color-mix(in oklch, var(--accent) 62%, var(--line));
  border-radius: 11px;
  background: color-mix(in oklch, var(--accent) 12%, var(--surface));
  color: var(--accent);
  font-size: 17px;
  font-weight: 900;
  line-height: 1;
  text-decoration: none;
  transition: transform 180ms cubic-bezier(0.23, 1, 0.32, 1), background 180ms cubic-bezier(0.23, 1, 0.32, 1), border-color 180ms cubic-bezier(0.23, 1, 0.32, 1);
}
.plan-action-icon:hover {
  transform: translateY(-1px);
  background: color-mix(in oklch, var(--accent) 18%, var(--surface));
  border-color: var(--accent);
}
.card::before,
.flight-card::before,
.budget-option::before,
.date-card::before,
.price-row::before,
.plan-read-panel::before {
  content: "";
  position: absolute;
  top: 14px;
  left: 0;
  width: 3px;
  height: 32px;
  border-radius: 0 999px 999px 0;
  background: color-mix(in oklch, var(--quiet) 62%, transparent);
}
.card.best,
.flight-card.best,
.decision-lead,
.budget-option:first-child {
  border-color: color-mix(in oklch, var(--accent) 58%, var(--line));
  background: linear-gradient(180deg, color-mix(in oklch, var(--accent) 8%, var(--surface-2)), color-mix(in oklch, var(--surface-2) 82%, transparent));
}
.card.best::before,
.flight-card.best::before,
.decision-lead::before,
.budget-option:first-child::before { background: var(--accent); }
.budget-lead {
  border-color: color-mix(in oklch, var(--good) 56%, var(--line));
  background: linear-gradient(180deg, color-mix(in oklch, var(--good) 8%, var(--surface-2)), color-mix(in oklch, var(--surface-2) 82%, transparent));
}
.budget-lead::before { background: var(--good); }

.plan-read { padding-bottom: clamp(18px, 3vw, 28px); }
.plan-read-panel {
  max-width: none;
  padding: 18px 20px 18px 22px;
}
.plan-read-panel p,
.plan-read-line {
  color: var(--muted);
  font-size: 16px;
  line-height: 1.55;
  margin: 0 0 13px;
}
.plan-read-line:last-child { margin-bottom: 0; }
.plan-read-panel strong { color: var(--fg); font-weight: 860; }
.text-signal,
.metric-signal {
  color: var(--fg);
  font-weight: 880;
  text-decoration-line: underline;
  text-decoration-thickness: 2px;
  text-underline-offset: 4px;
  text-decoration-color: color-mix(in oklch, currentColor 78%, transparent);
}
.metric-signal {
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.text-signal-good,
.metric-signal-good { color: var(--good); }
.text-signal-warn,
.metric-signal-warn { color: var(--warn); }
.text-signal-bad,
.metric-signal-bad { color: var(--bad); }
.text-signal-info,
.metric-signal-info { color: var(--accent); }
.text-signal-neutral,
.metric-signal-neutral { color: var(--fg); }

.card-head,
.lead-head {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 16px;
  align-items: start;
}
.card-head h3,
.flight-card h3,
.budget-option h3,
.date-card h3 {
  font-size: 21px;
  line-height: 1.16;
  margin: 6px 0 8px;
}
.title-main,
.title-route { display: block; }
.title-route { color: var(--muted); font-size: 0.9em; margin-top: 3px; }
.card-stat,
.lead-price {
  min-width: 116px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.card-stat strong,
.lead-price strong {
  display: block;
  color: var(--fg);
  font-size: 24px;
  line-height: 1;
  font-weight: 900;
}
.card-stat span,
.lead-price span {
  display: block;
  color: var(--quiet);
  font-size: 12px;
  font-weight: 780;
  margin-top: 5px;
}
.card-actions {
  display: flex !important;
  gap: 8px;
  justify-content: flex-end;
  align-items: center;
  margin-top: 10px !important;
}

.btn,
.icon-link,
.drawer-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid color-mix(in oklch, var(--accent) 62%, var(--line));
  border-radius: 11px;
  background: color-mix(in oklch, var(--accent) 12%, var(--surface));
  color: var(--fg);
  cursor: pointer;
  font-weight: 820;
  text-decoration: none;
  transition: transform 180ms cubic-bezier(0.23, 1, 0.32, 1), background 180ms cubic-bezier(0.23, 1, 0.32, 1), border-color 180ms cubic-bezier(0.23, 1, 0.32, 1);
}
.btn {
  min-height: 38px;
  gap: 8px;
  padding: 8px 12px;
}
a.btn::after { content: "↗"; color: var(--accent); font-weight: 900; }
.drawer-btn::after { content: "↗"; }
.icon-link {
  width: 34px;
  height: 34px;
  padding: 0;
  font-size: 0;
}
.icon-link::before {
  content: "⌁";
  font-size: 17px;
  color: var(--accent);
}
a.icon-link::before { content: "↗"; }
.btn:hover,
.icon-link:hover,
.drawer-close:hover {
  transform: translateY(-1px);
  background: color-mix(in oklch, var(--accent) 18%, var(--surface));
  border-color: var(--accent);
}

.meta {
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
.pill.good::before,`;
}
