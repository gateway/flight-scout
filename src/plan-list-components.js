import { escapeAttr, escapeHtml, formatDateTime } from "./html-utils.js";
import { planDisplaySummary } from "./plan-display.js";
import { coverageText } from "./plan-list-coverage.js";
import { renderRefreshPlanButton } from "./browser-refresh-controls.js";

// Owns reusable cards and controls shared by active, archived, and overview pages.
export function renderPlanCard({ plan, latest, dashboardHref, planPath, status }, dashboardPrefix) {
  return `<div class="card plan-card">
  <div class="plan-card-head">
    <div>
      <div class="label">Plan</div>
      <div class="title">${escapeHtml(plan.name)}</div>
    </div>
    <div class="overview-action-stack">
      ${status.active ? renderRefreshPlanButton(planPath) : ""}
      ${planIconLink(`${dashboardPrefix}${dashboardHref}`, "Open dashboard", "▦")}
    </div>
  </div>
  <p class="small">${escapeHtml(planDisplaySummary(plan))}</p>
  <div class="meta">
    <span class="pill ${status.active ? "good" : "warn"}">${escapeHtml(status.label)}</span>
    <span class="pill">${escapeHtml(dateWindowText(plan))}</span>
    <span class="pill">${escapeHtml(latestRefreshText(latest))}</span>
    <span class="pill">${escapeHtml(coverageText(plan, latest))}</span>
    <span class="pill">${latest ? `${latest.summary?.completeOptions ?? 0} complete options` : "no snapshot"}</span>
  </div>
  ${renderArchiveControl(planPath, status)}
</div>`;
}

export function planIconLink(href, label, icon) {
  return `<a class="plan-action-icon" href="${escapeAttr(href)}" aria-label="${escapeAttr(label)}" title="${escapeAttr(label)}">${escapeHtml(icon)}</a>`;
}

export function latestRefreshText(latest) {
  return latest?.createdAt ? `Last refreshed ${formatDateTime(latest.createdAt)}` : "Not refreshed yet";
}

export function renderPlanListScript() {
  return `<script>
document.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-plan-archive-action]");
  if (!button) return;
  const planPath = button.dataset.planPath;
  const action = button.dataset.planArchiveAction;
  const idleIcon = button.dataset.idleIcon;
  button.disabled = true;
  button.textContent = "…";
  try {
    const response = await fetch("/api/plans/archive", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ planPath, restore: action === "restore" })
    });
    if (!response.ok) throw new Error(await response.text());
    window.location.href = "/#active-plans";
    window.location.reload();
  } catch (error) {
    button.disabled = false;
    button.innerHTML = '<span aria-hidden="true">' + idleIcon + '</span>';
    alert("This button needs the local flight app server. Use the command fallback, or start it with npm run serve.");
  }
});
</script>`;
}

function renderArchiveControl(planPath, status) {
  const label = status.active ? "Archive this plan" : "Restore this plan";
  const icon = status.active ? "&#128465;" : "↺";
  return `<div class="plan-card-action">
    <button class="plan-action-icon plan-archive-btn" type="button" data-plan-path="${escapeAttr(planPath)}" data-plan-archive-action="${status.active ? "archive" : "restore"}" data-idle-icon="${escapeAttr(icon)}" aria-label="${escapeAttr(label)}"><span aria-hidden="true">${icon}</span></button>
  </div>`;
}

function dateWindowText(plan) {
  const coverage = plan.intent?.dateCoverage;
  if (!coverage?.start || !coverage?.end) return "date window not set";
  return `${coverage.start} to ${coverage.end}`;
}
