/**
 * GET /api/v1/admin/dashboard?gran=day|month|year&key=2026-07-06|2026-07|2026
 * Período CALENDÁRIO (fuso de Brasília): dia exato, mês fechado ou ano fechado.
 * Tudo que a visão geral precisa num payload só (poll near-real-time).
 */
import type { NextRequest } from "next/server";
import { gateAdmin } from "@/lib/admin/api";
import { jsonOk, serverError } from "@/lib/api/responses";
import { getAdminData, getLiveCloning, type DateRange } from "@/lib/admin/queries";
import { getRunpodHealth } from "@/lib/admin/runpod";

export const dynamic = "force-dynamic";

const TZ = "-03:00"; // Brasília

/** Monta [since, until) a partir da granularidade + chave. Null = inválido. */
function rangeFor(gran: string, key: string): DateRange | null {
  if (gran === "day" && /^\d{4}-\d{2}-\d{2}$/.test(key)) {
    const since = new Date(`${key}T00:00:00${TZ}`);
    const until = new Date(since.getTime() + 24 * 3600 * 1000);
    return { since: since.toISOString(), until: until.toISOString() };
  }
  if (gran === "month" && /^\d{4}-\d{2}$/.test(key)) {
    const [y, m] = key.split("-").map(Number);
    const since = new Date(`${key}-01T00:00:00${TZ}`);
    const nextKey = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
    const until = new Date(`${nextKey}-01T00:00:00${TZ}`);
    return { since: since.toISOString(), until: until.toISOString() };
  }
  if (gran === "year" && /^\d{4}$/.test(key)) {
    const y = Number(key);
    return {
      since: new Date(`${y}-01-01T00:00:00${TZ}`).toISOString(),
      until: new Date(`${y + 1}-01-01T00:00:00${TZ}`).toISOString(),
    };
  }
  return null;
}

/** Mês corrente em Brasília (default do filtro). */
function currentMonthKey(): string {
  const now = new Date(Date.now() - 3 * 3600 * 1000); // UTC→BRT
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function GET(request: NextRequest) {
  const g = await gateAdmin(request);
  if ("res" in g) return g.res;

  const params = new URL(request.url).searchParams;
  const gran = params.get("gran") ?? "month";
  const key = params.get("key") ?? currentMonthKey();
  const range = rangeFor(gran, key) ?? rangeFor("month", currentMonthKey())!;

  try {
    const [data, live, runpod] = await Promise.all([
      getAdminData(range),
      getLiveCloning(),
      getRunpodHealth(),
    ]);
    return jsonOk({ ...data, live, runpod });
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "Failed to load dashboard");
  }
}
