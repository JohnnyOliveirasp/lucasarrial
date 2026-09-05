/**
 * A SEQUÊNCIA INTEIRA, evento por evento:
 *   PURCHASE_APPROVED → SUBSCRIPTION_CANCELLATION → PURCHASE_PROTEST → PURCHASE_COMPLETE
 *
 * Este arquivo existe porque os dois defeitos de 04/09 nasceram em fixes
 * SEPARADOS, e cada um, sozinho, deixava o caso real de pé:
 *
 *   - só "estorno zera crédito"  → o crédito zerava no protesto e o
 *     PURCHASE_COMPLETE do dia seguinte devolvia o ACESSO (e, com ele, a
 *     renovação futura). Metade do prejuízo continuava.
 *   - só "status terminal não rebaixa" → o acesso ficava barrado, mas o saldo
 *     seguia intacto na mão de quem contestou a cobrança.
 *
 * O caso medido (_frank/prova/2026-09-05_cancelamentos_de_2026-09-04.md):
 * duas pessoas, mesmo padrão, aderiram em 28/08, pagaram R$97 em 04/09,
 * cancelaram ~35 min depois, protestaram no mesmo dia — e em 05/09 um
 * PURCHASE_COMPLETE da MESMA compra devolveu o acesso até 28/09, com
 * 178.935 e 187.189 créditos ainda no saldo.
 *
 * ⚠️ ESCOPO — o que este teste prova e o que NÃO prova.
 * Ele roda as funções de decisão REAIS (mapRevokeStatus, isMoneyReturnedStatus,
 * resolveGrantStatus, resolveRevokeStatus) numa máquina de estados que ESPELHA
 * a ordem do route.ts. Ele NÃO executa Postgres: a idempotência por transação é
 * do banco (mig 108) e está modelada aqui, não provada aqui. Nenhum saldo real
 * é tocado. A prova de que o webhook realmente chama isto nesta ordem está na
 * seção "trava da fiação" no fim do arquivo, lendo o fonte.
 *
 * Rodar (Node ≥ 22.18, type-stripping nativo):
 *   node --test src/lib/payments/estorno-sequencia.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolveGrantStatus, resolveRevokeStatus } from "./entitlement-status.ts";
import { isMoneyReturnedStatus, mapRevokeStatus } from "./hotmart-payload.ts";
import type { EntitlementStatus } from "../db/types.ts";

// ── modelo do que o webhook faz, na ordem do route.ts ──────────────────────

type Estado = {
  status: EntitlementStatus | null;
  creditosSub: number;
  /** marcadores 'estorno:<refId>' já lançados — a trava de idempotência da mig 108 */
  lancamentos: Set<string>;
};

/** Um evento da Hotmart. `transacao` é a chave de idempotência do estorno. */
type Evento = { tipo: string; transacao: string; pago?: boolean };

function aplicar(estado: Estado, ev: Evento): Estado {
  const proximo: Estado = { ...estado, lancamentos: new Set(estado.lancamentos) };

  // 1) ramo de COMPRA (route.ts: PURCHASE_APPROVED | PURCHASE_COMPLETE)
  if (ev.tipo === "PURCHASE_APPROVED" || ev.tipo === "PURCHASE_COMPLETE") {
    // só o APPROVED é dinheiro NOVO; o COMPLETE é o eco da MESMA cobrança
    const newPayment = ev.tipo === "PURCHASE_APPROVED" && ev.pago === true;
    proximo.status = resolveGrantStatus(proximo.status, newPayment);
    // crédito só no APPROVED (trava dos 484 créditos em dobro, 10/08)
    if (ev.tipo === "PURCHASE_APPROVED" && proximo.status === "active") {
      proximo.creditosSub += 100_000;
    }
    return proximo;
  }

  // 2) ramo de REVOGAÇÃO
  const revokeStatus = mapRevokeStatus(ev.tipo);
  if (!revokeStatus) return proximo;

  proximo.status = resolveRevokeStatus(proximo.status, revokeStatus);

  // 3) zeragem — roda MESMO quando o status foi preservado (ver route.ts)
  if (isMoneyReturnedStatus(revokeStatus)) {
    const marcador = `estorno:${ev.transacao}`;
    if (!proximo.lancamentos.has(marcador)) {
      proximo.lancamentos.add(marcador);
      proximo.creditosSub = 0;
    }
  }
  return proximo;
}

