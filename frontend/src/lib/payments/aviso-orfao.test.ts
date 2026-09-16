/**
 * Testes do aviso de COMPRA ÓRFÃ — incidente #239 (Tiago, 02/09/2026). Rodar
 * (Node ≥ 22.18, type-stripping nativo):
 *   node --test src/lib/payments/aviso-orfao.test.ts
 *
 * O CASO É REAL, medido no banco em 03/09/2026:
 *   - assinatura `PMB7RT7F`, comprada em 02/09 22:37 com `cachico3@hotmail.com`;
 *   - a conta do Tiago no app é `cachico1988123@gmail.com` (perfil de 30/08);
 *   - `entitlements.user_id` nasceu NULL, `payment_events` gravou
 *     PURCHASE_APPROVED com `processed_at` preenchido e `error` NULL;
 *   - resultado: 1h45 pagando e travado, e NINGUÉM foi avisado — quem viu foi
 *     a Carol no WhatsApp, por acaso.
 *
 * O aviso já existia (`alertOrphanPurchase`) e nunca produziu um e-mail: 665
 * mensagens varridas na conta do Resend (05/08 → 02/09) contra ~46 aprovações
 * órfãs no mesmo período = ZERO avisos. Ele falhava calado porque o retorno do
 * `sendEmail` era descartado dentro de um `catch {}` vazio.
 *
 * Por isso os dois testes que o card exige — aviso dispara, e o SEGUNDO evento
 * do mesmo entitlement não avisa de novo — rodam contra o fluxo inteiro com
 * canais falsos, e não contra pedaços soltos.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  avisarCompraOrfa,
  chaveDoAviso,
  deveAvisar,
  montarAviso,
  type CanaisAviso,
  type CompraOrfa,
  type EstadoAvisos,
  type EstadoAvisosIO,
} from "./aviso-orfao.ts";
import {
  extractBuyerName,
  extractProductName,
  extractPurchaseValue,
  extractTransactionId,
} from "./hotmart-payload.ts";

const NOSSO_PRODUTO = "7851642";
const AGORA = "2026-09-02T22:37:30.000Z";

/** Payload real do evento do Tiago (campos que o aviso usa). */
const PAYLOAD_TIAGO = {
  product: { id: 7851642, name: "FastCloner" },
  buyer: { email: "cachico3@hotmail.com", name: "Tiago Chico" },
  purchase: { transaction: "HP2742616487", status: "APPROVED", price: { value: 97 } },
  subscription: { subscriber: { code: "PMB7RT7F" } },
} as Record<string, unknown>;

const TIAGO: CompraOrfa = {
  eventType: "PURCHASE_APPROVED",
  buyerEmail: "cachico3@hotmail.com",
  buyerName: "Tiago Chico",
  productCode: "7851642",
  productName: "FastCloner",
  transaction: "HP2742616487",
  externalId: "PMB7RT7F",
  // o Tiago PAGOU: R$ 97 aprovados. É isso que o separa dos 10 trials de
  // R$ 0 que entupiam a fila de 09/09 (ver cabeçalho de `aviso-orfao.ts`).
  valorCompra: 97,
  statusCompra: "APPROVED",
};

/** Argumentos de `deveAvisar` com pagamento REAL — o que varia é o resto. */
const PAGO = { valorCompra: 97, statusCompra: "APPROVED" };

/** Canais falsos: guardam o que receberam e dizem se aceitaram. */
function canaisFalsos(aceita: { telegram: boolean; email: boolean }) {
  const visto = {
    duraveis: [] as Array<{ chave: string; texto: string }>,
    telegram: [] as string[],
    email: [] as Array<{ assunto: string; html: string }>,
  };
  const canais: CanaisAviso = {
    registrar: async (chave, aviso) => {
      visto.duraveis.push({ chave, texto: aviso.texto });
    },
    telegram: async (texto) => {
      visto.telegram.push(texto);
      return aceita.telegram;
    },
    email: async (assunto, html) => {
      visto.email.push({ assunto, html });
      return aceita.email;
    },
  };
  return { canais, visto };
}

