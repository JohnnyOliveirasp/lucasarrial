/**
 * Testes de `acesso-frase` — incidente #303 (`a0bc1f7e`). Rodar (Node ≥ 22.18,
 * type-stripping nativo):
 *   node --test src/lib/payments/acesso-frase.test.ts
 *
 * O PRIMEIRO teste é a regressão que importa: assinatura ACTIVE com data
 * futura NÃO pode produzir nenhuma palavra de prazo. Era essa frase que o
 * `account.ts` entregava ao agente, e foi ela que virou "o seu acesso está
 * indo até 09/09, ou seja, mais dois dias" no e-mail de 07/09.
 *
 * O SEGUNDO grupo trava a outra metade, a do #47: assinatura CANCELADA tem
 * data real de fim, mas o crédito NÃO morre nela — a geração é liberada por
 * saldo, não por data. Anunciar perda de crédito é o erro pelo outro lado.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  naturezaDaData,
  fraseDeAcessoParaAgente,
  fraseDeAcessoParaAluno,
} from "./acesso-frase.ts";

const AGORA = "2026-09-17T12:00:00.000Z";
const DAQUI_2_DIAS = "2026-09-19T12:00:00.000Z";
const PASSADO = "2026-08-16T12:00:00.000Z";

/** Palavras que NÃO podem aparecer sobre uma assinatura que renova. */
const PALAVRAS_DE_PRAZO = ["vence", "vencimento", "expira", "termina em", "prazo"];

test("REGRESSÃO #303: ACTIVE com data futura é RENOVAÇÃO, nunca prazo", () => {
  const l = {
    accessUntil: DAQUI_2_DIAS,
    accessSource: "hotmart",
    statusEntitlement: "active",
  };
  assert.equal(naturezaDaData(l, AGORA), "renova");

  const frase = fraseDeAcessoParaAgente(l, AGORA);
  assert.match(frase, /RENOVA automaticamente/);
  assert.match(frase, /PRÓXIMA COBRANÇA/);
  // A frase fala de prazo só para PROIBIR. O que não pode é a afirmação solta
  // "ativo até <data>" que o agente lia como vencimento.
  assert.doesNotMatch(frase, /^ATIVO até/);
});

test("REGRESSÃO #303: a frase para o ALUNO também não carrega prazo", () => {
  const frase = fraseDeAcessoParaAluno(
    { accessUntil: DAQUI_2_DIAS, accessSource: "hotmart", statusEntitlement: "active" },
    AGORA,
  );
  assert.equal(frase, "sua assinatura está ativa e renova automaticamente em 19/09/2026");
  for (const p of PALAVRAS_DE_PRAZO) {
    assert.doesNotMatch(frase!, new RegExp(p, "i"), `frase ao aluno não pode dizer "${p}"`);
  }
});

test("CANCELED com data futura: a data é real, mas o crédito não morre nela (#47)", () => {
  const l = {
    accessUntil: DAQUI_2_DIAS,
    accessSource: "hotmart",
    statusEntitlement: "canceled",
  };
  assert.equal(naturezaDaData(l, AGORA), "termina");

  const frase = fraseDeAcessoParaAgente(l, AGORA);
  assert.match(frase, /CANCELADA/);
  assert.match(frase, /NÃO somem/);
  assert.match(frase, /liberada por SALDO, não por data/);
  assert.match(frase, /NÃO anuncie/);

  assert.equal(
    fraseDeAcessoParaAluno(l, AGORA),
    "sua assinatura foi cancelada e não renova; o acesso do período já pago vai até 19/09/2026",
  );
});

test("SEM status conhecido: não afirma nem renovação nem vencimento — manda ESCALAR", () => {
  const l = { accessUntil: DAQUI_2_DIAS, accessSource: "hotmart", statusEntitlement: null };
  assert.equal(naturezaDaData(l, AGORA), "desconhecido");

  const frase = fraseDeAcessoParaAgente(l, AGORA);
  assert.match(frase, /NÃO afirme que ela renova NEM que vence/);
  assert.match(frase, /ESCALE/);

  // Ao aluno não se entrega meia-verdade: sem status, não há frase.
  assert.equal(fraseDeAcessoParaAluno(l, AGORA), null);
});

