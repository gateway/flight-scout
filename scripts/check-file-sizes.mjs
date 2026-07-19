import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const productionMaxLines = 300;
const testMaxLines = 450;

const ignoredDirectories = new Set(["node_modules", "outputs", ".git"]);

async function listJavaScriptFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (ignoredDirectories.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await listJavaScriptFiles(fullPath));
    else if (entry.isFile() && /\.(mjs|js)$/.test(entry.name)) files.push(fullPath);
  }
  return files;
}

function relative(file) {
  return path.relative(root, file).split(path.sep).join("/");
}

const files = await listJavaScriptFiles(root);
const violations = [];

for (const file of files) {
  const rel = relative(file);
  const text = await readFile(file, "utf8");
  const lines = lineCount(text);
  const max = rel.startsWith("test/") ? testMaxLines : productionMaxLines;
  if (lines > max) violations.push({ rel, lines, max });
}

if (violations.length) {
  console.error("File-size guard failed. Split large files into focused modules:");
  for (const item of violations) {
    console.error(`- ${item.rel}: ${item.lines} lines, max ${item.max}`);
  }
  process.exit(1);
}

console.log(`File-size guard passed for ${files.length} JavaScript files.`);

function lineCount(text) {
  if (!text) return 0;
  const lines = text.split(/\r?\n/).length;
  return lines - Number(text.endsWith("\n"));
}
