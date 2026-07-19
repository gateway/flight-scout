import { dateOnly } from "./html-utils.js";

// Selects the lowest complete fare for each departure date across raw or normalized options.
export function cheapestCompleteOptionsByDate(options) {
  const byDate = new Map();
  for (const option of options ?? []) {
    const date = option.date ?? dateOnly(option.departureTime ?? option.inbound?.departureTime ?? option.outbound?.departureTime);
    const price = option.price ?? option.totalCost;
    if (
      !date ||
      !Number.isFinite(price) ||
      !Number.isFinite(option.durationMinutes) ||
      option.tripComplete === false ||
      option.destinationComplete === false
    ) continue;
    const current = byDate.get(date);
    const currentPrice = current?.price ?? current?.totalCost;
    if (!current || price < currentPrice) byDate.set(date, option);
  }
  return byDate;
}
