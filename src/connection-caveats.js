import { readFileSync } from "node:fs";
import { airportMetadataForCode } from "./airport-resolver.js";
import { enrichLayoversWithTimes } from "./connection-duration.js";

export const SEPARATE_TICKET_CAVEAT = "These legs are separate tickets. You must collect and re-check bags, and a delay on the first ticket is not protected by the second airline.";
export const TRANSIT_REQUIREMENTS_DISCLAIMER = "Rules depend on your passport - verify official requirements before booking.";

const TRANSIT_NOTES = loadTransitNotes();

// Produces presentation-neutral caveats once so cards, drawers, and scoring cannot drift.
export function connectionCaveatsForOption(option, airportLookup = airportMetadataForCode) {
  const layovers = layoversForOption(option);
  const transitNotes = transitNotesForLayovers(layovers, airportLookup);
  return {
    overnightLayovers: layovers.filter((layover) => layover.overnight),
    separateTicket: option?.kind === "composed-stopover",
    transitNotes,
    transitDisclaimer: transitNotes.length ? TRANSIT_REQUIREMENTS_DISCLAIMER : null
  };
}

export function transitNotesForLayovers(layovers = [], airportLookup = airportMetadataForCode) {
  const seen = new Set();
  const notes = [];
  for (const layover of layovers) {
    const isoCountry = airportLookup(layover.id)?.isoCountry;
    const entry = TRANSIT_NOTES[isoCountry];
    if (!isoCountry || seen.has(isoCountry) || !entry?.appliesToConnections) continue;
    seen.add(isoCountry);
    notes.push({ isoCountry, note: entry.note });
  }
  return notes;
}

function loadTransitNotes() {
  const data = JSON.parse(readFileSync(new URL("../data/transit-notes.json", import.meta.url), "utf8"));
  if (Object.keys(data).length > 10) throw new Error("Transit-note dataset must contain no more than 10 countries.");
  return data;
}

function layoversForOption(option) {
  if (!option) return [];
  if (option.kind === "composed-stopover") {
    return [...layoversForOption(option.inbound), ...layoversForOption(option.onward)];
  }
  if (option.kind === "composed-round-trip") {
    return [...layoversForOption(option.outbound), ...layoversForOption(option.returnFlight)];
  }
  return enrichLayoversWithTimes(option.layovers ?? [], option.legs ?? []);
}
