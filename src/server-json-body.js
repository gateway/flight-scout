const DEFAULT_MAX_BODY_BYTES = 50_000;

export class RequestBodyError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name = "RequestBodyError";
    this.statusCode = statusCode;
  }
}

// Read a bounded JSON body without retaining bytes after the limit is crossed.
export function readJsonBody(request, { maxBytes = DEFAULT_MAX_BODY_BYTES } = {}) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let byteLength = 0;
    let settled = false;

    const cleanup = () => {
      request.off("data", onData);
      request.off("end", onEnd);
      request.off("error", onError);
    };
    const fail = (error, { drain = false } = {}) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (drain) request.resume();
      reject(error);
    };
    const onData = (chunk) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      byteLength += buffer.byteLength;
      if (byteLength > maxBytes) {
        fail(new RequestBodyError(413, "Request body too large."), { drain: true });
        return;
      }
      chunks.push(buffer);
    };
    const onEnd = () => {
      if (settled) return;
      settled = true;
      cleanup();
      try {
        const text = Buffer.concat(chunks, byteLength).toString("utf8");
        resolve(JSON.parse(text || "{}"));
      } catch {
        reject(new RequestBodyError(400, "Invalid JSON body."));
      }
    };
    const onError = (error) => fail(error);

    request.on("data", onData);
    request.on("end", onEnd);
    request.on("error", onError);
  });
}
