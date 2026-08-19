import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
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

/**
 * Best-effort: resolve o usuário logado pela cookie de sessão Supabase que
 * já acompanha o POST same-origin do clientLogger. Só o ID vai pro log —
 * nunca e-mail, nome nem IP (log não é depósito de dado pessoal; Frank 19/08).
 * Deslogado, cookie inválida ou Supabase fora do ar → undefined e o log
 * segue sem dono. Nunca lança: logging não pode falhar por causa de auth.
 */
async function resolveUserId(): Promise<string | undefined> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id ?? undefined;
  } catch {
    return undefined;
  }
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

  // QUEM só em error/fatal: é onde o dono do erro importa pro suporte.
  // getUser() custa uma ida ao Supabase Auth por chamada — não vale pagar
  // isso em cada pageview/beacon de debug.
  const userId =
    body.level === "error" || body.level === "fatal"
      ? await resolveUserId()
      : undefined;

  logger.raw({
    ts: new Date().toISOString(),
    level: body.level,
    scope: body.scope,
    msg: body.msg,
    meta: {
      ...(body.meta ?? {}),
      ua,
      referer,
      ...(userId ? { userId } : {}),
    },
  });

  return new NextResponse(null, { status: 204 });
}
