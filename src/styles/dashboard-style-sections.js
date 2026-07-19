export function dashboardStyleSections() {
  return `.good { color: var(--good); }
.warn { color: var(--warn); }
.bad { color: var(--bad); }

.pain-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-top: 14px;
}
.pain-grid div {
  border-top: 1px solid var(--line);
  background: transparent;
  padding-top: 10px;
}
.pain-grid span,
.drawer-facts span {
  display: block;
  color: var(--quiet);
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 780;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.pain-grid strong,
.drawer-facts strong {
  display: block;
  color: var(--fg);
  font-size: 18px;
  margin-top: 4px;
}
.pain-grid small { display: block; color: var(--quiet); margin-top: 2px; }

.assumption-list,
.drawer-advice {
  margin-top: 12px;
  padding: 4px 0 4px 12px;
  border-left: 3px solid var(--warn);
  color: var(--muted);
}
.assumption-list p,
.drawer-advice p { color: var(--muted); margin: 0; }
.assumption-list p + p,
.drawer-advice p + p { margin-top: 8px; }
.drawer-advice span {
  display: block;
  color: var(--warn);
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 780;
  letter-spacing: 0.08em;
  margin-bottom: 6px;
  text-transform: uppercase;
}

.section-intro { margin: 18px 0 10px; }
.section-intro h3 { font-size: 20px; margin: 0 0 5px; }
.section-intro p { max-width: none; }

.side-drawer { margin: 0; }
details { margin-top: 10px; }
summary { cursor: pointer; color: var(--accent); font-weight: 800; }
.inline-read-drawer { display: inline; margin: 0; }
.side-drawer.inline-read-drawer summary {
  display: inline;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--accent);
  list-style: none;
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 3px;
}
.inline-read-drawer summary::-webkit-details-marker,
.card-detail-drawer summary::-webkit-details-marker,
.route > summary::-webkit-details-marker { display: none; }
.inline-read-drawer summary strong { color: var(--accent); }
.inline-read-drawer[open] summary strong { color: var(--fg); }
.side-drawer[open] .drawer-panel {
  position: fixed;
  inset: 0 0 0 auto;
  z-index: 30;
  width: min(900px, 96vw);
  overflow: auto;
  border-left: 1px solid var(--line);
  background: color-mix(in oklch, var(--surface) 96%, black);
  color: var(--fg);
  box-shadow: -22px 0 70px rgba(0,0,0,.42);
}
.drawer-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 18px;
  padding: 22px 26px;
  border-bottom: 1px solid var(--line);
}
.drawer-head strong { display: block; margin-top: 6px; font-size: 18px; line-height: 1.22; }
.drawer-head-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  flex: 0 0 auto;
}
.drawer-head-link {
  min-height: 36px;
  white-space: nowrap;
}
.drawer-close {
  width: 36px;
  height: 36px;
  padding: 0;
  font-size: 20px;
}
.drawer-facts {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0;
  padding: 0 26px;
  margin: 0 0 18px;
  border-bottom: 1px solid var(--line);
}
.drawer-facts div {
  min-height: 74px;
  border-left: 1px solid var(--line);
  padding: 12px 14px 10px;
}
.drawer-facts div:first-child { border-left: 0; padding-left: 0; }
.flight-timeline { padding: 0 26px 22px; }
.timeline-leg {
  display: grid;
  grid-template-columns: 42px 22px minmax(360px, 1fr) minmax(150px, 190px);
  gap: 12px;
  padding: 16px 0;
  border-top: 1px solid var(--line);
}
.timeline-leg:first-child { border-top: 0; }
.timeline-layover + .timeline-leg { border-top: 0; }
.airline-mark { display: flex; align-items: center; justify-content: center; }
.airline-mark img {
  max-width: 36px;
  max-height: 36px;
  border-radius: 10px;
  background: white;
}
.timeline-rail { display: flex; flex-direction: column; align-items: center; gap: 6px; padding-top: 8px; }
.timeline-rail span { width: 11px; height: 11px; border: 2px solid var(--quiet); border-radius: 50%; }
.timeline-rail i { display: block; width: 3px; min-height: 54px; border-left: 3px dotted var(--quiet); }
.leg-duration { color: var(--accent); font-size: 13px; font-weight: 860; margin: 0 0 8px; }
.timeline-time { display: flex; gap: 10px; align-items: baseline; }
.timeline-time strong { min-width: 58px; color: var(--fg); font-size: 16px; }
.timeline-time span { color: var(--fg); font-size: 16px; font-weight: 780; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.flight-meta { color: var(--muted); margin-top: 14px; font-size: 12px; font-weight: 760; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.timeline-amenities {
  display: grid;
  align-content: start;
  gap: 5px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: color-mix(in oklch, var(--surface-2) 72%, transparent);
  color: var(--muted);
  padding: 10px;
  font-size: 12px;
  font-weight: 700;
}
.timeline-amenities span {
  color: var(--quiet);
  font-size: 10px;
  font-weight: 860;
  letter-spacing: .05em;
  text-transform: uppercase;
}
.timeline-amenities div { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.timeline-amenities div::before { content: "•"; color: var(--accent); margin-right: 8px; }
.timeline-layover {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-left: 76px;
  padding: 13px 12px;
  border-top: 1px solid var(--line);
  font-size: 14px;
  font-weight: 860;
}
.timeline-layover::before {
  content: "";
  width: 10px;
  height: 10px;
  flex: 0 0 auto;
  border-radius: 2px;
  background: currentColor;
}
.timeline-layover strong { font-size: 18px; line-height: 1.1; }
.timeline-layover span { color: var(--muted); font-weight: 760; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.layover-tight { color: var(--bad); }
.layover-watch { color: var(--warn); }
.layover-good { color: var(--good); }
.layover-long { color: var(--long); }
.layover-neutral { color: var(--quiet); }
.stopover-break {
  margin-top: 4px;
  padding: 12px 0 6px;
  border-top: 1px solid var(--line);
  color: var(--accent);
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 860;
  letter-spacing: .08em;
  text-transform: uppercase;
}`;
}
