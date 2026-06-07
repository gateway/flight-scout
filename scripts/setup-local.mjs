import { access, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const venvDir = path.join(root, ".venv");
const venvPython = process.platform === "win32"
  ? path.join(venvDir, "Scripts", "python.exe")
  : path.join(venvDir, "bin", "python");
const requirements = path.join(root, "src", "providers", "fli", "requirements.txt");
const envPath = path.join(root, ".env");

async function exists(file) {
  try {
    await access(file, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function run(command, args, { allowFailure = false } = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit"
  });
  if (result.status !== 0 && !allowFailure) {
    throw new Error(`Command failed: ${command} ${args.join(" ")}`);
  }
  return result.status === 0;
}

function findPython() {
  const candidates = [
    process.env.PYTHON,
    "python3.11",
    "python3",
    "python"
  ].filter(Boolean);

  for (const candidate of candidates) {
    const check = spawnSync(candidate, ["-c", "import sys; raise SystemExit(0 if sys.version_info >= (3, 11) else 1)"], {
      cwd: root,
      stdio: "ignore"
    });
    if (check.status === 0) return candidate;
  }
  throw new Error("Python 3.11 or newer was not found. Install Python 3.11+ and run npm run setup again.");
}

async function writeEnv() {
  const value = `FLI_PYTHON=${venvPython}`;
  if (!await exists(envPath)) {
    await writeFile(envPath, [
      "# Local settings for Flight Research Agent.",
      "# This file is ignored by git.",
      value,
      ""
    ].join("\n"));
    return;
  }

  const current = await readFile(envPath, "utf8");
  const lines = current.split(/\r?\n/);
  const next = lines.some((line) => line.startsWith("FLI_PYTHON="))
    ? lines.map((line) => line.startsWith("FLI_PYTHON=") ? value : line)
    : [...lines.filter((line, index) => line || index < lines.length - 1), value, ""];
  await writeFile(envPath, next.join("\n"));
}

const python = findPython();
if (!await exists(venvPython)) {
  console.log(`Creating local Python environment with ${python}...`);
  run(python, ["-m", "venv", ".venv"]);
}

console.log("Installing direct Python dependency: flights==0.9.0...");
run(venvPython, ["-m", "pip", "install", "-r", requirements]);

await writeEnv();

console.log("");
console.log("Local setup complete.");
console.log("Next steps:");
console.log("  npm run serve");
console.log("  open http://127.0.0.1:8765/");
