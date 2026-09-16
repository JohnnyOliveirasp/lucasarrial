/**
 * SGP — de onde sai a PROVA de que o aluno foi avisado (recado 6, 15/09).
 *
 * A régua ("isto conta como aviso?") mora em painel.ts › `lerAviso`, que é puro
 * e testado. Aqui é só banco: QUAL carimbo existe e como buscá-lo. Mesma divisão
 * de cobranca.ts, e pelo mesmo motivo — painel.ts também roda no browser.
 *
 * ── AS DUAS FONTES, EM ORDEM DE PRECEDÊNCIA ─────────────────────────────────
 *
 *  1. `sgp_pedidos.avisado_em` (migration 116, NÃO APLICADA).
 *     O carimbo de GENTE: alguém do time avisou o aluno e registrou. Ganha do
 *     automático porque é mais específico (é sobre ESTE pedido, não sobre o
 *     usuário) e porque quem clicou sabe coisas que o banco não sabe — por
 *     exemplo que avisou por WhatsApp, que é o canal que o time realmente usa.
 *     Enquanto a 116 não entrar, esta fonte simplesmente não existe e a de
 *     baixo responde sozinha; a tela continua de pé (ver `criarFilaComFallback`).
 *
 *  2. `profiles.onboarding_ready_email_at` — o carimbo do SISTEMA.
 *     Escrito como claim atômico por `lib/onboarding/pronto.ts` ANTES de mandar
 *     o e-mail "Sua plataforma está pronta", e devolvido a nulo se o envio
 *     estourar. É o mesmo evento que vira `status = 'pronto'` no SGP (os dois
 *     leem `statusOnboarding`), então é o carimbo certo pra esta pergunta.
 *
 * ⚠️ POR QUE NÃO `avisos_enviados` NEM `emails_enviados`, que seriam as tabelas
 * "óbvias": as duas só começam em 2026-09-14T14:06 (medido, é o instante em que
 * a migration que as criou foi aplicada). Zero nelas para qualquer coisa
 * anterior é zero CEGO, e foi exatamente contra isso que o recado 6 avisou em
 * caixa alta. `onboarding_ready_email_at` vai de 29/08 a hoje e cobre 81 dos 82
 * pedidos prontos — por isso ele, e não elas.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AvisoEntrega } from "./painel.ts";
import type { SgpPedidoRow } from "./types.ts";

/**
 * ⚠️ `COLUNAS_AVISO` NÃO mora aqui: mora em `cobranca.ts`, junto das listas das
 * migrations 106/109/110, porque é de lá que sai o `COLUNAS_OPCIONAIS` que
 * reconhece "essa coluna ainda não existe". Uma lista destas fora daquele
 * conjunto é uma coluna que o fallback não sabe derrubar.
 */

/**
 * Junta as duas fontes num aviso só, com a precedência documentada acima.
 *
 * PURA de propósito — dá pra testar a precedência inteira sem banco. Ela NÃO
 * valida nada (data legível, aviso de outro ciclo): quem valida é `lerAviso`,
 * que é a régua. Aqui é só "qual das duas fontes responde".
 */
export function avisoDoPedido(
  p: SgpPedidoRow,
  carimboDoPerfil: string | null | undefined,
): AvisoEntrega | null {
  if (p.avisado_em) {
    return {
      em: p.avisado_em,
      canal: p.avisado_canal?.trim() || "registrado pelo time",
      por: p.avisado_por?.trim() || "alguém do time",
      // Clique de gente: é o único carimbo que a tela pode oferecer pra desfazer.
      fonte: "time",
    };
  }
  if (carimboDoPerfil) {
    return {
      em: carimboDoPerfil,
      canal: "e-mail",
      // "o sistema" e não um nome de pessoa: este e-mail sai sozinho, e atribuí-lo
      // a alguém do time seria dar crédito por um trabalho que ninguém fez.
      por: "o sistema",
      // Não há o que desfazer: quem escreveu isto foi `lib/onboarding/pronto.ts`,
      // e apagar `avisado_*` (que está vazio) não mudaria esta linha.
      fonte: "sistema",
    };
  }
  return null;
}

/** Quantos ids por consulta. `in.()` vira querystring, e URL tem teto. */
const LOTE = 200;

/**
 * Os avisos de uma leva de pedidos, por id de pedido.
 *
 * Uma consulta a cada 200 pedidos prontos — hoje isso é UMA consulta (82
 * prontos, medido em 15/09). Só busca perfil de quem está em `pronto`: para o
 * resto a pergunta "foi avisado da entrega?" não faz sentido, e puxar 267
 * perfis pra responder 82 seria trabalho jogado fora num endpoint que roda em
 * polling de 30s.
 *
 * NUNCA LANÇA: se a consulta falhar, devolve o que conseguiu montar. Perder o
 * carimbo degrada a linha para GERADO — que é o estado honesto de "não sei" —,
 * enquanto estourar derrubaria a tela inteira do time de suporte por causa de
 * uma coluna acessória.
 */
export async function buscarAvisos(
  admin: SupabaseClient<never>,
  pedidos: SgpPedidoRow[],
): Promise<Map<string, AvisoEntrega>> {
  const mapa = new Map<string, AvisoEntrega>();

  // 1) O carimbo de gente (116) não precisa de consulta: já veio na linha.
  const faltam: SgpPedidoRow[] = [];
  for (const p of pedidos) {
    const doTime = avisoDoPedido(p, null);
    if (doTime) mapa.set(p.id, doTime);
    else if (p.status === "pronto" && p.user_id) faltam.push(p);
  }
  if (!faltam.length) return mapa;

  // 2) O carimbo do sistema, pra quem sobrou.
  const ids = [...new Set(faltam.map((p) => p.user_id as string))];
  const carimbo = new Map<string, string>();
  try {
    for (let i = 0; i < ids.length; i += LOTE) {
      const { data, error } = await admin
        .from("profiles")
        .select("id, onboarding_ready_email_at")
        .in("id", ids.slice(i, i + LOTE));
      if (error) throw error;
      for (const linha of (data ?? []) as Array<{
        id: string;
        onboarding_ready_email_at: string | null;
      }>) {
        if (linha.onboarding_ready_email_at) carimbo.set(linha.id, linha.onboarding_ready_email_at);
      }
    }
  } catch (e) {
    // Degradar é aceitável; mentir não. Sem carimbo a linha vira GERADO e a tela
    // pede pra avisar o aluno — no pior caso o time avisa alguém duas vezes, que
    // é infinitamente melhor que dizer "entregue" pra quem não foi avisado.
    console.error("[sgp/aviso] não consegui ler os carimbos:", e instanceof Error ? e.message : e);
    return mapa;
  }

  for (const p of faltam) {
    const a = avisoDoPedido(p, carimbo.get(p.user_id as string));
    if (a) mapa.set(p.id, a);
  }
  return mapa;
}
