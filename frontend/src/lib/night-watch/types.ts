/**
 * Vigia noturno — CONTRATO dos detectores (a "espinha").
 *
 * Por que existe: em 18/08 acharam 43 vozes paradas em silêncio (a mais antiga
 * há 15 dias). Todo travamento até hoje foi descoberto porque um ALUNO
 * reclamou, nunca porque o sistema avisou. O vigia varre a plataforma inteira
 * de madrugada e pergunta "tem alguém esperando algo que nunca vai chegar?".
 *
 * Este arquivo NÃO implementa detector nenhum — só o contrato onde eles
 * encaixam (cards 2, 6 e seguintes registram detectores em registry.ts).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";

/** Um item preso que um detector achou. */
export type NightWatchFinding = {
  /** Classe do problema, ex.: "fila_parada", "cron_morto". */
  kind: string;
  /** Tabela de origem (é por ela que o teto conta). */
  table: string;
  /** Id da linha presa (ou identificador estável do problema). */
  id: string;
  /** Aluno afetado, quando houver. */
  userId: string | null;
  /** Há quantas horas está preso — a ordenação é SEMPRE do mais antigo pro mais novo. */
  ageHours: number;
  /** Resumo humano, pronto pro relatório ("voz 'Fábio' parada em uploading há 360h"). */
  summary: string;
  /** true = existe receita conhecida de correção (a Onda 2 traz a resolvedora). */
  hasRecipe: boolean;
};

/**
 * O que UMA rodada de UM detector devolve. `checked` existe pra distinguir
 * "olhei 200 linhas e nada está preso" de "não consegui olhar nada" — a
 * consulta com erro que devolve vazio quase deu um dia por limpo em 18/08.
 */
export type DetectorRunResult = {
  /** Linhas efetivamente examinadas. 0 aqui NUNCA é sinônimo de saúde. */
  checked: number;
  findings: NightWatchFinding[];
};

export type DetectorContext = {
  db: SupabaseClient<Database>;
  now: Date;
  /** true = a rodada não vai escrever nada; detector também não pode. */
  dryRun: boolean;
};

export type NightWatchDetector = {
  /** Nome curto e único, ex.: "filas-paradas". */
  name: string;
  /** Tabela principal que ele varre (usada no teto por tabela). */
  table: string;
  /**
   * TTL PRÓPRIO em horas: cada detector sabe o que é "tempo demais" pro seu
   * domínio (registro parado 5min é normal; 1h é incidente). Não existe
   * número global de propósito.
   */
  ttlHours: number;
  /**
   * true = a tabela certamente tem linhas em produção; se o detector checar 0,
   * isso é ANOMALIA (consulta quebrada/cegueira) e vai no relatório como tal.
   */
  expectRows?: boolean;
  run: (ctx: DetectorContext) => Promise<DetectorRunResult>;
};

/** Resumo por detector que a rodada grava em night_watch_runs.detectors. */
export type DetectorSummary = {
  name: string;
  table: string;
  checked: number;
  found: number;
  /** Findings cortados pelo teto por tabela (aparece no relatório — sem teto silencioso). */
  truncated: number;
  /** Já estavam em night_watch_seen (não consomem o teto). */
  alreadySeen: number;
  fixed: number;
  /** Exceção do detector — isolada: NUNCA derruba a rodada. */
  error: string | null;
  /** Ex.: "checou 0 linhas numa tabela que certamente tem linhas". */
  anomaly: string | null;
};

export type NightWatchRunResult = {
  ok: boolean;
  /** "skipped_mutex" = já tinha rodada em andamento; esta saiu limpa. */
  status: "done" | "failed" | "skipped_mutex";
  dryRun: boolean;
  startedAt: string;
  finishedAt: string;
  detectors: DetectorSummary[];
  /** Findings novos (fora do seen), já ordenados do mais antigo pro mais novo e dentro do teto. */
  findings: NightWatchFinding[];
  /** Relatório humano no formato do 06_RELATORIO_E_LIMITES.md — sai SEMPRE. */
  report: string;
  /** O que a rodada teria escrito (dry) ou escreveu (live) — transparência total. */
  writes: string[];
};

/**
 * Anti-cegueira: o Supabase devolve `data: null` quando a consulta ERRA, e um
 * chamador ingênuo imprime "0 travados" alegremente. TODO detector deve passar
 * o resultado por aqui antes de acreditar nele — erro vira exceção (que a
 * espinha isola e reporta como falha DAQUELE detector, não como saúde).
 */
export function assertQueryOk<T>(
  q: { data: T[] | null; error: { message: string } | null },
  table: string,
): T[] {
  if (q.error) throw new Error(`consulta em ${table} falhou: ${q.error.message}`);
  return q.data ?? [];
}
