import { createRefreshJobStore } from "./refresh-job-store.js";

const PROGRESS_EVENTS = new Set(["cache-hit", "run-start", "provider-error", "sleep"]);

// Async refresh jobs translate provider progress into the stable browser-polling response shape.
export function createServerRefreshJobs({ actions, store = createRefreshJobStore() }) {
  function start(body) {
    const job = createJob(body.all ? "all active plans" : body.planPath);
    run(job.id, body).catch((error) => {
      update(job.id, { status: "failed", title: "Refresh failed", message: error.message, error: error.message });
    });
    return job;
  }

  async function run(jobId, body) {
    update(jobId, { status: "running", title: body.all ? "Refreshing all active plans" : "Refreshing this plan" });
    const refreshed = await actions.refreshSelection({
      all: Boolean(body.all),
      planPath: body.planPath,
      body,
      onPlanStart: (progress) => update(jobId, {
        planIndex: progress.planIndex,
        planTotal: progress.planTotal,
        searchIndex: 0,
        searchTotal: 0,
        message: `Plan ${progress.planIndex} of ${progress.planTotal}: preparing refresh.`
      }),
      onEvent: (event, progress) => updateProgress(jobId, event, progress)
    });
    const summary = body.all ? await actions.writeLatestLowdown(refreshed) : null;
    await actions.regeneratePlanList();
    update(jobId, {
      status: "complete",
      title: "Refresh complete",
      message: `Updated ${refreshed.length} plan${refreshed.length === 1 ? "" : "s"}.`,
      refreshed,
      lowdownHref: summary ? "outputs/latest-refresh-lowdown.md" : null
    });
  }

  function createJob(label) {
    return store.create({
      label,
      status: "running",
      title: "Starting refresh",
      message: "Preparing selected local searches.",
      planIndex: 0,
      planTotal: 0,
      searchIndex: 0,
      searchTotal: 0,
      currentSearch: ""
    });
  }

  function updateProgress(jobId, event, progress) {
    if (!PROGRESS_EVENTS.has(event.type)) return;
    const searchIndex = Number.isInteger(event.index) ? event.index + 1 : 0;
    const searchTotal = Number.isInteger(event.total) ? event.total : 0;
    const currentSearch = event.call?.id ?? "";
    const verb = progressVerb(event.type);
    update(jobId, {
      planIndex: progress.planIndex,
      planTotal: progress.planTotal,
      searchIndex,
      searchTotal,
      currentSearch,
      message: `Plan ${progress.planIndex} of ${progress.planTotal}, search ${searchIndex} of ${searchTotal}: ${verb} ${currentSearch}.`
    });
  }

  function update(jobId, patch) {
    return store.update(jobId, patch);
  }

  return { get: store.get, start };
}

function progressVerb(type) {
  if (type === "cache-hit") return "using saved data for";
  if (type === "sleep") return "waiting before next search after";
  if (type === "provider-error") return "search issue on";
  return "checking";
}
