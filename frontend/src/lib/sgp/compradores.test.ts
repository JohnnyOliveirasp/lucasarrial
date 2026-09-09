/**
 * Régua da planilha "todos os compradores" do SGP (/admin/sgp, aba 2).
 *
 * O que estes testes protegem, na ordem do risco:
 *  1. a UNIÃO não pode perder nenhum dos dois lados — partir de uma fonte só é
 *     exatamente o defeito que este painel veio consertar (90 invisíveis);
 *  2. quem nunca começou tem o relógio contado da COMPRA, não de `atualizado_em`
 *     (que não existe pra ele) — senão ele nunca aparece como parado;
 *  3. data de aquisição VAZIA pra quem não tem compra registrada: nunca uma data
 *     inventada;
 *  4. uma pessoa com dois pedidos vira UMA linha, mostrando o pedido mais
 *     adiantado — caso real (Otniel: `pronto` + `dados` abandonado).
 *
 * Rodar (Node ≥ 22.18, type-stripping nativo):
 *   node --test src/lib/sgp/compradores.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  chaveEmail,
  escolherPedido,
  montarCompradores,
  ordenarCompradores,
  resumirCompradores,
  telefoneLegivel,
  STATUS_NAO_COMECOU,
  type CobrancaFastClonerBruta,
  type CompraSgpBruta,
  type EntitlementFastClonerBruto,
} from "./compradores.ts";
import { ETAPA_HUMANA, SGP_PARADO_HORAS } from "./painel.ts";
import type { SgpPedidoRow, SgpStatus } from "./types.ts";

const H = 60 * 60 * 1000;
const AGORA = new Date("2026-09-08T12:00:00Z").getTime();
const iso = (ms: number) => new Date(ms).toISOString();

function pedido(over: Partial<SgpPedidoRow> = {}): SgpPedidoRow {
  return {
    id: "ped-1",
    sessao: "sess",
    nome: "Fulano de Tal",
    email: "f@x.com",
    whatsapp: "5561999998888",
    email_verificado_at: null,
    codigo_hash: null,
    codigo_expira_em: null,
    codigo_tentativas: 0,
    conta_existente: false,
    user_id: null,
    criado_em: iso(AGORA - 10 * H),
    atualizado_em: iso(AGORA - 1 * H),
    status: "foto" as SgpStatus,
    ciencia_foto: null,
    ciencia_foto_at: null,
    ciencia_audio: null,
    ciencia_audio_at: null,
    aceite_lgpd_at: null,
    fotos: [],
    audios: [],
    enviado_em: null,
    foto_pronta_em: null,
    voz_pronta_em: null,
    voice_id: null,
    erro: null,
    ...over,
  };
}

function compra(over: Partial<CompraSgpBruta> = {}): CompraSgpBruta {
  return {
    email: "f@x.com",
    nome: "Fulano de Tal",
    telefone: "61999998888",
    recebidoEm: iso(AGORA - 5 * 24 * H),
    ...over,
  };
}

// ───────────────────────── a união ─────────────────────────

test("a união soma os dois lados e não perde ninguém", () => {
  const linhas = montarCompradores({
    compras: [compra({ email: "so-comprou@x.com" }), compra({ email: "os-dois@x.com" })],
    pedidos: [pedido({ email: "os-dois@x.com" }), pedido({ id: "p2", email: "so-portal@x.com" })],
    agora: AGORA,
  });
  // 2 compradores + 2 pedidos, com 1 em comum = 3 pessoas.
  assert.equal(linhas.length, 3);
  assert.deepEqual(
    linhas.map((l) => l.chave).sort(),
    ["os-dois@x.com", "so-comprou@x.com", "so-portal@x.com"],
  );
});

test("quem existe nos dois lados aparece UMA vez só", () => {
  const linhas = montarCompradores({
    compras: [compra({ email: "Mesma.Pessoa@Empresa.com" })],
    pedidos: [pedido({ email: "mesma.pessoa@empresa.com" })],
    agora: AGORA,
  });
  assert.equal(linhas.length, 1);
  // Tem os dois lados: data da compra E status do portal.
  assert.ok(linhas[0].dataAquisicao);
  assert.equal(linhas[0].statusPedido, "foto");
});

test("REGRESSÃO: partir só de sgp_pedidos perderia quem comprou e não começou", () => {
  const compras = Array.from({ length: 90 }, (_, i) => compra({ email: `comprador${i}@x.com` }));
  const linhas = montarCompradores({
    compras: [...compras, compra({ email: "comecou@x.com" })],
    pedidos: [pedido({ email: "comecou@x.com" })],
    agora: AGORA,
  });
  assert.equal(linhas.length, 91);
  const resumo = resumirCompradores(linhas);
  assert.equal(resumo.naoComecaram, 90);
  assert.equal(resumo.comecaram, 1);
});

test("REGRESSÃO: partir só de payment_events perderia quem está no portal sem compra", () => {
  const linhas = montarCompradores({
    compras: [compra({ email: "pagou@x.com" })],
    pedidos: [pedido({ email: "sem-compra-registrada@x.com" })],
    agora: AGORA,
  });
  assert.equal(linhas.length, 2);
  const orfao = linhas.find((l) => l.chave === "sem-compra-registrada@x.com");
  assert.ok(orfao);
  assert.equal(orfao.semCompraRegistrada, true);
});

// ───────────────── data de aquisição: nunca inventada ─────────────────

test("sem compra registrada a data de aquisição fica VAZIA, nunca inventada", () => {
  const [linha] = montarCompradores({
    compras: [],
    pedidos: [pedido({ email: "orfao@x.com", criado_em: iso(AGORA - 3 * 24 * H) })],
    agora: AGORA,
  });
  assert.equal(linha.dataAquisicao, null);
  assert.equal(linha.semCompraRegistrada, true);
});

test("a data de aquisição é a compra MAIS ANTIGA do mesmo e-mail", () => {
  const velha = iso(AGORA - 30 * 24 * H);
  const [linha] = montarCompradores({
    compras: [
      compra({ email: "recomprou@x.com", recebidoEm: iso(AGORA - 2 * 24 * H) }),
      compra({ email: "recomprou@x.com", recebidoEm: velha }),
      compra({ email: "recomprou@x.com", recebidoEm: iso(AGORA - 10 * 24 * H) }),
    ],
    pedidos: [],
    agora: AGORA,
  });
  assert.equal(linha.dataAquisicao, velha);
});

// ───────── o relógio de quem nunca começou (requisito explícito) ─────────

test("quem nunca começou conta o relógio da COMPRA, não de atualizado_em", () => {
  const [linha] = montarCompradores({
    compras: [compra({ email: "parado@x.com", recebidoEm: iso(AGORA - 5 * 24 * H) })],
    pedidos: [],
    agora: AGORA,
  });
  assert.equal(linha.status, STATUS_NAO_COMECOU);
  assert.equal(linha.esperandoMs, 5 * 24 * H);
  assert.equal(linha.esperandoTexto, "5 dias");
  assert.equal(linha.parado, true);
});

test("comprou há menos de 48h ainda não é 'parado'", () => {
  const [linha] = montarCompradores({
    compras: [compra({ email: "novo@x.com", recebidoEm: iso(AGORA - (SGP_PARADO_HORAS - 1) * H) })],
    pedidos: [],
    agora: AGORA,
  });
  assert.equal(linha.parado, false);
});

test("quem já recebeu o clone nunca conta como parado, por mais antigo que seja", () => {
  const [linha] = montarCompradores({
    compras: [compra({ email: "entregue@x.com", recebidoEm: iso(AGORA - 90 * 24 * H) })],
    pedidos: [pedido({ email: "entregue@x.com", status: "pronto", atualizado_em: iso(AGORA - 60 * 24 * H) })],
    agora: AGORA,
  });
  assert.equal(linha.concluido, true);
  assert.equal(linha.parado, false);
});

// ───────────────────── pessoa com dois pedidos ─────────────────────

test("dois pedidos do mesmo e-mail viram UMA linha, com o mais adiantado (caso Otniel)", () => {
  const linhas = montarCompradores({
    compras: [],
    pedidos: [
      pedido({ id: "pronto", email: "otniel@gmail.com", status: "pronto", enviado_em: iso(AGORA - 3 * 24 * H) }),
      pedido({ id: "abandonado", email: "otniel@gmail.com", status: "dados", enviado_em: null }),
    ],
    agora: AGORA,
  });
  assert.equal(linhas.length, 1);
  assert.equal(linhas[0].statusPedido, "pronto");
  assert.ok(linhas[0].enviadoEm, "a data de envio tem que vir do pedido que de fato foi enviado");
});

test("empate de avanço: vence o pedido que mexeu por último", () => {
  const novo = pedido({ id: "novo", status: "foto", atualizado_em: iso(AGORA - 1 * H) });
  const velho = pedido({ id: "velho", status: "foto", atualizado_em: iso(AGORA - 40 * H) });
  assert.equal(escolherPedido([velho, novo])?.id, "novo");
  assert.equal(escolherPedido([novo, velho])?.id, "novo");
});

test("'pronto' ganha de 'falhou' — a pessoa recebeu o clone pelo outro pedido", () => {
  const ok = pedido({ id: "ok", status: "pronto" });
  const ruim = pedido({ id: "ruim", status: "falhou" });
  assert.equal(escolherPedido([ruim, ok])?.id, "ok");
  assert.equal(escolherPedido([ok, ruim])?.id, "ok");
});

// ───────────────────────── telefone ─────────────────────────

test("o telefone do checkout da Hotmart (sem DDI) vira número com DDI", () => {
  // Formato real medido no payload: "11984263680", 11 dígitos, sem o 55.
  const [linha] = montarCompradores({
    compras: [compra({ email: "tel@x.com", telefone: "11984263680" })],
    pedidos: [],
    agora: AGORA,
  });
  assert.equal(linha.celularDigitos, "5511984263680");
  assert.equal(linha.celular, "(11) 98426-3680");
});

test("número estrangeiro do checkout não ganha máscara brasileira", () => {
  // Caso real: "393498533692" (Itália) veio com country_iso BR no payload.
  const [linha] = montarCompradores({
    compras: [compra({ email: "italia@x.com", telefone: "393498533692" })],
    pedidos: [],
    agora: AGORA,
  });
  assert.equal(linha.celularDigitos, "393498533692");
  assert.equal(linha.celular, "393498533692");
});

test("o WhatsApp digitado no portal ganha do telefone do checkout", () => {
  const [linha] = montarCompradores({
    compras: [compra({ email: "dois@x.com", telefone: "11984263680" })],
    pedidos: [pedido({ email: "dois@x.com", whatsapp: "5561999998888" })],
    agora: AGORA,
  });
  assert.equal(linha.celularDigitos, "5561999998888");
});

test("sem telefone em nenhuma fonte a célula é um traço e o resumo conta", () => {
  const linhas = montarCompradores({
    compras: [compra({ email: "sem-tel@x.com", telefone: null })],
    pedidos: [],
    agora: AGORA,
  });
  assert.equal(linhas[0].celular, "—");
  assert.equal(linhas[0].celularDigitos, null);
  assert.equal(resumirCompradores(linhas).semTelefone, 1);
});

test("telefoneLegivel devolve o mesmo que a fila de trabalho já mostrava", () => {
  // A fila usava esta mesma régua inline; mover pro módulo não pode mudar nada.
  assert.equal(telefoneLegivel("5561993107338"), "(61) 99310-7338");
  assert.equal(telefoneLegivel("551133334444"), "(11) 3333-4444");
  assert.equal(telefoneLegivel("393498533692"), "393498533692");
});

// ───────────────────────── chave de e-mail ─────────────────────────

test("a chave normaliza caixa e espaço", () => {
  assert.equal(chaveEmail("  Fulano@Empresa.COM "), "fulano@empresa.com");
});

test("no Gmail o ponto e o +tag são ignorados (herysilva27 = herysilva.27)", () => {
  assert.equal(chaveEmail("herysilva.27@gmail.com"), chaveEmail("herysilva27@gmail.com"));
  assert.equal(chaveEmail("pessoa+sgp@gmail.com"), "pessoa@gmail.com");
  assert.equal(chaveEmail("a.b@googlemail.com"), "ab@googlemail.com");
});

test("FORA do Gmail o ponto distingue pessoas diferentes e NÃO é removido", () => {
  assert.notEqual(chaveEmail("joao.silva@empresa.com"), chaveEmail("joaosilva@empresa.com"));
});

test("e-mail vazio ou torto não derruba a montagem", () => {
  assert.equal(chaveEmail(null), "");
  assert.equal(chaveEmail("sem-arroba"), "sem-arroba");
  const linhas = montarCompradores({
    compras: [{ email: "", nome: null, telefone: null, recebidoEm: iso(AGORA) }],
    pedidos: [pedido({ email: null })],
    agora: AGORA,
  });
  // A compra sem e-mail é descartada (não há como contatar); o PEDIDO sem
  // e-mail continua na tela — sumir esconderia um caso real do time.
  assert.equal(linhas.length, 1);
  assert.equal(linhas[0].statusPedido, "foto");
});

// ───────────────────────── status e ordem ─────────────────────────

test("o status é português de gente, nunca o enum cru do banco", () => {
  const linhas = montarCompradores({
    compras: [compra({ email: "a@x.com" })],
    pedidos: [
      pedido({ id: "1", email: "b@x.com", status: "foto" }),
      pedido({ id: "2", email: "c@x.com", status: "revisao" }),
      pedido({ id: "3", email: "d@x.com", status: "pronto" }),
    ],
    agora: AGORA,
  });
  const status = linhas.map((l) => l.status);
  assert.ok(status.includes(STATUS_NAO_COMECOU));
  assert.ok(status.includes(ETAPA_HUMANA.foto));
  assert.ok(status.includes(ETAPA_HUMANA.revisao));
  for (const s of status) {
    assert.ok(!["dados", "foto", "audio", "revisao", "enviado", "processando", "pronto", "falhou"].includes(s), `vazou enum cru: ${s}`);
  }
});

test("ordem: quem espera há mais tempo primeiro, entregues no fim", () => {
  const linhas = ordenarCompradores(
    montarCompradores({
      compras: [
        compra({ email: "recente@x.com", recebidoEm: iso(AGORA - 3 * 24 * H) }),
        compra({ email: "antigo@x.com", recebidoEm: iso(AGORA - 20 * 24 * H) }),
        compra({ email: "entregue@x.com", recebidoEm: iso(AGORA - 60 * 24 * H) }),
      ],
      pedidos: [pedido({ email: "entregue@x.com", status: "pronto", atualizado_em: iso(AGORA - 50 * 24 * H) })],
      agora: AGORA,
    }),
  );
  assert.deepEqual(linhas.map((l) => l.chave), ["antigo@x.com", "recente@x.com", "entregue@x.com"]);
});

test("o resumo bate com a forma real do funil (90 sem começar de 103)", () => {
  const compras = Array.from({ length: 103 }, (_, i) => compra({ email: `c${i}@x.com`, recebidoEm: iso(AGORA - 10 * 24 * H) }));
  // 13 dos compradores começaram, e mais 12 estão no portal sem compra.
  const pedidos = [
    ...Array.from({ length: 13 }, (_, i) => pedido({ id: `a${i}`, email: `c${i}@x.com`, status: "foto" })),
    ...Array.from({ length: 12 }, (_, i) => pedido({ id: `b${i}`, email: `orfao${i}@x.com`, status: "pronto" })),
  ];
  const resumo = resumirCompradores(montarCompradores({ compras, pedidos, agora: AGORA }));
  assert.equal(resumo.total, 115);
  assert.equal(resumo.naoComecaram, 90);
  assert.equal(resumo.comecaram, 25);
  assert.equal(resumo.semCompraRegistrada, 12);
});

// ─────────────── a coluna FastCloner (pedido do Lucas, 09/09) ───────────────
/**
 * O que estes testes protegem:
 *  1. PAGANTE e TRIAL não podem virar a mesma coisa. Medido em 09/09: dos 112
 *     compradores de SGP, 11 têm assinatura viva e só DOIS pagam — um sim/não
 *     faria o time ler 11 clientes onde há 2;
 *  2. acesso VENCIDO é "não assina", nunca "assina" (o `entitlements.status`
 *     fica `active` como rótulo velho, é o `access_until` que decide);
 *  3. valor > 0 NÃO basta pra chamar alguém de pagante — a Hotmart emite os
 *     R$97 em OVERDUE pra quem nunca pagou (18/08: 1.356.554 créditos dados a
 *     14 pessoas que não pagaram, exatamente por ler valor sem status);
 *  4. moeda estrangeira sai com a moeda certa (a base tem GBP, EUR, USD, PYG);
 *  5. e a garantia que vale por todas: a coluna é INFORMATIVA — a contagem de
 *     linhas do painel não muda por causa dela, em nenhum sentido.
 */
