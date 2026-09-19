/**
 * Testes de regressão do saldo ILEGÍVEL do HeyGen (#396, 19/09).
 *
 * Rodar (Node ≥ 22.18, type-stripping nativo):
 *   node --test src/lib/heygen/quota-ilegivel.test.ts
 *
 * O DEFEITO QUE MOTIVOU: `getRemainingQuota` fazia
 *   `typeof data.remaining_quota === "number" ? data.remaining_quota : 0`
 * ou seja, QUALQUER resposta em formato inesperado virava `raw = 0` — e 0 é
 * indistinguível de "a cota acabou de verdade". A tela mostrava em vermelho
 * "sua cota de API chegou a zero, recarregue no HeyGen" para quem podia estar
 * com a cota cheia, mandando o aluno gastar dinheiro à toa.
 *
 * O caso real que abriu o assunto (raulcssavatar@, 14/09) NÃO era este: a cota
 * dele tinha acabado mesmo, e a mensagem estava certa. Este teste protege a
 * OUTRA população — a que recebe o mesmo texto sem ter o mesmo problema.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getRemainingQuota,
  classifyHeygenError,
  HeygenError,
  CODIGO_SALDO_ILEGIVEL,
} from "./client.ts";

/** Finge uma resposta 200 do HeyGen com o corpo que o teste quiser. */
function comRespostaDoHeygen<T>(corpo: unknown, fn: () => Promise<T>): Promise<T> {
  const original = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(JSON.stringify(corpo), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })) as typeof fetch;
  return fn().finally(() => {
    globalThis.fetch = original;
  });
}

test("lê remaining_quota quando ele vem, e divide por 60 para os créditos", async () => {
  const q = await comRespostaDoHeygen({ data: { remaining_quota: 1800 } }, () =>
    getRemainingQuota("k".repeat(24)),
  );
  assert.equal(q.raw, 1800, "o cru tem que sair exatamente como o HeyGen mandou");
  assert.equal(q.credits, 30);
});

test("ZERO DE VERDADE continua sendo zero — não vira erro", async () => {
  // Esta é a população do caso real: cota gasta até acabar. A tela DEVE
  // mostrar 0 em vermelho e mandar recarregar. Não podemos quebrar isso.
  const q = await comRespostaDoHeygen({ data: { remaining_quota: 0 } }, () =>
    getRemainingQuota("k".repeat(24)),
  );
  assert.equal(q.raw, 0);
  assert.equal(q.credits, 0);
});

test("cai para details.api quando remaining_quota não vem", async () => {
  const q = await comRespostaDoHeygen({ data: { details: { api: 600 } } }, () =>
    getRemainingQuota("k".repeat(24)),
  );
  assert.equal(q.raw, 600);
  assert.equal(q.credits, 10);
});

test("formato desconhecido FALHA EXPLÍCITO em vez de virar 0", async () => {
  await assert.rejects(
    () => comRespostaDoHeygen({ data: { saldo_novo: 123 } }, () => getRemainingQuota("k".repeat(24))),
    (e: unknown) => {
      assert.ok(e instanceof HeygenError, "tem que ser HeygenError");
      assert.equal(e.code, CODIGO_SALDO_ILEGIVEL);
      return true;
    },
    "resposta em formato novo NÃO pode virar saldo 0",
  );
});

test("campo presente mas não-numérico também falha explícito", async () => {
  await assert.rejects(
    () =>
      comRespostaDoHeygen({ data: { remaining_quota: "1800" } }, () =>
        getRemainingQuota("k".repeat(24)),
      ),
    (e: unknown) => (e as HeygenError).code === CODIGO_SALDO_ILEGIVEL,
  );
});

test("o erro de saldo ilegível NÃO pode ser classificado como cota zerada", () => {
  // A armadilha: classifyHeygenError decide por /quota|credit|insufficient/
  // sobre a MENSAGEM, e qualquer texto honesto sobre saldo casa com ela.
  // Se isto regredir, o aluno volta a ler "sua cota chegou a zero" quando na
  // verdade nós é que não conseguimos ler o número — o bug original de novo.
  const erro = new HeygenError(
    "Não foi possível ler o seu saldo no HeyGen agora: a resposta veio num formato que não reconhecemos.",
    200,
    CODIGO_SALDO_ILEGIVEL,
  );
  const { kind } = classifyHeygenError(erro);
  assert.notEqual(kind, "quota", "não pode virar 'quota' — é o falso zero");
  assert.equal(kind, "heygen");
});

test("cota zerada de verdade, vinda como erro do HeyGen, continua sendo 'quota'", () => {
  const erro = new HeygenError("Insufficient credit to perform this action", 400);
  assert.equal(classifyHeygenError(erro).kind, "quota");
});

test("chave recusada continua sendo 'auth' (reconectar resolve)", () => {
  assert.equal(classifyHeygenError(new HeygenError("Unauthorized", 401)).kind, "auth");
});
