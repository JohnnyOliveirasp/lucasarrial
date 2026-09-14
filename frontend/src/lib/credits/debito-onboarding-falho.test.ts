/**
 * `node --test src/lib/credits/debito-onboarding-falho.test.ts`
 *
 * O que estes testes protegem: o débito do onboarding falhar SEM SUMIR.
 *
 * O defeito original era de silêncio, não de lógica — `treino.ts` e
 * `avatares.ts` faziam `await debitCreditsOnboarding({...})` sem atribuir, e
 * a própria função devolvia `{ok:false}` mudo, descartando inteiro o
 * `error.message` da RPC. Material entregue, crédito não cobrado, nada no
 * razão e nada no log. Um teste que só verificasse "retornou ok:false" não
 * pegaria isso: o que precisa ser travado é o CONTEÚDO do registro.
 *
 * Import com extensão `.ts` e sem alias `@/`: o runner não resolve o alias.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MARCA_DEBITO_FALHO,
  montarAvisoDebitoFalho,
  resumirDebitoFalho,
} from "./debito-onboarding-falho.ts";

const TREINO_NO_PROFILE = {
  userId: "11111111-1111-1111-1111-111111111111",
  amount: 10000,
  kind: "training" as const,
  refType: "voice",
  refId: "22222222-2222-2222-2222-222222222222",
  reason: "no_profile" as const,
};

// ── O AVISO PRECISA SER ACHÁVEL ───────────────────────────────────────────

test("carrega a marca greppável — sem ela o evento existe e ninguém acha", () => {
  // ⚠️ `includes(MARCA)` SOZINHO é tautológico: com a marca vazia,
  // `includes("")` é sempre true e o teste passa com o defeito dentro
  // (pego na mutação 2 da verificação de 14/09). A marca é travada pelo
  // literal, e o literal tem que estar no aviso.
  assert.equal(MARCA_DEBITO_FALHO, "[credits] DEBITO DO ONBOARDING NAO ENTROU");
  assert.ok(
    montarAvisoDebitoFalho(TREINO_NO_PROFILE).startsWith(
      "[credits] DEBITO DO ONBOARDING NAO ENTROU:",
    ),
  );
});

test("identifica QUAL material ficou sem cobrança (kind + ref)", () => {
  const aviso = montarAvisoDebitoFalho(TREINO_NO_PROFILE);
  assert.ok(aviso.includes("kind=training"));
  // Sem o ref não dá pra cruzar com a voz/geração e a dívida vira anônima.
  assert.ok(aviso.includes("ref=voice:22222222-2222-2222-2222-222222222222"));
  assert.ok(aviso.includes(`user=${TREINO_NO_PROFILE.userId}`));
});

test("carrega o VALOR: é o tamanho da dívida que não entrou no razão", () => {
  assert.ok(montarAvisoDebitoFalho(TREINO_NO_PROFILE).includes("amount=10000"));
});

// ── REGRESSÃO: O DETALHE DA RPC NÃO PODE SER ENGOLIDO ─────────────────────

test("REGRESSÃO: o detalhe cru da RPC sobrevive — era ele que se perdia", () => {
  // `if (error) return { ok:false, reason:"error" }` jogava o error.message
  // fora inteiro. Sem ele, "error" não distingue timeout de permissão de
  // função ausente, e o log não sustenta diagnóstico nenhum.
  const aviso = montarAvisoDebitoFalho({
    ...TREINO_NO_PROFILE,
    reason: "error",
    detalhe: "canceling statement due to statement timeout",
  });
  assert.ok(aviso.includes("canceling statement due to statement timeout"));
  assert.ok(aviso.includes("motivo=error"));
});

test("sem detalhe, não inventa nem deixa 'detalhe=undefined' no log", () => {
  const aviso = montarAvisoDebitoFalho({ ...TREINO_NO_PROFILE, detalhe: null });
  assert.ok(!aviso.includes("detalhe="));
  assert.ok(!aviso.includes("undefined"));
});

// ── OS DOIS MOTIVOS SE DISTINGUEM ─────────────────────────────────────────

test("no_profile e error dizem coisas diferentes: a ação humana é diferente", () => {
  const semPerfil = montarAvisoDebitoFalho(TREINO_NO_PROFILE);
  const erroRpc = montarAvisoDebitoFalho({ ...TREINO_NO_PROFILE, reason: "error" });
  assert.ok(semPerfil.includes("perfil inexistente"));
  assert.ok(erroRpc.includes("debit_credits_onboarding falhou"));
  assert.notEqual(semPerfil, erroRpc);
});

test("o aviso diz que o material JÁ SAIU — é o que impede ler como 'nada aconteceu'", () => {
  const aviso = montarAvisoDebitoFalho(TREINO_NO_PROFILE);
  assert.ok(aviso.includes("JA FOI ENTREGUE"));
});

// ── RESUMO CURTO PRO CHAMADOR ─────────────────────────────────────────────

test("resumo carrega motivo, valor e tipo — chamador não precisa do log", () => {
  const resumo = resumirDebitoFalho(TREINO_NO_PROFILE);
  assert.ok(resumo.includes("no_profile"));
  assert.ok(resumo.includes("10000"));
  assert.ok(resumo.includes("training"));
});

test("avatar (image) também tem resumo próprio, com o custo dele", () => {
  const resumo = resumirDebitoFalho({
    ...TREINO_NO_PROFILE,
    amount: 525,
    kind: "image",
    refType: "image_generation",
    reason: "error",
  });
  assert.ok(resumo.includes("525"));
  assert.ok(resumo.includes("image"));
});

// ── CAMPOS AUSENTES NÃO PODEM QUEBRAR O LOG ───────────────────────────────

test("ref ausente vira '-' em vez de derrubar o aviso", () => {
  // O log é o último recurso quando tudo mais falhou; ele não pode ser o
  // próximo a falhar.
  const aviso = montarAvisoDebitoFalho({
    userId: "u",
    amount: 1,
    kind: "training",
    reason: "error",
  });
  assert.ok(aviso.includes("ref=-:-"));
  assert.ok(aviso.includes(MARCA_DEBITO_FALHO));
});