function ent(over: Partial<EntitlementFastClonerBruto> = {}): EntitlementFastClonerBruto {
  return {
    buyer_email: "f@x.com",
    status: "active",
    access_until: iso(AGORA + 30 * 24 * H),
    ...over,
  };
}

function cobranca(over: Partial<CobrancaFastClonerBruta> = {}): CobrancaFastClonerBruta {
  return {
    email: "f@x.com",
    valor: 97,
    moeda: "BRL",
    statusCompra: "APPROVED",
    recebidoEm: iso(AGORA - 2 * 24 * H),
    ...over,
  };
}

/** Atalho: monta UMA pessoa com a fonte FastCloner ligada. */
function linhaCom(
  entitlements: EntitlementFastClonerBruto[],
  cobrancas: CobrancaFastClonerBruta[],
  email = "f@x.com",
) {
  const linhas = montarCompradores({
    compras: [compra({ email })],
    pedidos: [],
    agora: AGORA,
    fastcloner: { entitlements, cobrancas },
  });
  assert.equal(linhas.length, 1);
  return linhas[0]!;
}

// (a)
test("FastCloner: quem paga aparece como PAGA, com valor e até quando", () => {
  const ate = iso(AGORA + 29 * 24 * H);
  const l = linhaCom([ent({ access_until: ate })], [cobranca({ valor: 97, moeda: "BRL" })]);
  assert.equal(l.fastcloner?.estado, "paga");
  assert.equal(l.fastcloner?.valor, 97);
  assert.equal(l.fastcloner?.valorTexto, "R$97");
  assert.equal(l.fastcloner?.ate, ate);
  assert.equal(l.fastcloner?.vitalicio, false);
  assert.equal(l.fastcloner?.cobrancaNaoConfirmada, false);
});

