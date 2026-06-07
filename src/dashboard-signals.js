import { escapeHtml } from "./html-utils.js";

const signalTones = new Set(["good", "warn", "bad", "info", "neutral"]);

function toneClass(tone) {
  return signalTones.has(tone) ? tone : "neutral";
}

export function signal(text, tone = "neutral") {
  return `<span class="text-signal text-signal-${toneClass(tone)}">${escapeHtml(text)}</span>`;
}

export function metricSignal(text, tone = "neutral") {
  return `<span class="metric-signal metric-signal-${toneClass(tone)}">${escapeHtml(text)}</span>`;
}

export function signalizeText(text) {
  let html = escapeHtml(text);
  html = html.replace(/\b(Saves \$[\d,]*\d)/g, (_, value) => signal(value, "good"));
  html = html.replace(/\b(Saves \d+h \d+m)/g, (_, value) => signal(value, "good"));
  html = html.replace(/\b(\d+% cheaper|\$[\d,]*\d cheaper)\b/g, (_, value) => signal(value, "good"));
  html = html.replace(/\b(\$[\d,]*\d more|costs \$[\d,]*\d more)\b/g, (_, value) => signal(value, "warn"));
  html = html.replace(/\b(adds \d+h \d+m|adds about \d+ minutes?|adds about \d+h \d+m)\b/g, (_, value) => signal(value, "warn"));
  html = html.replace(/\b(tight connection|risky connection|missed connection)\b/gi, (_, value) => signal(value, "bad"));
  html = html.replace(/\b(Same price|Known prices look stable|same value)\b/gi, (_, value) => signal(value, "info"));
  return html;
}
