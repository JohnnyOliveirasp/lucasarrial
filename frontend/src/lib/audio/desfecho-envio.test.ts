/**
 * O que estes testes protegem (caso Hellen Grasso #526, 23/09): o
 * `uploads-complete` NUNCA mais pode carimbar "áudio muito curto" num envio
 * que chegou pela metade. Ela mandou 7 arquivos, 5 se perderam em silêncio,
 * e a recusa culpou a duração da fala DELA — 16 dias sem resposta depois de
 * pagar ~R$ 960.
 *
 * Rodar (Node ≥ 22.18, type-stripping nativo):
 *   node --test src/lib/audio/desfecho-envio.test.ts
 *
 * Import com extensão `.ts` explícita e sem alias `@/`: o runner do
 * `node --test` não resolve o alias (lição do PR #159).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MIN_BYTES_AUDIO,
  decidirDesfechoEnvio,
  nomeLegivelDaChave,
} from "./desfecho-envio.ts";

const PREFIXO = "user-1/voz-1/raw";
const chave = (slot: number, nome: string) =>
  `${PREFIXO}/${String(slot).padStart(3, "0")}_${nome}`;

/** 7 slots como o browser emite — a Hellen escolheu 7 arquivos. */
const SETE_CHAVES = Array.from({ length: 7 }, (_, i) =>
  chave(i, `gravacao-${i + 1}.mp3`),
);

const objeto = (key: string, size = 500_000) => ({ key, size });

test("1. slots e recebidos batem, 25min medidos → segue normal (ok)", () => {
  const d = decidirDesfechoEnvio({
    chavesEsperadas: SETE_CHAVES,
    objetosNoR2: SETE_CHAVES.map((k) => objeto(k)),
    totalSegundos: 25 * 60,
    temMedicao: true,
  });
  assert.equal(d.tipo, "ok");

  // Tudo chegou mas o browser não mediu nada → validating (o worker re-mede),
  // nunca uma recusa inventada a partir de zero medição.
  const semMedicao = decidirDesfechoEnvio({
    chavesEsperadas: SETE_CHAVES,
    objetosNoR2: SETE_CHAVES.map((k) => objeto(k)),
    totalSegundos: 0,
    temMedicao: false,
  });
  assert.equal(semMedicao.tipo, "sem_medicao");
});

test("2. 7 slots, 2 chegaram (caso Hellen) → envio incompleto NOMEANDO os que faltaram, nunca too_short", () => {
  // Exatamente a impressão digital da voz 9bb9fccf: só os slots 001 e 006
  // existem no bucket, e os 2 somam 415s (6min55s) — bem abaixo dos 20min.
  const chegaram = [SETE_CHAVES[1], SETE_CHAVES[6]];
  const d = decidirDesfechoEnvio({
    chavesEsperadas: SETE_CHAVES,
    objetosNoR2: chegaram.map((k) => objeto(k)),
    totalSegundos: 415,
    temMedicao: true,
  });

  assert.equal(d.tipo, "envio_incompleto");
  assert(d.tipo === "envio_incompleto"); // narrowing pro TS
  assert.equal(d.esperados, 7);
  assert.equal(d.chegaram, 2);
  assert.deepEqual(d.chavesFaltando, [
    SETE_CHAVES[0],
    SETE_CHAVES[2],
    SETE_CHAVES[3],
    SETE_CHAVES[4],
    SETE_CHAVES[5],
  ]);
  // A mensagem NOMEIA cada arquivo perdido, pelo nome que o aluno reconhece…
  for (const nome of ["gravacao-1.mp3", "gravacao-3.mp3", "gravacao-4.mp3", "gravacao-5.mp3", "gravacao-6.mp3"]) {
    assert(d.mensagem.includes(nome), `mensagem deveria citar ${nome}`);
  }
  // …assume a culpa como nossa e NÃO fala em duração/mínimo — a frase de
  // "áudio curto" é exatamente a acusação errada que este ramo impede.
  assert(d.mensagem.includes("não da sua gravação"));
  assert(!d.mensagem.includes("mínimo"), "não pode culpar a duração da fala");

  // Arquivo presente porém TRUNCADO (PUT cortado, poucos bytes) conta como
  // não-chegado: pro aluno o efeito é o mesmo e reenviar resolve.
  const comToco = decidirDesfechoEnvio({
    chavesEsperadas: SETE_CHAVES,
    objetosNoR2: [
      ...SETE_CHAVES.slice(0, 6).map((k) => objeto(k)),
      objeto(SETE_CHAVES[6], MIN_BYTES_AUDIO - 1),
    ],
    totalSegundos: 25 * 60,
    temMedicao: true,
  });
  assert.equal(comToco.tipo, "envio_incompleto");

  // E o incompleto vence MESMO sem medição: faltou arquivo, a conversa é
  // sobre o envio, não sobre validar duração.
  const semMedicao = decidirDesfechoEnvio({
    chavesEsperadas: SETE_CHAVES,
    objetosNoR2: chegaram.map((k) => objeto(k)),
    totalSegundos: 0,
    temMedicao: false,
  });
  assert.equal(semMedicao.tipo, "envio_incompleto");
});

