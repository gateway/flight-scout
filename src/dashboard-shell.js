import { dashboardCss } from "./dashboard-styles.js";
import { escapeAttr, escapeHtml, formatDateTime, money } from "./html-utils.js";
import { planDisplaySummary } from "./plan-display.js";
import { renderRefreshOverlay, renderRefreshPlanButton, renderRefreshScript } from "./browser-refresh-controls.js";
import { renderWindowExtensionScript } from "./dashboard-window-edge.js";

// Shared page shell, top navigation, and side-drawer browser behavior.
function renderPageShell({ plan, planPath, current, pages }, activePage, body) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(plan.name)} ${escapeHtml(pages[activePage]?.label ?? "Dashboard")}</title>
<style>${dashboardCss()}</style>
</head>
<body>
<main>
  ${renderPlanNav(pages, activePage, planPath)}
  <div class="hero">
    <div class="eyebrow">Saved flight plan</div>
    <h1>${escapeHtml(plan.name)}</h1>
    <p class="sub">${escapeHtml(planDisplaySummary(plan))}</p>
    ${renderHeroStatus(current)}
  </div>
  ${body}
</main>
${renderDrawerScript()}
${renderRefreshOverlay()}
${renderRefreshScript()}
${renderWindowExtensionScript()}
</body>
</html>`;
}

export function renderDrawerScript() {
  return `<script>
document.addEventListener("click", (event) => {
  const routeSort = event.target.closest("[data-sort-route]");
  if (routeSort) {
    const route = routeSort.closest(".route");
    const options = route?.querySelector("[data-route-options]");
    if (!options) return;
    const mode = routeSort.dataset.sortRoute;
    route.querySelectorAll("[data-sort-route]").forEach((button) => button.classList.toggle("active", button === routeSort));
    const cards = Array.from(options.querySelectorAll(".route-option"));
    const field = mode === "cheapest" ? "price" : mode === "fastest" ? "duration" : "rank";
    cards.sort((a, b) => Number(a.dataset[field]) - Number(b.dataset[field]));
    cards.forEach((card) => options.appendChild(card));
    return;
  }
  const summary = event.target.closest(".side-drawer > summary");
  if (summary) {
    event.preventDefault();
    const drawer = summary.closest(".side-drawer");
    const shouldOpen = !drawer.hasAttribute("open");
    document.querySelectorAll(".side-drawer[open]").forEach((openDrawer) => {
      if (openDrawer !== drawer) openDrawer.removeAttribute("open");
    });
    if (shouldOpen) drawer.setAttribute("open", "");
    else drawer.removeAttribute("open");
    return;
  }
  if (event.target.closest(".drawer-close")) {
    event.target.closest("details")?.removeAttribute("open");
    return;
  }
  document.querySelectorAll(".side-drawer[open]").forEach((drawer) => {
    const panel = drawer.querySelector(".drawer-panel");
    const summary = drawer.querySelector(":scope > summary");
    if (panel?.contains(event.target) || summary?.contains(event.target)) return;
    drawer.removeAttribute("open");
  });
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") document.querySelectorAll(".side-drawer[open]").forEach((drawer) => drawer.removeAttribute("open"));
});
</script>`;
}

function renderPlanNav(pages, activePage, planPath) {
  const pageLinks = ["decision", "dates", "routes", "refresh"].map((key) => {
    const page = pages[key];
    const className = `nav-link${key === activePage ? " primary" : ""}`;
    return `<a class="${className}" href="${escapeAttr(page.href)}">${escapeHtml(page.label)}</a>`;
  }).join("");
  return `<nav class="top-nav">
    <a class="nav-link" href="/">All plans</a>
    ${pageLinks}
    ${planPath ? renderRefreshPlanButton(planPath, { className: "nav-refresh-btn" }) : ""}
  </nav>`;
}

function renderHeroStatus(current) {
  if (!current) return "";
  return `<div class="hero-status">
    <span>Last checked ${escapeHtml(formatDateTime(current.meta.createdAt))}</span>
    <span>${current.meta.refresh?.fliCallCount ?? current.meta.refresh?.liveCallCount ?? 0} fresh searches</span>
  </div>`;
}


export { renderPageShell };
