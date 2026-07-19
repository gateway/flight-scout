import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { loadSavedPlans } from "./plan-list-data.js";
import { renderArchivedPlanList, renderPlanList } from "./plan-list-pages.js";

// Owns plan-list output paths and writes; rendering and data loading remain side-effect isolated.
export async function writePlanListDashboard({ root = process.cwd(), outputPath }) {
  const plans = await loadSavedPlans(root);
  const html = renderPlanList(plans, {
    archivedHref: "plans.archived.html",
    lowdownHref: "latest-refresh-lowdown.md",
    hasLowdown: existsSync(path.join(root, "outputs", "latest-refresh-lowdown.md"))
  });
  const archiveHtml = renderArchivedPlanList(plans, { activeHref: "plans.dashboard.html" });
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, html);
  await writeFile(path.join(path.dirname(outputPath), "index.html"), html);
  await writeFile(path.join(path.dirname(outputPath), "plans.archived.html"), archiveHtml);
  return outputPath;
}

export async function writeAppIndex({ root = process.cwd(), outputPath, dashboardPrefix = "outputs/" }) {
  const plans = await loadSavedPlans(root);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, renderPlanList(plans, {
    dashboardPrefix,
    archivedHref: `${dashboardPrefix}plans.archived.html`,
    lowdownHref: `${dashboardPrefix}latest-refresh-lowdown.md`,
    hasLowdown: existsSync(path.join(root, "outputs", "latest-refresh-lowdown.md"))
  }));
  await mkdir(path.join(path.dirname(outputPath), dashboardPrefix), { recursive: true });
  await writeFile(
    path.join(path.dirname(outputPath), dashboardPrefix, "plans.archived.html"),
    renderArchivedPlanList(plans, { activeHref: "/", dashboardPrefix: "" })
  );
  return outputPath;
}
