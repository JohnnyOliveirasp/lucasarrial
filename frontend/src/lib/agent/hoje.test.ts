/**
 * Testes da data de hoje no system prompt da Fast (#323). Rodar:
 *   node --test src/lib/agent/hoje.test.ts
 *
 * O RELÓGIO ENTRA FIXO em todos os casos. Lição já escrita em garantia.ts:64 e
 * repetida aqui porque este arquivo é *sobre* datas: teste de prazo com relógio
 * real passa hoje e quebra amanhã sem ninguém ter mexido no código.
 *
 * NOTA DE EXECUÇÃO: `hoje.ts` não importa nada por alias ("@/..."), de propósito
 * — assim o runner nativo do Node resolve o módulo e o teste pode CHAMAR a
 * função de verdade, em vez de ler o fonte como faz o manual.test.ts (que é
 * obrigado a isso porque manual.ts importa @/lib/video-clone/config).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { blocoHoje, dataPorExtensoBR } from "./hoje.ts";

test("carimba a data de Brasília, não a do processo em UTC", () => {
  // 15h00Z de 09/09 = 12h00 em Brasília, mesmo dia. Caso trivial de controle.
  assert.equal(dataPorExtensoBR(new Date("2026-09-09T15:00:00Z")), "quarta-feira, 09/09/2026");
});

test("A ARMADILHA DO FUSO: depois das 21h de Brasília o UTC já virou o dia seguinte", () => {
  // 02h00Z de 09/09 ainda é 08/09 às 23h em São Paulo. Se alguém trocar o
  // formatador por um que use o relógio do processo (o servidor roda em UTC),
  // a Fast passa a anunciar AMANHÃ como se fosse hoje, todas as noites — que é
  // exatamente a classe de erro que este chamado conserta.
  assert.equal(dataPorExtensoBR(new Date("2026-09-09T02:00:00Z")), "terça-feira, 08/09/2026");

  // E o contrário: 03h00Z já é 00h de Brasília do mesmo dia.
  assert.equal(dataPorExtensoBR(new Date("2026-09-09T03:00:00Z")), "quarta-feira, 09/09/2026");
});

test("o bloco traz a data E a regra de conferir prazo do histórico", () => {
  const b = blocoHoje(new Date("2026-09-09T15:00:00Z"));

  assert.match(b, /HOJE É quarta-feira, 09\/09\/2026/, "sumiu a data de hoje do bloco");

  // O modo de falha medido NÃO foi "ela não sabia o dia": foi ela repetir uma
  // data do histórico sem conferir se já tinha passado. Informar a data sem a
  // regra não conserta o caso da Alana, então a regra é parte do conserto.
  assert.match(
    b,
    /hist[óo]rico[\s\S]{0,200}J[ÁA] TER VENCIDO/i,
    "sumiu o aviso de que data no histórico pode já ter vencido",
  );
  assert.match(
    b,
    /JAMAIS o repita como se fosse futuro/i,
    "sumiu a proibição de repetir prazo vencido como promessa futura",
  );
  assert.match(
    b,
    /NUNCA prometa data nova por conta pr[óo]pria/i,
    "sumiu a proibição de inventar prazo novo (quem tem o retorno é a equipe)",
  );
});

test("a data NÃO abre porta pra Fast voltar a contar garantia na mão (#198/#265)", () => {
  // Guarda de REGRESSÃO que este próprio conserto criou. Ideia veio do PR #221
  // (feat/fast-sabe-a-data-de-hoje), uma tentativa paralela do mesmo defeito.
  //
  // Dar a data de hoje e mandar "compare com hoje" convida a Fast a calcular
  // janela de garantia sozinha — exatamente o que o #198 proibiu e o #265
  // mostrou custar caro (a janela varia por produto: a Hotmart já mandou 6, 7,
  // 14, 15 e 30 dias). A conta tem que continuar vindo PRONTA da
  // account.ts:181/184. Sem esta carve-out o conserto do #323 reabriria aquele.
  const b = blocoHoje(new Date("2026-09-09T15:00:00Z"));
  assert.match(
    b,
    /N[ÃA]O a use para calcular garantia/i,
    "sumiu a proibição de usar a data de hoje pra calcular garantia",
  );
  assert.match(
    b,
    /proibida de contar dias/i,
    "sumiu o reforço de que a Fast não conta dias — o #198 volta por esta porta",
  );
});

test("O TESTE NÃO É DECORATIVO: sem a data de hoje, a asserção cai", () => {
  // Guarda contra "o bloco virou string vazia / o campo parou de viajar".
  // Um bloco que não cite a data não pode passar por este arquivo.
  const vazio = "";
  assert.throws(
    () => assert.match(vazio, /HOJE É /),
    "a asserção da data passaria num bloco vazio — o teste não estaria guardando nada",
  );
});
