import { lstat, readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const scannedExtensions = new Set([".js", ".json", ".md", ".py", ".txt", ".yaml", ".yml"]);

const requiredGitignoreEntries = [
  ".env",
  ".venv/",
  ".playwright-cli/",
  "cache/",
  "outputs/",
  "plans/",
  "trips/",
  "work/",
  "docs/DASHBOARD_COHERENCE_SPEC.md",
  "docs/engineering/"
];
const blockedTerms = ["apify", "legacy report", "provider-compare", "npm run report", "npm run search", "spending money", "paid scan"];
const publicReadmeBlockedTerms = ["/Users/", ...blockedTerms];
const publicUserDocs = ["README.md", "docs/GETTING_STARTED.md", "docs/CODEX_SKILL_USAGE.md", "docs/EXAMPLE_PROMPTS.md"];
const protectedTrackedRoots = [
  ".venv/",
  ".playwright-cli/",
  "cache/",
  "docs/engineering/",
  "node_modules/",
  "outputs/",
  "plans/",
  "trips/",
  "work/"
];
const protectedTrackedFiles = new Set(["index.html"]);
const protectedTrackedSuffixes = [".dashboard.html", ".dates.html", ".routes.html", ".refresh.html"];

const findings = [];

function addFinding(file, message) {
  findings.push(`${file}: ${message}`);
}

function gitFiles(args, description) {
  try {
    return execFileSync("git", ["ls-files", "-z", ...args], { cwd: root, encoding: "utf8" })
      .split("\0")
      .filter(Boolean);
  } catch (error) {
    addFinding(".git", `unable to inspect ${description} (${error.message})`);
    return [];
  }
}

function trackedFiles() {
  return gitFiles([], "tracked files");
}

function publishableFiles() {
  return gitFiles(["--cached", "--others", "--exclude-standard"], "publishable files")
    .filter((relative) => scannedExtensions.has(path.extname(relative))
      || relative === ".env.example"
      || relative === ".gitignore");
}

function isProtectedTrackedFile(relative) {
  const environmentFile = relative === ".env"
    || (relative.startsWith(".env.") && relative !== ".env.example");
  return environmentFile || protectedTrackedFiles.has(relative);
}

function isAllowedSensitiveExample(relative, text) {
  return relative === "docs/SECURITY_AND_PRIVACY.md"
    || relative === "scripts/release-audit.mjs";
}

async function auditServerSafety() {
  const serverFile = "src/local-server.js";
  const serverSource = await readFile(path.join(root, serverFile), "utf8");
  if (!/process\.env\.HOST\s*\?\?\s*["']127\.0\.0\.1["']/.test(serverSource)) {
    addFinding(serverFile, "normal startup must default to the loopback host 127.0.0.1");
  }
  if (!/allowStateChangingRequest\s*\(\s*request\s*,\s*response\s*\)/.test(serverSource)) {
    addFinding(serverFile, "state-changing request guard must remain on the server request path");
  }
  if (!/servePublicStatic\s*\(\s*\{/.test(serverSource)) {
    addFinding(serverFile, "constrained static handler must remain on the server request path");
  }

  const staticFile = "src/server-static.js";
  const staticSource = await readFile(path.join(root, staticFile), "utf8");
  const extensionBlock = staticSource.match(/OUTPUT_EXTENSIONS\s*=\s*new Set\s*\(\s*\[([\s\S]*?)\]\s*\)/)?.[1];
  if (!extensionBlock) {
    addFinding(staticFile, "browser output extension allowlist must remain explicit");
  } else if (/["']\.json["']/.test(extensionBlock)) {
    addFinding(staticFile, "JSON must not be browser-served from generated outputs");
  }
  if (!/\brealpath\s*\(/.test(staticSource)) {
    addFinding(staticFile, "realpath checks must remain for static-file symlink containment");
  }
  if (!/path\.relative\s*\(/.test(staticSource)) {
    addFinding(staticFile, "relative path containment must remain for public static files");
  }
}

const gitignore = await readFile(path.join(root, ".gitignore"), "utf8");
for (const entry of requiredGitignoreEntries) {
  if (!gitignore.includes(entry)) addFinding(".gitignore", `missing required ignore entry ${entry}`);
}

for (const relative of trackedFiles()) {
  if (isProtectedTrackedFile(relative) || protectedTrackedRoots.some((prefix) => relative.startsWith(prefix))) {
    addFinding(relative, "tracked protected path must be removed from the Git index");
  }
  if (protectedTrackedSuffixes.some((suffix) => relative.endsWith(suffix))) {
    addFinding(relative, "tracked generated dashboard must be removed from the Git index");
  }
}

for (const relative of publishableFiles()) {
  const file = path.join(root, relative);
  let fileStat;
  try {
    fileStat = await lstat(file);
  } catch (error) {
    if (error.code === "ENOENT") continue;
    addFinding(relative, `unable to inspect publishable file (${error.message})`);
    continue;
  }
  if (fileStat.isSymbolicLink()) {
    addFinding(relative, "publishable symbolic links are not allowed");
    continue;
  }
  if (!fileStat.isFile()) {
    addFinding(relative, "publishable path is not a regular file");
    continue;
  }
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
  let text;
  try {
    text = await readFile(path.join(root, relative), "utf8");
  } catch (error) {
    if (error.code === "ENOENT") continue;
    addFinding(relative, `unable to inspect public documentation (${error.message})`);
    continue;
  }
  for (const term of publicReadmeBlockedTerms) {
    if (text.toLowerCase().includes(term.toLowerCase())) addFinding(relative, `public docs contain "${term}"`);
  }
}

await auditServerSafety();

if (findings.length) {
  console.error("Release audit failed:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log("Release audit passed.");
