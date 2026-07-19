import { dashboardStyleBase } from "./styles/dashboard-style-base.js";
import { dashboardStyleComponents } from "./styles/dashboard-style-components.js";
import { dashboardStyleSections } from "./styles/dashboard-style-sections.js";
import { dashboardStyleDrawerResponsive } from "./styles/dashboard-style-drawer-responsive.js";
import { dashboardStyleRefresh } from "./styles/dashboard-style-refresh.js";
import { dashboardStylePlanList } from "./styles/dashboard-style-plan-list.js";

export function dashboardCss() {
  // Locked shared dashboard theme. Keep this as the only public CSS assembly point.
  return [
    dashboardStyleBase(),
    dashboardStyleComponents(),
    dashboardStyleSections(),
    dashboardStylePlanList(),
    dashboardStyleDrawerResponsive(),
    dashboardStyleRefresh()
  ].join("\n");
}