const zerado = (): Estado => ({ status: null, creditosSub: 0, lancamentos: new Set() });

// ── O CASO REAL, passo a passo ─────────────────────────────────────────────

test("sequência do caso de 04/09: APPROVED → CANCELLATION → PROTEST → COMPLETE", () => {
  const TX = "HP-REC2-R97"; // a MESMA transação nos quatro eventos
  let e = zerado();

  // 04/09 14:07 — pagou R$97: libera e credita o ciclo
  e = aplicar(e, { tipo: "PURCHASE_APPROVED", transacao: TX, pago: true });
  assert.equal(e.status, "active");
  assert.equal(e.creditosSub, 100_000, "o pagamento credita o ciclo normalmente");

  // 04/09 14:43 — cancelou ~35 min depois. Quem PAGOU e cancela MANTÉM o saldo
  // (regra 9) e mantém o acesso até o fim do período — nada de estorno aqui.
  e = aplicar(e, { tipo: "SUBSCRIPTION_CANCELLATION", transacao: TX });
  assert.equal(e.status, "canceled");
  assert.equal(e.creditosSub, 100_000, "cancelar não zera crédito de quem pagou");

  // 04/09 19:40 — PROTESTOU a cobrança. Agora o dinheiro voltou:
  e = aplicar(e, { tipo: "PURCHASE_PROTEST", transacao: TX });
  assert.equal(e.status, "chargeback", "protesto marca o entitlement");
  assert.equal(e.creditosSub, 0, "DEFEITO (a): o protesto tem que zerar o crédito");

  // 05/09 08:08 — o PURCHASE_COMPLETE da MESMA compra. Era ele que devolvia
  // o acesso até 28/09.
  e = aplicar(e, { tipo: "PURCHASE_COMPLETE", transacao: TX });
  assert.equal(e.status, "chargeback", "DEFEITO (b): o COMPLETE não pode ressuscitar");
  assert.notEqual(e.status, "active");
  assert.equal(e.creditosSub, 0, "e não pode devolver crédito por tabela");
});

test("os dois defeitos são independentes: cada fix sozinho deixa metade do buraco", () => {
  const TX = "HP-REC2-R97";
  // Só o fix (a): o crédito zera, mas um COMPLETE tratado como dinheiro novo
  // reativaria o acesso. É o que `newPayment` impede.
  const soZeragem = resolveGrantStatus("chargeback", /* newPayment */ true);
  assert.equal(soZeragem, "active", "tratar COMPLETE como dinheiro novo reativa — por isso não é");

  // Só o fix (b): o acesso fica barrado, mas sem a zeragem o saldo sobrevive.
  let e: Estado = { status: "chargeback", creditosSub: 100_000, lancamentos: new Set() };
  const semZerar = { ...e, lancamentos: new Set([`estorno:${TX}`]) }; // marcador já lançado
  e = aplicar(semZerar, { tipo: "PURCHASE_PROTEST", transacao: TX });
  assert.equal(e.creditosSub, 100_000, "com o lançamento já feito, o saldo não é zerado de novo");
});

// ── A armadilha da INTEGRAÇÃO (o que este PR conserta além dos dois PRs) ───

test("REFUNDED depois de PROTEST: status preservado, mas transação NOVA ainda zera", () => {
  // chargeback (5) é mais forte que refunded (4): o status NÃO é reescrito.
  // Se a zeragem fosse pulada junto, um estorno de OUTRA transação passaria batido.
  let e: Estado = { status: "chargeback", creditosSub: 50_000, lancamentos: new Set() };

  e = aplicar(e, { tipo: "PURCHASE_REFUNDED", transacao: "HP-REC1-OUTRA" });
  assert.equal(e.status, "chargeback", "o status terminal mais forte fica de pé");
  assert.equal(e.creditosSub, 0, "mas o dinheiro devolvido de outra transação zera o saldo");
});

test("reentrega do MESMO evento é no-op (não lança duas vezes)", () => {
  const TX = "HP-REC2-R97";
  let e: Estado = { status: "active", creditosSub: 100_000, lancamentos: new Set() };

  e = aplicar(e, { tipo: "PURCHASE_PROTEST", transacao: TX });
  assert.equal(e.creditosSub, 0);
  assert.equal(e.lancamentos.size, 1);

  // a Hotmart reentrega o mesmo evento
  e = aplicar(e, { tipo: "PURCHASE_PROTEST", transacao: TX });
  assert.equal(e.lancamentos.size, 1, "o marcador da transação impede o segundo lançamento");
});

