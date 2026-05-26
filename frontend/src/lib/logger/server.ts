// Server-only logger — appends JSON lines to /logs/FrontendServer.log.
// Never throws: on disk failure, falls back to console.error.

import { existsSync, mkdirSync, appendFileSync } from "fs";
import { resolve } from "path";
import type { LogEntry, LogLevel, LogScope } from "./types";

const LOG_DIR =
  process.env.LOG_DIR ??
  resolve(process.cwd(), "..", "logs");
const LOG_FILE_NAME = process.env.LOG_FILE_NAME ?? "FrontendServer.log";
const LOG_PATH = resolve(LOG_DIR, LOG_FILE_NAME);

let initialized = false;

function ensureLogDir() {
  if (initialized) return;
  try {
    if (!existsSync(LOG_DIR)) {
      mkdirSync(LOG_DIR, { recursive: true });
    }
    initialized = true;
  } catch (err) {
    console.error("[logger] failed to create log dir:", err);
  }
}

function buildEntry(
  level: LogLevel,
  scope: LogScope,
  msg: string,
  meta?: Record<string, unknown>,
): LogEntry {
  return {
    ts: new Date().toISOString(),
    level,
    scope,
    msg,
    ...(meta && Object.keys(meta).length > 0 ? { meta } : {}),
  };
}

function writeEntry(entry: LogEntry) {
  ensureLogDir();
  try {
    appendFileSync(LOG_PATH, JSON.stringify(entry) + "\n", "utf8");
  } catch (err) {
    console.error("[logger] write failed:", err, "entry:", entry);
  }
  if (process.env.NODE_ENV !== "production" || entry.level === "error" || entry.level === "fatal") {
    const tag = `[${entry.level.toUpperCase()}][${entry.scope}]`;
    const out = entry.meta ? `${tag} ${entry.msg} ${JSON.stringify(entry.meta)}` : `${tag} ${entry.msg}`;
    if (entry.level === "error" || entry.level === "fatal") {
      console.error(out);
    } else if (entry.level === "warn") {
      console.warn(out);
    } else {
      console.log(out);
    }
  }
}

export const logger = {
  debug(scope: LogScope, msg: string, meta?: Record<string, unknown>) {
    writeEntry(buildEntry("debug", scope, msg, meta));
  },
  info(scope: LogScope, msg: string, meta?: Record<string, unknown>) {
    writeEntry(buildEntry("info", scope, msg, meta));
  },
  warn(scope: LogScope, msg: string, meta?: Record<string, unknown>) {
    writeEntry(buildEntry("warn", scope, msg, meta));
  },
  error(scope: LogScope, msg: string, meta?: Record<string, unknown>) {
    writeEntry(buildEntry("error", scope, msg, meta));
  },
  fatal(scope: LogScope, msg: string, meta?: Record<string, unknown>) {
    writeEntry(buildEntry("fatal", scope, msg, meta));
  },
  raw(entry: LogEntry) {
    writeEntry(entry);
  },
  path: LOG_PATH,
};