// (b)
test("FastCloner: trial de R$0 vivo é TRIAL, nunca 'paga'", () => {
  const l = linhaCom([ent()], [cobranca({ valor: 0 })]);
  assert.equal(l.fastcloner?.estado, "trial");
  assert.equal(l.fastcloner?.valorTexto, "R$0");
  assert.notEqual(l.fastcloner?.estado, "paga");
});

// (c)
test("FastCloner: sem entitlement nenhum é NÃO ASSINA, e não inventa valor", () => {
  const l = linhaCom([], []);
  assert.equal(l.fastcloner?.estado, "nao_assina");
  assert.equal(l.fastcloner?.valor, null);
  assert.equal(l.fastcloner?.ate, null);
  assert.equal(l.fastcloner?.valorTexto, "—");
});

// (d)
test("FastCloner: assinatura VENCIDA é não assina, mesmo com status 'active'", () => {
  // O rótulo `active` nunca vira `expired` no vencimento natural — é o
  // access_until que decide, e é por isso que a régua vem de acesso-regra.ts.
  const l = linhaCom([ent({ status: "active", access_until: iso(AGORA - 1 * H) })], [cobranca()]);
  assert.equal(l.fastcloner?.estado, "nao_assina");
  assert.equal(l.fastcloner?.valor, null, "vencido não pode carregar valor: parece que paga");
});