test("recompra DEPOIS do estorno volta a valer (terminal não é punição perpétua)", () => {
  let e: Estado = { status: "chargeback", creditosSub: 0, lancamentos: new Set(["estorno:TX1"]) };

  // dinheiro NOVO, transação nova: reativa e credita
  e = aplicar(e, { tipo: "PURCHASE_APPROVED", transacao: "TX2", pago: true });
  assert.equal(e.status, "active", "quem paga de novo tem que receber");
  assert.equal(e.creditosSub, 100_000);

  // e o reprocessamento do evento ANTIGO não apaga o crédito novo
  e = aplicar(e, { tipo: "PURCHASE_PROTEST", transacao: "TX1" });
  assert.equal(e.creditosSub, 100_000, "marcador de TX1 já existe → no-op");
});

test("quem só cancelou (sem estorno) mantém saldo e não vira terminal", () => {
  let e: Estado = { status: "active", creditosSub: 100_000, lancamentos: new Set() };
  e = aplicar(e, { tipo: "SUBSCRIPTION_CANCELLATION", transacao: "TX" });
  assert.equal(e.status, "canceled");
  assert.equal(e.creditosSub, 100_000);

  // e a renovação seguinte reativa normalmente (canceled não é terminal)
  e = aplicar(e, { tipo: "PURCHASE_APPROVED", transacao: "TX2", pago: true });
  assert.equal(e.status, "active");
});

// ── TRAVA DA FIAÇÃO: o modelo acima só vale se o route.ts for assim ────────
//
// Lendo o fonte, como o resto da casa faz — o defeito aqui não foi a decisão,
// foi o caminho de escrita que ignorava a decisão.

const routeSrc = readFileSync(
  new URL("../../app/api/v1/webhooks/hotmart/route.ts", import.meta.url),
  "utf8",
);

test("o webhook zera o crédito no ramo de revogação", () => {
  assert.ok(
    routeSrc.includes("isMoneyReturnedStatus(revokeStatus)"),
    "o route.ts precisa decidir a zeragem por isMoneyReturnedStatus",
  );
  assert.ok(
    routeSrc.includes("zeroSubscriptionCreditsOnRefund"),
    "e precisa efetivamente chamar a zeragem",
  );
});

test("a zeragem NÃO é pulada quando o status terminal é preservado", () => {
  const ramo = routeSrc.slice(
    routeSrc.indexOf("const revoke = await revokeAccess"),
    routeSrc.indexOf('return ok("ignored")'),
  );
  assert.ok(ramo.length > 0, "ramo de revogação não encontrado no route.ts");

  // Casamos com o USO (`revoke.terminalPreservado`), não com a palavra solta —
  // senão um comentário citando o termo já satisfaz a trava e ela vira enfeite.
  const zeragem = ramo.indexOf("isMoneyReturnedStatus(revokeStatus)");
  const terminal = ramo.indexOf("revoke.terminalPreservado");
  assert.ok(zeragem > 0, "a zeragem tem que estar dentro do ramo de revogação");
  assert.ok(terminal > 0, "o ramo tem que desviar por revoke.terminalPreservado");
  assert.ok(
    zeragem < terminal,
    "a zeragem precisa vir ANTES do desvio por terminalPreservado — senão um " +
      "return antecipado pula o crédito (a armadilha de juntar os dois fixes)",
  );

  // e não pode existir NENHUM return entre a revogação e a zeragem
  const antesDaZeragem = ramo.slice(0, zeragem);
  assert.equal(
    /\n\s*return\s/.test(antesDaZeragem),
    false,
    "nenhum return pode escapar do ramo antes de zerar o crédito",
  );
});

test("revokeAccess devolve o dono junto do status (senão o estorno não sabe de quem zerar)", () => {
  const entitlementsSrc = readFileSync(
    new URL("./entitlements.ts", import.meta.url),
    "utf8",
  );
  const tipo = entitlementsSrc.slice(
    entitlementsSrc.indexOf("export type RevokeResult"),
    entitlementsSrc.indexOf("export async function revokeAccess"),
  );
  for (const campo of ["found", "userId", "statusFinal", "terminalPreservado"]) {
    assert.ok(tipo.includes(campo), `RevokeResult precisa expor ${campo}`);
  }
});
