// Owns compact overview lists and route/date scan visualizations.
export function dashboardStyleDataVisuals() {
  return `.mini-list,
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
}`;
}
