/**
 * Testes da data de hoje no system prompt da Fast. Rodar (Node ≥ 22.18):
 *   node --test src/lib/agent/data-hoje.test.ts
 *
 * POR QUE ESTE ARQUIVO EXISTE (caso alana_pinho@hotmail.com, 09/09):
 * a Fast não sabia que dia era hoje. Ela achava no histórico um "te aviso no
 * dia 07" escrito por ela mesma dias antes e REPETIA a promessa, com o dia 07
 * já passado. A aluna corrigiu a Fast — depois de já ter chamado a gente de
 * robô. Conta criada 01/09, acesso vencido em 08/09, ZERO vozes, ZERO
 * gerações, 99.475 créditos parados.
 *
 * RELÓGIO FIXO, SEMPRE: a data entra por PARÂMETRO em todo assert daqui. Um
 * new Date() dentro de asserção faz o teste passar hoje e cair amanhã — é a
 * lição já registrada no garantia.ts:64. Os valores abaixo foram medidos na
 * saída real da função, não deduzidos de cabeça.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { linhaDataHoje } from "./data-hoje.ts";

/** 2026-09-09T12:00:00Z = 09:00 em São Paulo, quarta-feira. */
const QUARTA = new Date("2026-09-09T12:00:00Z");

test("(a) a data de hoje aparece formatada em dd/mm/aaaa", () => {
  const linha = linhaDataHoje(QUARTA);
  assert.match(
    linha,
    /HOJE É 09\/09\/2026/,
    "a data sumiu do topo do prompt — é exatamente o defeito de origem",
  );
});

test("(b) o dia da semana está correto e em português", () => {
  assert.match(linhaDataHoje(QUARTA), /quarta-feira/);
  // Um segundo ponto do calendário, pra provar que o dia da semana é
  // calculado e não uma string fixa que por acaso bateu.
  assert.match(
    linhaDataHoje(new Date("2026-09-13T12:00:00Z")),
    /HOJE É 13\/09\/2026, domingo/,
  );
});

test("(c) chamada SEM argumento continua funcionando", () => {
  // Os 6 call sites (brain.ts:120/122/125/127, winback/dispatch.ts:275,
  // winback/email.ts:107) chamam sem argumento. Aqui não dá pra afirmar QUAL
  // é a data sem congelar o relógio do processo, então o assert é sobre a
  // FORMA: tem que sair uma data real, não "undefined" nem "Invalid Date".
  const linha = linhaDataHoje();
  assert.match(
    linha,
    /^HOJE É \d{2}\/\d{2}\/\d{4}, [a-zç-]+-?f?e?i?r?a? ?\(horário de Brasília\)\./u,
    `chamada sem argumento não produziu uma data válida: ${linha.split("\n")[0]}`,
  );
  assert.doesNotMatch(linha, /Invalid Date|undefined|NaN/);
});

test("(d) a regra sobre data vencida está no texto", () => {
  const linha = linhaDataHoje(QUARTA);
  // Só saber a data não conserta nada: sem esta regra o modelo tem a data no
  // topo e mesmo assim copia a promessa vencida do histórico.
  assert.match(
    linha,
    /JÁ VENCIDA[\s\S]{0,200}NUNCA reprometa/,
    "sumiu a proibição de reprometer uma data que já passou",
  );
  assert.match(
    linha,
    // \s+ e não espaço literal: o bloco é quebrado em linhas, então a frase
    // atravessa um \n. Assert com espaço cru cai por causa da largura da
    // coluna, não por causa da regra ter sumido.
    /NUNCA invente\s+uma data nova/,
    "sumiu a proibição de inventar prazo novo no lugar do vencido",
  );
  assert.match(
    linha,
    /escale pro humano/,
    "a saída pro humano sumiu — sem ela a Fast fica sozinha com o prazo furado",
  );
});

test("a data é a de Brasília, não a do servidor (vira o dia às 00h de SP)", () => {
  // 01:00Z do dia 10 ainda é dia 9 em São Paulo (22:00). Se este assert cair,
  // a data está saindo em UTC e a Fast vai adiantar o dia toda madrugada.
  assert.match(
    linhaDataHoje(new Date("2026-09-10T01:00:00Z")),
    /HOJE É 09\/09\/2026, quarta-feira/,
  );
  // E 02:00Z do dia 9 ainda é dia 8 em São Paulo (23:00).
  assert.match(
    linhaDataHoje(new Date("2026-09-09T02:00:00Z")),
    /HOJE É 08\/09\/2026, terça-feira/,
  );
});

test("data inválida cai pra agora em vez de envenenar o prompt", () => {
  // Prompt sem data é o defeito de origem, e "Invalid Date" no topo é pior
  // ainda. Um Date quebrado vindo de um chamador não pode virar isso.
  const linha = linhaDataHoje(new Date("lixo"));
  assert.match(linha, /^HOJE É \d{2}\/\d{2}\/\d{4}, /u);
  assert.doesNotMatch(linha, /Invalid Date|NaN/);
});

test("a regra não autoriza a Fast a calcular garantia", () => {
  // Dar a data pro modelo reabre a porta do #198: ele tem "hoje" e a data de
  // cadastro no contexto e se sente convidado a contar os dias da garantia.
  // A conta continua vindo PRONTA na linha GARANTIA HOTMART.
  assert.match(
    linhaDataHoje(QUARTA),
    /NÃO use esta[\s\S]{0,80}garantia[\s\S]{0,200}você não conta dias/,
    "sumiu a trava que impede a data de hoje virar cálculo de garantia (#198)",
  );
});
