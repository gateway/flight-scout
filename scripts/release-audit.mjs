import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const ignoredDirs = new Set([".git", ".venv", "cache", "node_modules", "outputs", "plans", "trips", "work"]);
const scannedExtensions = new Set([".js", ".json", ".md", ".py", ".txt", ".yaml", ".yml"]);

const requiredGitignoreEntries = [".env", ".venv/", "cache/", "outputs/", "plans/", "trips/", "work/"];
const blockedTerms = ["apify", "legacy report", "provider-compare", "npm run report", "npm run search", "spending money", "paid scan"];
const publicReadmeBlockedTerms = ["/Users/", ...blockedTerms];
const publicUserDocs = ["README.md", "docs/GETTING_STARTED.md", "docs/CODEX_SKILL_USAGE.md", "docs/EXAMPLE_PROMPTS.md"];

const findings = [];

function addFinding(file, message) {
  findings.push(`${file}: ${message}`);
}

async function walk(dir, files = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") && entry.name !== ".env.example" && entry.name !== ".gitignore") {
      if (ignoredDirs.has(entry.name)) continue;
    }
    if (entry.isDirectory()) {
      if (ignoredDirs.has(entry.name)) continue;
      await walk(path.join(dir, entry.name), files);
      continue;
    }
    const file = path.join(dir, entry.name);
    if (scannedExtensions.has(path.extname(file)) || entry.name === ".env.example" || entry.name === ".gitignore") {
      files.push(file);
    }
  }
  return files;
}

function isAllowedSensitiveExample(relative, text) {
  return relative === "docs/SECURITY_AND_PRIVACY.md"
    || relative === "scripts/release-audit.mjs";
}

const gitignore = await readFile(path.join(root, ".gitignore"), "utf8");
for (const entry of requiredGitignoreEntries) {
  if (!gitignore.includes(entry)) addFinding(".gitignore", `missing required ignore entry ${entry}`);
}

for (const file of await walk(root)) {
  const relative = path.relative(root, file);
  const text = await readFile(file, "utf8");

  if (!isAllowedSensitiveExample(relative, text) && (text.includes("/Users/evilone") || text.includes("/Users/"))) {
    addFinding(relative, "contains a local user path");
  }
  if (!isAllowedSensitiveExample(relative, text) && /\b(sk-[A-Za-z0-9_-]{20,}|AIza[0-9A-Za-z_-]{20,})\b/.test(text)) {
    addFinding(relative, "looks like it contains a real API-style token");
  }
  if (relative.endsWith(".json") && /"booking_token"\s*:\s*"Wy[A-Za-z0-9+/=_-]+"/.test(text)) {
    addFinding(relative, "contains an unsanitized booking token fixture");
  }
}

for (const relative of publicUserDocs) {
  const text = await readFile(path.join(root, relative), "utf8");
  for (const term of publicReadmeBlockedTerms) {
    if (text.toLowerCase().includes(term.toLowerCase())) addFinding(relative, `public docs contain "${term}"`);
  }
}

if (findings.length) {
  console.error("Release audit failed:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log("Release audit passed.");