test("erro de leitura cai em `desconhecido`, não em `vence` (princípio do #282)", () => {
  // Quem chama devolve `statusEntitlement: null` quando o SELECT erra. O que
  // este teste trava é a consequência: falha de leitura NÃO pode virar uma
  // afirmação sobre a assinatura de um pagante.
  const frase = fraseDeAcessoParaAgente(
    { accessUntil: DAQUI_2_DIAS, accessSource: "hotmart", statusEntitlement: null },
    AGORA,
  );
  assert.doesNotMatch(frase, /RENOVA automaticamente/);
  assert.doesNotMatch(frase, /CANCELADA/);
});

test("data no passado é SEM acesso, não `ativo até <data que já foi>`", () => {
  const l = { accessUntil: PASSADO, accessSource: "hotmart", statusEntitlement: "canceled" };
  assert.equal(naturezaDaData(l, AGORA), "sem_acesso");
  assert.match(fraseDeAcessoParaAgente(l, AGORA), /^SEM assinatura ativa/);
  assert.doesNotMatch(fraseDeAcessoParaAgente(l, AGORA), /^ATIVO/);
});

test("vitalício: sem data e com origem — não inventa data", () => {
  const l = { accessUntil: null, accessSource: "hotmart", statusEntitlement: "active" };
  assert.equal(naturezaDaData(l, AGORA), "vitalicio");
  assert.match(fraseDeAcessoParaAgente(l, AGORA), /sem data de término/);
  assert.doesNotMatch(fraseDeAcessoParaAgente(l, AGORA), /\?/);
});

test("conta sem nada: SEM assinatura ativa, sem data pendurada", () => {
  const l = { accessUntil: null, accessSource: null, statusEntitlement: null };
  assert.equal(naturezaDaData(l, AGORA), "sem_acesso");
  assert.match(fraseDeAcessoParaAgente(l, AGORA), /^SEM assinatura ativa\./);
  // Sem data pendurada continua sendo o ponto do teste: nenhum "?" e nenhuma
  // data inventada no lugar da que não existe.
  assert.doesNotMatch(fraseDeAcessoParaAgente(l, AGORA), /\?/);
  // A frase para o ALUNO não ganha imperativo — o imperativo é instrução de
  // prompt, e quem lê esta é uma pessoa.
  assert.equal(fraseDeAcessoParaAluno(l, AGORA), "você não tem assinatura ativa");
});

test("sem acesso: a frase do agente PROÍBE o 'pode usar normalmente' (#507)", () => {
  // 21/09/2026, chat de ajuda do app: o contexto trazia `Acesso: SEM
  // assinatura ativa` e `Saldo: 0 créditos`, e a Fast ainda assim respondeu
  // que a aluna podia "continuar usando a plataforma normalmente". Fato seco
  // sem imperativo vira afirmação errada — a mesma classe do #198 e do #303.
  for (const l of [
    { accessUntil: null, accessSource: null, statusEntitlement: null },
    { accessUntil: PASSADO, accessSource: "hotmart", statusEntitlement: "canceled" },
  ]) {
    const frase = fraseDeAcessoParaAgente(l, AGORA);
    assert.match(frase, /^SEM assinatura ativa/);
    assert.match(frase, /pode continuar usando a plataforma normalmente/);
    assert.match(frase, /NUNCA/);
    // Aponta para o SALDO em vez de negar a geração em bloco: conta sem
    // assinatura e COM créditos avulsos gera normalmente, e negar seria o
    // mesmo defeito virado ao contrário.
    assert.match(frase, /SALDO/);
    assert.doesNotMatch(frase, /^ATIVO/);
  }
});

test("o caso real que abriu o card: conta 49110dde, HCIA7GIM ACTIVE, 09/09", () => {
  // Reprodução do estado de 07/09: access_until = date_next_charge da
  // assinatura ACTIVE. A casa escreveu "vai até 09/09, mais dois dias".
  const l = {
    accessUntil: "2026-09-09T12:00:00.000Z",
    accessSource: "hotmart",
    statusEntitlement: "active",
  };
  const agora = "2026-09-07T14:27:00.000Z";
  assert.equal(naturezaDaData(l, agora), "renova");
  assert.equal(
    fraseDeAcessoParaAluno(l, agora),
    "sua assinatura está ativa e renova automaticamente em 09/09/2026",
  );
});
