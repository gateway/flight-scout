import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_CONFIG = {
  requestDelayMs: 5000,
  staleAfterHours: 24,
  modes: {
    light: { maxCalls: 8 },
    standard: { maxCalls: 28 },
    "targeted-deep": { maxCalls: 42 },
    deep: { maxCalls: 60 }
  }
};

// Refresh-budget loading owns configuration fallback and preserves the established shallow override contract.
export async function loadRefreshBudget(root = process.cwd()) {
  const configPath = path.join(root, "config", "refresh-budget.json");
  if (!existsSync(configPath)) return DEFAULT_CONFIG;
  return { ...DEFAULT_CONFIG, ...JSON.parse(await readFile(configPath, "utf8")) };
}
