export type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";

export type LogScope =
  | "server"
  | "client"
  | "middleware"
  | "api"
  | "instrument"
  | "render"
  | "audit";

export interface LogEntry {
  ts: string;
  level: LogLevel;
  scope: LogScope;
  msg: string;
  meta?: Record<string, unknown>;
}

export interface ClientLogPayload {
  level: LogLevel;
  scope: LogScope;
  msg: string;
  meta?: Record<string, unknown>;
}
