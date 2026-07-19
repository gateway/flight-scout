import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);
const AUDIT_PATH = fileURLToPath(new URL("../scripts/release-audit.mjs", import.meta.url));

test("release audit rejects a protected generated file force-added to Git", async () => {
  const root = await createReleaseFixture();
  try {
    const privatePath = "plans/private-trip/plan.json";
    await writeFixture(root, privatePath, '{"private":true}\n');
    await execFileAsync("git", ["add", "-f", privatePath], { cwd: root });

    await assert.rejects(
      () => runAudit(root),
      (error) => {
        assert.equal(error.code, 1);
        assert.match(error.stderr, /tracked protected path/i);
        assert.match(error.stderr, /plans\/private-trip\/plan\.json/);
        return true;
      }
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("release audit rejects any force-added environment file", async () => {
  const root = await createReleaseFixture();
  try {
    await writeFixture(root, ".env.local", "LOCAL_SETTING=fixture\n");
    await execFileAsync("git", ["add", "-f", ".env.local"], { cwd: root });

    await assert.rejects(
      () => runAudit(root),
      (error) => {
        assert.equal(error.code, 1);
        assert.match(error.stderr, /\.env\.local.*tracked protected path/i);
        return true;
      }
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("release audit rejects generated dashboard HTML outside the output directory", async () => {
  const root = await createReleaseFixture();
  try {
    const generatedPath = "example.dashboard.html";
    await writeFixture(root, generatedPath, "<!doctype html><title>Generated dashboard</title>\n");
    await execFileAsync("git", ["add", "-f", generatedPath], { cwd: root });

    await assertAuditFailure(root, /tracked generated dashboard/i);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("release audit does not inspect ignored private content", async () => {
  const root = await createReleaseFixture();
  try {
    await writeFixture(root, ".gitignore", `${await readFixture(root, ".gitignore")}\nprivate-notes/\n`);
    await writeFixture(root, "private-notes/trip.txt", `/${"Users"}/private/travel details\n`);

    const result = await runAudit(root);

    assert.match(result.stdout, /release audit passed/i);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("release audit ignores a tracked public file deleted from the worktree", async () => {
  const root = await createReleaseFixture();
  try {
    await rm(path.join(root, "docs/EXAMPLE_PROMPTS.md"));

    const result = await runAudit(root);

    assert.match(result.stdout, /release audit passed/i);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("release audit requires browser artifacts and internal engineering notes to stay ignored", async () => {
  const root = await createReleaseFixture();
  try {
    const unsafeIgnore = (await readFixture(root, ".gitignore"))
      .replace(".playwright-cli/\n", "")
      .replace("docs/DASHBOARD_COHERENCE_SPEC.md\n", "")
      .replace("docs/engineering/\n", "");
    await writeFixture(root, ".gitignore", unsafeIgnore);
    await writeFixture(root, ".playwright-cli/page.yml", "browser: artifact\n");
    await writeFixture(root, "docs/engineering/WORK_STATE.md", "# Internal state\n");

    await assertAuditFailure(root, /missing required ignore entry/i);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("release audit rejects a public default server binding", async () => {
  const root = await createReleaseFixture();
  try {
    await writeFixture(
      root,
      "src/local-server.js",
      (await readFixture(root, "src/local-server.js")).replace("127.0.0.1", "0.0.0.0")
    );

    await assertAuditFailure(root, /src\/local-server\.js.*loopback/i);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("release audit rejects removal of the state-changing request guard", async () => {
  const root = await createReleaseFixture();
  try {
    await writeFixture(
      root,
      "src/local-server.js",
      (await readFixture(root, "src/local-server.js")).replace("allowStateChangingRequest(request, response);\n", "")
    );

    await assertAuditFailure(root, /src\/local-server\.js.*state-changing request guard/i);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("release audit rejects removal of the constrained static handler", async () => {
  const root = await createReleaseFixture();
  try {
    const unsafeSource = (await readFixture(root, "src/local-server.js"))
      .replace("servePublicStatic({ root, requestUrl, response });", "");
    assert.doesNotMatch(unsafeSource, /servePublicStatic\s*\(/);
    await writeFixture(
      root,
      "src/local-server.js",
      unsafeSource
    );

    await assertAuditFailure(root, /src\/local-server\.js.*constrained static handler/i);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("release audit rejects JSON in the browser output extension allowlist", async () => {
  const root = await createReleaseFixture();
  try {
    await writeFixture(
      root,
      "src/server-static.js",
      (await readFixture(root, "src/server-static.js")).replace('".js"]', '".js", ".json"]')
    );

    await assertAuditFailure(root, /src\/server-static\.js.*JSON.*browser-served/i);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("release audit rejects removal of static-file realpath checks", async () => {
  const root = await createReleaseFixture();
  try {
    await writeFixture(
      root,
      "src/server-static.js",
      (await readFixture(root, "src/server-static.js")).replace("realpath(candidate);", "")
    );

    await assertAuditFailure(root, /src\/server-static\.js.*realpath/i);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("release audit rejects removal of relative path containment", async () => {
  const root = await createReleaseFixture();
  try {
    await writeFixture(
      root,
      "src/server-static.js",
      (await readFixture(root, "src/server-static.js")).replace("path.relative(root, candidate);", "")
    );

    await assertAuditFailure(root, /src\/server-static\.js.*relative path containment/i);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("release audit rejects publishable symlinks without reading their ignored targets", async () => {
  const root = await createReleaseFixture();
  try {
    await writeFixture(root, ".gitignore", `${await readFixture(root, ".gitignore")}\nprivate-notes/\n`);
    await writeFixture(root, "private-notes/trip.txt", `/${"Users"}/private/travel details\n`);
    await symlink("../private-notes/trip.txt", path.join(root, "src/private-link.txt"));

    await assertAuditFailure(root, /src\/private-link\.txt.*publishable symbolic link/i, {
      absentPattern: /contains a local user path/i
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

async function createReleaseFixture() {
  const root = await mkdtemp(path.join(tmpdir(), "flight-release-audit-"));
  await execFileAsync("git", ["init", "-q"], { cwd: root });
  await writeFixture(root, ".gitignore", [
    ".env",
    ".env.*",
    "!.env.example",
    ".venv/",
    ".playwright-cli/",
    "cache/",
    "outputs/",
    "plans/",
    "trips/",
    "work/",
    "index.html",
    "docs/DASHBOARD_COHERENCE_SPEC.md",
    "docs/engineering/"
  ].join("\n"));
  await writeFixture(root, ".env.example", "FLI_PYTHON=.venv/bin/python\n");
  await writeFixture(root, "README.md", "# Safe fixture\n");
  for (const name of ["GETTING_STARTED.md", "CODEX_SKILL_USAGE.md", "EXAMPLE_PROMPTS.md"]) {
    await writeFixture(root, `docs/${name}`, `# ${name}\n`);
  }
  await writeFixture(root, "src/local-server.js", [
    'const HOST = process.env.HOST ?? "127.0.0.1";',
    "allowStateChangingRequest(request, response);",
    "servePublicStatic({ root, requestUrl, response });"
  ].join("\n"));
  await writeFixture(root, "src/server-static.js", [
    'const OUTPUT_EXTENSIONS = new Set([".html", ".css", ".js"]);',
    "realpath(candidate);",
    "path.relative(root, candidate);"
  ].join("\n"));
  await execFileAsync("git", ["add", "."], { cwd: root });
  return root;
}

async function writeFixture(root, relative, contents) {
  const target = path.join(root, relative);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, contents);
}

async function readFixture(root, relative) {
  return readFile(path.join(root, relative), "utf8");
}

async function runAudit(root) {
  return execFileAsync(process.execPath, [AUDIT_PATH], { cwd: root });
}

async function assertAuditFailure(root, messagePattern, { absentPattern } = {}) {
  await assert.rejects(
    () => runAudit(root),
    (error) => {
      assert.equal(error.code, 1);
      assert.match(error.stderr, messagePattern);
      if (absentPattern) assert.doesNotMatch(error.stderr, absentPattern);
      return true;
    }
  );
}
