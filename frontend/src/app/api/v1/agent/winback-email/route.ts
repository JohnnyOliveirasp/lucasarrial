/**
 * POST /api/v1/agent/winback-email — Resgate da Fast pelo E-MAIL.
 *
 * Ordem do Johnny (10/08): o WhatsApp levou uma tranca de 24h, então a Fast
 * pergunta o motivo por e-mail para TODOS que cancelaram, um texto escrito
 * para cada pessoa. As respostas caem no suporte@ e o mail-sweep já reconhece
 * quem é do resgate (winbackContextByEmail), então a conversa continua com o
 * roteiro certo e com o crédito de cortesia disponível.
 *
 * ?limite=N (padrão 200 — "matar tudo hoje"). Manual: não tem cron.
 * Cada envio espera 15s do anterior; um lote grande leva um tempo, por isso o
 * maxDuration alto.
 */
import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/lib/api/responses";
import { agentTokenOk } from "@/lib/incidents/agent-auth";
import { enviarResgatePorEmail } from "@/lib/winback/email";

export const maxDuration = 800;

export async function POST(request: NextRequest) {
  if (!agentTokenOk(request)) return jsonError("unauthorized", "Token inválido.", 401);
  const limite = Number(request.nextUrl.searchParams.get("limite") ?? 200);
  const r = await enviarResgatePorEmail(Math.max(1, Math.min(limite, 300)));
  console.log("[winback/email] lote:", JSON.stringify({ enviados: r.enviados, falhas: r.falhas }));
  return jsonOk({ winbackEmail: { enviados: r.enviados, falhas: r.falhas, detalhe: r.detalhe } });
}
