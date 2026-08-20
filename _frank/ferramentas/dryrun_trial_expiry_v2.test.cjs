/**
 * Testes da lógica da expire_trial_credits v2 (a mesma decisão do SQL da
 * migration 85, reproduzida em JS puro pelo dry-run). Sem banco, sem rede:
 *
 *   node --test _frank/ferramentas/dryrun_trial_expiry_v2.test.cjs
 *
 * Cada caso aqui é um erro que JÁ aconteceu (18/08) ou um buraco que a v2
 * fecha — o teste existe pra ele não voltar.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  allowlistDoEnv, ehPagamento, ehTrial, montarConjuntos,
  guardaEntitlement, classificar, estouraTeto,
} = require("./dryrun_trial_expiry_v2.cjs");

const AGORA = "2026-08-20T15:00:00.000Z";

function evento(tipo, { valor = 0, rec = null, email = "a@b.com", grafiaRest = false, recebido = "2026-08-01T00:00:00+00:00" } = {}) {
  const purchase = { price: { value: valor } };
  if (rec != null) purchase[grafiaRest ? "recurrency_number" : "recurrence_number"] = rec;
  return { event_type: tipo, received_at: recebido, payload: { data: { purchase, buyer: { email } } } };
}

function base(extra = {}) {
  return {
    email: "aluno@x.com",
    trialStart: "2026-08-01T00:00:00+00:00", // 19 dias atrás — passou do dia 10
    agora: AGORA,
    graceDays: 10,
    allowSet: new Set(),
    pagos: new Set(),
    resolvidos: new Set(),
    perfil: { id: "u1", credits_subscription: 100000, credits_extra: 5000 },
    ents: [],
    ...extra,
  };
}

// ── pagamento de verdade (o coração do incidente 18/08) ──────────────────────

test("APPROVED com valor > 0 e recurrence presente É pagamento", () => {
  assert.equal(ehPagamento(evento("PURCHASE_APPROVED", { valor: 97, rec: 2 })), true);
});

test("COMPLETE com valor > 0 e recurrence presente É pagamento (item 6 da v2)", () => {
  assert.equal(ehPagamento(evento("PURCHASE_COMPLETE", { valor: 97, rec: 2 })), true);
});

test("valor 0 nunca é pagamento (é o trial)", () => {
  assert.equal(ehPagamento(evento("PURCHASE_APPROVED", { valor: 0, rec: 1 })), false);
});

test("compra avulsa (sem recurrence_number) NÃO é pagamento da assinatura", () => {
  assert.equal(ehPagamento(evento("PURCHASE_APPROVED", { valor: 97 })), false);
});

test("DELAYED e BILLET_PRINTED com valor > 0 NÃO são pagamento — o OVERDUE do webhook", () => {
  // A armadilha de 18/08 na grafia do webhook: cobrança emitida ≠ cobrança paga.
  assert.equal(ehPagamento(evento("PURCHASE_DELAYED", { valor: 97, rec: 2 })), false);
  assert.equal(ehPagamento(evento("PURCHASE_BILLET_PRINTED", { valor: 97, rec: 2 })), false);
});

test("grafia da API REST (recurrency_number) NÃO conta como pagamento no webhook", () => {
  // payment_events tem 2.516 recurrence_number e ZERO recurrency_number
  // (conferido em produção 20/08). Se a grafia REST aparecer, é dado fora do
  // lugar — contar seria mascarar o problema.
  assert.equal(ehPagamento(evento("PURCHASE_APPROVED", { valor: 97, rec: 2, grafiaRest: true })), false);
});

// ── trial (critério do painel, mig 63) ───────────────────────────────────────

test("trial = APPROVED, rec 1, valor 0", () => {
  assert.equal(ehTrial(evento("PURCHASE_APPROVED", { valor: 0, rec: 1 })), true);
  assert.equal(ehTrial(evento("PURCHASE_COMPLETE", { valor: 0, rec: 1 })), false);
  assert.equal(ehTrial(evento("PURCHASE_APPROVED", { valor: 0, rec: 2 })), false);
  assert.equal(ehTrial(evento("PURCHASE_APPROVED", { valor: 97, rec: 1 })), false);
});

test("montarConjuntos: pessoa com trial e mensalidade paga entra nos dois conjuntos", () => {
  const { trials, pagos } = montarConjuntos([
    evento("PURCHASE_APPROVED", { valor: 0, rec: 1, email: "pagou@x.com", recebido: "2026-08-01T00:00:00+00:00" }),
    evento("PURCHASE_APPROVED", { valor: 97, rec: 2, email: "pagou@x.com", recebido: "2026-08-08T00:00:00+00:00" }),
    evento("PURCHASE_APPROVED", { valor: 0, rec: 1, email: "sotrial@x.com" }),
  ]);
  assert.equal(trials.get("pagou@x.com"), "2026-08-01T00:00:00+00:00");
  assert.equal(pagos.has("pagou@x.com"), true);
  assert.equal(pagos.has("sotrial@x.com"), false);
});

// ── as guardas da v2, na ordem do SQL ────────────────────────────────────────

test("dentro dos 10 dias: fora da varredura", () => {
  const r = classificar(base({ trialStart: "2026-08-15T00:00:00+00:00" }));
  assert.equal(r.decisao, "fora_do_prazo");
});

test("já resolvido (marcador): fora da varredura pra sempre", () => {
  const r = classificar(base({ resolvidos: new Set(["aluno@x.com"]) }));
  assert.equal(r.decisao, "ja_resolvido");
});

test("allowlist: equipe nunca sofre automação de saldo — a lição do Lucas 18/08", () => {
  const r = classificar(base({
    email: "lucas.m.arrial@gmail.com",
    allowSet: allowlistDoEnv({}),
  }));
  assert.equal(r.decisao, "allowlist");
  assert.equal(r.debito, 0);
});

test("allowlist default inclui os 3 da equipe (espelho do access.ts)", () => {
  const a = allowlistDoEnv({});
  for (const e of ["johnny.oliveirasp@gmail.com", "lucas.m.arrial@gmail.com", "eduardo@lucasarrial.com"]) {
    assert.equal(a.has(e), true, e);
  }
});

test("pagou ao menos uma mensalidade: marca paid, não zera", () => {
  const r = classificar(base({ pagos: new Set(["aluno@x.com"]) }));
  assert.equal(r.decisao, "marcaria_paid");
});

test("sem conta hoje: nada a zerar e NÃO marca (compra órfã pode ser reivindicada)", () => {
  const r = classificar(base({ perfil: null }));
  assert.equal(r.decisao, "sem_conta");
});

test("entitlement ATIVO vigente: pula sem marcar (pagamento provável fora do payment_events)", () => {
  const r = classificar(base({ ents: [{ status: "active", access_until: "2026-09-01T00:00:00+00:00" }] }));
  assert.equal(r.decisao, "pulado_entitlement_ativo");
});

test("entitlement ativo com access_until NULL também protege", () => {
  const r = classificar(base({ ents: [{ status: "active", access_until: null }] }));
  assert.equal(r.decisao, "pulado_entitlement_ativo");
});

test("CANCELED com período pago vigente: pula — a guarda NOVA da v2 (buraco 3)", () => {
  // Quem pagou, cancelou e está no período pago fica canceled + access_until
  // futuro. A v1 zeraria se o evento de pagamento faltasse no banco.
  const r = classificar(base({ ents: [{ status: "canceled", access_until: "2026-09-06T00:00:00+00:00" }] }));
  assert.equal(r.decisao, "pulado_canceled_vigente");
});

test("canceled com período JÁ VENCIDO não protege: zera", () => {
  const r = classificar(base({ ents: [{ status: "canceled", access_until: "2026-08-01T00:00:00+00:00" }] }));
  assert.equal(r.decisao, "zeraria");
  assert.equal(r.debito, 100000);
});

test("zera SÓ credits_subscription; extra nunca entra no débito", () => {
  const r = classificar(base({ perfil: { id: "u1", credits_subscription: 31586, credits_extra: 928 } }));
  assert.equal(r.decisao, "zeraria");
  assert.equal(r.debito, 31586);
});

test("saldo de mensalidade já gasto: marca zeroed com débito 0", () => {
  const r = classificar(base({ perfil: { id: "u1", credits_subscription: 0, credits_extra: 5000 } }));
  assert.equal(r.decisao, "marcaria_zeroed_sem_saldo");
  assert.equal(r.debito, 0);
});

test("saldo negativo é tratado como 0, nunca débito negativo", () => {
  const r = classificar(base({ perfil: { id: "u1", credits_subscription: -50 } }));
  assert.equal(r.decisao, "marcaria_zeroed_sem_saldo");
  assert.equal(r.debito, 0);
});

// ── teto por rodada ──────────────────────────────────────────────────────────

test("teto vale sobre débitos REAIS: 15 débitos com teto 20 passa; 21 estoura", () => {
  assert.equal(estouraTeto(15, 20), false);
  assert.equal(estouraTeto(20, 20), false);
  assert.equal(estouraTeto(21, 20), true);
});

// ── comparação de tempo nunca por string (formatos +00:00 vs Z divergem) ─────

test("guarda compara época, não string: +00:00 vs Z no mesmo instante", () => {
  // access_until 1s no futuro em formato +00:00, agora em formato Z
  const r = guardaEntitlement(
    [{ status: "active", access_until: "2026-08-20T15:00:01+00:00" }],
    "2026-08-20T15:00:00.000Z",
  );
  assert.equal(r, "entitlement_ativo");
});