// (e)
test("FastCloner: moeda estrangeira aparece com a moeda certa, nunca R$", () => {
  const gbp = linhaCom([ent()], [cobranca({ valor: 0, moeda: "GBP" })]);
  assert.equal(gbp.fastcloner?.valorTexto, "£0");
  const usd = linhaCom([ent()], [cobranca({ valor: 20, moeda: "USD" })]);
  assert.equal(usd.fastcloner?.valorTexto, "US$20");
  assert.equal(usd.fastcloner?.estado, "paga");
  // Moeda fora do mapa não vira R$ chutado: sai com o código na frente.
  const pyg = linhaCom([ent()], [cobranca({ valor: 50000, moeda: "PYG" })]);
  assert.equal(pyg.fastcloner?.valorTexto, "PYG 50000");
  for (const l of [gbp, usd, pyg]) assert.ok(!l.fastcloner?.valorTexto.includes("R$"));
});

// (f)
test("FastCloner: a coluna não muda a contagem de linhas do painel", () => {
  const compras = Array.from({ length: 103 }, (_, i) => compra({ email: `c${i}@x.com` }));
  const pedidos = [
    ...Array.from({ length: 13 }, (_, i) => pedido({ id: `a${i}`, email: `c${i}@x.com`, status: "foto" })),
    ...Array.from({ length: 12 }, (_, i) => pedido({ id: `b${i}`, email: `orfao${i}@x.com`, status: "pronto" })),
  ];
  const sem = montarCompradores({ compras, pedidos, agora: AGORA });
  const com = montarCompradores({
    compras,
    pedidos,
    agora: AGORA,
    fastcloner: {
      // Entitlement de gente que NÃO está na lista não pode adicionar linha…
      entitlements: [ent({ buyer_email: "c0@x.com" }), ent({ buyer_email: "ninguem-daqui@x.com" })],
      // …e cobrança de fora também não.
      cobrancas: [cobranca({ email: "c0@x.com" }), cobranca({ email: "ninguem-daqui@x.com" })],
    },
  });
  assert.equal(com.length, sem.length);
  assert.equal(com.length, 115);
  assert.deepEqual(com.map((l) => l.chave).sort(), sem.map((l) => l.chave).sort());
  const resumo = resumirCompradores(com);
  assert.equal(resumo.total, 115);
  assert.equal(resumo.naoComecaram, 90);
  assert.equal(resumo.fastclonerConsultados, 115);
  assert.equal(resumo.fastclonerPagantes, 1);
  assert.equal(resumo.fastclonerNaoAssina, 114);
});

