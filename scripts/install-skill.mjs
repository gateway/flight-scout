import { cp, mkdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const root = process.cwd();
const skillName = "flight-plan-riffer";
const source = path.join(root, "skills", skillName);
const codexHome = process.env.CODEX_HOME || path.join(os.homedir(), ".codex");
const target = path.join(codexHome, "skills", skillName);

await mkdir(path.dirname(target), { recursive: true });
await rm(target, { recursive: true, force: true });
await cp(source, target, { recursive: true });

console.log(`Installed ${skillName} skill to ${target}`);
console.log("Restart Codex or start a new Codex session if the skill does not appear immediately.");
