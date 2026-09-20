/**
 * Régua de fala DISTINTA do SGP (#501) — os quatro casos obrigatórios do
 * cartão, mais a invariância de ordem que fecha a concorrência.
 *
 * Rodar de dentro de frontend/ (o alias @/ não resolve no runner puro):
 *   npx tsx --test src/lib/sgp/fala-distinta.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  chavesRepetidas,
  distintosPorConteudo,
  identidadeDoConteudo,
  somaFalaDistinta,
  type AudioComConteudo,
} from "./fala-distinta.ts";

/** A régua da casa (types.ts:29). Copiada aqui de propósito: se alguém mexer
 *  no mínimo, este teste continua provando a MATEMÁTICA, não o valor. */
const MIN = 20 * 60;

function audio(key: string, segundos: number, etag?: string | null, bytes?: number | null): AudioComConteudo {
  return { key, segundos, etag, bytes };
}

// ------------------------------------------------------ caso 1 (obrigatório)
test("mesmo etag+tamanho conta UMA vez — 6m34 real não pode virar 23m38", () => {
  // O padrão do caso kettycruz: o mesmo arquivo reenviado várias vezes fecha a
  // régua sem fala nova. Aqui: 394s (6m34) x3 cópias + um segundo arquivo de
  // 500s. A soma ingênua (1682s) passa dos 1200s; a fala distinta (894s) não.
  const itens = [
    audio("sgp/s1/audio/aaa_bloco1.mp3", 394, '"d41d8cd98f00b204e9800998ecf8427e"', 6_303_104),
    audio("sgp/s1/audio/bbb_bloco1.mp3", 394, '"d41d8cd98f00b204e9800998ecf8427e"', 6_303_104),
    audio("sgp/s1/audio/ccc_bloco1.mp3", 394, '"d41d8cd98f00b204e9800998ecf8427e"', 6_303_104),
    audio("sgp/s1/audio/ddd_bloco2.mp3", 500, '"aa1234567890abcdefaa1234567890ab"', 8_000_000),
  ];
  const ingenua = itens.reduce((s, a) => s + a.segundos, 0);
  assert.equal(ingenua, 1682);
  assert.ok(ingenua >= MIN, "o cenário reproduz o defeito: a soma ingênua fecha a régua");

  const distinta = somaFalaDistinta(itens);
  assert.equal(distinta, 894);
  assert.ok(distinta < MIN, "sem a cópia o pedido NÃO fecha os 20 min — é isso que o conserto muda");

  // E a tela sabe apontar exatamente quem não conta.
  assert.deepEqual([...chavesRepetidas(itens)].sort(), ["sgp/s1/audio/bbb_bloco1.mp3", "sgp/s1/audio/ccc_bloco1.mp3"]);
});

// ------------------------------------------------------ caso 2 (obrigatório)
test("controle negativo: mesmo NOME com etag diferente conta as DUAS", () => {
  // Duas gravações legítimas do mesmo ambiente saem do celular com o mesmo
  // nome. Se este teste quebrar, o conserto virou regressão.
  const itens = [
    audio("sgp/s2/audio/a1b2_gravacao.m4a", 610, '"11111111111111111111111111111111"', 5_000_000),
    audio("sgp/s2/audio/c3d4_gravacao.m4a", 615, '"22222222222222222222222222222222"', 5_100_000),
  ];
  assert.equal(somaFalaDistinta(itens), 1225);
  assert.equal(chavesRepetidas(itens).size, 0);
  assert.equal(distintosPorConteudo(itens).length, 2);
});

test("controle negativo 2: mesmo etag com TAMANHO diferente não é o mesmo conteúdo", () => {
  const itens = [
    audio("k1", 300, '"33333333333333333333333333333333"', 1_000_000),
    audio("k2", 300, '"33333333333333333333333333333333"', 2_000_000),
  ];
  assert.equal(somaFalaDistinta(itens), 600);
});

// ------------------------------------------------------ caso 3 (obrigatório)
test("arquivo único: comportamento inalterado", () => {
  const um = [audio("sgp/s3/audio/x_unico.mp3", 1300, '"44444444444444444444444444444444"', 20_000_000)];
  assert.equal(somaFalaDistinta(um), 1300);
  assert.equal(chavesRepetidas(um).size, 0);
});

test("itens sem etag/bytes (anexados antes do conserto) contam individualmente", () => {
  // Falha ABERTA: sem impressão de conteúdo, cada item conta como sempre
  // contou. Nenhum pedido em andamento perde minuto por falta de metadado.
  const legado = [
    audio("k1", 400), // sem etag nem bytes
    audio("k2", 400, null, null),
    audio("k3", 400, '"55555555555555555555555555555555"', null), // bytes faltando: sem identidade
    audio("k4", 400, '"55555555555555555555555555555555"', null),
  ];
  assert.equal(somaFalaDistinta(legado), 1600);
  assert.equal(chavesRepetidas(legado).size, 0);
});

