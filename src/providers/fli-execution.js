import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { PROVIDERS } from "./provider-types.js";

const ADAPTER_PATH = fileURLToPath(new URL("./fli/fli_search_adapter.py", import.meta.url));
const DEFAULT_LOCALE = Object.freeze({
  currency: "USD",
  language: "en-US",
  country: "US"
});

export class FliProviderError extends Error {
  constructor(message, { code = "fli-provider-error", detail = null } = {}) {
    super(message);
    this.name = "FliProviderError";
    this.code = code;
    this.detail = detail;
  }
}

// Converts a provider search into the unchanged Python-adapter protocol.
export async function executeFliSearch(searchRequest, context = {}) {
  const payload = adapterPayload(searchRequest, context);
  const python = context.pythonPath ?? process.env.FLI_PYTHON ?? "python3";
  try {
    const { stdout } = await runAdapterProcess({
      python,
      payload,
      adapterArgs: context.adapterArgs,
      timeoutMs: context.timeoutMs ?? 90_000,
      maxBuffer: context.maxBuffer ?? 1024 * 1024 * 8
    });
    const parsed = JSON.parse(stdout);
    if (!parsed.ok) {
      throw new FliProviderError(parsed.message ?? "fli provider search failed.", {
        code: parsed.code ?? "fli-search-failed",
        detail: parsed
      });
    }
    return { providerId: PROVIDERS.FLI, raw: parsed };
  } catch (error) {
    throw translateExecutionError(error, python);
  }
}

function adapterPayload(searchRequest, context) {
  return {
    id: searchRequest.id,
    input: searchRequest.input,
    maxResults: context.maxResults ?? 30,
    directOnly: context.directOnly ?? searchRequest.directOnly ?? false,
    currency: context.currency ?? searchRequest.currency ?? DEFAULT_LOCALE.currency,
    language: context.language ?? searchRequest.language ?? DEFAULT_LOCALE.language,
    country: context.country ?? searchRequest.country ?? DEFAULT_LOCALE.country
  };
}

function translateExecutionError(error, python) {
  if (error instanceof FliProviderError) return error;
  if (error.code === "ENOENT") {
    return new FliProviderError(`Could not run ${python}. Install Python 3.11+ or set FLI_PYTHON.`, {
      code: "fli-python-missing"
    });
  }
  const stderr = String(error.stderr ?? "").trim();
  return new FliProviderError(stderr || error.message, {
    code: "fli-adapter-failed",
    detail: { stderr, adapter: path.relative(process.cwd(), ADAPTER_PATH) }
  });
}

function runAdapterProcess({ python, payload, adapterArgs = null, timeoutMs, maxBuffer }) {
  return new Promise((resolve, reject) => {
    const child = spawn(python, adapterArgs ?? [ADAPTER_PATH], { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      const error = new Error(`fli adapter timed out after ${timeoutMs}ms.`);
      error.code = "ETIMEDOUT";
      error.stderr = stderr;
      reject(error);
    }, timeoutMs);

    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      if (stdout.length > maxBuffer) {
        child.kill("SIGTERM");
        const error = new Error("fli adapter output exceeded max buffer.");
        error.code = "ERR_CHILD_PROCESS_STDIO_MAXBUFFER";
        error.stderr = stderr;
        reject(error);
      }
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        const error = new Error(`fli adapter exited with code ${code}.`);
        error.code = code;
        error.stderr = stderr;
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });

    child.stdin.end(JSON.stringify(payload));
  });
}
