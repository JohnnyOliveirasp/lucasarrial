/**
 * `node --test src/lib/video-clone/config.test.ts`
 *
 * O TETO DE EXECUÇÃO DO VÍDEO CLONE (#404). O que estes testes protegem, em
 * ordem de importância:
 *
 *   1. A PARCELA FIXA FICA ACIMA DO QUE PRODUÇÃO JÁ MOSTROU. O #404 matou 9
 *      alunos porque o custo fixo real (cold start + fila) encostou nos 1200s
 *      que o teto reservava. O teste ancora na MEDIÇÃO (1199,4s no melhor job
 *      que entregou), não no número escolhido — quem baixar o overhead sem
 *      remedir produção derruba o teste.
 *   2. OS 9 MORTOS DO #404 CABEM AGORA. Caso a caso, com o áudio real de cada
 *      um. Regressão literal: se alguém reverter o overhead, estes 9 voltam a
 *      morrer e o teste nomeia quem.
 *   3. O JOB QUE RASPOU O TETO GANHOU MARGEM DE VERDADE. O `77,65s → 3539,432s`
 *      entregou com 0,568s de sobra. Não basta ele passar: tem que passar com
 *      folga que não seja sorte.
 *   4. A PARCELA DE COMPUTE NÃO FOI MEXIDA JUNTO. O #404 é defeito da parcela
 *      fixa; mexer nas duas de uma vez faz a próxima medição não saber a qual
 *      atribuir o resultado.
 *
 * ⚠️ O QUE ESTE ARQUIVO **NÃO** PROVA, dito de propósito: que 40min BASTA. A
 * distribuição dos sucessos está censurada em 1200s — job que precisava de mais
 * nunca virou `ready` pra entrar na conta. Estes testes provam que o teto saiu
 * de dentro da distribuição observada; a cauda verdadeira só aparece com uma
 * semana de `elapsed_seconds` gravado no `ready` (dcc6653). Não leia verde aqui
 * como "o #404 acabou".
 *
 * Import com extensão `.ts` explícita e sem alias `@/`: o runner do
 * `node --test` não resolve o alias (lição do PR #159).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CLONE_FIXED_OVERHEAD_SECONDS,
  CLONE_FIXED_OVERHEAD_MEDIDO_EM_SUCESSO,
  CLONE_MAX_AUDIO_SECONDS,
  CLONE_TIERS,
  cloneExecutionTimeoutMs,
  getCloneTier,
} from "./config.ts";

const v3 = getCloneTier("480p-v3")!;
const v2 = getCloneTier("480p-v2")!;

/** Custo fixo que o teto reserva pra um áudio — o que sobra depois do compute. */
function fixoReservado(tier: typeof v3, audioSeconds: number): number {
  const billed = Math.max(5, Math.ceil(audioSeconds));
  const perAudioSecond = tier.flow === "v1" ? 60 : 30;
  return cloneExecutionTimeoutMs(tier, audioSeconds) / 1000 - billed * perAudioSecond;
}

// ─── 1. A régua externa: produção ────────────────────────────────────────────

test("(1a) o overhead fixo cobre COM MARGEM o maior custo fixo já visto num job que entregou", () => {
  // 1199,4s foi medido num job `ready` (77,65s de áudio, 3539,432s de elapsed).
  // Margem de 2× é o critério do desenho original (07/08: 20min de teto contra
  // ~10min de cold start medido). Restaurar a margem É o conserto do #404.
  assert.ok(
    CLONE_FIXED_OVERHEAD_SECONDS >= 2 * CLONE_FIXED_OVERHEAD_MEDIDO_EM_SUCESSO,
    `overhead fixo (${CLONE_FIXED_OVERHEAD_SECONDS}s) precisa ser >= 2x o medido ` +
      `em sucesso (${CLONE_FIXED_OVERHEAD_MEDIDO_EM_SUCESSO}s = ${2 * CLONE_FIXED_OVERHEAD_MEDIDO_EM_SUCESSO}s). ` +
      `Foi encostar nessa medição que matou 9 alunos no #404.`,
  );
});

test("(1b) a medição de produção não foi 'ajustada' pra caber no número escolhido", () => {
  // Trava contra a saída preguiçosa: baixar a constante medida até o teste
  // passar. O valor veio do banco em 15/09 e só muda com nova medição.
  assert.equal(CLONE_FIXED_OVERHEAD_MEDIDO_EM_SUCESSO, 1199.4);
});

