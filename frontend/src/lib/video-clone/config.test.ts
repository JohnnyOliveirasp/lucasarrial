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
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CLONE_AVISO_DERIVA_ROSTO,
  CLONE_DERIVA_ROSTO_SECONDS,
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

// ─── 5. O AVISO DE DERIVA DE ROSTO ESTÁ EM TODO TIER (#329) ──────────────────
//
// O defeito de 19/09: a frase "acima de ~40s o rosto pode se afastar da foto"
// existia SÓ no blurb do "Padrão 2.0" (105 cr/s). O "Turbo" (80 cr/s) — que o
// blurb dele mesmo chama de "no mesmo motor" — não avisava nada. Como o vídeo
// longo é o caro, o preço empurrava justamente quem mais precisava do aviso pro
// tier que calava. Um aluno pagante queimou 41.600 créditos em vídeos >40s,
// todos no Turbo.
//
// ⚠️ ESTES TESTES CHECAM O TEXTO LITERAL, não `blurb.includes(CONSTANTE)`.
// A constante é appendada por código em `CLONE_TIERS`, então comparar o blurb
// com ela seria TAUTOLOGIA: passaria por construção, inclusive se alguém
// voltasse a escrever os blurbs à mão sem o aviso. Ancorar no conteúdo
// ("se afastar da foto" + o número) é o que faz o teste MORRER se o bug voltar.

/** O que qualquer aviso de deriva tem que dizer, venha de onde vier. */
const MARCAS_DO_AVISO = ["se afastar da foto", String(CLONE_DERIVA_ROSTO_SECONDS)];

for (const tier of CLONE_TIERS) {
  test(`(5a) o blurb do tier "${tier.label}" (${tier.id}) avisa da deriva de rosto`, () => {
    for (const marca of MARCAS_DO_AVISO) {
      assert.ok(
        tier.blurb.includes(marca),
        `o blurb de ${tier.id} ("${tier.label}") não contém "${marca}".\n` +
          `Blurb atual: ${tier.blurb}\n` +
          `Foi exatamente isto que custou 41.600 cr no #329: tier sem aviso.`,
      );
    }
  });
}

test("(5b) o TURBO especificamente avisa — foi ele que faltava no #329", () => {
  // Nomeado à parte de propósito: o laço acima passa a existir/sumir junto com
  // CLONE_TIERS. Se alguém remover o Turbo da lista, este teste cai e nomeia.
  const turbo = getCloneTier("480p-v2");
  assert.ok(turbo, "o tier 480p-v2 (Turbo) sumiu de CLONE_TIERS");
  assert.ok(
    turbo.blurb.includes("se afastar da foto"),
    `regressão do #329: o Turbo voltou a não avisar. Blurb: ${turbo.blurb}`,
  );
});

test("(5c) o aviso é do MOTOR — não pode nomear um tier só", () => {
  // Trava contra o conserto errado: copiar pro Turbo uma frase que diz
  // "no Padrão 2.0 o rosto se afasta". O aviso tem que valer pros dois.
  for (const nomeDeTier of ["Padrão 2.0", "Turbo"]) {
    assert.ok(
      !CLONE_AVISO_DERIVA_ROSTO.includes(nomeDeTier),
      `o aviso comum cita "${nomeDeTier}" — ele é compartilhado, não pode ser de um tier.`,
    );
  }
  assert.ok(
    /nos dois modos|do motor/i.test(CLONE_AVISO_DERIVA_ROSTO),
    "o aviso não diz que a limitação é do motor/vale nos dois modos",
  );
});

test("(5d) o limiar do aviso fica ABAIXO do teto aceito — senão nunca dispara", () => {
  // A plataforma aceita 90s e documenta ~40s. Se alguém "alinhar" os dois
  // subindo o limiar até o teto, o aviso deixa de aparecer pra todo mundo.
  assert.ok(
    CLONE_DERIVA_ROSTO_SECONDS < CLONE_MAX_AUDIO_SECONDS,
    `limiar (${CLONE_DERIVA_ROSTO_SECONDS}s) não pode alcançar o teto (${CLONE_MAX_AUDIO_SECONDS}s)`,
  );
  assert.equal(CLONE_DERIVA_ROSTO_SECONDS, 40, "o limiar documentado ao aluno é ~40s");
});

// ─── 6. O AVISO CHEGA NOS TRÊS IDIOMAS ───────────────────────────────────────
//
// Achado de 19/09 junto com o #329: `tierNote` — a nota que a tela mostra
// abaixo dos dois cartões, independente do tier — JÁ avisava da deriva em
// pt-BR e es, mas o en.json NÃO tinha a frase. Aluno em inglês não era avisado
// em lugar nenhum: nem no blurb (que só o v3 tinha) nem na nota.
// `chaves.test.ts` só prova que a CHAVE existe nos três; não olha o conteúdo.

const DIR_MENSAGENS = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "messages");

/** "pt-BR" → o objeto videoClone.studio daquele idioma. */
function studioDoIdioma(locale: string): Record<string, string> {
  const dic = JSON.parse(readFileSync(join(DIR_MENSAGENS, `${locale}.json`), "utf8"));
  return dic.videoClone.studio as Record<string, string>;
}

/** Como a deriva aparece escrita em cada idioma. */
const DERIVA_POR_IDIOMA: Record<string, RegExp> = {
  "pt-BR": /se afastar da foto/i,
  en: /drift away from the photo/i,
  es: /alejarse de la foto/i,
};

for (const [locale, marca] of Object.entries(DERIVA_POR_IDIOMA)) {
  test(`(6a) ${locale}: a nota dos modos (tierNote) avisa da deriva`, () => {
    const studio = studioDoIdioma(locale);
    assert.ok(
      marca.test(studio.tierNote),
      `${locale}.json videoClone.studio.tierNote não avisa da deriva.\n` +
        `Era este o buraco do en.json em 19/09: pt-BR e es avisavam, o en não.`,
    );
  });

  test(`(6b) ${locale}: o aviso da hora de gerar (longAudioDrift) existe e cita o áudio`, () => {
    const studio = studioDoIdioma(locale);
    assert.ok(studio.longAudioDrift, `${locale}.json não tem videoClone.studio.longAudioDrift`);
    assert.ok(
      marca.test(studio.longAudioDrift),
      `${locale}: longAudioDrift não fala da deriva — texto: ${studio.longAudioDrift}`,
    );
    // Os dois parâmetros que o componente passa. Faltando um, o next-intl
    // renderiza o literal "{seconds}" na cara do aluno.
    for (const param of ["{seconds}", "{limit}"]) {
      assert.ok(
        studio.longAudioDrift.includes(param),
        `${locale}: longAudioDrift não usa ${param} — texto: ${studio.longAudioDrift}`,
      );
    }
  });
}
