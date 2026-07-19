import { formatMinutes } from "./html-utils.js";

// Explains why human-ranked choices can beat raw price or duration winners.
// The functions accept normalized decision options but remain pure so every
// dashboard surface can use the same comparison vocabulary.
export function bestChoiceRationale({ best, cheapest, fastest }) {
  const challengers = uniqueChallengers(best, cheapest, fastest);
  if (!challengers.length) {
    return "It is the strongest starting point for price, travel time, and connection quality.";
  }

  const ownStrength = bestConnectionStrength(best, challengers.map(({ option }) => option));
  const challengerReads = challengers.map(({ option, roles }) => {
    const role = roles.length === 2 ? "the cheaper and faster option" : `the ${roles[0]} option`;
    return `${role} ${challengerConcern(option, best)}`;
  });
  return `It wins because ${ownStrength}; ${challengerReads.join("; ")}.`;
}

export function challengerConcern(candidate, baseline) {
  const concerns = [];
  const risk = candidate?.connectionRisk;
  if (risk?.level === "tight") concerns.push(`depends on a tight ${layoverText(risk.shortest)}`);
  else if (risk?.level === "watch") concerns.push(`depends on a short ${layoverText(risk.shortest)}`);
  else if (risk?.level === "unknown") concerns.push("has an unverified connection time");

  if (confidenceRank(candidate?.confidence?.level) < confidenceRank(baseline?.confidence?.level)) {
    concerns.push("has lower confidence");
  }
  if ((candidate?.assumptions?.length ?? 0) > (baseline?.assumptions?.length ?? 0)) {
    concerns.push("requires extra travel before the listed itinerary");
  }
  if ((candidate?.stops ?? 0) > (baseline?.stops ?? 0)) concerns.push("adds more stops");
  return concerns.length ? joinReads(concerns) : "has a weaker overall routing and connection profile";
}

function uniqueChallengers(best, cheapest, fastest) {
  const byOption = new Map();
  for (const [role, option] of [["cheaper", cheapest], ["faster", fastest]]) {
    if (!option || option === best) continue;
    const entry = byOption.get(option) ?? { option, roles: [] };
    entry.roles.push(role);
    byOption.set(option, entry);
  }
  return [...byOption.values()];
}

function bestConnectionStrength(best, challengers) {
  const shortest = best?.connectionRisk?.shortest;
  if (best?.connectionRisk?.level === "comfortable" && shortest) {
    return `its shortest connection is a comfortable ${layoverDurationPlace(shortest)}`;
  }
  if (!shortest && challengers.some((option) => option?.connectionRisk?.shortest)) {
    return "it avoids a connection";
  }
  return "it offers the stronger overall balance of price, travel time, and connection quality";
}

function layoverText(layover) {
  const duration = formatMinutes(layover?.duration) ?? "unknown-time";
  const airport = layover?.id ?? layover?.name;
  return `${duration} connection${airport ? ` at ${airport}` : ""}`;
}

function layoverDurationPlace(layover) {
  const duration = formatMinutes(layover?.duration) ?? "unknown-time";
  const airport = layover?.id ?? layover?.name;
  return `${duration}${airport ? ` at ${airport}` : ""}`;
}

function confidenceRank(level) {
  return { "Needs data": 0, Low: 1, Medium: 2, High: 3 }[level] ?? 0;
}

function joinReads(parts) {
  if (parts.length < 2) return parts[0] ?? "";
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts.at(-1)}`;
}