function estadoNaMemoria(inicial: EstadoAvisos = {}) {
  let atual: EstadoAvisos = { ...inicial };
  const io: EstadoAvisosIO = {
    ler: async () => ({ ...atual }),
    gravar: async (e) => {
      atual = { ...e };
    },
  };
  return { io, ver: () => atual };
}

// ── 1. o aviso dispara na aprovação sem conta ───────────────────────────────

test("aprovação sem conta: avisa, e o aviso vai por TODOS os canais", async () => {
  const { canais, visto } = canaisFalsos({ telegram: true, email: true });
  const { io, ver } = estadoNaMemoria();

  const r = await avisarCompraOrfa(TIAGO, NOSSO_PRODUTO, io, canais, AGORA);

  assert.equal(r.avisou, true);
  assert.equal(r.motivo, "enviado");
  assert.deepEqual(r.canais, ["telegram", "email"]);
  assert.equal(visto.telegram.length, 1);
  assert.equal(visto.email.length, 1);
  // durável ANTES dos canais voláteis: é a garantia que faltou no #239
  assert.equal(visto.duraveis.length, 1);
  assert.equal(visto.duraveis[0].chave, "PMB7RT7F");
  assert.deepEqual(ver()["PMB7RT7F"], {
    at: AGORA,
    buyerEmail: "cachico3@hotmail.com",
    canais: ["telegram", "email"],
    // desde 16/09 (#305): a transação tentada fica registrada, pra que um aviso
    // que não chegue a ninguém possa ser retentado sem virar rajada
    tentativas: ["HP2742616487"],
  });
});

test("o aviso entrega os 5 dados que a ação exige (nada de 'compra órfã' e nada mais)", () => {
  const { assunto, texto } = montarAviso(TIAGO);
  assert.match(assunto, /cachico3@hotmail\.com/);
  for (const dado of ["cachico3@hotmail.com", "Tiago Chico", "FastCloner", "HP2742616487", "PMB7RT7F"]) {
    assert.ok(texto.includes(dado), `faltou "${dado}" no texto do aviso`);
  }
  // regra de 01/09: "O QUE FAZER" (pra quem atende) antes dos dados brutos
  assert.ok(texto.indexOf("O QUE FAZER") < texto.indexOf("DADOS"));
});

test("campo faltando no payload vira travessão, não quebra nem inventa", () => {
  const { texto } = montarAviso({ ...TIAGO, buyerName: null, transaction: null, productName: "" });
  assert.ok(texto.includes("Comprador: —"));
  assert.ok(texto.includes("Transação: —"));
});

// ── 2. o SEGUNDO evento do mesmo entitlement não avisa de novo ──────────────

test("renovação/reprocessamento do MESMO entitlement não avisa de novo", async () => {
  const { canais, visto } = canaisFalsos({ telegram: true, email: true });
  const { io, ver } = estadoNaMemoria();

  const primeiro = await avisarCompraOrfa(TIAGO, NOSSO_PRODUTO, io, canais, AGORA);
  // mesmo assinante, cobrança do mês seguinte (transação nova, external_id igual)
  const segundo = await avisarCompraOrfa(
    { ...TIAGO, transaction: "HP9999999999" },
    NOSSO_PRODUTO,
    io,
    canais,
    "2026-10-02T22:37:30.000Z",
  );
  // e o PURCHASE_COMPLETE que a Hotmart manda ~7,8 dias depois
  const terceiro = await avisarCompraOrfa(
    { ...TIAGO, eventType: "PURCHASE_COMPLETE" },
    NOSSO_PRODUTO,
    io,
    canais,
    "2026-09-10T12:00:00.000Z",
  );

  assert.equal(primeiro.avisou, true);
  assert.equal(segundo.avisou, false);
  assert.equal(segundo.motivo, "ja_avisado");
  assert.equal(terceiro.avisou, false);
  assert.equal(terceiro.motivo, "ja_avisado");
  // UM aviso em três eventos, em todos os canais
  assert.equal(visto.telegram.length, 1);
  assert.equal(visto.email.length, 1);
  assert.equal(visto.duraveis.length, 1);
  assert.equal(ver()["PMB7RT7F"].at, AGORA); // não regravou por cima
});

// ── 3. ruído: curso e evento que não libera acesso ──────────────────────────

