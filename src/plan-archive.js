import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export async function setPlanArchiveStatus({ root = process.cwd(), planPath, restore = false }) {
  const absolute = path.resolve(root, planPath);
  const plan = JSON.parse(await readFile(absolute, "utf8"));
  if (restore) {
    delete plan.status;
    delete plan.archived;
    delete plan.hidden;
  } else {
    plan.status = "archived";
    delete plan.archived;
    delete plan.hidden;
  }
  await writeFile(absolute, `${JSON.stringify(plan, null, 2)}\n`);
  return { plan, absolute };
}
