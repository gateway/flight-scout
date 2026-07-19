import { escapeAttr, escapeHtml } from "./html-utils.js";

// Shared browser refresh controls for generated static pages served by local-server.js.
// The buttons stay inert from file://, and call the local app server when available.
export function renderRefreshPlanButton(planPath, { label = "Refresh this plan", icon = "↻", className = "" } = {}) {
  return `<button class="plan-action-icon refresh-plan-btn ${escapeAttr(className)}" type="button" data-plan-path="${escapeAttr(planPath)}" data-plan-refresh-action="plan" aria-label="${escapeAttr(label)}" title="${escapeAttr(label)}"><span aria-hidden="true">${escapeHtml(icon)}</span></button>`;
}

export function renderRefreshAllButton(count) {
  if (!count) return "";
  return `<button class="btn refresh-all-btn" type="button" data-plan-refresh-action="all">Refresh all active plans</button>`;
}

export function renderRefreshOverlay() {
  return `<div class="refresh-overlay" data-refresh-overlay hidden>
  <div class="refresh-dialog" role="status" aria-live="polite">
    <div class="label">Refreshing</div>
    <div class="title" data-refresh-title>Checking latest flight data</div>
    <p class="small" data-refresh-message>This can take a few minutes while local searches run one at a time.</p>
    <div class="refresh-progress" aria-hidden="true"><span data-refresh-progress-bar></span></div>
  </div>
</div>`;
}

export function renderRefreshScript() {
  return `<script>
document.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-plan-refresh-action]");
  if (!button) return;
  const action = button.dataset.planRefreshAction;
  const isAll = action === "all";
  const planPath = button.dataset.planPath;
  const label = isAll ? "all active plans" : "this plan";
  if (!confirm("Refresh " + label + " now?\\n\\nThis reruns the selected local searches and regenerates the dashboards.")) return;
  const overlay = document.querySelector("[data-refresh-overlay]");
  const title = overlay?.querySelector("[data-refresh-title]");
  const message = overlay?.querySelector("[data-refresh-message]");
  const progressBar = overlay?.querySelector("[data-refresh-progress-bar]");
  if (overlay) overlay.hidden = false;
  if (title) title.textContent = isAll ? "Refreshing all active plans" : "Refreshing this plan";
  if (message) message.textContent = "Starting selected local searches.";
  if (progressBar) {
    progressBar.classList.add("is-indeterminate");
    progressBar.style.width = "";
  }
  button.disabled = true;
  try {
    const response = await fetch("/api/plans/refresh/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(isAll ? { all: true, mode: "standard", refresh: true } : { planPath, mode: "standard", refresh: true })
    });
    if (!response.ok) throw new Error(await response.text());
    const payload = await response.json();
    await pollRefreshJob(payload.jobId, { title, message, progressBar });
    const hash = window.location.hash || (isAll ? "#active-plans" : "");
    window.location.href = window.location.pathname + "?v=refresh-" + Date.now() + hash;
  } catch (error) {
    if (overlay) overlay.hidden = true;
    button.disabled = false;
    alert("Refresh failed: " + error.message);
  }
});

async function pollRefreshJob(jobId, nodes) {
  while (true) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const response = await fetch("/api/plans/refresh-status?id=" + encodeURIComponent(jobId));
    if (!response.ok) throw new Error(await response.text());
    const payload = await response.json();
    const job = payload.job;
    if (nodes.title && job.title) nodes.title.textContent = job.title;
    if (nodes.message && job.message) nodes.message.textContent = job.message;
    updateRefreshProgress(nodes.progressBar, job);
    if (job.status === "complete") return job;
    if (job.status === "failed") throw new Error(job.error || job.message || "Refresh failed.");
  }
}

function updateRefreshProgress(progressBar, job) {
  if (!progressBar) return;
  const planTotal = Number(job.planTotal || 0);
  const planIndex = Number(job.planIndex || 0);
  const searchTotal = Number(job.searchTotal || 0);
  const searchIndex = Number(job.searchIndex || 0);
  if (!planTotal || !searchTotal) return;
  const planBase = Math.max(0, planIndex - 1) / planTotal;
  const searchShare = Math.min(1, Math.max(0, searchIndex / searchTotal)) / planTotal;
  const percent = Math.max(4, Math.min(100, Math.round((planBase + searchShare) * 100)));
  progressBar.classList.remove("is-indeterminate");
  progressBar.style.width = percent + "%";
}
</script>`;
}
