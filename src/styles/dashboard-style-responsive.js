// Ordered tablet and mobile overrides for the shared dashboard and flight drawer.
export function dashboardStyleResponsive() {
  return `@media (max-width: 980px) {
  main { width: min(100% - 24px, 1380px); }
  .side-drawer[open] .drawer-panel {
    inset: 0;
    width: 100vw;
    max-width: 100vw;
    border-left: 0;
    overflow-x: hidden;
    overscroll-behavior: contain;
  }
  .drawer-head {
    position: sticky;
    top: 0;
    z-index: 2;
    display: grid;
    grid-template-columns: 1fr;
    gap: 14px;
    padding: 18px 20px;
    background: color-mix(in oklch, var(--surface) 98%, black);
  }
  .drawer-head > div:first-child { min-width: 0; }
  .drawer-head strong {
    max-width: none;
    font-size: 20px;
    line-height: 1.18;
  }
  .drawer-head-actions {
    grid-row: 1;
    justify-content: flex-end;
    width: 100%;
  }
  .drawer-head-link {
    min-width: 0;
    max-width: calc(100vw - 86px);
  }
  .top-nav { grid-template-columns: repeat(3, minmax(0, 1fr)); position: static; }
  .decision-stack,
  .flight-row,
  .lead-head,
  .hero-status { grid-template-columns: 1fr; }
  .card-head { grid-template-columns: minmax(0, 1fr) auto; }
  .pain-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .lead-price,
  .card-stat { text-align: right; margin-top: 0; }
  .actions,
  .card-actions { justify-content: flex-end; }
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
  .drawer-head { padding: 16px; }
  .drawer-facts,
  .flight-timeline,
  .drawer-panel .pain-grid {
    padding-left: 16px;
    padding-right: 16px;
  }
  .drawer-panel .assumption-list,
  .drawer-panel .drawer-advice { margin-left: 16px; margin-right: 16px; }
  .drawer-head-link {
    max-width: calc(100vw - 76px);
    padding-left: 10px;
    padding-right: 10px;
  }
  .top-nav { grid-template-columns: repeat(2, minmax(0, 1fr)); border-radius: 14px; }
  .nav-link { justify-content: start; }
  .hero,
  section { border-radius: 16px; padding: 18px; }
  h1 { font-size: clamp(36px, 12vw, 54px); }
  .grid,
  .budget-strip,
  .date-strip { grid-template-columns: 1fr; }
  .flight-card .card-head {
    grid-template-columns: minmax(0, 1fr) minmax(84px, auto);
    gap: 10px;
  }
  .flight-card .card-stat {
    min-width: 84px;
    justify-self: end;
  }
  .flight-card .card-stat strong { font-size: 22px; }
  .flight-card .card-actions {
    display: grid !important;
    grid-template-columns: repeat(2, 34px);
    justify-content: end;
    gap: 8px;
  }
  .flight-card .pain-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px;
  }
  .flight-card .pain-grid div {
    min-width: 0;
    padding-top: 8px;
  }
  .flight-card .pain-grid strong {
    font-size: clamp(16px, 4.7vw, 20px);
    white-space: nowrap;
  }
  .flight-card .pain-grid span {
    font-size: 9px;
    letter-spacing: 0.04em;
  }
  .price-bars { grid-template-columns: repeat(7, 74px); }
}`;
}
