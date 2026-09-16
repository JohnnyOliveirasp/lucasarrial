/**
 * Testes de `decidirAcessoDoPerfil` — incidente #282. Rodar (Node ≥ 22.18,
 * type-stripping nativo):
 *   node --test src/lib/payments/entitlements-pure.test.ts
 *
 * O PRIMEIRO teste é o que trava a regressão: até este conserto, um SELECT que
 * ERRAVA voltava `data: null`, virava lista vazia e o recompute gravava
 * `plan: "free"` no perfil de quem PAGOU. Erro de leitura revogava acesso.
 *
 * Os demais fixam a regra de negócio que NÃO pode mudar de carona neste
 * conserto — em especial `canceled` com data futura (corrigido em 20/08: quem
 * cancela mantém o período já pago) e o desempate entre vários entitlements.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { decidirAcessoDoPerfil } from "./entitlements-pure.ts";

const AGORA = "2026-09-16T12:00:00.000Z";
const FUTURO = "2026-10-16T12:00:00.000Z";
const MAIS_LONGE = "2026-12-01T12:00:00.000Z";
const PASSADO = "2026-08-16T12:00:00.000Z";

const ok = (linhas: { provider: string; status: string; access_until: string | null }[]) => ({
  data: linhas,
  error: null,
});

test("REGRESSÃO #282: erro de leitura NÃO escreve nada (não rebaixa pagante)", () => {
  const d = decidirAcessoDoPerfil(
    { data: null, error: { message: 'relation "entitlements" does not exist' } },
    AGORA,
  );
  assert.equal(d.escrever, false);
  assert.equal(d.escrever === false && d.motivo, "erro_de_leitura");
});

test("erro de leitura COM dados parciais também não escreve", () => {
  // Não dá pra decidir acesso com metade da resposta: se a consulta errou, a
  // lista pode estar truncada e o melhor entitlement pode ser o que faltou.
  const d = decidirAcessoDoPerfil(
    { data: [{ provider: "hotmart", status: "canceled", access_until: PASSADO }], error: { message: "timeout" } },
    AGORA,
  );
  assert.equal(d.escrever, false);
});

test("data null SEM erro também aborta (ausência de resposta não é resposta)", () => {
  const d = decidirAcessoDoPerfil({ data: null, error: null }, AGORA);
  assert.equal(d.escrever, false);
  assert.equal(d.escrever === false && d.motivo, "sem_dados_e_sem_erro");
});

test("lista VAZIA é resposta de verdade: grava free", () => {
  // Diferente do caso acima: o banco respondeu, e a resposta é "não tem nada".
  const d = decidirAcessoDoPerfil(ok([]), AGORA);
  assert.deepEqual(d, {
    escrever: true,
    patch: { plan: "free", access_source: null, access_until: null },
  });
});

test("active vitalício (access_until NULL) dá pro, e o NULL é preservado", () => {
  const d = decidirAcessoDoPerfil(ok([{ provider: "hotmart", status: "active", access_until: null }]), AGORA);
  assert.deepEqual(d, {
    escrever: true,
    patch: { plan: "pro", access_source: "hotmart", access_until: null },
  });
});

test("active com data futura dá pro", () => {
  const d = decidirAcessoDoPerfil(ok([{ provider: "hotmart", status: "active", access_until: FUTURO }]), AGORA);
  assert.equal(d.escrever && d.patch.plan, "pro");
  assert.equal(d.escrever && d.patch.access_until, FUTURO);
});

test("active EXPIRADO não dá acesso", () => {
  const d = decidirAcessoDoPerfil(ok([{ provider: "hotmart", status: "active", access_until: PASSADO }]), AGORA);
  assert.equal(d.escrever && d.patch.plan, "free");
});

test("REGRA 20/08: canceled com data FUTURA mantém o acesso pago", () => {
  const d = decidirAcessoDoPerfil(ok([{ provider: "hotmart", status: "canceled", access_until: FUTURO }]), AGORA);
  assert.deepEqual(d, {
    escrever: true,
    patch: { plan: "pro", access_source: "hotmart", access_until: FUTURO },
  });
});

test("canceled com data NULL é 'acabou', não vitalício: free", () => {
  const d = decidirAcessoDoPerfil(ok([{ provider: "hotmart", status: "canceled", access_until: null }]), AGORA);
  assert.equal(d.escrever && d.patch.plan, "free");
});

test("canceled com data PASSADA: free", () => {
  const d = decidirAcessoDoPerfil(ok([{ provider: "hotmart", status: "canceled", access_until: PASSADO }]), AGORA);
  assert.equal(d.escrever && d.patch.plan, "free");
});

for (const status of ["refunded", "chargeback", "expired"]) {
  test(`${status} NUNCA dá acesso, nem com data futura (o dinheiro voltou ou não entrou)`, () => {
    const d = decidirAcessoDoPerfil(ok([{ provider: "hotmart", status, access_until: FUTURO }]), AGORA);
    assert.equal(d.escrever && d.patch.plan, "free");
    assert.equal(d.escrever && d.patch.access_source, null);
  });
}

test("entre vários, 'active' ganha de 'canceled' mesmo com data menor", () => {
  const d = decidirAcessoDoPerfil(
    ok([
      { provider: "mercadopago", status: "canceled", access_until: MAIS_LONGE },
      { provider: "hotmart", status: "active", access_until: FUTURO },
    ]),
    AGORA,
  );
  assert.equal(d.escrever && d.patch.access_source, "hotmart");
  assert.equal(d.escrever && d.patch.access_until, FUTURO);
});

test("empatados no status, ganha a data mais longe", () => {
  const d = decidirAcessoDoPerfil(
    ok([
      { provider: "hotmart", status: "active", access_until: FUTURO },
      { provider: "stripe", status: "active", access_until: MAIS_LONGE },
    ]),
    AGORA,
  );
  assert.equal(d.escrever && d.patch.access_source, "stripe");
  assert.equal(d.escrever && d.patch.access_until, MAIS_LONGE);
});

test("vitalício ganha de data marcada (NULL = infinito)", () => {
  const d = decidirAcessoDoPerfil(
    ok([
      { provider: "hotmart", status: "active", access_until: MAIS_LONGE },
      { provider: "stripe", status: "active", access_until: null },
    ]),
    AGORA,
  );
  assert.equal(d.escrever && d.patch.access_source, "stripe");
  assert.equal(d.escrever && d.patch.access_until, null);
});

test("entitlement morto no meio não estraga o vivo", () => {
  // O `refunded` com data futura é o caso do #138 ("acesso vivo ≠ pagou"): ele
  // não pode nem dar acesso nem encurtar o do entitlement bom.
  const d = decidirAcessoDoPerfil(
    ok([
      { provider: "hotmart", status: "refunded", access_until: MAIS_LONGE },
      { provider: "hotmart", status: "active", access_until: FUTURO },
    ]),
    AGORA,
  );
  assert.equal(d.escrever && d.patch.plan, "pro");
  assert.equal(d.escrever && d.patch.access_until, FUTURO);
});

test("a consulta recebida NÃO é mutada (sort não reordena a lista do caller)", () => {
  const linhas = [
    { provider: "hotmart", status: "canceled", access_until: MAIS_LONGE },
    { provider: "stripe", status: "active", access_until: FUTURO },
  ];
  decidirAcessoDoPerfil({ data: linhas, error: null }, AGORA);
  assert.equal(linhas[0].provider, "hotmart");
});
