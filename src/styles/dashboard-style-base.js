export function dashboardStyleBase() {
  return `:root {
  --bg: oklch(11% 0.018 245);
  --surface: oklch(16% 0.022 245);
  --surface-2: oklch(20% 0.024 245);
  --surface-3: oklch(24% 0.028 245);
  --fg: oklch(94% 0.012 235);
  --muted: oklch(72% 0.025 238);
  --quiet: oklch(56% 0.026 238);
  --line: oklch(30% 0.026 245);
  --accent: oklch(70% 0.155 190);
  --accent-2: oklch(68% 0.18 255);
  --warn: oklch(78% 0.14 78);
  --bad: oklch(68% 0.18 28);
  --good: oklch(72% 0.15 154);
  --long: oklch(74% 0.15 58);
  --shadow: 0 22px 70px rgba(0, 0, 0, 0.34);
  --font-display: "Avenir Next", "SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
  --font-body: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", "IBM Plex Mono", ui-monospace, Menlo, monospace;
}

* { box-sizing: border-box; }
html { color-scheme: dark; background: var(--bg); scroll-behavior: smooth; }
body {
  margin: 0;
  min-height: 100svh;
  background:
    radial-gradient(circle at 8% -10%, color-mix(in oklch, var(--accent) 16%, transparent) 0, transparent 28rem),
    radial-gradient(circle at 96% 0%, color-mix(in oklch, var(--accent-2) 12%, transparent) 0, transparent 24rem),
    linear-gradient(180deg, oklch(13% 0.022 245), var(--bg) 34rem);
  color: var(--fg);
  font: 15px/1.5 var(--font-body);
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

a { color: inherit; }
main {
  width: min(1380px, calc(100% - 32px));
  margin: 0 auto;
  padding: 18px 0 48px;
}

.top-nav {
  position: sticky;
  top: 0;
  z-index: 10;
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 8px;
  align-items: center;
  margin: 0 0 18px;
  padding: 10px;
  border: 1px solid color-mix(in oklch, var(--line) 92%, transparent);
  border-radius: 18px;
  background: color-mix(in oklch, var(--bg) 78%, transparent);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.nav-link,
.tab {
  min-height: 44px;
  display: inline-grid;
  grid-template-columns: 24px minmax(0, auto);
  align-items: center;
  justify-content: center;
  gap: 9px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: var(--muted);
  padding: 9px 10px;
  font-size: 13px;
  font-weight: 780;
  text-decoration: none;
  transition: background 180ms cubic-bezier(0.23, 1, 0.32, 1), color 180ms cubic-bezier(0.23, 1, 0.32, 1), transform 180ms cubic-bezier(0.23, 1, 0.32, 1);
}
.nav-link::before {
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  border-radius: 8px;
  background: color-mix(in oklch, var(--surface-2) 86%, transparent);
  color: var(--quiet);
  font-size: 15px;
}
.nav-link:nth-child(1)::before { content: "⌂"; }
.nav-link:nth-child(2)::before { content: "◈"; }
.nav-link:nth-child(3)::before { content: "◷"; }
.nav-link:nth-child(4)::before { content: "⇄"; }
.nav-link:nth-child(5)::before { content: "↻"; }
.nav-link:nth-child(6)::before { content: "▤"; }
.nav-link:hover {
  transform: translateY(-1px);
  background: color-mix(in oklch, var(--surface-2) 76%, transparent);
  color: var(--fg);
}
.nav-link.primary,
.tab.active {
  background: color-mix(in oklch, var(--accent) 18%, var(--surface));
  color: var(--fg);
}
.nav-link.primary::before {
  background: var(--accent);
  color: oklch(10% 0.018 245);
}

.hero {
  position: relative;
  overflow: hidden;
  padding: clamp(24px, 4vw, 40px);
  margin: 0 0 18px;
  border: 1px solid color-mix(in oklch, var(--accent) 28%, var(--line));
  border-radius: 22px;
  background:
    linear-gradient(135deg, color-mix(in oklch, var(--surface-2) 88%, transparent), color-mix(in oklch, var(--surface) 94%, transparent)),
    var(--surface);
  box-shadow: var(--shadow);
}
.hero::after {
  content: "";
  position: absolute;
  inset: auto -12% -44% 36%;
  height: 320px;
  background: radial-gradient(closest-side, color-mix(in oklch, var(--accent) 22%, transparent), transparent);
  filter: blur(18px);
  pointer-events: none;
}
.eyebrow,
.label {
  color: var(--quiet);
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 780;
  letter-spacing: 0.11em;
  line-height: 1.2;
  text-transform: uppercase;
}
.eyebrow { position: relative; z-index: 1; color: var(--accent); margin: 0 0 13px; }
h1 {
  position: relative;
  z-index: 1;
  width: 100%;
  margin: 0;
  color: var(--fg);
  font-family: var(--font-display);
  font-size: clamp(40px, 4vw, 54px);
  letter-spacing: 0;
  line-height: 0.98;
  overflow-wrap: break-word;
  word-break: normal;
  text-wrap: balance;
}
.sub {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: none;
  margin: 16px 0 0;
  color: var(--muted);
  font-size: 17px;
  line-height: 1.55;
}
.hero-status {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-top: 22px;
}
.hero-status span {
  min-height: 44px;
  display: flex;
  align-items: center;
  gap: 9px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: color-mix(in oklch, var(--surface-2) 78%, transparent);
  color: var(--muted);
  padding: 10px 12px;
  font-size: 13px;
  font-weight: 760;
}
.hero-status span::before { color: var(--accent); font-size: 16px; }
.hero-status span:nth-child(1)::before { content: "↻"; }
.hero-status span:nth-child(2)::before { content: "◷"; }
.hero-status span:nth-child(3)::before { content: "$"; font-family: var(--font-mono); font-weight: 900; }
`;
}
