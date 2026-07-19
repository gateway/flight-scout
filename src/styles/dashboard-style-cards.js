// Owns shared card surfaces, emphasis states, read panels, and text signals.
export function dashboardStyleCards() {
  return `.card,
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
.watch-target-card {
  border-color: color-mix(in oklch, var(--good) 48%, var(--line));
  background: color-mix(in oklch, var(--good) 6%, var(--surface-2));
}
.watch-target-card::before { background: var(--good); }
.watch-alert-card {
  border-color: color-mix(in oklch, var(--bad) 52%, var(--line));
  background: color-mix(in oklch, var(--bad) 6%, var(--surface-2));
}
.watch-alert-card::before { background: var(--bad); }
.watch-outcome-marker {
  position: absolute;
  top: 16px;
  left: 16px;
  color: var(--good);
  font-size: 18px;
  font-weight: 900;
}
.watch-target-card .card-head .label,
.watch-alert-card .card-head .label { padding-left: 24px; }
.watch-alert-card .watch-outcome-marker { color: var(--bad); }

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
.metric-signal-neutral { color: var(--fg); }`;
}
