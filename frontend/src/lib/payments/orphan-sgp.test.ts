/**
 * Testes do CAMINHO PRÓPRIO DO SGP no varredor de compra órfã.
 * Rodar (Node ≥ 22.18, type-stripping):
 *   node --test src/lib/payments/orphan-sgp.test.ts
 *
 * O QUE ESTES TESTES TRAVAM, e por quê:
 *
 *  1. Que o comprador do SGP PARE de ser descartado pelo filtro de produto
 *     (o defeito do card #312: 19 pagantes sem conta, invisíveis).
 *
 *  2. Que ele NÃO receba o convite do FastCloner. O texto daquele convite diz
 *     "seus créditos do FastCloner já estão reservados" e o comprador do curso
 *     NÃO tem crédito nenhum (regra comercial do Lucas, 31/08). Alargar o filtro
 *     de produto sem separar o texto trocaria um comprador invisível por uma
 *     promessa falsa — que é pior, porque gera pedido de reembolso.
 *
 *  3. Que o estorno cale o aviso. Esta guarda existe SÓ aqui: no caminho do
 *     FastCloner quem barra o estornado é o entitlement (#127), e o SGP não tem
 *     entitlement. Com garantia incondicional de 7 dias, é o produto com mais
 *     chance de estorno da casa.
 *
 *  4. Que o cruzamento com o `sgp_boas_vindas` impeça a repetição. Medido em
 *     08/09: 15 dos 19 órfãos JÁ tinham recebido o e-mail do webhook. Sem o
 *     cruzamento, o conserto deste card manda 15 e-mails repetidos no dia 1 —
 *     a mesma "leva dupla" de 06/09.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  decidirConviteSgp,
  produtoDaCompra,
  produtoQueMandaNoConvite,
  EVENTOS_QUE_DESFAZEM,
} from "./orphan-sgp.ts";

const FC = "7851642";
const SGP = "7283229";
const HORA = 60 * 60 * 1000;

/** O caso feliz: pagou, não estornou, ninguém falou com ele, compra madura. */
const BASE = {
  pagou: true,
  estornado: false,
  jaRecebeuBoasVindas: false,
  jaAvisadoPeloVarredor: false,
  idadeMs: 24 * HORA,
  carenciaMs: HORA,
};

// ── classificação por produto ────────────────────────────────────────────

test("o produto do SGP é RECONHECIDO, não descartado (o defeito do #312)", () => {
  assert.equal(
    produtoDaCompra({ productId: SGP, produtoFastcloner: FC, produtoSgp: SGP }),
    "sgp",
  );
});

test("o produto do FastCloner continua sendo o do FastCloner", () => {
  assert.equal(
    produtoDaCompra({ productId: FC, produtoFastcloner: FC, produtoSgp: SGP }),
    "fastcloner",
  );
});

test("produto de terceiro segue descartado", () => {
  assert.equal(
    produtoDaCompra({ productId: "9999999", produtoFastcloner: FC, produtoSgp: SGP }),
    "outro",
  );
});

test("id numérico do payload é aceito (a Hotmart manda number, não string)", () => {
  assert.equal(
    produtoDaCompra({ productId: String(7283229), produtoFastcloner: FC, produtoSgp: SGP }),
    "sgp",
  );
});

test("SEM id de produto o varredor NÃO adivinha: falha fechada", () => {
  // Diferente do webhook (que trata ausência como "nosso" pra não parar de
  // liberar acesso pago). Aqui o custo de errar é MANDAR E-MAIL ERRADO.
  for (const vazio of [null, undefined, "", "   "]) {
    assert.equal(
      produtoDaCompra({ productId: vazio, produtoFastcloner: FC, produtoSgp: SGP }),
      "outro",
    );
  }
});

test("engano de ambiente (mesmo id nos dois): o FastCloner ganha", () => {
  assert.equal(
    produtoDaCompra({ productId: FC, produtoFastcloner: FC, produtoSgp: FC }),
    "fastcloner",
  );
});

test("comprou os DOIS: o convite do FastCloner é que manda", () => {
  // Quem assinou a plataforma tem crédito esperando, e é disso que o convite
  // do FastCloner fala. O portal do SGP pra essa pessoa é problema do webhook.
  assert.equal(
    produtoQueMandaNoConvite({ comprouFastcloner: true, comprouSgp: true }),
    "fastcloner",
  );
  assert.equal(
    produtoQueMandaNoConvite({ comprouFastcloner: false, comprouSgp: true }),
    "sgp",
  );
  assert.equal(
    produtoQueMandaNoConvite({ comprouFastcloner: false, comprouSgp: false }),
    "outro",
  );
});

