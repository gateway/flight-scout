import { escapeHtml } from "./html-utils.js";
import { humanizeRefreshReasons } from "./refresh-plan-presentation.js";

export function refreshSpendSummaryText(refreshPlan) {
  if (!refreshPlan) return "No refresh check is loaded yet.";
  const fliCalls = refreshPlan.fliCallCount ?? 0;
  const selectedCount = refreshPlan.selectedCallCount ?? refreshPlan.calls?.length ?? 0;
  if (fliCalls === 0) {
    return `All ${selectedCount} selected searches are still fresh in cache.`;
  }
  return `I would run ${fliCalls} local search${fliCalls === 1 ? "" : "es"}.`;
}

export function renderRefreshDecisionCostCheck(refreshPlan) {
  if (!refreshPlan) return "";
  const calls = refreshPlan.calls ?? [];
  const liveCalls = calls.filter((call) => call.provider?.fliLive);
  const cachedCalls = calls.filter((call) => !call.provider?.fliLive);
  return `<div class="row refresh-decision">
    <div class="label">Refresh check</div>
    <div class="title">${escapeHtml(refreshSpendSummaryText(refreshPlan))}</div>
    <p class="small">${escapeHtml(refreshPlan.explanation)} ${escapeHtml(reasonSummary(calls))}</p>
    <div class="grid">
      ${refreshCallGroup(
        "Local searches",
        liveCalls,
        0
      )}
      ${refreshCallGroup("Already cached", cachedCalls, 0)}
    </div>
    ${refreshPlan.warnings?.length ? `<p class="small warn-text">${escapeHtml(refreshPlan.warnings.join(" "))}</p>` : ""}
  </div>`;
}

function refreshCallGroup(label, calls) {
  const shown = calls.slice(0, 8);
  const hidden = calls.length - shown.length;
  return `<div class="card">
    <div class="label">${escapeHtml(label)}</div>
    <div class="title">${calls.length} search${calls.length === 1 ? "" : "es"}</div>
    <div class="history-list">${shown.map(refreshCallItem).join("") || `<p class="small">None for this refresh.</p>`}</div>
    ${hidden > 0 ? `<p class="small">${hidden} more selected search${hidden === 1 ? "" : "es"} are listed in Refresh call detail.</p>` : ""}
  </div>`;
}

function refreshCallItem(call) {
  return `<div class="history-item">
    <strong>${escapeHtml(call.title ?? call.id)}</strong>
    <div class="small">${escapeHtml(humanizeRefreshReasons(call.refreshReasons).join(", "))} · ${escapeHtml(call.cache?.status ?? "unknown")}</div>
  </div>`;
}

function reasonSummary(calls) {
  const reasons = humanizeRefreshReasons(calls.flatMap((call) => call.refreshReasons ?? []));
  if (!reasons.length) return "The selected searches are the current best candidates for this plan.";
  return `Selected because: ${reasons.slice(0, 4).join("; ")}.`;
}
