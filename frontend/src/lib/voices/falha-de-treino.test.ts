/**
 * Rodar (Node ≥ 22.18, type-stripping nativo):
 *   node --test src/lib/voices/falha-de-treino.test.ts
 *
 * Sem mock e sem alias: o módulo testado é PURO de propósito (ver o cabeçalho
 * dele). O que estes testes travam é a regra que o caso ricardoolito expôs —
 * a mensagem não pode afirmar estorno nem equipe acionada sem que as duas
 * coisas tenham acontecido.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PREFIXO_FALHA_TECNICA,
  desfechoDoCredito,
  falhaEhNossa,
  mensagemFalhaTecnica,
} from "./falha-de-treino.ts";

const CUSTO = 10000;

/** Qualquer palavra que só faça sentido se dinheiro tiver se movido. */
function falaDeCredito(msg: string): boolean {
  return /crédito|creditos|créditos|devolv|estorn|reembols/i.test(msg);
}

test("falha técnica SEM débito: a mensagem não fala em crédito nenhum", () => {
  const msg = mensagemFalhaTecnica({ credito: "nao_cobrado", chamado: 85, custoCreditos: CUSTO });
  assert.equal(
    falaDeCredito(msg),
    false,
    `mensagem afirmou algo sobre crédito sem ter havido cobrança: ${msg}`,
  );
  // É o caso do SGP: não cobrado, logo não estornado, logo nada a dizer.
  assert.match(msg, /não precisa fazer nada/i);
});

test("falha técnica COM débito estornado: a mensagem diz a devolução, com o valor", () => {
  const msg = mensagemFalhaTecnica({ credito: "estornado", chamado: 85, custoCreditos: CUSTO });
  assert.match(msg, /Devolvemos os 10\.000 créditos/);
});

test("estorno TENTADO e falho nunca vira 'devolvemos'", () => {
  const msg = mensagemFalhaTecnica({
    credito: "estorno_falhou",
    chamado: 85,
    custoCreditos: CUSTO,
  });
  assert.ok(
    !/Devolvemos/i.test(msg),
    `afirmou devolução que não entrou: ${msg}`,
  );
  assert.match(msg, /não saiu sozinha/i);
});

test("só manda tentar de novo quem tem saldo de volta", () => {
  const comSaldo = mensagemFalhaTecnica({ credito: "estornado", chamado: 1, custoCreditos: CUSTO });
  assert.match(comSaldo, /começar a clonagem de novo/i);

  // Quem não foi cobrado tem 0 crédito por desenho (SGP) e bateria em 402 na
  // tela nova — mandar "tente novamente" é porta trancada.
  for (const credito of ["nao_cobrado", "estorno_falhou"] as const) {
    const msg = mensagemFalhaTecnica({ credito, chamado: 1, custoCreditos: CUSTO });
    assert.ok(
      !/clonagem de novo|tente treinar novamente|tente de novo/i.test(msg),
      `mandou ${credito} tentar de novo sem saldo para isso: ${msg}`,
    );
  }
});

test("só afirma equipe acionada quando o chamado tem número", () => {
  const comChamado = mensagemFalhaTecnica({
    credito: "estornado",
    chamado: 412,
    custoCreditos: CUSTO,
  });
  assert.match(comChamado, /Abrimos um chamado/i);

  const semChamado = mensagemFalhaTecnica({
    credito: "estornado",
    chamado: null,
    custoCreditos: CUSTO,
  });
  assert.ok(
    !/equipe já está com ele|Abrimos um chamado|equipe (já )?foi notificada/i.test(semChamado),
    `prometeu equipe sem chamado aberto: ${semChamado}`,
  );
  // O que sobra tem que continuar sendo verdade: a falha está gravada.
  assert.match(semChamado, /ficou registrada/i);
});

test("toda variante abre com o prefixo que o ingest usa pra descartar a duplicata", () => {
  for (const credito of ["nao_cobrado", "estornado", "estorno_falhou"] as const) {
    for (const chamado of [null, 7]) {
      const msg = mensagemFalhaTecnica({ credito, chamado, custoCreditos: CUSTO });
      assert.ok(
        msg.startsWith(PREFIXO_FALHA_TECNICA),
        `variante (${credito}, chamado=${chamado}) não começa com o prefixo: ${msg}`,
      );
    }
  }
});

test("desfechoDoCredito traduz o par (cobrado?, estorno entrou?)", () => {
  assert.equal(desfechoDoCredito({ billed: false, estornoOk: false }), "nao_cobrado");
  // Não cobrado manda, mesmo que alguém passe estornoOk true por engano.
  assert.equal(desfechoDoCredito({ billed: false, estornoOk: true }), "nao_cobrado");
  assert.equal(desfechoDoCredito({ billed: true, estornoOk: true }), "estornado");
  assert.equal(desfechoDoCredito({ billed: true, estornoOk: false }), "estorno_falhou");
});

test("falhaEhNossa: só o que não é material do aluno", () => {
  assert.equal(falhaEhNossa({ erroDeDataset: false, arquivoCorrompido: false }), true);
  assert.equal(falhaEhNossa({ erroDeDataset: true, arquivoCorrompido: false }), false);
  assert.equal(falhaEhNossa({ erroDeDataset: false, arquivoCorrompido: true }), false);
});

test("milhar não depende do ICU do runtime", () => {
  const msg = mensagemFalhaTecnica({ credito: "estornado", chamado: 1, custoCreditos: 1234567 });
  assert.match(msg, /1\.234\.567 créditos/);
});
