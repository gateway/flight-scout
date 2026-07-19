export function dashboardStyleRefresh() {
  return `.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
}
.section-head h2 { margin: 0; }
.section-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 10px;
}
.plan-action-icon:disabled {
  cursor: progress;
  opacity: .65;
  transform: none;
}
.nav-refresh-btn {
  justify-self: center;
  align-self: center;
}
.refresh-all-btn {
  min-height: 42px;
  white-space: nowrap;
}
.refresh-all-btn::before {
  content: "↻";
  margin-right: 8px;
  color: var(--accent);
}
.refresh-overlay[hidden] { display: none; }
.refresh-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: grid;
  place-items: center;
  padding: 22px;
  background: rgba(0, 0, 0, .58);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}
.refresh-dialog {
  width: min(440px, 100%);
  border: 1px solid color-mix(in oklch, var(--accent) 42%, var(--line));
  border-radius: 18px;
  background: color-mix(in oklch, var(--surface) 96%, black);
  box-shadow: var(--shadow);
  padding: 20px;
}
.refresh-progress {
  height: 8px;
  margin-top: 18px;
  overflow: hidden;
  border-radius: 999px;
  background: color-mix(in oklch, var(--line) 72%, transparent);
}
.refresh-progress span {
  display: block;
  width: 0;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--accent), var(--good));
  transition: width .25s ease;
}
.refresh-progress span.is-indeterminate {
  width: 38%;
  animation: refresh-progress 1.2s ease-in-out infinite;
}
@keyframes refresh-progress {
  0% { transform: translateX(-110%); }
  100% { transform: translateX(280%); }
}`;
}
