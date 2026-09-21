/**
 * Testes de `decidirCreditoDaAssinatura` — crédito mensal que era pulado
 * quando buyer_email ≠ e-mail da conta. Rodar:
 *   npx tsx --test src/lib/payments/credito-assinatura.test.ts
 *
 * OS CASOS SÃO REAIS, medidos no banco em 21/09/2026:
 *   - Marcio Fernandes: compra em cdmarciofernandes@hotmail.com, conta em
 *     cdmarciofernandes@gmail.com, trx HP1509025099, pagou 10/08. ZERO linha
 *     no ledger: o webhook não achou perfil pelo e-mail da compra e pulou o
 *     crédito, com o vínculo certo parado em entitlements.user_id.
 *   - Fernanda Franzolin: compra em fnfranzolin@hotmail.com, conta em
 *     ftfranzolin@gmail.com, trx HP0304698101, pagou 11/08. Mesmo buraco.
 * Os dois logaram UMA vez, viram a conta vazia e nunca mais voltaram.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { decidirCreditoDaAssinatura } from "./credito-assinatura.ts";

const MARCIO = "11111111-1111-4111-8111-111111111111"; // dono no entitlement
const ANA = "22222222-2222-4222-8222-222222222222"; // dono achado pelo e-mail
const SUB = "sub_9CX41"; // externalId = código do assinante (igual em toda renovação)

test("1. e-mail da compra tem perfil: ele é o dono e credita (comportamento de sempre)", () => {
  const d = decidirCreditoDaAssinatura({
    eventType: "PURCHASE_APPROVED",
    userIdDoEmail: ANA,
    userIdDoEntitlement: null,
    transactionId: "HP0000000001",
    externalId: SUB,
  });
  assert.equal(d.userId, ANA);
  assert.equal(d.creditar, true);
  assert.equal(d.avisarOrfa, false);
});

test("1b. e-mail resolve E entitlement tem dono: o e-mail manda (não troca titularidade)", () => {
  const d = decidirCreditoDaAssinatura({
    eventType: "PURCHASE_APPROVED",
    userIdDoEmail: ANA,
    userIdDoEntitlement: MARCIO,
    transactionId: "HP0000000002",
    externalId: SUB,
  });
  assert.equal(d.userId, ANA);
});

test("2. CASO MARCIO: e-mail não casa, entitlement tem dono → credita NELE e NÃO avisa órfã", () => {
  // HP1509025099, pago 10/08: buyer_email @hotmail sem perfil, conta @gmail
  // vinculada em entitlements.user_id. O ciclo TEM que ser creditado.
  const d = decidirCreditoDaAssinatura({
    eventType: "PURCHASE_APPROVED",
    userIdDoEmail: null,
    userIdDoEntitlement: MARCIO,
    transactionId: "HP1509025099",
    externalId: SUB,
  });
  assert.equal(d.userId, MARCIO);
  assert.equal(d.creditar, true);
  assert.equal(d.refId, "HP1509025099");
  // Era ESTE alarme falso que chegava: "compra paga SEM conta" pra cliente
  // com conta ativa, vinculada, com acesso até 21/10.
  assert.equal(d.avisarOrfa, false);
});

test("3. órfã de verdade: nem e-mail nem entitlement → NÃO credita e AVISA", () => {
  const d = decidirCreditoDaAssinatura({
    eventType: "PURCHASE_APPROVED",
    userIdDoEmail: null,
    userIdDoEntitlement: null,
    transactionId: "HP0000000003",
    externalId: SUB,
  });
  assert.equal(d.userId, null);
  assert.equal(d.creditar, false);
  assert.equal(d.avisarOrfa, true);
});

test("4. mesma transação duas vezes → mesma chave de dedupe (o RPC credita UMA vez)", () => {
  // A deduplicação mora no RPC grant_subscription_credits, que trava por
  // refId. O contrato deste módulo é: reentrega do MESMO evento produz o
  // MESMO refId (dedupe segura), e renovação produz refId DIFERENTE (setembro
  // não parece repetição de julho).
  const entrega = () =>
    decidirCreditoDaAssinatura({
      eventType: "PURCHASE_APPROVED",
      userIdDoEmail: null,
      userIdDoEntitlement: MARCIO,
      transactionId: "HP1509025099",
      externalId: SUB,
    });
  const a = entrega();
  const b = entrega(); // reenvio da Hotmart (manda até 5×)
  assert.equal(a.refId, b.refId);

  // simulação do contrato do RPC: segunda passada com o mesmo refId não lança
  const ledger = new Set<string>();
  for (const d of [a, b]) {
    if (d.creditar && !ledger.has(d.refId)) ledger.add(d.refId);
  }
  assert.equal(ledger.size, 1);

  // renovação (transação NOVA, MESMO externalId) tem que gerar chave nova
  const renovacao = decidirCreditoDaAssinatura({
    eventType: "PURCHASE_APPROVED",
    userIdDoEmail: null,
    userIdDoEntitlement: MARCIO,
    transactionId: "HP1509025100",
    externalId: SUB,
  });
  assert.notEqual(renovacao.refId, a.refId);
});

test("4b. a chave é a TRANSAÇÃO, nunca o externalId quando a transação existe", () => {
  // externalId = código do assinante, IGUAL em toda renovação. Como chave,
  // faria a cobrança de setembro parecer repetição da de julho.
  const d = decidirCreditoDaAssinatura({
    eventType: "PURCHASE_APPROVED",
    userIdDoEmail: null,
    userIdDoEntitlement: MARCIO,
    transactionId: "HP1509025099",
    externalId: SUB,
  });
  assert.equal(d.refId, "HP1509025099");
  assert.notEqual(d.refId, SUB);
  // sem transação no payload, o fallback continua sendo o externalId
  const semTrx = decidirCreditoDaAssinatura({
    eventType: "PURCHASE_APPROVED",
    userIdDoEmail: null,
    userIdDoEntitlement: MARCIO,
    transactionId: null,
    externalId: SUB,
  });
  assert.equal(semTrx.refId, SUB);
});

test("5. PURCHASE_COMPLETE não credita (só APPROVED), mas o dono continua conhecido", () => {
  // O COMPLETE chega ~7,8 dias depois da MESMA cobrança; creditar nos dois
  // dava 2 lotes por pagamento (484 medidas em dobro). O dono segue resolvido
  // porque o bônus de campanha e o NÃO-alarme de órfã dependem dele.
  const d = decidirCreditoDaAssinatura({
    eventType: "PURCHASE_COMPLETE",
    userIdDoEmail: null,
    userIdDoEntitlement: MARCIO,
    transactionId: "HP1509025099",
    externalId: SUB,
  });
  assert.equal(d.creditar, false);
  assert.equal(d.userId, MARCIO);
  assert.equal(d.avisarOrfa, false);
});

test("6. MUTAÇÃO: a regra VELHA (só e-mail) reprova no caso 2", () => {
  // Réplica exata do código antigo do webhook:
  //   const userId = await resolveUserIdByEmail(buyerEmail);
  //   if (userId) { credita } else { avisa órfã }
  // — o entitlement nem era consultado.
  const regraVelha = (userIdDoEmail: string | null) => ({
    userId: userIdDoEmail,
    creditar: userIdDoEmail !== null,
    avisarOrfa: userIdDoEmail === null,
  });

  const velha = regraVelha(null); // e-mail da compra sem perfil (caso Marcio)
  const nova = decidirCreditoDaAssinatura({
    eventType: "PURCHASE_APPROVED",
    userIdDoEmail: null,
    userIdDoEntitlement: MARCIO,
    transactionId: "HP1509025099",
    externalId: SUB,
  });

  // A velha PULA o crédito e DISPARA o alarme falso — exatamente o bug medido.
  assert.equal(velha.creditar, false);
  assert.equal(velha.avisarOrfa, true);
  // A nova faz o contrário nos dois pontos. Se alguém mutar o módulo de volta
  // pra ignorar o entitlement, este teste e o teste 2 quebram juntos.
  assert.equal(nova.creditar, true);
  assert.equal(nova.avisarOrfa, false);
  assert.notDeepEqual(
    { creditar: velha.creditar, avisarOrfa: velha.avisarOrfa },
    { creditar: nova.creditar, avisarOrfa: nova.avisarOrfa },
  );
});

test("string vazia do lookup é ausência, não dono (linha corrompida não vira titular)", () => {
  const d = decidirCreditoDaAssinatura({
    eventType: "PURCHASE_APPROVED",
    userIdDoEmail: "",
    userIdDoEntitlement: MARCIO,
    transactionId: "HP0000000004",
    externalId: SUB,
  });
  assert.equal(d.userId, MARCIO);
  const dd = decidirCreditoDaAssinatura({
    eventType: "PURCHASE_APPROVED",
    userIdDoEmail: "",
    userIdDoEntitlement: "",
    transactionId: "HP0000000005",
    externalId: SUB,
  });
  assert.equal(dd.userId, null);
  assert.equal(dd.avisarOrfa, true);
});
