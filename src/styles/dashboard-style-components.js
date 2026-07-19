import { dashboardStyleActions } from "./dashboard-style-actions.js";
import { dashboardStyleCards } from "./dashboard-style-cards.js";
import { dashboardStyleDataVisuals } from "./dashboard-style-data-visuals.js";
import { dashboardStyleLayout } from "./dashboard-style-layout.js";
import { dashboardStyleMetadata } from "./dashboard-style-metadata.js";
import { dashboardStylePriceHistory } from "./dashboard-style-price-history.js";

// Preserve the established cascade while each reusable component family owns its rules.
export function dashboardStyleComponents() {
  return `${dashboardStyleLayout()}\n${dashboardStyleDataVisuals()}\n${dashboardStylePriceHistory()}

${dashboardStyleCards()}

${dashboardStyleActions()}

${dashboardStyleMetadata()}`;
}