// ------------------------------------------------------ caso 4 (obrigatório)
test("concorrência: duas chamadas simultâneas com o mesmo conteúdo — só uma conta", () => {
  // A estratégia escolhida deixa o passo atômico ACEITAR a cópia (nenhum SQL
  // mudou). Aqui se simula o que o banco produz sob QUALQUER intercalação de
  // dois POSTs do mesmo arquivo (keys diferentes, o slot sorteia uuid): as
  // duas entram no array. A régua tem que colapsá-las, em qualquer ordem.
  const a = audio("sgp/s4/audio/1111_arq.mp3", 700, '"66666666666666666666666666666666"', 11_200_000);
  const b = audio("sgp/s4/audio/2222_arq.mp3", 700, '"66666666666666666666666666666666"', 11_200_000);
  const c = audio("sgp/s4/audio/3333_outro.mp3", 550, '"77777777777777777777777777777777"', 8_800_000);

  // Todas as intercalações possíveis dos dois POSTs concorrentes (+ um terceiro
  // arquivo honesto): a soma é a MESMA — a decisão não depende mais da ordem
  // de escrita, que era exatamente o buraco do #238.
  for (const ordem of [
    [a, b, c],
    [b, a, c],
    [a, c, b],
    [c, a, b],
    [b, c, a],
    [c, b, a],
  ]) {
    assert.equal(somaFalaDistinta(ordem), 1250, `ordem ${ordem.map((i) => i.key).join(",")}`);
    assert.equal(chavesRepetidas(ordem).size, 1);
  }
});

// ------------------------------------------------------ detalhes de identidade
test("etag é normalizado: aspas, W/ e caixa não separam o mesmo conteúdo", () => {
  const itens = [
    audio("k1", 200, '"ABCDEF00000000000000000000000000"', 3_000_000),
    audio("k2", 200, 'W/"abcdef00000000000000000000000000"', 3_000_000),
    audio("k3", 200, "abcdef00000000000000000000000000", 3_000_000),
  ];
  assert.equal(somaFalaDistinta(itens), 200);
  assert.equal(identidadeDoConteudo(itens[0]), identidadeDoConteudo(itens[2]));
});

test("etag vazio ou bytes inválidos caem na identidade por key (contam sozinhos)", () => {
  assert.equal(identidadeDoConteudo(audio("k9", 100, "", 5)), "k:k9");
  assert.equal(identidadeDoConteudo(audio("k9", 100, '""', 5)), "k:k9");
  assert.equal(identidadeDoConteudo(audio("k9", 100, '"aa"', 0)), "k:k9");
  assert.equal(identidadeDoConteudo(audio("k9", 100, '"aa"', Number.NaN)), "k:k9");
});

// ---------------------------------------------- tripwire de fonte (sem banco)
// Mesmo padrão do anexar.test.ts (B): os portões não podem voltar à soma
// ingênua por refactor distraído. O alias @/ não resolve no runner puro,
// então aqui se lê o FONTE dos call sites.
const AQUI = import.meta.dirname;
const RAIZ = join(AQUI, "..", "..");

test("tripwire: os portões e as telas somam pela régua distinta", () => {
  const portoes: Array<[string, string]> = [
    [join(RAIZ, "app", "api", "v1", "sgp", "audio", "concluir", "route.ts"), "somaFalaDistinta("],
    [join(RAIZ, "app", "api", "v1", "sgp", "audio", "slot", "route.ts"), "somaFalaDistinta("],
    [join(RAIZ, "lib", "sgp", "processar.ts"), "somaFalaDistinta("],
    [join(RAIZ, "lib", "sgp", "processar.ts"), "distintosPorConteudo("],
    [join(RAIZ, "lib", "sgp", "ajuda.ts"), "somaFalaDistinta("],
    [join(RAIZ, "components", "sgp", "step-audio-form.tsx"), "somaFalaDistinta("],
    [join(RAIZ, "app", "[locale]", "sgp", "revisao", "page.tsx"), "somaFalaDistinta("],
  ];
  for (const [arquivo, marca] of portoes) {
    const fonte = readFileSync(arquivo, "utf8");
    assert.ok(fonte.includes(marca), `${arquivo} tem que usar ${marca} — soma ingênua conta o mesmo arquivo duas vezes (#501)`);
    // processar.ts pode reduzir — mas só DEPOIS do distintosPorConteudo (o
    // reduce dele roda sobre a lista já deduplicada). Nos demais, reduce
    // ingênuo sobre segundos é a regressão exata do #501.
    assert.ok(
      arquivo.endsWith("processar.ts") || !/reduce\(\(s, a\) => s \+ \(?a\.segundos/.test(fonte),
      `${arquivo} não pode voltar ao reduce ingênuo sobre segundos`,
    );
  }
  // E a rota do áudio grava a impressão de conteúdo no item.
  const rotaAudio = readFileSync(join(RAIZ, "app", "api", "v1", "sgp", "audio", "route.ts"), "utf8");
  assert.ok(rotaAudio.includes("etag: m.etag"), "a rota do áudio tem que gravar o etag do R2 no item");
  assert.ok(rotaAudio.includes("bytes: m.bytes"), "a rota do áudio tem que gravar o tamanho do R2 no item");
});
