// Browser-side logger — POSTs to /api/log so the server can append to file.
// Uses sendBeacon during unload events, fetch otherwise. Never throws.

import type { ClientLogPayload, LogLevel, LogScope } from "./types";

const ENDPOINT = "/api/log";

function send(payload: ClientLogPayload, beacon = false) {
  if (typeof window === "undefined") return;
  try {
    const body = JSON.stringify(payload);
    if (beacon && "sendBeacon" in navigator) {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon(ENDPOINT, blob);
      return;
    }
    void fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
      cache: "no-store",
    }).catch(() => {
      /* swallow */
    });
  } catch {
    /* swallow */
  }
}

function entry(level: LogLevel, scope: LogScope, msg: string, meta?: Record<string, unknown>) {
  send({ level, scope, msg, meta });
}

export const clientLogger = {
  debug: (msg: string, meta?: Record<string, unknown>) => entry("debug", "client", msg, meta),
  info: (msg: string, meta?: Record<string, unknown>) => entry("info", "client", msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => entry("warn", "client", msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => entry("error", "client", msg, meta),
  fatal: (msg: string, meta?: Record<string, unknown>) => entry("fatal", "client", msg, meta),
  beacon: (payload: ClientLogPayload) => send(payload, true),
};
