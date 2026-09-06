/**
 * Testes do LEMBRETE de voz parada em `awaiting_training`. Rodar
 * (Node ≥ 22.18, type-stripping nativo):
 *   node --test src/lib/voices/lembrete-treino.test.ts
 *
 * O CASO É REAL, medido no banco em 06/09/2026:
 *   - 18 vozes em `awaiting_training`, TODAS com áudio enviado (0 sem áudio);
 *   - 20 a 59 minutos de gravação por pessoa;
 *   - a mais velha parada há 54 DIAS;
 *   - 16 são anteriores ao conserto de tela de 26/08 e 2 são posteriores.
 *
 * O que estes testes travam, em ordem de risco:
 *
 *  1. CARTA DUPLICADA. O sweep roda a cada 5 min. Sem trava, a mesma voz vira
 *     um e-mail a cada 5 minutos; e no primeiro sweep depois do deploy as 18
 *     vozes que o Johnny JÁ tratou à mão em 06/09 receberiam tudo de novo. Por
 *     isso o corte de backfill e a trava por voz têm teste próprio.
 *
 *  2. BOTÃO MORTO. Treinar custa créditos e o botão devolve 402 pra quem não
 *     tem. Mandar "é só clicar em Treinar" pra quem está com saldo zero é
 *     mandar a pessoa bater numa parede — o texto TEM que mudar com o saldo.
 *
 *  3. RAJADA. Uma voz parada há 54 dias venceu as duas etapas de uma vez. Ela
 *     tem que receber UM e-mail, não dois seguidos.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ETAPAS_DIAS,
  SEM_LEMBRETE_ANTES_DE,
  antesDoCorte,
  diasParado,
  etapaDevida,
  etapasCobertas,
  lembrarVoz,
  montarLembrete,
  temSaldo,
  type EstadoLembretes,
  type TextoLembrete,
  type VozParada,
} from "./lembrete-treino.ts";

const CUSTO = 10_000;

/** Voz-base: criada DEPOIS do corte, com saldo de sobra. */
function voz(over: Partial<VozParada> = {}): VozParada {
  return {
    voiceId: "v-1",
    userId: "u-1",
    email: "aluno@exemplo.com",
    nome: "Ana",
    criadaEm: "2026-09-10T12:00:00.000Z",
    saldo: 50_000,
    equipe: false,
    ...over,
  };
}

/** Coletor de envios — o teste inteiro roda sem banco e sem SMTP. */
function coletor() {
  const enviados: { voz: VozParada; texto: TextoLembrete }[] = [];
  return {
    enviados,
    enviar: async (v: VozParada, t: TextoLembrete) => {
      enviados.push({ voz: v, texto: t });
    },
  };
}

// ── 1. A trava anti-repetição ──────────────────────────────────────────────

test("manda o lembrete quando a voz vence a primeira etapa", async () => {
  const estado: EstadoLembretes = {};
  const c = coletor();
  const agora = new Date("2026-09-13T12:00:00.000Z"); // 3 dias

  const r = await lembrarVoz(voz(), estado, CUSTO, agora, c.enviar);

  assert.equal(r.enviou, true);
  assert.equal(r.enviou && r.etapa, 3);
  assert.equal(c.enviados.length, 1);
  assert.deepEqual(estado["v-1"].etapas, [3]);
});

test("SEGUNDO sweep na mesma voz NÃO manda de novo (o sweep roda a cada 5min)", async () => {
  const estado: EstadoLembretes = {};
  const c = coletor();
  const agora = new Date("2026-09-13T12:00:00.000Z");

  await lembrarVoz(voz(), estado, CUSTO, agora, c.enviar);
  // 5 minutos depois, o cron roda de novo com o MESMO estado.
  const r2 = await lembrarVoz(
    voz(),
    estado,
    CUSTO,
    new Date("2026-09-13T12:05:00.000Z"),
    c.enviar,
  );

  assert.equal(r2.enviou, false);
  assert.equal(r2.enviou === false && r2.motivo, "ja_lembrada");
  assert.equal(c.enviados.length, 1, "só pode ter saído UM e-mail");
});

test("cem sweeps seguidos produzem no máximo os 2 e-mails da régua", async () => {
  const estado: EstadoLembretes = {};
  const c = coletor();
  // 20 dias parado: as duas etapas já venceram e ficam vencidas pra sempre.
  for (let i = 0; i < 100; i++) {
    await lembrarVoz(
      voz(),
      estado,
      CUSTO,
      new Date("2026-09-30T12:00:00.000Z"),
      c.enviar,
    );
  }
  assert.equal(c.enviados.length, 1, "as duas etapas venceram juntas = 1 carta");
});

test("a segunda etapa sai quando vence, e só ela", async () => {
  const estado: EstadoLembretes = {};
  const c = coletor();

  await lembrarVoz(voz(), estado, CUSTO, new Date("2026-09-13T12:00:00.000Z"), c.enviar);
  assert.deepEqual(estado["v-1"].etapas, [3]);

  // Dia 14: segunda (e última) tentativa.
  const r = await lembrarVoz(
    voz(),
    estado,
    CUSTO,
    new Date("2026-09-24T12:00:00.000Z"),
    c.enviar,
  );
  assert.equal(r.enviou && r.etapa, 14);
  assert.equal(c.enviados.length, 2);
  assert.deepEqual(estado["v-1"].etapas, [3, 14]);

  // Dia 60: acabou a régua. A gente para de insistir.
  const r3 = await lembrarVoz(
    voz(),
    estado,
    CUSTO,
    new Date("2026-11-10T12:00:00.000Z"),
    c.enviar,
  );
  assert.equal(r3.enviou, false);
  assert.equal(c.enviados.length, 2);
});

