import { metricSignal } from "./dashboard-signals.js";
import { escapeHtml, money } from "./html-utils.js";

export function movementCounts(comparison) {
  const changes = comparison?.changes ?? [];
  return {
    cheaper: changes.filter((change) => change.direction === "down").length,
    higher: changes.filter((change) => change.direction === "up").length,
    same: changes.filter((change) => change.direction === "same").length,
    newOptions: changes.filter((change) => change.direction === "new").length,
    disappeared: changes.filter((change) => change.direction === "disappeared").length
  };
}

export function movementSignal(comparison) {
  if (!comparison?.available) return metricSignal("first snapshot", "info");
  const read = movementRead(comparison);
  return metricSignal(read.label, read.tone);
}

export function movementMiniRows(comparison) {
  if (!comparison?.available) return [];
  const counts = movementCounts(comparison);
  const rows = [
    ["Cheaper", counts.cheaper, "good"],
    ["Higher", counts.higher, "warn"],
    ["New", counts.newOptions, "info"]
  ];
  return rows.filter(([, value]) => value > 0);
}

export function bestMovementText(comparison) {
  const changes = comparison?.changes ?? [];
  const bestDrop = changes.filter((change) => change.direction === "down").sort((a, b) => a.delta - b.delta)[0];
  const largestIncrease = changes.filter((change) => change.direction === "up").sort((a, b) => b.delta - a.delta)[0];
  if (bestDrop) return `Best drop: $${money(Math.abs(bestDrop.delta))}`;
  if (largestIncrease) return `Largest increase: $${money(largestIncrease.delta)}`;
  return "";
}

export function movementRead(comparison) {
  if (!comparison?.available) {
    return {
      label: "First saved search",
      body: "There is no earlier saved search to compare against yet.",
      tone: "info"
    };
  }
  const counts = movementCounts(comparison);
  const movementTotal = counts.cheaper + counts.higher;
  if (counts.cheaper > counts.higher * 1.5 && counts.cheaper > 0) {
    return {
      label: "Mostly better than last refresh",
      body: movementCountSentence(counts),
      tone: "good"
    };
  }
  if (counts.higher > counts.cheaper * 1.5 && counts.higher > 0) {
    return {
      label: "Mostly higher than last refresh",
      body: movementCountSentence(counts),
      tone: "warn"
    };
  }
  if (movementTotal > 0) {
    return {
      label: "Mixed price movement",
      body: movementCountSentence(counts),
      tone: "info"
    };
  }
  if (counts.newOptions > 0) {
    return {
      label: "New options appeared",
      body: `${counts.newOptions} new options appeared, while known prices mostly stayed the same.`,
      tone: "info"
    };
  }
  return {
    label: "Mostly unchanged",
    body: "Known prices look stable compared with the previous saved search.",
    tone: "info"
  };
}

export function renderMovementRead(comparison) {
  const read = movementRead(comparison);
  return `<div class="movement-read movement-read-${read.tone}">
    <strong>${escapeHtml(read.label)}</strong>
    <span>${escapeHtml(read.body)}</span>
  </div>`;
}

function movementCountSentence(counts) {
  return `Cheaper: ${counts.cheaper} · Higher: ${counts.higher} · New: ${counts.newOptions}`;
}
