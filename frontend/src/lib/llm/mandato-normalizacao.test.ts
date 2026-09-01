/**
 * Testes da GUARDA DE MANDATO do normalizador (incidente #192).
 *
 * Rodar (Node ≥ 22.18, type-stripping nativo):
 *   node --test src/lib/llm/mandato-normalizacao.test.ts
 *
 * O caso que motivou tudo: o aluno "Robert Ros" (70rrosusa@gmail.com) reclamou
 * que a voz "não reproduz o meu timbre NEM A FORMA DE FALAR". Medido na geração
 * b298e5be: ele escreveu "clica nos dois" e "Escolhe o seu caminho", e o
 * normalizador sintetizou "clique nos dois" e "Escolha o seu caminho". Nenhuma
 * das duas é erro de digitação — é o imperativo falado do português brasileiro.
 * Trocar isso É forma de falar.
 *
 * TODOS os números abaixo saem de uma medição sobre as 2.489 gerações reais que
 * têm `text_raw` e `text_normalized` diferentes (30/08). Não são inventados, e
 * quem mexer nesta guarda deve refazer a medição antes de mudar um limiar.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  aplicaGuardaDeMandato,
  classificaTroca,
  chave,
  PROTEGIDAS,
} from "./mandato-normalizacao.ts";

const v = (cru: string, saida: string, caixaAlta = false) =>
  classificaTroca(chave(cru), chave(saida), caixaAlta);
const reverte = (cru: string, saida: string) => v(cru, saida).startsWith("reverte");

// ── 1. O DEFEITO DO #192: forma falada trocada por forma escrita ──────────

test('"pra" -> "para" é revertido (143 ocorrências reais, a troca nº 1 do defeito)', () => {
  assert.equal(v("pra", "para"), "reverte-protegida");
});

test("o imperativo falado do Robert é revertido (clica/escolhe — a queixa dele)", () => {
  assert.equal(v("clica", "clique"), "reverte-flexao");
  assert.equal(v("escolhe", "escolha"), "reverte-flexao");
});

test("a mesma família de imperativo, medida no histórico", () => {
  for (const [cru, saida] of [
    ["olha", "olhe"],
    ["presta", "preste"],
    ["comenta", "comente"],
    ["envia", "envie"],
    ["divulga", "divulgue"], // exige a canonização gu->g
    ["fica", "fique"], // exige a canonização qu->c
  ]) {
    assert.ok(reverte(cru, saida), `${cru} -> ${saida} devia reverter`);
  }
});

test("outras formas faladas do grupo (ta/to/ce/pro/trampo)", () => {
  for (const [cru, saida] of [
    ["ta", "esta"],
    ["to", "estou"],
    ["ce", "voce"],
    ["pro", "para"],
    ["trampo", "trabalho"],
  ]) {
    assert.equal(v(cru, saida), "reverte-protegida", `${cru} -> ${saida}`);
  }
});

test('violação nominal do próprio prompt: "digital" -> "dijital" (11 no histórico)', () => {
  // o SYSTEM do normalizador lista "digital" entre as palavras a NÃO tocar,
  // e o modelo troca assim mesmo. É a prova de que instrução não é garantia.
  assert.equal(v("digital", "dijital"), "reverte-protegida");
  assert.equal(v("digitais", "dijitais"), "reverte-protegida");
});

test("troca lexical pura: palavra do aluno substituída por outra sem relação", () => {
  for (const [cru, saida] of [
    ["humano", "dia"],
    ["momento", "tempo"],
    ["emocao", "fundamental"],
    ["treinamento", "clone"],
  ]) {
    assert.equal(v(cru, saida), "reverte-troca-lexical", `${cru} -> ${saida}`);
  }
});

// ── 2. O TRABALHO LEGÍTIMO NÃO PODE SER DESFEITO ─────────────────────────
// Esta é a direção de erro que importa: desfazer normalização legítima
// devolveria "R$ 50,90" cru pro sintetizador.

test("expansão de número/moeda/data passa intacta (é 1-para-muitos, nem é olhada)", () => {
  const r = aplicaGuardaDeMandato("custa R$ 50,90 e dura 3 dias", "custa cinquenta reais e noventa centavos e dura três dias");
  assert.equal(r.revertidas.length, 0);
  assert.equal(r.texto, "custa cinquenta reais e noventa centavos e dura três dias");
});

test("abreviação virando palavra inteira é mantida (dr/dra/vc — 34+24+17 reais)", () => {
  assert.equal(v("dr", "doutor"), "mantem-abreviacao");
  assert.equal(v("dra", "doutora"), "mantem-abreviacao");
  assert.equal(v("vc", "voce"), "mantem-abreviacao");
});

test("estrangeirismo reescrito pela pronúncia é mantido (o prompt MANDA fazer)", () => {
  assert.equal(v("marketing", "marketin"), "mantem-estrangeira");
  assert.equal(v("design", "dizain"), "mantem-estrangeira");
  assert.equal(v("reels", "riuls"), "mantem-estrangeira");
});

test("termo técnico longo reescrito em g->j é mantido", () => {
  assert.equal(v("tecnologia", "tecnolojia"), "mantem");
  assert.equal(v("cardiologista", "cardiolojista"), "mantem");
});

test("erro de digitação óbvio é mantido (está no mandato do prompt)", () => {
  assert.equal(v("dimessao", "dimensao"), "mantem");
});

test("alongamento é mantido (oolha -> olha, 31 ocorrências reais)", () => {
  assert.equal(v("oolha", "olha"), "mantem-alongamento");
  assert.equal(v("diaaa", "dia"), "mantem-alongamento");
});

test("conserto de ACENTO é invisível pra guarda — nunca desfaz", () => {
  // "so" -> "só" e "nao" -> "não" têm a MESMA chave, então nem chegam a ser
  // classificados como troca.
  assert.equal(chave("só"), chave("so"));
  assert.equal(chave("não"), chave("nao"));
  const r = aplicaGuardaDeMandato("eu so falo nao", "eu só falo não");
  assert.equal(r.revertidas.length, 0);
  assert.equal(r.texto, "eu só falo não");
});

test("sigla em CAIXA ALTA nunca é tocada (a expansão dela é legítima)", () => {
  assert.equal(v("IA", "inteligencia", true), "mantem");
  assert.equal(v("CEO", "ceo", true), "mantem");
});

// ── 3. INVARIANTES DE SEGURANÇA ──────────────────────────────────────────

test("INVARIANTE: a guarda não cria nem apaga fim de frase", () => {
  // medido: 0 de 290 gerações com reversão tiveram a contagem de [.!?] alterada
  const cru = "clica aqui. pra ver! entendeu?";
  const saida = "clique aqui. Para ver! entendeu?";
  const r = aplicaGuardaDeMandato(cru, saida);
  const fins = (s: string) => (s.match(/[.!?]/g) || []).length;
  assert.equal(fins(r.texto), fins(saida));
  assert.ok(r.revertidas.length >= 2);
});

test("a reversão preserva a MAIÚSCULA de início de frase que o LLM pôs", () => {
  const r = aplicaGuardaDeMandato("vai la. clica no botao", "Vai lá. Clique no botão");
  assert.ok(r.texto.includes("Clica"), `esperava "Clica" maiúsculo, veio: ${r.texto}`);
});

test("remoção de rubrica de produção passa intacta (é muitos-para-zero)", () => {
  const r = aplicaGuardaDeMandato("[pausa] oi pra voce", "oi para você");
  // "pra" -> "para" é 1x1 e volta; a rubrica removida não é recriada
  assert.ok(!r.texto.includes("[pausa]"));
  assert.ok(r.texto.includes("pra"));
});

test("texto idêntico não produz reversão nenhuma", () => {
  const r = aplicaGuardaDeMandato("nada muda aqui", "nada muda aqui");
  assert.equal(r.revertidas.length, 0);
  assert.equal(r.abstida, false);
});

test("a lista de protegidas cobre os grupos que o prompt nomeia", () => {
  for (const p of ["pra", "ta", "to", "digital", "video", "online", "postar"]) {
    assert.ok(PROTEGIDAS.has(p), `"${p}" devia estar protegida`);
  }
});

// ── 4. LIMITES CONHECIDOS — medidos, e de propósito NÃO corrigidos aqui ──
// Estes testes travam o comportamento ATUAL para que qualquer mudança futura
// apareça no diff. Eles documentam buraco, não aprovam buraco.

test("BURACO CONHECIDO: tradução de estrangeirismo escapa (creator -> criador)", () => {
  // A regra 5 (parece estrangeira -> mantém) dispara ANTES da regra 7 (troca
  // lexical), então "creator" -> "criador" passa, embora o prompt proíba
  // tradução EM MAIÚSCULAS. 7 ocorrências no histórico. O cabeçalho do módulo
  // lista este par como exemplo da regra 7 — ou seja, o módulo se contradiz, e
  // só rodando é que isso apareceu.
  assert.equal(v("creator", "criador"), "mantem-estrangeira");
});

test("CUSTO CONHECIDO: a guarda desfaz alguns consertos de digitação legítimos", () => {
  // Medido: ~10% das 451 reversões são trabalho legítimo sendo desfeito,
  // concentrado quando a palavra do aluno é um typo LONGE da palavra certa.
  // Exemplos reais: creie->criei (5x), clode->claude (3x), acrodei->acordei.
  // Não é regressão: é o preço da guarda, e está aqui pra ser visto, não
  // escondido. Decidir se compensa é do Johnny, não meu.
  assert.ok(reverte("creie", "criei"));
  assert.ok(reverte("clode", "claude"));
});