// ── 2. O corte de backfill (as 18 já tratadas à mão em 06/09) ──────────────

test("voz anterior ao corte NÃO recebe nada — o Johnny já escreveu à mão", async () => {
  const estado: EstadoLembretes = {};
  const c = coletor();
  // A mais velha do lote real: 54 dias antes de 06/09.
  const antiga = voz({ voiceId: "v-antiga", criadaEm: "2026-07-14T12:00:00.000Z" });

  const r = await lembrarVoz(antiga, estado, CUSTO, new Date("2026-09-07T12:00:00.000Z"), c.enviar);

  assert.equal(r.enviou, false);
  assert.equal(r.enviou === false && r.motivo, "antes_do_corte");
  assert.equal(c.enviados.length, 0, "carta duplicada no mesmo dia é o defeito");
  assert.deepEqual(estado, {}, "nem estado ela suja");
});

test("o corte é exatamente a data do trabalho manual", () => {
  assert.equal(antesDoCorte("2026-09-05T23:59:59.000Z"), true);
  assert.equal(antesDoCorte(SEM_LEMBRETE_ANTES_DE), false);
  assert.equal(antesDoCorte("2026-09-06T00:00:01.000Z"), false);
});

// ── 3. O saldo muda o texto (não mandar ninguém pra botão morto) ───────────

test("com saldo: o e-mail manda clicar, e diz onde", () => {
  const t = montarLembrete(voz({ saldo: 50_000 }), 3, CUSTO);
  assert.match(t.assunto, /1 clique/i);
  assert.match(t.texto, /Iniciar treinamento/);
  assert.match(t.texto, /app\/voice-cloning/);
  assert.doesNotMatch(t.texto, /crédito/i, "quem tem saldo não ouve falar de crédito");
});

test("SEM saldo: o e-mail NÃO manda clicar num botão que devolve 402", () => {
  const t = montarLembrete(voz({ saldo: 0 }), 3, CUSTO);
  assert.match(t.assunto, /crédito/i);
  assert.match(t.texto, /10\.000/, "diz o custo real");
  assert.match(t.texto, /\b0\b/, "e diz o saldo real da pessoa");
  assert.match(t.texto, /planos/, "dá a saída");
});

test("equipe treina sem saldo — bypassesBilling não é cobrado", () => {
  assert.equal(temSaldo({ saldo: 0, equipe: true }, CUSTO), true);
  assert.equal(temSaldo({ saldo: 0, equipe: false }, CUSTO), false);
  assert.equal(temSaldo({ saldo: CUSTO, equipe: false }, CUSTO), true);
  assert.equal(temSaldo({ saldo: CUSTO - 1, equipe: false }, CUSTO), false);
});

test("o e-mail nunca promete que o áudio se perdeu, e nunca usa jargão", () => {
  for (const saldo of [0, 50_000]) {
    const t = montarLembrete(voz({ saldo }), 5, CUSTO);
    assert.match(t.texto, /guardado/, "a pessoa precisa saber que não vai regravar");
    for (const jargao of ["R2", "RunPod", "LoRA", "awaiting_training", "402"]) {
      assert.doesNotMatch(
        t.texto,
        new RegExp(jargao, "i"),
        `"${jargao}" não significa nada pro aluno`,
      );
    }
  }
});

// ── 4. A régua crua ────────────────────────────────────────────────────────

test("nada sai antes da primeira etapa", async () => {
  const estado: EstadoLembretes = {};
  const c = coletor();
  // 2 dias — é o caso real mais novo do lote de 06/09.
  const r = await lembrarVoz(voz(), estado, CUSTO, new Date("2026-09-12T12:00:00.000Z"), c.enviar);
  assert.equal(r.enviou, false);
  assert.equal(r.enviou === false && r.motivo, "nova_demais");
  assert.equal(c.enviados.length, 0);
});

test("voz sem e-mail é pulada em vez de explodir", async () => {
  const estado: EstadoLembretes = {};
  const c = coletor();
  const r = await lembrarVoz(voz({ email: "" }), estado, CUSTO, new Date("2026-10-01T12:00:00.000Z"), c.enviar);
  assert.equal(r.enviou, false);
  assert.equal(r.enviou === false && r.motivo, "sem_email");
});

test("diasParado não devolve negativo nem quebra com data inválida", () => {
  const agora = new Date("2026-09-13T12:00:00.000Z");
  assert.equal(diasParado("2026-09-10T12:00:00.000Z", agora), 3);
  assert.equal(diasParado("2026-09-10T23:59:00.000Z", agora), 2, "dias INTEIROS");
  assert.equal(diasParado("2026-09-20T12:00:00.000Z", agora), 0, "futuro não é negativo");
  assert.equal(diasParado("nao-e-data", agora), 0);
});

test("etapaDevida devolve a MAIOR vencida, nunca uma rajada", () => {
  assert.equal(etapaDevida(0, []), null);
  assert.equal(etapaDevida(3, []), 3);
  assert.equal(etapaDevida(13, [3]), null);
  assert.equal(etapaDevida(14, [3]), 14);
  assert.equal(etapaDevida(54, []), 14, "54 dias = a última, não as duas");
  assert.equal(etapaDevida(54, [3, 14]), null);
});

test("etapasCobertas fecha as anteriores junto (senão o dia 3 sai depois do 14)", () => {
  assert.deepEqual(etapasCobertas(0), []);
  assert.deepEqual(etapasCobertas(3), [3]);
  assert.deepEqual(etapasCobertas(54), [3, 14]);
});

test("a régua é de no máximo 2 etapas, em ordem", () => {
  assert.deepEqual([...ETAPAS_DIAS], [3, 14]);
});
