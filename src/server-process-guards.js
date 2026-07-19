const guardedProcesses = new WeakSet();

// The local dashboard favors availability: unexpected asynchronous failures are
// logged once at the process boundary instead of silently terminating the server.
export function installProcessErrorGuards({ processRef = process, logger = console.error } = {}) {
  if (guardedProcesses.has(processRef)) return false;
  guardedProcesses.add(processRef);
  processRef.on("unhandledRejection", (reason) => {
    logger(`[flight-scout] Unhandled rejection: ${errorMessage(reason)}`);
  });
  processRef.on("uncaughtException", (error) => {
    logger(`[flight-scout] Uncaught exception: ${errorMessage(error)}`);
  });
  return true;
}

function errorMessage(value) {
  if (value instanceof Error) return value.stack ?? value.message;
  return String(value);
}
