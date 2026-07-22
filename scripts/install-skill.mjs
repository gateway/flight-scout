import { access, cp, mkdir, rm } from "node:fs/promises";
import { constants } from "node:fs";
import os from "node:os";
import path from "node:path";

// Installs the flight-plan-riffer skill for local assistants. The SKILL.md
// format (frontmatter name/description plus markdown instructions) is shared
// by Codex and Claude Code, so one source folder serves both targets.

const root = process.cwd();
const skillName = "flight-plan-riffer";
const source = path.join(root, "skills", skillName);
const args = new Set(process.argv.slice(2));
const forceCodex = args.has("--codex");
const forceClaude = args.has("--claude");

const codexHome = process.env.CODEX_HOME || path.join(os.homedir(), ".codex");
const claudeHome = process.env.CLAUDE_HOME || path.join(os.homedir(), ".claude");

const targets = [
  { label: "Codex", flag: "--codex", home: codexHome, forced: forceCodex },
  { label: "Claude Code", flag: "--claude", home: claudeHome, forced: forceClaude }
].filter((target) => (forceCodex || forceClaude ? target.forced : true));

async function exists(file) {
  try {
    await access(file, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

let installed = 0;
for (const target of targets) {
  if (!target.forced && !await exists(target.home)) {
    console.log(`Skipped ${target.label}: ${target.home} does not exist. Use ${target.flag} to install anyway.`);
    continue;
  }
  const destination = path.join(target.home, "skills", skillName);
  await mkdir(path.dirname(destination), { recursive: true });
  await rm(destination, { recursive: true, force: true });
  await cp(source, destination, { recursive: true });
  console.log(`Installed ${skillName} skill for ${target.label}: ${destination}`);
  installed += 1;
}

if (installed === 0) {
  console.log("No assistant skill folder was found. Install Codex or Claude Code first, or force a target with --codex or --claude.");
  process.exitCode = 1;
} else {
  console.log("Start a new assistant session if the skill does not appear immediately.");
}