test("3. 7 slots, 7 chegaram, fala 18min < 20min → AÍ SIM too_short (a régua de duração não some)", () => {
  const d = decidirDesfechoEnvio({
    chavesEsperadas: SETE_CHAVES,
    objetosNoR2: SETE_CHAVES.map((k) => objeto(k)),
    totalSegundos: 18 * 60,
    temMedicao: true,
  });
  assert.equal(d.tipo, "curto_demais");
  assert(d.tipo === "curto_demais");
  // A mensagem é a da régua (mensagemCurtoDemais): diz o que tem, o mínimo
  // e quanto falta — não uma cópia local que possa divergir.
  assert(d.mensagem.includes("18min"));
  assert(d.mensagem.includes("mínimo de 20min"));
  assert(d.mensagem.includes("Faltam ~2min"));
});

test("4. 1 slot, 1 chegou, fala curta → too_short", () => {
  const uma = [chave(0, "unica.mp3")];
  const d = decidirDesfechoEnvio({
    chavesEsperadas: uma,
    objetosNoR2: uma.map((k) => objeto(k)),
    totalSegundos: 415,
    temMedicao: true,
  });
  assert.equal(d.tipo, "curto_demais");
});

test("5. MUTAÇÃO: sem a comparação slots × recebidos, o caso 2 cai em too_short — o bug da Hellen", () => {
  // O que o código VIA antes do conserto: só a lista que "chegou" (o browser
  // alegava sucesso e ninguém conferia o bucket). Passar as 2 chaves como se
  // fossem TODAS as esperadas simula exatamente a ausência da comparação —
  // e o veredito degrada pra "áudio muito curto", culpando a aluna.
  const chegaram = [SETE_CHAVES[1], SETE_CHAVES[6]];

  const semComparacao = decidirDesfechoEnvio({
    chavesEsperadas: chegaram, // ← a mutação: o guarda não sabe dos 7 slots
    objetosNoR2: chegaram.map((k) => objeto(k)),
    totalSegundos: 415,
    temMedicao: true,
  });
  assert.equal(semComparacao.tipo, "curto_demais");
  assert(semComparacao.tipo === "curto_demais");
  assert(
    semComparacao.mensagem.includes("mínimo de 20min"),
    "sem o guarda, a acusação errada volta",
  );

  // Com a comparação (o mundo real: 7 esperadas), o MESMO material vira
  // envio incompleto. A diferença entre os dois vereditos é exatamente o
  // guarda que este módulo introduz.
  const comComparacao = decidirDesfechoEnvio({
    chavesEsperadas: SETE_CHAVES,
    objetosNoR2: chegaram.map((k) => objeto(k)),
    totalSegundos: 415,
    temMedicao: true,
  });
  assert.equal(comComparacao.tipo, "envio_incompleto");
  assert.notEqual(semComparacao.tipo, comComparacao.tipo);
});

test("nomeLegivelDaChave tira caminho e prefixo de slot", () => {
  assert.equal(
    nomeLegivelDaChave("u/v/raw/003_minha_gravacao.mp3"),
    "minha_gravacao.mp3",
  );
  // Nome que por acaso começa com 3 dígitos + _ só perde o prefixo do SLOT.
  assert.equal(nomeLegivelDaChave("u/v/raw/000_001_take.mp3"), "001_take.mp3");
  // R2 fora do ar (objetosNoR2 null): sem prova de perda, não se acusa perda
  // — cai na régua de duração como sempre caiu (status quo documentado).
  const d = decidirDesfechoEnvio({
    chavesEsperadas: ["u/v/raw/000_a.mp3"],
    objetosNoR2: null,
    totalSegundos: 415,
    temMedicao: true,
  });
  assert.equal(d.tipo, "curto_demais");
});
