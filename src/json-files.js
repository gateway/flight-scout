import { readFile } from "node:fs/promises";

// Preserve the source path because native JSON parse errors do not identify the damaged file.
export async function readJsonFile(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    const failure = new Error(`Could not read JSON file "${filePath}": ${error.message}`, { cause: error });
    failure.code = "json-read-failed";
    failure.filePath = filePath;
    throw failure;
  }
}

export function jsonReadWarning(error, { code, ...context }) {
  return {
    code,
    ...context,
    filePath: error.filePath ?? null,
    message: error.message
  };
}
