import { writeFile } from "node:fs/promises";
import { interpretFlightPlanText } from "./plan-intent.js";

export function parseTripIntent(text) {
  const intent = interpretFlightPlanText(text);
  return {
    raw: text,
    status: intent.status,
    clarifications: intent.clarifications,
    interpreted: {
      origin: intent.origin,
      alternateStarts: [],
      destination: intent.destination,
      departureWindow: intent.departureWindow,
      returnWindow: intent.returnWindow,
      tripType: intent.tripType,
      budget: intent.budget,
      priorities: {
        fastest: intent.preferences.priority === "fastest",
        fewestLayovers: intent.preferences.priority === "fewest-layovers",
        compareStopovers: Boolean(intent.stopover)
      },
      optionalStops: intent.stopover ? [{
        label: intent.stopover.label,
        airports: intent.stopover.airports,
        nights: intent.stopover.nights,
        required: intent.stopover.required
      }] : [],
      unresolved: intent.status === "needs-clarification" ? intent.clarifications : [],
      assumptions: [
        ...intent.assumptions,
        "No live provider scan has been run from this intent.",
        "Review the generated trip spec before running local searches.",
        "Prices must be verified before booking."
      ]
    }
  };
}

export async function writeIntentFiles({ text, outputPath }) {
  const intent = parseTripIntent(text);
  await writeFile(outputPath, JSON.stringify(intent, null, 2));
  return intent;
}
