/**
 * Vídeo Clone — regras PURAS do cancelamento e da leitura da espera.
 *
 * Mora fora do módulo server-only de propósito: sem `@/`, sem fetch, sem banco,
 * pra rodar no `node --test` (mesmo motivo de `support/rajada-nasce-fechada.ts`).
 *
 * ── DE ONDE SAEM OS NÚMEROS DAQUI ────────────────────────────────────────
 * Medição de 13/09 sobre os 762 clones `ready` dos últimos 14 dias, comparando
 * `created_at` (banco) com o `LastModified` do MP4 no R2 — que é o único
 * carimbo real de "ficou disponível pro aluno":
 *
 *   mediana 13,8 min · p90 34,2 min · p99 77,0 min · máximo 97,0 min
 *   acima de 1h: 12 de 762 (1,6%) — e as 12 ENTREGARAM.
 *
 * Ferramenta: _Bugs/2026-09-13_medir_entrega_video_clone.cjs
 */

/** Status em que o job ainda está em voo — os únicos canceláveis. */
export const STATUS_EM_VOO = ["pending", "generating"] as const;

export function podeCancelar(status: string): boolean {
  return (STATUS_EM_VOO as readonly string[]).includes(status);
}

/**
 * Por que ESTE status não dá pra cancelar. Só é chamado quando
 * `podeCancelar` deu false, e a distinção importa: "já terminou" é notícia
 * BOA (o vídeo está lá), e tratar isso como erro genérico faria o aluno achar
 * que perdeu o trabalho.
 */
export function motivoNaoCancelavel(status: string): string {
  if (status === "ready") return "Esse vídeo já ficou pronto — ele está no seu histórico.";
  if (status === "canceled") return "Essa geração já foi cancelada.";
  if (status === "failed") return "Essa geração já tinha terminado em falha, e os créditos já voltaram.";
  return "Essa geração não pode mais ser cancelada.";
}

/**
 * A espera está DENTRO do normal medido, ou é anormal de verdade?
 *
 * Serve pra tela parar de mentir. O texto antigo prometia "até 15 minutos"
 * (messages/*.json, videoClone.studio.generatingHint) enquanto o p90 real é
 * 34 min — ou seja, 1 em cada 10 alunos passava do prometido e concluía, com
 * razão, que estava travado. Foi exatamente o caso do incidente de 13/09: o
 * aluno reclamou aos ~61 min e o vídeo dele saiu 89 segundos depois.
 */
export type LeituraDaEspera = "normal" | "fila_cheia" | "acima_do_medido";

export function lerEspera(minutos: number): LeituraDaEspera {
  if (minutos < 35) return "normal";
  if (minutos < 100) return "fila_cheia";
  return "acima_do_medido";
}

/** Minutos inteiros desde a criação. Negativo vira 0 (relógio torto). */
export function minutosDesde(criadoEmISO: string, agoraMs: number): number {
  const t = new Date(criadoEmISO).getTime();
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.floor((agoraMs - t) / 60000));
}
