/**
 * Testes da guarda do resgate — incidente #283. Rodar (Node ≥ 22.18,
 * type-stripping nativo):
 *   node --test src/lib/payments/claim-guard.test.ts
 *
 * OS CASOS SÃO REAIS, medidos no banco em 06/09/2026:
 *   - `gestao@qooqi.com.br`: pagante confirmado, `plan='pro'`, saldo 0 e
 *     NENHUMA linha `subscription_grant` — 47 dias travado (21/07 a 06/09).
 *     É o caso que a guarda antiga não enxergava.
 *   - o contraponto: quem recebeu os 100.000 do ciclo e gastou também fica em
 *     saldo 0, mas TEM `subscription_grant`. Esse não pode disparar o resgate
 *     em toda renderização do /app.
 *
 * Dimensionamento medido no mesmo dia (2.264 perfis, 827 com `plan='pro'`):
 * só 3 perfis entram no ramo de saldo zero. O caminho comum não faz query.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  precisaResgatarCompras,
  saldoTotal,
  semPlanoPago,
  type PerfilParaResgate,
} from "./claim-guard.ts";

/** Sonda espiã: conta quantas vezes a consulta ao banco seria feita. */
function sonda(resposta: boolean) {
  const estado = { chamadas: 0 };
  return {
    estado,
    fn: async () => {
      estado.chamadas++;
      return resposta;
    },
  };
}

const PRO_SEM_SALDO: PerfilParaResgate = {
  plan: "pro",
  credits_subscription: 0,
  credits_extra: 0,
};

test("sem perfil: resgata e NÃO consulta o banco", async () => {
  const s = sonda(false);
  assert.equal(
    await precisaResgatarCompras({
      profile: null,
      bypassaCobranca: false,
      jaRecebeuRecarga: s.fn,
    }),
    true,
  );
  assert.equal(s.estado.chamadas, 0);
});

test("plano nulo ou 'free': resgata e NÃO consulta o banco (guarda original)", async () => {
  for (const plan of [null, "free"]) {
    const s = sonda(false);
    assert.equal(
      await precisaResgatarCompras({
        profile: { plan, credits_subscription: 0, credits_extra: 0 },
        bypassaCobranca: false,
        jaRecebeuRecarga: s.fn,
      }),
      true,
      `plan=${String(plan)} deveria resgatar`,
    );
    assert.equal(s.estado.chamadas, 0, `plan=${String(plan)} não deveria consultar`);
  }
});

test("caminho comum (plano pago COM saldo): não resgata e não consulta", async () => {
  const s = sonda(false);
  assert.equal(
    await precisaResgatarCompras({
      profile: { plan: "pro", credits_subscription: 100_000, credits_extra: 0 },
      bypassaCobranca: false,
      jaRecebeuRecarga: s.fn,
    }),
    false,
  );
  assert.equal(s.estado.chamadas, 0);
});

test("saldo só em credits_extra ainda é saldo: não resgata", async () => {
  const s = sonda(false);
  assert.equal(
    await precisaResgatarCompras({
      profile: { plan: "pro", credits_subscription: 0, credits_extra: 5_280 },
      bypassaCobranca: false,
      jaRecebeuRecarga: s.fn,
    }),
    false,
  );
  assert.equal(s.estado.chamadas, 0);
});

test("#283 — pagante com saldo 0 que NUNCA recebeu recarga: resgata", async () => {
  const s = sonda(false); // nenhuma linha subscription_grant
  assert.equal(
    await precisaResgatarCompras({
      profile: PRO_SEM_SALDO,
      bypassaCobranca: false,
      jaRecebeuRecarga: s.fn,
    }),
    true,
  );
  assert.equal(s.estado.chamadas, 1);
});

test("ANTI-REGRESSÃO — pagante que recebeu e GASTOU tudo: não resgata", async () => {
  const s = sonda(true); // já existe subscription_grant
  assert.equal(
    await precisaResgatarCompras({
      profile: PRO_SEM_SALDO,
      bypassaCobranca: false,
      jaRecebeuRecarga: s.fn,
    }),
    false,
  );
  assert.equal(s.estado.chamadas, 1, "a consulta só acontece no ramo de saldo zero");
});

test("equipe/admin (bypassesBilling) com saldo 0: não resgata nem consulta", async () => {
  const s = sonda(false);
  assert.equal(
    await precisaResgatarCompras({
      profile: PRO_SEM_SALDO,
      bypassaCobranca: true,
      jaRecebeuRecarga: s.fn,
    }),
    false,
  );
  assert.equal(s.estado.chamadas, 0, "saldo de sócio/admin é decorativo, não vale consulta");
});

test("mas admin SEM plano continua caindo na guarda original", async () => {
  const s = sonda(false);
  assert.equal(
    await precisaResgatarCompras({
      profile: { plan: "free", credits_subscription: 0, credits_extra: 0 },
      bypassaCobranca: true,
      jaRecebeuRecarga: s.fn,
    }),
    true,
  );
  assert.equal(s.estado.chamadas, 0);
});

test("créditos NULL contam como zero (coluna nova / perfil recém-criado)", async () => {
  assert.equal(saldoTotal({ plan: "pro", credits_subscription: null, credits_extra: null }), 0);
  const s = sonda(false);
  assert.equal(
    await precisaResgatarCompras({
      profile: { plan: "pro", credits_subscription: null, credits_extra: null },
      bypassaCobranca: false,
      jaRecebeuRecarga: s.fn,
    }),
    true,
  );
  assert.equal(s.estado.chamadas, 1);
});

test("saldo negativo (débito acima do saldo) também é 'sem saldo'", async () => {
  const s = sonda(true);
  assert.equal(
    await precisaResgatarCompras({
      profile: { plan: "pro", credits_subscription: -10, credits_extra: 0 },
      bypassaCobranca: false,
      jaRecebeuRecarga: s.fn,
    }),
    false,
  );
  assert.equal(s.estado.chamadas, 1);
});

test("semPlanoPago/saldoTotal isolados", () => {
  assert.equal(semPlanoPago(null), true);
  assert.equal(semPlanoPago(undefined), true);
  assert.equal(semPlanoPago({ plan: "", credits_subscription: 0, credits_extra: 0 }), true);
  assert.equal(semPlanoPago({ plan: "free", credits_subscription: 0, credits_extra: 0 }), true);
  assert.equal(semPlanoPago({ plan: "pro", credits_subscription: 0, credits_extra: 0 }), false);
  assert.equal(saldoTotal(null), 0);
  assert.equal(saldoTotal({ plan: "pro", credits_subscription: 12, credits_extra: 30 }), 42);
});