test("compra de CURSO não avisa (FCI/SGP não dão acesso ao FastCloner)", async () => {
  const { canais, visto } = canaisFalsos({ telegram: true, email: true });
  const { io } = estadoNaMemoria();
  const curso: CompraOrfa = { ...TIAGO, productCode: "1234567", productName: "Sistema de Geração Pronto" };

  const r = await avisarCompraOrfa(curso, NOSSO_PRODUTO, io, canais, AGORA);

  assert.equal(r.avisou, false);
  assert.equal(r.motivo, "produto_de_fora");
  assert.equal(visto.telegram.length, 0);
  assert.equal(visto.email.length, 0);
});

test("evento que não libera acesso não avisa", () => {
  for (const evento of ["SUBSCRIPTION_CANCELLATION", "PURCHASE_REFUNDED", "PURCHASE_BILLET_PRINTED"]) {
    const d = deveAvisar({ eventType: evento, productCode: NOSSO_PRODUTO, nossoProduto: NOSSO_PRODUTO, buyerEmail: "a@b.com", ...PAGO });
    assert.equal(d.ok, false, `${evento} não deveria avisar`);
  }
  assert.equal(
    deveAvisar({ eventType: "PURCHASE_COMPLETE", productCode: NOSSO_PRODUTO, nossoProduto: NOSSO_PRODUTO, buyerEmail: "a@b.com", ...PAGO }).ok,
    true,
  );
});

test("produto ausente no payload não avisa quando sabemos qual é o nosso", () => {
  const d = deveAvisar({ eventType: "PURCHASE_APPROVED", productCode: null, nossoProduto: NOSSO_PRODUTO, buyerEmail: "a@b.com", ...PAGO });
  assert.equal(d.ok, false);
});

// ── 3b. NÃO ENTROU DINHEIRO: o que 62,5% da fila de 09/09 era de verdade ────

test("trial de R$ 0 APROVADO não avisa — motivo 'sem_pagamento' (10 dos 16 da fila de 09/09)", async () => {
  const { canais, visto } = canaisFalsos({ telegram: true, email: true });
  const { io, ver } = estadoNaMemoria();
  const trial: CompraOrfa = { ...TIAGO, valorCompra: 0, statusCompra: "APPROVED" };

  const r = await avisarCompraOrfa(trial, NOSSO_PRODUTO, io, canais, AGORA);

  assert.equal(r.avisou, false);
  assert.equal(r.motivo, "sem_pagamento");
  // nem canal volátil nem DURÁVEL: trial de R$ 0 não entra na fila de recados
  assert.equal(visto.telegram.length, 0);
  assert.equal(visto.email.length, 0);
  assert.equal(visto.duraveis.length, 0);
  assert.deepEqual(ver(), {});
  // e a decisão pura diz a mesma coisa
  assert.deepEqual(
    deveAvisar({
      eventType: "PURCHASE_APPROVED",
      productCode: NOSSO_PRODUTO,
      nossoProduto: NOSSO_PRODUTO,
      buyerEmail: "a@b.com",
      valorCompra: 0,
      statusCompra: "APPROVED",
    }),
    { ok: false, motivo: "sem_pagamento" },
  );
});

test("R$ 97 em OVERDUE não avisa: a Hotmart emite a mensalidade de quem NUNCA pagou", () => {
  const d = deveAvisar({
    eventType: "PURCHASE_APPROVED",
    productCode: NOSSO_PRODUTO,
    nossoProduto: NOSSO_PRODUTO,
    buyerEmail: "a@b.com",
    valorCompra: 97,
    statusCompra: "OVERDUE",
  });
  assert.deepEqual(d, { ok: false, motivo: "sem_pagamento" });
  // valor sozinho NÃO é pagamento (18/08: 1.356.554 créditos devolvidos assim)
  assert.equal(
    deveAvisar({
      eventType: "PURCHASE_APPROVED",
      productCode: NOSSO_PRODUTO,
      nossoProduto: NOSSO_PRODUTO,
      buyerEmail: "a@b.com",
      valorCompra: 97,
      statusCompra: null,
    }).ok,
    false,
  );
});