// ─── 2. Os 9 mortos do #404, um por um ───────────────────────────────────────

/** Os 9 `executionTimeout exceeded` de 14–15/09, com o áudio real de cada um. */
const MORTOS_DO_404: ReadonlyArray<{ aluno: string; audio: number; tetoAntigo: number }> = [
  { aluno: "welrisson (16:06Z 14/09)", audio: 53.01, tetoAntigo: 2820 },
  { aluno: "welrisson (16:55Z 14/09)", audio: 53.01, tetoAntigo: 2820 },
  { aluno: "leonice", audio: 63.26, tetoAntigo: 3120 },
  { aluno: "danicale", audio: 28.44, tetoAntigo: 2070 },
  { aluno: "claytonpc10", audio: 74.3, tetoAntigo: 3450 },
  { aluno: "alcinalivre", audio: 46.54, tetoAntigo: 2610 },
  { aluno: "daniel", audio: 86.82, tetoAntigo: 3810 },
  { aluno: "wendellaraujo", audio: 57.36, tetoAntigo: 2940 },
  { aluno: "nettosl", audio: 14.85, tetoAntigo: 1650 },
];

for (const m of MORTOS_DO_404) {
  test(`(2) ${m.aluno}: o teto que o matou (${m.tetoAntigo}s) virou folga`, () => {
    const agora = cloneExecutionTimeoutMs(v3, m.audio) / 1000;
    assert.ok(
      agora >= m.tetoAntigo + 1200,
      `${m.aluno} morreu em ${m.tetoAntigo}s; teto agora é ${agora}s — ganhou só ${agora - m.tetoAntigo}s`,
    );
  });
}

test("(2b) o morto de 480p-v2 também ganhou folga — o #404 NÃO é só do v3", () => {
  // O título do cartão diz "TODAS 480p-v3". O `gabriel.reis` (19,57s, 19:29Z
  // 15/09) morreu no mesmo teto rodando 480p-v2. Conserto escopado em "v3"
  // passaria ao lado dele.
  const antigo = 1800;
  const agora = cloneExecutionTimeoutMs(v2, 19.57) / 1000;
  assert.ok(agora >= antigo + 1200, `v2 ganhou só ${agora - antigo}s`);
});

// ─── 3. O job que raspou o teto ──────────────────────────────────────────────

test("(3) o job que entregou com 0,568s de sobra agora tem margem que não é sorte", () => {
  // 77,65s de áudio, 3539,432s de elapsed, teto de 3540s. Passou raspando.
  const elapsedReal = 3539.432;
  const agora = cloneExecutionTimeoutMs(v3, 77.65) / 1000;
  const sobra = agora - elapsedReal;
  assert.ok(sobra >= 1200, `sobra de apenas ${sobra.toFixed(1)}s — era 0,568s antes do conserto`);
});

// ─── 4. A parcela de compute continua intocada ───────────────────────────────

test("(4a) compute segue em 30 s/s no v2/v3 — medido 30,1 em produção", () => {
  // Diferença entre dois áudios isola a parcela por segundo: o fixo cancela.
  for (const tier of [v2, v3]) {
    const d = cloneExecutionTimeoutMs(tier, 40) / 1000 - cloneExecutionTimeoutMs(tier, 30) / 1000;
    assert.equal(d, 10 * 30, `${tier.id} mudou a parcela de compute junto com a fixa`);
  }
});

test("(4b) o overhead fixo é o MESMO pra qualquer áudio — cold start não escala", () => {
  // Se alguém tentar "consertar" o #404 dando mais fixo só pro áudio curto, a
  // parcela vira função do áudio e esta invariante cai.
  const fixos = [5, 14.85, 30, 60, CLONE_MAX_AUDIO_SECONDS].map((s) => fixoReservado(v3, s));
  assert.deepEqual(new Set(fixos), new Set([CLONE_FIXED_OVERHEAD_SECONDS]));
});

test("(4c) todo tier vivo produz teto finito, positivo e crescente no áudio", () => {
  for (const tier of CLONE_TIERS) {
    let anterior = 0;
    for (const s of [5, 10, 30, 60, CLONE_MAX_AUDIO_SECONDS]) {
      const ms = cloneExecutionTimeoutMs(tier, s);
      assert.ok(Number.isFinite(ms) && ms > 0, `${tier.id} @${s}s deu ${ms}`);
      assert.ok(ms > anterior, `${tier.id} não cresce entre ${s}s e o anterior`);
      anterior = ms;
    }
  }
});