test("FastCloner: valor > 0 sem pagamento confirmado NÃO é pagante", () => {
  // Boleto impresso e nunca pago carrega os R$97 igualzinho a quem pagou.
  for (const status of ["BILLET_PRINTED", "OVERDUE", "DELAYED"]) {
    const l = linhaCom([ent()], [cobranca({ valor: 97, statusCompra: status })]);
    assert.equal(l.fastcloner?.estado, "trial", `${status} não pode virar pagante`);
    assert.equal(l.fastcloner?.cobrancaNaoConfirmada, true, `${status} tem que ficar marcado na tela`);
  }
});

test("FastCloner: vale a cobrança MAIS RECENTE — o trial que virou assinatura", () => {
  const l = linhaCom(
    [ent()],
    [
      cobranca({ valor: 0, recebidoEm: iso(AGORA - 40 * 24 * H) }),
      cobranca({ valor: 97, recebidoEm: iso(AGORA - 2 * 24 * H) }),
    ],
  );
  assert.equal(l.fastcloner?.estado, "paga");
  assert.equal(l.fastcloner?.valor, 97);
});

test("FastCloner: acesso vivo sem cobrança registrada não vira pagante nem mente valor", () => {
  const l = linhaCom([ent()], []);
  assert.equal(l.fastcloner?.estado, "trial");
  assert.equal(l.fastcloner?.valor, null);
  assert.equal(l.fastcloner?.valorTexto, "sem cobrança registrada");
  assert.equal(l.fastcloner?.cobrancaNaoConfirmada, false);
});