test("R$ 97 APROVADO avisa normalmente — a trava nova não cala o pagante", () => {
  const d = deveAvisar({
    eventType: "PURCHASE_APPROVED",
    productCode: NOSSO_PRODUTO,
    nossoProduto: NOSSO_PRODUTO,
    buyerEmail: "a@b.com",
    valorCompra: 97,
    statusCompra: "APPROVED",
  });
  assert.equal(d.ok, true);
  // e valor que chega como STRING no payload (a Hotmart mistura) também vale
  assert.equal(
    deveAvisar({
      eventType: "PURCHASE_COMPLETE",
      productCode: NOSSO_PRODUTO,
      nossoProduto: NOSSO_PRODUTO,
      buyerEmail: "a@b.com",
      valorCompra: "97.00",
      statusCompra: "complete",
    }).ok,
    true,
  );
});

test("extractPurchaseValue lê o preço do payload real e não inventa zero", () => {
  assert.equal(extractPurchaseValue(PAYLOAD_TIAGO), 97);
  assert.equal(extractPurchaseValue({ purchase: { price: { value: 0 } } }), 0);
  assert.equal(extractPurchaseValue({ purchase: { price: { value: "97.00" } } }), 97);
  // ausência é null (desconhecido), NUNCA 0 — quem decide é eventoEhPagamento
  assert.equal(extractPurchaseValue({}), null);
  assert.equal(extractPurchaseValue({ purchase: {} }), null);
  assert.equal(extractPurchaseValue({ purchase: { price: { value: "grátis" } } }), null);
});

// ── 4. o silêncio deixa de ser invisível ────────────────────────────────────

test("nenhum canal aceitou: avisou=true com canais VAZIO (é isso que o webhook registra)", async () => {
  const { canais } = canaisFalsos({ telegram: false, email: false });
  const { io, ver } = estadoNaMemoria();

  const r = await avisarCompraOrfa(TIAGO, NOSSO_PRODUTO, io, canais, AGORA);

  assert.equal(r.avisou, true);
  assert.deepEqual(r.canais, []); // <- o #239 inteiro: agora isso é VISÍVEL
  assert.deepEqual(ver()["PMB7RT7F"].canais, []);
});

test("Telegram fora do ar: o e-mail ainda entrega e o estado diz qual canal foi", async () => {
  const { canais } = canaisFalsos({ telegram: false, email: true });
  const { io } = estadoNaMemoria();
  const r = await avisarCompraOrfa(TIAGO, NOSSO_PRODUTO, io, canais, AGORA);
  assert.deepEqual(r.canais, ["email"]);
});

// ── 4-B. aviso que não chegou a NINGUÉM não pode silenciar o assinante ──────
// Incidente #305 / 54c14038, medido em 16/09: 3 dos 19 registros vivos em
// `orphan_alerts` estavam com `canais: []`, e um deles era PAGANTE órfão com a
// assinatura renovando. Antes desta regra, nenhuma cobrança seguinte reabria o
// caso — o webhook ficava mudo para sempre.

test("ninguém recebeu: a PRÓXIMA cobrança tenta de novo (não silencia pra sempre)", async () => {
  const mudos = canaisFalsos({ telegram: false, email: false });
  const { io, ver } = estadoNaMemoria();

  const primeiro = await avisarCompraOrfa(TIAGO, NOSSO_PRODUTO, io, mudos.canais, AGORA);
  assert.deepEqual(primeiro.canais, []);
  assert.deepEqual(ver()["PMB7RT7F"].tentativas, ["HP2742616487"]);

  // a renovação do mês seguinte: MESMA assinatura, transação NOVA
  const renovacao: CompraOrfa = { ...TIAGO, transaction: "HP9999999999" };
  const vivos = canaisFalsos({ telegram: true, email: true });
  const segundo = await avisarCompraOrfa(renovacao, NOSSO_PRODUTO, io, vivos.canais, AGORA);

  assert.equal(segundo.avisou, true, "a cobrança nova tem direito a uma tentativa nova");
  assert.equal(segundo.motivo, "enviado");
  assert.deepEqual(segundo.canais, ["telegram", "email"]);
  // e o durável é reescrito — era ele que faltava nos 12 casos sem recado
  assert.equal(vivos.visto.duraveis.length, 1);
  assert.deepEqual(ver()["PMB7RT7F"].tentativas, ["HP2742616487", "HP9999999999"]);
});

