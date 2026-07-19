import { dashboardStyleDrawerBase } from "./dashboard-style-drawer-base.js";
import { dashboardStylePageContent } from "./dashboard-style-page-content.js";
import { dashboardStyleResponsive } from "./dashboard-style-responsive.js";

// Keep the established order: drawer spacing, page content, then viewport overrides.
export function dashboardStyleDrawerResponsive() {
  return `${dashboardStyleDrawerBase()}\n\n${dashboardStylePageContent()}\n\n${dashboardStyleResponsive()}`;
}
