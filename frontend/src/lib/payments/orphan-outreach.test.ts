/**
 * Testes da guarda do CONVITE DE COMPRA ÓRFÃ. Rodar (Node ≥ 22.18, type-stripping):
 *   node --test src/lib/payments/orphan-outreach.test.ts
 *
 * A guarda já regrediu DUAS vezes em direções opostas, e quase uma terceira:
 *   - #57  (72a4c9db): `hasAccount` lia só 1000 perfis → "crie sua conta" foi
 *     pra 105 clientes ATIVOS. Falso POSITIVO.
 *   - #127 (beef6f02): compra aprovada uma vez entrava na lista pra sempre →
 *     quem estornou recebia "seus créditos continuam reservados". Corrigido com
 *     `status === "active"`, que passou do ponto e virou falso NEGATIVO:
 *     `canceled` DENTRO da janela já paga tem acesso, pela regra do próprio
 *     gate ("quem pagou fica até o fim do período", 20/08).
 *   - 08/09: a correção do falso negativo, escrita só com `entitlementValeAcesso`,
 *     ia convidar 7 pessoas que NUNCA pagaram — trial de R$ 0 cancelado e boleto
 *     `BILLET_PRINTED`/`DELAYED`. `access_until` no futuro num trial cancelado é
 *     a armadilha "acesso vivo ≠ pagou" (#138). Pego na bancada, antes de subir.
 *
 * Por isso a decisão tem DUAS condições e as duas estão travadas aqui: acesso
 * vivo (régua única do gate) E dinheiro que entrou de verdade (valor > 0 E
 * status de pagamento — a régua do `pagou_de_verdade.cjs`).
 *
 * Conferido contra a Hotmart viva nos 13 órfãos de 08/09: 13/13.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  compradorMereceConvite,
  entitlementDaPlataforma,
  entitlementValeAcesso,
  eventoEhPagamento,
  produtosDeCurso,
} from "./acesso-regra.ts";

const AGORA = "2026-09-08T12:00:00.000Z";
const FUTURO = "2026-09-21T00:00:00.000Z";
const PASSADO = "2026-09-05T00:00:00.000Z";
const PAGOU = true;
const NAO_PAGOU = false;

// ── condição 1: acesso vivo ────────────────────────────────────────────────

test("active com data futura, pagante, é convidado", () => {
  assert.equal(compradorMereceConvite({ status: "active", access_until: FUTURO }, PAGOU, AGORA), true);
});

test("active vitalício (access_until NULL), pagante, é convidado", () => {
  assert.equal(compradorMereceConvite({ status: "active", access_until: null }, PAGOU, AGORA), true);
});

test("REGRESSÃO #127-invertido: canceled DENTRO da janela paga é convidado", () => {
  // O caso herysilva.27: assinatura cancelada, mas paga até 21/09 e sem conta.
  assert.equal(compradorMereceConvite({ status: "canceled", access_until: FUTURO }, PAGOU, AGORA), true);
});

test("canceled com a janela paga já vencida NÃO é convidado", () => {
  assert.equal(compradorMereceConvite({ status: "canceled", access_until: PASSADO }, PAGOU, AGORA), false);
});

test("canceled sem data NÃO é convidado (NULL aqui é 'acabou', não 'vitalício')", () => {
  assert.equal(compradorMereceConvite({ status: "canceled", access_until: null }, PAGOU, AGORA), false);
});

test("#127 continua barrado: refunded nunca é convidado, mesmo com data futura", () => {
  assert.equal(compradorMereceConvite({ status: "refunded", access_until: FUTURO }, PAGOU, AGORA), false);
});

test("#127 continua barrado: chargeback nunca é convidado, mesmo com data futura", () => {
  assert.equal(compradorMereceConvite({ status: "chargeback", access_until: FUTURO }, PAGOU, AGORA), false);
});

test("comprador sem entitlement nenhum não é convidado", () => {
  assert.equal(compradorMereceConvite(null, PAGOU, AGORA), false);
});

test("status desconhecido é tratado como SEM acesso (falha fechada)", () => {
  assert.equal(compradorMereceConvite({ status: "seja_la_o_que_for", access_until: FUTURO }, PAGOU, AGORA), false);
});

// ── condição 2: pagou de verdade ───────────────────────────────────────────

test("O ERRO DE 08/09: trial de R$ 0 cancelado dentro da janela NÃO é convidado", () => {
  // gestao10.jessica / paolamellomkt / sidney: canceled, access_until futuro,
  // e R$ 0,00 na Hotmart. A condição 1 sozinha diria "convide".
  assert.equal(
    compradorMereceConvite({ status: "canceled", access_until: FUTURO }, PAGOU, AGORA),
    true,
    "sanidade: com pagamento, este mesmo caso é convidado",
  );
  assert.equal(compradorMereceConvite({ status: "canceled", access_until: FUTURO }, NAO_PAGOU, AGORA), false);
});

test("nem mesmo assinatura ACTIVE convida quem nunca pagou", () => {
  assert.equal(compradorMereceConvite({ status: "active", access_until: FUTURO }, NAO_PAGOU, AGORA), false);
});

test("dinheiro que entrou: valor > 0 E status de pagamento", () => {
  assert.equal(eventoEhPagamento({ valor: 97, status: "APPROVED" }), true);
  assert.equal(eventoEhPagamento({ valor: "97", status: "COMPLETE" }), true);
  assert.equal(eventoEhPagamento({ valor: 22, status: "COMPLETED" }), true);
});

test("A ARMADILHA DE 18/08: valor sem status NÃO é pagamento", () => {
  // A Hotmart emite a mensalidade de R$ 97 em OVERDUE pra quem nunca pagou.
  // Ler só o valor devolveu 1.356.554 créditos a 14 pessoas que não pagaram.
  assert.equal(eventoEhPagamento({ valor: 97, status: "OVERDUE" }), false);
  assert.equal(eventoEhPagamento({ valor: 97, status: "DELAYED" }), false);
  assert.equal(eventoEhPagamento({ valor: 97, status: "BILLET_PRINTED" }), false);
});

test("trial: valor 0 nunca é pagamento, mesmo APPROVED", () => {
  assert.equal(eventoEhPagamento({ valor: 0, status: "APPROVED" }), false);
  assert.equal(eventoEhPagamento({ valor: "0", status: "COMPLETE" }), false);
});

test("valor ausente/ilegível não vira pagamento por engano", () => {
  assert.equal(eventoEhPagamento({ valor: null, status: "APPROVED" }), false);
  assert.equal(eventoEhPagamento({ valor: undefined, status: "APPROVED" }), false);
  assert.equal(eventoEhPagamento({ valor: "abc", status: "APPROVED" }), false);
  assert.equal(eventoEhPagamento({ valor: -97, status: "APPROVED" }), false);
});

test("status vem em caixa alta ou baixa e decide igual", () => {
  assert.equal(eventoEhPagamento({ valor: 97, status: "approved" }), true);
  assert.equal(eventoEhPagamento({ valor: 97, status: null }), false);
});

// ── a extração da regra do gate não pode ter mudado nada ───────────────────

test("a condição de ACESSO do convite é a MESMA do gate, caso a caso", () => {
  const casos: Array<{ status: string; access_until: string | null }> = [
    { status: "active", access_until: null },
    { status: "active", access_until: FUTURO },
    { status: "active", access_until: PASSADO },
    { status: "canceled", access_until: null },
    { status: "canceled", access_until: FUTURO },
    { status: "canceled", access_until: PASSADO },
    { status: "refunded", access_until: FUTURO },
    { status: "chargeback", access_until: FUTURO },
    { status: "expired", access_until: FUTURO },
  ];
  for (const c of casos) {
    assert.equal(
      compradorMereceConvite(c, PAGOU, AGORA),
      entitlementValeAcesso(c, AGORA),
      `divergiu em ${c.status}/${c.access_until}`,
    );
  }
});

test("o gate NÃO mudou na extração: active com data vencida continua sem acesso", () => {
  assert.equal(entitlementValeAcesso({ status: "active", access_until: PASSADO }, AGORA), false);
});

// ── condição 3: quem DECIDE o convite tem que ser linha de PLATAFORMA ──────
//
// #312, 15/09. O sweeper montava `ultimoEnt` pegando a linha de maior
// updated_at do e-mail, SEM olhar `product_code`, e entregava essa linha pro
// `compradorMereceConvite` — que só sabe perguntar "vale acesso?". Quem comprou
// só o curso em 09/06 tem vitalício de CURSO (active, access_until NULL), que é
// a linha mais nova que existe pra ele: ela ganharia a disputa e o convite
// sairia. Desde o #313 a conta criada não adota entitlement de curso, então o
// convite prometeria crédito reservado e entregaria nada.
//
// Os 4 casos reais de 09/06 estão travados aqui com produto e tudo.

test("vitalício de CURSO não pode ser a linha que decide o convite", () => {
  const cursos = produtosDeCurso({});
  // A linha existe e "vale acesso" pela régua pura — é justamente por isso que
  // a filtragem por produto precisa vir ANTES, e não depois.
  const vitalicioDeCurso = { status: "active", access_until: null };
  assert.equal(entitlementValeAcesso(vitalicioDeCurso, AGORA), true);
  assert.equal(compradorMereceConvite(vitalicioDeCurso, PAGOU, AGORA), true);
  // ...e é por isso que ela nunca pode chegar lá: não é da plataforma.
  for (const produtoDeCurso of ["7283229", "7283335"]) {
    assert.equal(
      entitlementDaPlataforma(produtoDeCurso, cursos),
      false,
      `${produtoDeCurso} não é curso — o sweeper voltaria a convidar comprador de curso`,
    );
  }
});

test("linha da plataforma continua decidindo normalmente", () => {
  const cursos = produtosDeCurso({});
  assert.equal(entitlementDaPlataforma("7851642", cursos), true);
});

test("product_code ausente NÃO é lido como curso (pagante antigo não perde o convite)", () => {
  const cursos = produtosDeCurso({});
  // Ausência de informação não é a informação "é curso" — mesma guarda do #222.
  assert.equal(entitlementDaPlataforma(null, cursos), true);
  assert.equal(entitlementDaPlataforma("", cursos), true);
  assert.equal(entitlementDaPlataforma("   ", cursos), true);
});

test("SGP vindo do ambiente também é curso pro sweeper", () => {
  // O sweeper chama produtosDeCurso() sem argumento (lê process.env), a mesma
  // lista do conserto e do detector. Um SGP novo em ambiente não pode ficar de
  // fora só aqui: era assim que o conserto pulava a órfã por ser curso
  // enquanto o detector a contava como plataforma.
  const cursos = produtosDeCurso({ HOTMART_SGP_PRODUCT_ID: "9999999" });
  assert.equal(entitlementDaPlataforma("9999999", cursos), false);
  assert.equal(entitlementDaPlataforma("7283229", cursos), false);
  assert.equal(entitlementDaPlataforma("7851642", cursos), true);
});