// ── as guardas do aviso do SGP ───────────────────────────────────────────

test("caso feliz: comprador do SGP pago, sem conta e nunca avisado RECEBE", () => {
  const d = decidirConviteSgp(BASE);
  assert.equal(d.manda, true);
  assert.equal(d.motivo, "manda");
});

test("não pagou de verdade (boleto impresso, Pix não pago): NÃO recebe", () => {
  const d = decidirConviteSgp({ ...BASE, pagou: false });
  assert.equal(d.manda, false);
  assert.equal(d.motivo, "nao_pagou");
});

test("ESTORNOU: não recebe 'envie suas fotos' (garantia de 7 dias do SGP)", () => {
  const d = decidirConviteSgp({ ...BASE, estornado: true });
  assert.equal(d.manda, false);
  assert.equal(d.motivo, "estornado");
});

test("o estorno cala MESMO tendo pago — pagar e estornar não se cancelam", () => {
  // O `pagou` continua true depois do estorno (o PURCHASE_APPROVED não some).
  // Se a ordem das guardas fosse outra, o pagamento venceria o estorno.
  const d = decidirConviteSgp({ ...BASE, pagou: true, estornado: true });
  assert.equal(d.motivo, "estornado");
});

test("JÁ recebeu o e-mail do webhook: NÃO recebe de novo (os 15 de 08/09)", () => {
  const d = decidirConviteSgp({ ...BASE, jaRecebeuBoasVindas: true });
  assert.equal(d.manda, false);
  assert.equal(d.motivo, "ja_recebeu_boas_vindas");
});

test("já avisado pelo próprio varredor: silêncio (dedupe do SGP é PARA SEMPRE)", () => {
  // Ao contrário do FastCloner, onde o dedupe eterno calava assinante cobrado
  // todo mês: o SGP é compra avulsa, não há cobrança nova pra reabrir ciclo.
  const d = decidirConviteSgp({ ...BASE, jaAvisadoPeloVarredor: true });
  assert.equal(d.manda, false);
  assert.equal(d.motivo, "ja_avisado_pelo_varredor");
});

test("compra recente demais: espera a carência (o webhook fala primeiro)", () => {
  const d = decidirConviteSgp({ ...BASE, idadeMs: 10 * 60 * 1000, carenciaMs: HORA });
  assert.equal(d.manda, false);
  assert.equal(d.motivo, "recente_demais");
});

test("exatamente na carência já passa (fronteira: >=, não >)", () => {
  assert.equal(decidirConviteSgp({ ...BASE, idadeMs: HORA, carenciaMs: HORA }).manda, true);
  assert.equal(
    decidirConviteSgp({ ...BASE, idadeMs: HORA - 1, carenciaMs: HORA }).manda,
    false,
  );
});

test("a ordem das guardas é do mais grave pro mais brando", () => {
  // Com tudo errado ao mesmo tempo, o motivo registrado é o mais informativo.
  const d = decidirConviteSgp({
    ...BASE,
    pagou: false,
    estornado: true,
    jaRecebeuBoasVindas: true,
    jaAvisadoPeloVarredor: true,
    idadeMs: 0,
  });
  assert.equal(d.motivo, "nao_pagou");
});

test("NENHUMA guarda sozinha é suficiente: cada uma barra por si", () => {
  const quebras = [
    { pagou: false },
    { estornado: true },
    { jaRecebeuBoasVindas: true },
    { jaAvisadoPeloVarredor: true },
    { idadeMs: 0 },
  ];
  for (const q of quebras) {
    assert.equal(decidirConviteSgp({ ...BASE, ...q }).manda, false, JSON.stringify(q));
  }
});

test("os eventos que desfazem a compra incluem estorno E chargeback", () => {
  // Se alguém encurtar esta lista, o aviso volta a sair pra quem pediu o
  // dinheiro de volta. `PURCHASE_CANCELED`/`EXPIRED` entram pelo lado seguro:
  // sem entitlement, não há nada pra dizer o contrário.
  for (const e of ["PURCHASE_REFUNDED", "PURCHASE_CHARGEBACK", "PURCHASE_PROTEST"]) {
    assert.ok(
      (EVENTOS_QUE_DESFAZEM as readonly string[]).includes(e),
      `${e} tem que calar o aviso do SGP`,
    );
  }
});
