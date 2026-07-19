const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// Generated pages use relative API URLs, so a normalized Origin/Host match
// protects every mutating route without coupling clients to a session token.
export function allowStateChangingRequest(request, response) {
  if (!STATE_CHANGING_METHODS.has(request.method ?? "")) return true;
  const origin = requestOrigin(request);
  const expected = expectedOrigin(request);
  if (origin !== null && expected !== null && origin === expected) return true;

  response.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
  response.end("Forbidden");
  return false;
}

function requestOrigin(request) {
  return normalizeOrigin(request.headers.origin);
}

function expectedOrigin(request) {
  const host = request.headers.host;
  if (typeof host !== "string" || !host) return null;
  const protocol = request.socket.encrypted ? "https:" : "http:";
  return normalizeOrigin(`${protocol}//${host}`);
}

function normalizeOrigin(value) {
  if (typeof value !== "string" || !value) return null;
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) return null;
    return url.origin;
  } catch {
    return null;
  }
}