test("ninguém recebeu, mas é o MESMO evento reenviado pela Hotmart: não vira rajada", async () => {
  const { canais, visto } = canaisFalsos({ telegram: false, email: false });
  const { io } = estadoNaMemoria();

  await avisarCompraOrfa(TIAGO, NOSSO_PRODUTO, io, canais, AGORA);
  const reenvio = await avisarCompraOrfa(TIAGO, NOSSO_PRODUTO, io, canais, AGORA);

  assert.equal(reenvio.avisou, false);
  assert.equal(reenvio.motivo, "ja_avisado");
  assert.equal(visto.telegram.length, 1, "o mesmo evento não dispara duas vezes");
});

test("alguém RECEBEU: a renovação seguinte continua muda (uma vez por entitlement)", async () => {
  const { canais, visto } = canaisFalsos({ telegram: true, email: true });
  const { io } = estadoNaMemoria();

  await avisarCompraOrfa(TIAGO, NOSSO_PRODUTO, io, canais, AGORA);
  const renovacao: CompraOrfa = { ...TIAGO, transaction: "HP9999999999" };
  const segundo = await avisarCompraOrfa(renovacao, NOSSO_PRODUTO, io, canais, AGORA);

  assert.equal(segundo.motivo, "ja_avisado");
  assert.equal(visto.telegram.length, 1, "aviso entregue não se repete a cada ciclo");
});

test("registro ANTIGO (sem `tentativas`) com canais vazio: a cobrança nova reabre", async () => {
  // Formato exato do que está gravado em produção hoje para GGMWWE5Q —
  // gravado antes de 16/09, portanto sem o campo `tentativas`.
  const { io } = estadoNaMemoria({
    PMB7RT7F: { at: "2026-09-03T09:09:19.035Z", buyerEmail: "cachico3@hotmail.com", canais: [] },
  });
  const { canais } = canaisFalsos({ telegram: true, email: true });

  const r = await avisarCompraOrfa(TIAGO, NOSSO_PRODUTO, io, canais, AGORA);

  assert.equal(r.avisou, true, "estado legado não pode enterrar o pagante órfão");
  assert.deepEqual(r.canais, ["telegram", "email"]);
});

test("sem número de transação e ninguém recebeu: mantém o silêncio (não dá pra frear rajada)", async () => {
  const semTransacao: CompraOrfa = { ...TIAGO, transaction: null };
  const { canais } = canaisFalsos({ telegram: false, email: false });
  const { io } = estadoNaMemoria();

  await avisarCompraOrfa(semTransacao, NOSSO_PRODUTO, io, canais, AGORA);
  const de_novo = await avisarCompraOrfa(semTransacao, NOSSO_PRODUTO, io, canais, AGORA);

  assert.equal(de_novo.motivo, "ja_avisado");
});

// ── 5. chave de idempotência e extratores ──────────────────────────────────

test("payload sem id nenhum cai no e-mail como chave, e não avisa em loop", async () => {
  const semId: CompraOrfa = { ...TIAGO, externalId: "PURCHASE_APPROVED:unknown" };
  assert.equal(chaveDoAviso(semId), "email:cachico3@hotmail.com");

  const { canais, visto } = canaisFalsos({ telegram: true, email: true });
  const { io } = estadoNaMemoria();
  await avisarCompraOrfa(semId, NOSSO_PRODUTO, io, canais, AGORA);
  const de_novo = await avisarCompraOrfa(semId, NOSSO_PRODUTO, io, canais, AGORA);
  assert.equal(de_novo.motivo, "ja_avisado");
  assert.equal(visto.telegram.length, 1);
});

test("extratores leem o payload real do Tiago", () => {
  assert.equal(extractBuyerName(PAYLOAD_TIAGO), "Tiago Chico");
  assert.equal(extractProductName(PAYLOAD_TIAGO), "FastCloner");
  assert.equal(extractTransactionId(PAYLOAD_TIAGO), "HP2742616487");
  assert.equal(extractBuyerName({}), null);
  assert.equal(extractProductName({ product: { name: "   " } }), null);
});
