// Owns card headings, price placement, and reusable button/icon actions.
export function dashboardStyleActions() {
  return `.card-head,
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
}`;
}