test("FastCloner: 'canceled' com período pago no futuro ainda tem acesso", () => {
  // Regra única do acesso-regra.ts: quem cancelou mas pagou até o dia X fica
  // até o dia X. Copiar a regra aqui como "só active" apagaria essa pessoa.
  const l = linhaCom([ent({ status: "canceled", access_until: iso(AGORA + 5 * 24 * H) })], [cobranca()]);
  assert.equal(l.fastcloner?.estado, "paga");
  const morto = linhaCom([ent({ status: "canceled", access_until: null })], [cobranca()]);
  assert.equal(morto.fastcloner?.estado, "nao_assina");
});

test("FastCloner: casa pelo MESMO e-mail normalizado do resto do módulo (ponto do Gmail)", () => {
  // Caso REAL de 09/09: assina como `luciano.rezende.filho@gmail.com` e comprou
  // o SGP como `lucianorezendefilho@gmail.com`. Uma segunda normalização (ou
  // nenhuma) diria "não assina" pra quem assina.
  const l = linhaCom(
    [ent({ buyer_email: "luciano.rezende.filho@gmail.com" })],
    [cobranca({ email: "Luciano.Rezende.Filho@Gmail.com", valor: 0 })],
    "lucianorezendefilho@gmail.com",
  );
  assert.equal(l.chave, "lucianorezendefilho@gmail.com");
  assert.equal(l.fastcloner?.estado, "trial");
  assert.equal(l.fastcloner?.valorTexto, "R$0");
});

test("FastCloner: sem a fonte, a linha diz 'não consultado' (null) e NÃO 'não assina'", () => {
  const linhas = montarCompradores({ compras: [compra()], pedidos: [], agora: AGORA });
  assert.equal(linhas[0]?.fastcloner, null);
  const resumo = resumirCompradores(linhas);
  assert.equal(resumo.fastclonerConsultados, 0);
  assert.equal(resumo.fastclonerPagantes, 0);
  assert.equal(resumo.fastclonerNaoAssina, 0, "sem consulta, ninguém pode ser contado como 'não assina'");
});

test("FastCloner: acesso vitalício (sem data) não vira vencido", () => {
  const l = linhaCom([ent({ access_until: null })], [cobranca()]);
  assert.equal(l.fastcloner?.estado, "paga");
  assert.equal(l.fastcloner?.vitalicio, true);
  assert.equal(l.fastcloner?.ate, null);
});
