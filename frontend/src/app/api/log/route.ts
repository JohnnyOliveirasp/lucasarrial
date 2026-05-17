import { NextResponse } from "next/server";
import { logger } from "@/lib/logger/server";
import type { ClientLogPayload, LogLevel, LogScope } from "@/lib/logger/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_LEVELS: LogLevel[] = ["debug", "info", "warn", "error", "fatal"];
const VALID_SCOPES: LogScope[] = [
  "server",
  "client",
  "middleware",
  "api",
  "instrument",
  "render",
  "audit",
];

function isValid(payload: unknown): payload is ClientLogPayload {
  if (!payload || typeof payload !== "object") return false;
  const p = payload as Record<string, unknown>;
  if (typeof p.msg !== "string") return false;
  if (typeof p.level !== "string" || !VALID_LEVELS.includes(p.level as LogLevel))
    return false;
  if (typeof p.scope !== "string" || !VALID_SCOPES.includes(p.scope as LogScope))
    return false;
  if (p.meta && typeof p.meta !== "object") return false;
  return true;
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  if (!isValid(body)) {
    return NextResponse.json({ ok: false, error: "invalid payload" }, { status: 400 });
  }

  const ua = req.headers.get("user-agent") ?? undefined;
  const referer = req.headers.get("referer") ?? undefined;

  logger.raw({
    ts: new Date().toISOString(),
    level: body.level,
    scope: body.scope,
    msg: body.msg,
    meta: {
      ...(body.meta ?? {}),
      ua,
      referer,
    },
  });

  return new NextResponse(null, { status: 204 });
}
