// Stable public facade for shared flight-card rendering across every dashboard page.
export { renderCardHead } from "./dashboard-flight-card.js";
export { flightActionLinks, flightIconLink, flightDetailDrawer } from "./dashboard-flight-actions.js";
export { renderFlightDetailPanel } from "./dashboard-flight-drawer.js";
export {
  hasFlightDetail,
  flightGoogleFlightsUrl,
  bestChoiceSentence,
  optionHeadline,
  humanOptionLine,
  cleanTitlePart,
  optionRouteLine,
  optionDate,
  connectionPill,
  renderPainBreakdown,
  renderAssumptions
} from "./dashboard-flight-option.js";
