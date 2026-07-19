import { createReadStream } from "node:fs";
import { realpath, stat } from "node:fs/promises";
import path from "node:path";

// Static serving is intentionally narrower than the project filesystem. JSON
// outputs can contain parsed intent, so only browser-facing artifact types are public.
const OUTPUT_EXTENSIONS = new Set([
  ".html",
  ".css",
  ".js",
  ".md",
  ".png",
  ".jpg",
  ".jpeg",
  ".svg",
  ".webp",
  ".ico"
]);

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon"
};

export async function servePublicStatic({ root, requestUrl, response, openReadStream = createReadStream, logger = console.error }) {
  const pathname = requestPathname(requestUrl);
  const filePath = pathname ? await resolvePublicFile(root, pathname) : null;
  if (!filePath) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  const stream = openReadStream(filePath);
  stream.once("error", (error) => {
    logger(`[flight-scout] Failed to stream ${filePath}: ${error.message}`);
    if (!response.destroyed) response.destroy();
  });
  response.writeHead(200, { "content-type": CONTENT_TYPES[path.extname(filePath).toLowerCase()] });
  stream.pipe(response);
}

function requestPathname(requestUrl) {
  try {
    const encoded = new URL(requestUrl ?? "/", "http://localhost").pathname;
    const decoded = decodeURIComponent(encoded);
    return decoded.includes("\0") ? null : decoded;
  } catch {
    return null;
  }
}

async function resolvePublicFile(root, pathname) {
  const route = pathname === "/" ? "/index.html" : pathname;
  if (route === "/index.html") {
    return resolveExactIndex(root);
  }
  if (!route.startsWith("/outputs/")) return null;

  const extension = path.extname(route).toLowerCase();
  if (!OUTPUT_EXTENSIONS.has(extension)) return null;

  const outputRoot = path.resolve(root, "outputs");
  const candidate = path.resolve(root, `.${route}`);
  if (!isContainedBy(outputRoot, candidate)) return null;

  try {
    const [realOutputRoot, realCandidate] = await Promise.all([realpath(outputRoot), realpath(candidate)]);
    if (!isContainedBy(realOutputRoot, realCandidate)) return null;
    if (!OUTPUT_EXTENSIONS.has(path.extname(realCandidate).toLowerCase())) return null;
    return (await stat(realCandidate)).isFile() ? realCandidate : null;
  } catch {
    return null;
  }
}

async function resolveExactIndex(root) {
  try {
    const realRoot = await realpath(root);
    const expected = path.join(realRoot, "index.html");
    const candidate = await realpath(path.resolve(root, "index.html"));
    if (candidate !== expected) return null;
    return (await stat(candidate)).isFile() ? candidate : null;
  } catch {
    return null;
  }
}

function isContainedBy(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!path.isAbsolute(relative) && relative !== ".." && !relative.startsWith(`..${path.sep}`));
}
