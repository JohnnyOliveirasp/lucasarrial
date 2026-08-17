/**
 * POST /api/v1/react/ajustar — R3 do Video React.
 *
 * Dois modos:
 *  · `reescrever` — a LLM devolve o roteiro INTEIRO com o pedido do criador
 *    dentro. Colar o pedido no meio quebra o ritmo do reaction, então a
 *    reescrita é do texto todo (regra combinada com o Johnny em 14/08).
 *  · `cta` — escreve a chamada final. O CTA é o FIM e tem CENA PRÓPRIA, por
 *    isso NÃO entra na conta de tempo do viral.
 */
import type { NextRequest } from "next/server";
import { gateAdmin } from "@/lib/admin/api";
import { badRequest, jsonError, jsonOk, serverError } from "@/lib/api/responses";
import {
  contarPalavras,
  escreverCta,
  REACT_AJUSTE_COST,
  reescreverReact,
  segundosEstimados,
} from "@/lib/react/roteiro";
import { debitCredits, getBalance } from "@/lib/credits/service";
import { bypassesBilling } from "@/lib/credits/access";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const gate = await gateAdmin(request);
  if ("res" in gate) return gate.res;

  let body: { modo?: unknown; roteiro?: unknown; pedido?: unknown; duracao_seg?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return badRequest("Corpo inválido");
  }

  const roteiro = typeof body.roteiro === "string" ? body.roteiro.trim() : "";
  const pedido = typeof body.pedido === "string" ? body.pedido.trim() : "";
  if (!roteiro) return badRequest("Faltou o roteiro.");
  if (!pedido) return badRequest("Escreva o que você quer mudar.");

  // Cada ajuste é uma chamada de LLM — barata, mas não de graça. Mesma régua
  // do chat do Gerador de Roteiro (10 cr). Padrão da plataforma (17/08):
  // equipe não paga, saldo checado ANTES, débito só DEPOIS do sucesso —
  // LLM falhou = ninguém pagou (antes debitava antes e não estornava).
  const billed = !bypassesBilling(gate.auth.email);
  if (billed) {
    const bal = await getBalance(gate.auth.user_id);
    if (bal.total < REACT_AJUSTE_COST) {
      return jsonError(
        "insufficient_credits",
        `Este ajuste custa ${REACT_AJUSTE_COST} créditos e seu saldo não cobre.`,
        402,
      );
    }
  }

  try {
    let resposta: Response;
    if (body.modo === "cta") {
      const { cta } = await escreverCta({ roteiro, oferta: pedido });
      resposta = jsonOk({ cta, palavras: contarPalavras(cta), segundos: segundosEstimados(cta) });
    } else {
      const duracao = Number(body.duracao_seg) || 30;
      const { roteiro: novo } = await reescreverReact({ roteiro, pedido, duracaoSeg: duracao });
      resposta = jsonOk({
        roteiro: novo,
        palavras: contarPalavras(novo),
        segundos_estimados: segundosEstimados(novo),
      });
    }

    if (billed) {
      await debitCredits({
        userId: gate.auth.user_id,
        amount: REACT_AJUSTE_COST,
        kind: "generation",
        refType: "react_ajuste",
        note: body.modo === "cta" ? "React: escrever CTA" : "React: ajustar roteiro",
      });
    }
    return resposta;
  } catch (e) {
    console.error("[react/ajustar]", e instanceof Error ? e.message : e);
    return serverError("Não consegui ajustar agora. Tente de novo.");
  }
}
