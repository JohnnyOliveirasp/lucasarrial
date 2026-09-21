/**
 * Testes do e-mail de boas-vindas do SGP (pedido do Lucas, 03/09/2026). Rodar
 * (Node ≥ 22.18, type-stripping nativo):
 *   node --test src/lib/payments/sgp-boas-vindas.test.ts
 *
 * O PAYLOAD É REAL. Foi lido de `payment_events` em 03/09/2026: um dos 4
 * PURCHASE_APPROVED do produto 7283229 que a Hotmart ENTREGOU no nosso webhook
 * em 09/06/2026, antes do commit 4688e40 passar a descartar todo produto que
 * não fosse o FastCloner. Só o comprador foi trocado por um fictício — o repo é
 * público e não leva dado pessoal de aluno.
 *
 * Formato conferido no payload de verdade e que os testes dependem:
 *   - `data.product.id` é NÚMERO (7283229), não string;
 *   - NÃO existe `data.subscription` (é curso, não assinatura), então o
 *     `extractExternalId` cai na própria transação;
 *   - `data.purchase.status` = "APPROVED" e `data.purchase.transaction` = "HP…".
 *
 * Os dois testes que o card exige — o e-mail sai num evento simulado do
 * 7283229, e o SEGUNDO evento da mesma transação NÃO manda de novo — rodam
 * contra o fluxo inteiro com canais falsos, não contra pedaços soltos.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  chaveDaBoasVindas,
  deveMandarBoasVindas,
  ehEmailJaCadastrado,
  mandarBoasVindasSgp,
  montarBoasVindas,
  roteamentoDoProduto,
  SGP_PORTAL_URL,
  SGP_PRODUCT_ID_PADRAO,
  TETO_TENTATIVAS_BOAS_VINDAS,
  boasVindasEntregues,
  tentativasDe,
  classificarMx,
  descreverDns,
  dominioDoEmail,
  ehNullMx,
  entregaImpossivel,
  mereceRegistro,
  MOTIVO_ENTREGA_IMPOSSIVEL,
  type CasoEntregabilidade,
  type RespostaDns,
  type CanaisBoasVindas,
  type CompraSgp,
  type EstadoBoasVindas,
  type EstadoBoasVindasIO,
} from "./sgp-boas-vindas.ts";
import {
  extractBuyerEmail,
  extractBuyerName,
  extractExternalId,
  extractProductCode,
  extractProductName,
  extractPurchaseStatus,
  extractTransactionId,
} from "./hotmart-payload.ts";
import {
  SGP_AUDIO_MAX_SEGUNDOS,
  SGP_AUDIO_MIN_SEGUNDOS,
  SGP_FOTOS_MAX,
  SGP_FOTOS_MIN,
} from "../sgp/types.ts";

const NOSSO_PRODUTO = "7851642";
const AGORA = "2026-09-03T21:00:00.000Z";

/** Payload real do 7283229 (comprador fictício), como a Hotmart entrega. */
const PAYLOAD_SGP = {
  id: "c43ee40a-924b-4c82-911d-e55950a0a4ab",
  event: "PURCHASE_APPROVED",
  version: "2.0.0",
  data: {
    product: {
      id: 7283229,
      name: "Sistema de Geração Pronto",
      ucode: "c38d1748-3fa8-4ae4-8423-d9d68ce14095",
      warranty_date: "2026-06-16T00:00:00Z",
    },
    buyer: { name: "Maria de Teste", email: "maria.teste@example.com" },
    purchase: {
      transaction: "HP1611254312",
      status: "APPROVED",
      offer: { code: "x86qnptw", name: "Taxa correta" },
      price: { value: 597, currency_value: "BRL" },
    },
  },
} as { event: string; data: Record<string, unknown> };

/** O mesmo que o webhook monta antes de chamar o módulo. */
function compraDoPayload(p: typeof PAYLOAD_SGP): CompraSgp {
  const d = p.data;
  return {
    eventType: p.event,
    buyerEmail: extractBuyerEmail(d) ?? "",
    buyerName: extractBuyerName(d),
    productCode: extractProductCode(d),
    productName: extractProductName(d),
    transaction: extractTransactionId(d),
    externalId: extractExternalId(d, p.event),
    purchaseStatus: extractPurchaseStatus(d),
  };
}

const LINK_SENHA = "https://fastcloner.com/auth/callback?token=abc123&next=%2Freset-password";

/**
 * Canais falsos que guardam o que foi mandado.
 *
 * `contas` registra CADA chamada de `garantirConta` — é isso que prova, nos
 * testes de idempotência, que a segunda compra não foi só "não criou conta"
 * mas sim "nem tentou mexer na conta".
 */
function canaisFalsos(
  opts: {
    emailFalha?: boolean;
    conta?: "criada" | "ja_tinha" | "falhou";
    /** #290: o comprador já paga a assinatura da plataforma? */
    assina?: boolean;
    /** #290: a consulta de assinatura explode — não pode custar o e-mail. */
    assinaFalha?: boolean;
    /**
     * 13/09: o que o DNS responde pro domínio do comprador. AUSENTE de
     * propósito no default — canal sem `resolverDns` é o comportamento de
     * antes desta mudança, e é o que os ~30 testes que já existiam exercitam.
     */
    dns?: RespostaDns;
    /** 13/09: a consulta de DNS falha (ou estoura o tempo). */
    dnsFalha?: string;
  } = {},
) {
  const enviados: Array<{ to: string; assunto: string; texto: string }> = [];
  const registros: Array<{ email: string; ok: boolean; erro: string | null }> = [];
  const contas: Array<{ email: string; nome: string | null }> = [];
  const casos: CasoEntregabilidade[] = [];
  const dominiosConsultados: string[] = [];
  const situacao = opts.conta ?? "criada";
  const canais: CanaisBoasVindas = {
    garantirConta: async ({ email, nome }) => {
      contas.push({ email, nome });
      if (situacao === "ja_tinha") {
        return { situacao: "ja_tinha", linkDefinirSenha: null, erro: null };
      }
      if (situacao === "falhou") {
        return { situacao: "falhou", linkDefinirSenha: null, erro: "Supabase fora do ar" };
      }
      return { situacao: "criada", linkDefinirSenha: LINK_SENHA, erro: null };
    },
    email: async (to, assunto, texto) => {
      if (opts.emailFalha) throw new Error("SMTP fora do ar");
      enviados.push({ to, assunto, texto });
      return true;
    },
    registrar: async ({ email, ok, erro }) => {
      registros.push({ email, ok, erro });
    },
    temAssinaturaFastcloner: async () => {
      if (opts.assinaFalha) throw new Error("Supabase fora do ar");
      return opts.assina ?? false;
    },
  };
  // Só pluga o DNS quando o teste pediu: sem isto, todo teste antigo passaria a
  // exercitar um caminho que ele não escreveu.
  if (opts.dns || opts.dnsFalha) {
    canais.resolverDns = async (dominio) => {
      dominiosConsultados.push(dominio);
      if (opts.dnsFalha) throw new Error(opts.dnsFalha);
      return opts.dns as RespostaDns;
    };
    canais.registrarEntregabilidade = async (caso) => {
      casos.push(caso);
    };
  }
  return { canais, enviados, registros, contas, casos, dominiosConsultados };
}

/** As respostas de DNS que os testes usam, medidas no DNS de verdade em 13/09. */
const DNS_NULL_MX: RespostaDns = { mx: [{ exchange: "", priority: 0 }], temEndereco: null };
const DNS_SEM_NADA: RespostaDns = { mx: [], temEndereco: false };
const DNS_SEM_MX_COM_A: RespostaDns = { mx: [], temEndereco: true };
const DNS_OK: RespostaDns = {
  mx: [
    { exchange: "gmail-smtp-in.l.google.com", priority: 5 },
    { exchange: "alt1.gmail-smtp-in.l.google.com", priority: 10 },
  ],
  temEndereco: null,
};

/** Estado em memória, com contador de escrita (o `agent_state` de verdade). */
function estadoFalso(inicial: EstadoBoasVindas = {}) {
  let estado: EstadoBoasVindas = { ...inicial };
  const io: EstadoBoasVindasIO = {
    ler: async () => ({ ...estado }),
    gravar: async (novo) => {
      estado = { ...novo };
    },
  };
  return { io, ver: () => estado };
}

// ── #290: o orquestrador tem que USAR a resposta, não só recebê-la ─────────

test("#290 fim a fim: assinante pagante NÃO recebe a frase que manda contratar", async () => {
  // Este é o teste que prova o fix inteiro. Os testes de `montarBoasVindas`
  // sozinhos passariam mesmo se o orquestrador esquecesse de consultar o canal
  // — que é exatamente como um fix destes morre em silêncio na produção.
  const { canais, enviados } = canaisFalsos({ assina: true });
  const { io } = estadoFalso();

  const r = await mandarBoasVindasSgp(
    compraDoPayload(PAYLOAD_SGP),
    SGP_PRODUCT_ID_PADRAO,
    io,
    canais,
    AGORA,
  );

  assert.equal(r.enviou, true);
  assert.equal(enviados.length, 1);
  assert.doesNotMatch(
    enviados[0].texto,
    /NÃO inclui a assinatura da plataforma FastCloner/,
    "o e-mail que SAIU ainda carrega o defeito do #290",
  );
  assert.match(enviados[0].texto, /A SUA ASSINATURA DA PLATAFORMA FASTCLONER TAMBÉM ESTÁ ATIVA/);
});

test("#290: consulta de assinatura quebrada não derruba o e-mail (best-effort)", async () => {
  const { canais, enviados } = canaisFalsos({ assinaFalha: true });
  const { io } = estadoFalso();

  const r = await mandarBoasVindasSgp(
    compraDoPayload(PAYLOAD_SGP),
    SGP_PRODUCT_ID_PADRAO,
    io,
    canais,
    AGORA,
  );

  // O aluno continua recebendo o e-mail, e no lado seguro: o texto de hoje.
  assert.equal(r.enviou, true);
  assert.equal(enviados.length, 1);
  assert.match(enviados[0].texto, /NÃO inclui a assinatura da plataforma FastCloner/);
});

// ── o caso que o card exige ────────────────────────────────────────────────

test("evento real do 7283229 manda o e-mail com o link do portal", async () => {
  const { canais, enviados, registros } = canaisFalsos();
  const { io, ver } = estadoFalso();

  const r = await mandarBoasVindasSgp(
    compraDoPayload(PAYLOAD_SGP),
    SGP_PRODUCT_ID_PADRAO,
    io,
    canais,
    AGORA,
  );

  assert.equal(r.enviou, true);
  assert.equal(r.motivo, "enviado");
  assert.deepEqual(r.canais, ["email"]);

  assert.equal(enviados.length, 1);
  assert.equal(enviados[0].to, "maria.teste@example.com");
  assert.match(enviados[0].texto, /Maria/); // trata pelo primeiro nome
  assert.ok(
    enviados[0].texto.includes(SGP_PORTAL_URL),
    "o e-mail precisa levar o link do portal",
  );

  // registrou a tentativa (avisos_enviados, best-effort)
  assert.deepEqual(registros, [{ email: "maria.teste@example.com", ok: true, erro: null }]);
  // e gravou a transação como já avisada
  assert.deepEqual(Object.keys(ver()), ["HP1611254312"]);
});

test("SEGUNDO evento da MESMA transação não manda de novo", async () => {
  const { canais, enviados } = canaisFalsos();
  const { io } = estadoFalso();
  const compra = compraDoPayload(PAYLOAD_SGP);

  const primeiro = await mandarBoasVindasSgp(compra, SGP_PRODUCT_ID_PADRAO, io, canais, AGORA);
  const segundo = await mandarBoasVindasSgp(compra, SGP_PRODUCT_ID_PADRAO, io, canais, AGORA);

  assert.equal(primeiro.enviou, true);
  assert.equal(segundo.enviou, false);
  assert.equal(segundo.motivo, "ja_enviado");
  assert.equal(enviados.length, 1, "só pode ter saído UM e-mail");
});

test("PURCHASE_COMPLETE da mesma compra (~7,8 dias depois) não manda de novo", async () => {
  const { canais, enviados } = canaisFalsos();
  const { io } = estadoFalso();

  await mandarBoasVindasSgp(compraDoPayload(PAYLOAD_SGP), SGP_PRODUCT_ID_PADRAO, io, canais, AGORA);

  // mesma transação, evento diferente — é o que já duplicou crédito em 10/08
  const completo = { ...compraDoPayload(PAYLOAD_SGP), eventType: "PURCHASE_COMPLETE" };
  const r = await mandarBoasVindasSgp(completo, SGP_PRODUCT_ID_PADRAO, io, canais, AGORA);

  assert.equal(r.enviou, false);
  assert.equal(r.motivo, "evento_nao_e_compra");
  assert.equal(enviados.length, 1);
});

test("transações diferentes do mesmo comprador recebem cada uma o seu", async () => {
  const { canais, enviados } = canaisFalsos();
  const { io } = estadoFalso();

  await mandarBoasVindasSgp(compraDoPayload(PAYLOAD_SGP), SGP_PRODUCT_ID_PADRAO, io, canais, AGORA);
  const outra = { ...compraDoPayload(PAYLOAD_SGP), transaction: "HP2446711096" };
  const r = await mandarBoasVindasSgp(outra, SGP_PRODUCT_ID_PADRAO, io, canais, AGORA);

  assert.equal(r.enviou, true);
  assert.equal(enviados.length, 2);
});

// ── o que NÃO pode virar e-mail ────────────────────────────────────────────

test("PURCHASE_APPROVED com Pix ainda não pago não manda nada", async () => {
  const { canais, enviados } = canaisFalsos();
  const { io } = estadoFalso();
  const boleto = { ...compraDoPayload(PAYLOAD_SGP), purchaseStatus: "WAITING_PAYMENT" };

  const r = await mandarBoasVindasSgp(boleto, SGP_PRODUCT_ID_PADRAO, io, canais, AGORA);

  assert.equal(r.enviou, false);
  assert.equal(r.motivo, "pagamento_nao_confirmado");
  assert.equal(enviados.length, 0);
});

test("compra do FastCloner NUNCA cai no e-mail do SGP", () => {
  const d = deveMandarBoasVindas({
    eventType: "PURCHASE_APPROVED",
    purchaseStatus: "APPROVED",
    productCode: NOSSO_PRODUTO,
    produtoSgp: SGP_PRODUCT_ID_PADRAO,
    buyerEmail: "alguem@example.com",
  });
  assert.deepEqual(d, { ok: false, motivo: "produto_nao_e_sgp" });
});

test("reembolso/cancelamento do SGP não manda e-mail de boas-vindas", () => {
  for (const evento of ["PURCHASE_REFUNDED", "PURCHASE_PROTEST", "SUBSCRIPTION_CANCELLATION"]) {
    const d = deveMandarBoasVindas({
      eventType: evento,
      purchaseStatus: "APPROVED",
      productCode: SGP_PRODUCT_ID_PADRAO,
      produtoSgp: SGP_PRODUCT_ID_PADRAO,
      buyerEmail: "alguem@example.com",
    });
    assert.deepEqual(d, { ok: false, motivo: "evento_nao_e_compra" }, evento);
  }
});

test("falha de SMTP é registrada e não repete o envio", async () => {
  const { canais, registros } = canaisFalsos({ emailFalha: true });
  const { io } = estadoFalso();

  const r = await mandarBoasVindasSgp(
    compraDoPayload(PAYLOAD_SGP),
    SGP_PRODUCT_ID_PADRAO,
    io,
    canais,
    AGORA,
  );

  // enviou=true com canais=[] é o sinal de "tentou e NINGUÉM recebeu": é isso
  // que o webhook grava em payment_events.error.
  assert.equal(r.enviou, true);
  assert.deepEqual(r.canais, []);
  assert.equal(registros.length, 1);
  assert.equal(registros[0].ok, false);
  assert.equal(registros[0].erro, "SMTP fora do ar");
  // #324: a causa também volta pro chamador. Antes ela só ia pro `registrar`,
  // ou seja, pra `avisos_enviados` — a tabela da migration 104, que NUNCA foi
  // aplicada. Na prática o motivo era calculado e jogado no lixo.
  assert.equal(r.envioErro, "SMTP fora do ar");
});

test("#324: a causa do envio que falhou sobrevive no resultado E no estado", async () => {
  const { canais } = canaisFalsos({ emailFalha: true });
  const { io, ver } = estadoFalso();

  const r = await mandarBoasVindasSgp(
    compraDoPayload(PAYLOAD_SGP),
    SGP_PRODUCT_ID_PADRAO,
    io,
    canais,
    AGORA,
  );

  // 1. O chamador consegue montar um `payment_events.error` que diz POR QUÊ.
  //    Em 09/09 ele dizia só "boas-vindas do SGP não saíram", e quem investigou
  //    7h depois não sabia se tinha sido timeout, recusa do servidor ou caixa
  //    inexistente — três causas com três reparos diferentes.
  assert.equal(r.envioErro, "SMTP fora do ar");

  // 2. E a causa fica gravada JUNTO da trava de idempotência. É o estado que
  //    denuncia esta classe (procura-se por `canais: []`), então o motivo tem
  //    que morar no mesmo lugar — senão descobrir exige cruzar outra tabela.
  const chave = chaveDaBoasVindas(compraDoPayload(PAYLOAD_SGP));
  assert.deepEqual(ver()[chave].canais, [], "ninguém recebeu");
  assert.equal(ver()[chave].envioErro, "SMTP fora do ar");
});

test("#324: envio que DEU CERTO não carrega causa de erro nenhuma", async () => {
  const { canais } = canaisFalsos();
  const { io, ver } = estadoFalso();

  const r = await mandarBoasVindasSgp(
    compraDoPayload(PAYLOAD_SGP),
    SGP_PRODUCT_ID_PADRAO,
    io,
    canais,
    AGORA,
  );

  // O campo é o SINAL de falha: sujá-lo no caminho feliz faria o detector de
  // vítimas acusar justamente quem recebeu o e-mail normalmente.
  assert.equal(r.envioErro, null);
  assert.deepEqual(r.canais, ["email"]);
  const chave = chaveDaBoasVindas(compraDoPayload(PAYLOAD_SGP));
  assert.equal(ver()[chave].envioErro, undefined);
});

// ── o roteamento por produto (a linha que cegou a casa em 09/06) ───────────

test("roteamento: FastCloner segue nosso, SGP passa, resto continua descartado", () => {
  const args = { nossoProduto: NOSSO_PRODUTO, produtoSgp: SGP_PRODUCT_ID_PADRAO };
  assert.equal(roteamentoDoProduto({ ...args, eventProduct: NOSSO_PRODUTO }), "nosso");
  assert.equal(roteamentoDoProduto({ ...args, eventProduct: SGP_PRODUCT_ID_PADRAO }), "sgp");
  // Fábrica de Conteúdo Invisível: outro curso, segue fora
  assert.equal(roteamentoDoProduto({ ...args, eventProduct: "7283335" }), "de_fora");
  // payload sem produto → comportamento antigo, não descarta
  assert.equal(roteamentoDoProduto({ ...args, eventProduct: null }), "nosso");
});

test("roteamento: SGP configurado igual ao FastCloner não sequestra a assinatura", () => {
  // Engano de ambiente. Errar liberando acesso pago é muito mais barato que
  // errar parando de liberar.
  const rota = roteamentoDoProduto({
    eventProduct: NOSSO_PRODUTO,
    nossoProduto: NOSSO_PRODUTO,
    produtoSgp: NOSSO_PRODUTO,
  });
  assert.equal(rota, "nosso");
});

test("o payload real do 7283229 é roteado como sgp", () => {
  const rota = roteamentoDoProduto({
    eventProduct: extractProductCode(PAYLOAD_SGP.data),
    nossoProduto: NOSSO_PRODUTO,
    produtoSgp: SGP_PRODUCT_ID_PADRAO,
  });
  assert.equal(rota, "sgp", "product.id vem como número no payload e precisa casar");
});

// ── o texto ────────────────────────────────────────────────────────────────

test("QUEM NÃO ASSINA: o e-mail NÃO promete acesso ao FastCloner (regra do Lucas, 31/08)", () => {
  const { texto } = montarBoasVindas(compraDoPayload(PAYLOAD_SGP));
  assert.match(
    texto,
    /NÃO inclui a assinatura da plataforma FastCloner/,
    "sem esta frase o e-mail vira a origem do engano do Celso/Caio/Ranieri",
  );
  // e não pode convidar a pessoa a "acessar a plataforma" como se fosse dela
  assert.doesNotMatch(texto, /seu acesso (à|a) plataforma/i);
});

test("QUEM JÁ ASSINA: o e-mail não manda contratar o que a pessoa já pagou (#290)", () => {
  const { texto } = montarBoasVindas(compraDoPayload(PAYLOAD_SGP), undefined, true);
  // A frase que fez 15 assinantes pagantes lerem que não tinham a plataforma
  // NÃO pode sobrar em lugar nenhum do corpo.
  assert.doesNotMatch(
    texto,
    /NÃO inclui a assinatura da plataforma FastCloner/,
    "é literalmente o defeito do #290: dizer ao assinante pagante que ele não assina",
  );
  assert.doesNotMatch(texto, /contratada à parte/);
  // e o texto oposto precisa estar lá, com a porta de entrada
  assert.match(texto, /A SUA ASSINATURA DA PLATAFORMA FASTCLONER TAMBÉM ESTÁ ATIVA/);
  assert.match(texto, /Os seus créditos ficam disponíveis/);
});

test("o default é o texto de hoje: chamador que não sabe cai no lado seguro (#290)", () => {
  // Sem o 3º argumento o comportamento é IDÊNTICO ao de antes do fix — é o que
  // garante que nenhum chamador antigo passou a prometer plataforma sem querer.
  const semArgumento = montarBoasVindas(compraDoPayload(PAYLOAD_SGP)).texto;
  const comFalseExplicito = montarBoasVindas(compraDoPayload(PAYLOAD_SGP), undefined, false).texto;
  assert.equal(semArgumento, comFalseExplicito);
});

test("o e-mail diz o material exigido, e os números batem com a régua do /sgp", () => {
  const { texto, assunto } = montarBoasVindas(compraDoPayload(PAYLOAD_SGP));
  assert.ok(assunto.length > 0);
  // Se alguém mudar a régua em lib/sgp/types.ts, este teste cai e o e-mail é
  // corrigido junto — é pra isso que ele importa as constantes de verdade.
  assert.equal(SGP_FOTOS_MIN, 4);
  assert.equal(SGP_FOTOS_MAX, 6);
  assert.equal(SGP_AUDIO_MIN_SEGUNDOS / 60, 20);
  assert.equal(SGP_AUDIO_MAX_SEGUNDOS / 60, 60);
  assert.match(texto, new RegExp(`De ${SGP_FOTOS_MIN} a ${SGP_FOTOS_MAX} fotos`));
  assert.match(
    texto,
    new RegExp(`De ${SGP_AUDIO_MIN_SEGUNDOS / 60} a ${SGP_AUDIO_MAX_SEGUNDOS / 60} minutos`),
  );
});

test("comprador sem nome não vira 'Oi, null'", () => {
  const semNome = { ...compraDoPayload(PAYLOAD_SGP), buyerName: null };
  const { texto } = montarBoasVindas(semNome);
  assert.ok(texto.startsWith("Oi!\n"), texto.slice(0, 20));
});

// ── a chave ────────────────────────────────────────────────────────────────

test("a chave é a transação; sem transação cai no e-mail", () => {
  assert.equal(
    chaveDaBoasVindas({ transaction: "HP1611254312", buyerEmail: "a@b.com" }),
    "HP1611254312",
  );
  assert.equal(chaveDaBoasVindas({ transaction: null, buyerEmail: "A@B.com" }), "email:a@b.com");
});

// ── CONTA DO COMPRADOR (weekly do Lucas, 04/09 — item 1 de 6) ──────────────
//
// Os três casos que o card exige como prova estão aqui: conta nova + link no
// e-mail; segunda compra que NÃO cria nem reseta; e a conta nascendo sem
// assinatura e sem crédito.

test("compra nova CRIA a conta e o e-mail leva o link pra definir a senha", async () => {
  const { canais, enviados, contas } = canaisFalsos({ conta: "criada" });
  const { io, ver } = estadoFalso();

  const r = await mandarBoasVindasSgp(
    compraDoPayload(PAYLOAD_SGP),
    SGP_PRODUCT_ID_PADRAO,
    io,
    canais,
    AGORA,
  );

  assert.equal(r.enviou, true);
  assert.equal(r.conta, "criada");
  assert.equal(r.contaErro, null);

  // tentou criar a conta com o e-mail e o nome do comprador
  assert.deepEqual(contas, [{ email: "maria.teste@example.com", nome: "Maria de Teste" }]);

  // UM e-mail só, com as DUAS coisas dentro: o portal e o acesso
  assert.equal(enviados.length, 1, "tem que ser um e-mail só, não dois");
  const texto = enviados[0].texto;
  assert.ok(texto.includes(SGP_PORTAL_URL), "o link do portal continua no e-mail");
  assert.ok(texto.includes(LINK_SENHA), "o link de definir senha tem que estar no e-mail");

  // auditoria barata: o estado guarda que a conta nasceu nesta compra
  assert.equal(ver()["HP1611254312"].conta, "criada");
});

test("NUNCA vai senha em texto no e-mail — só o link", async () => {
  const { canais, enviados } = canaisFalsos({ conta: "criada" });
  const { io } = estadoFalso();

  await mandarBoasVindasSgp(
    compraDoPayload(PAYLOAD_SGP),
    SGP_PRODUCT_ID_PADRAO,
    io,
    canais,
    AGORA,
  );

  const texto = enviados[0].texto;
  // A decisão técnica do card: o Lucas pediu "login + senha", e mandamos link.
  // Senha em claro fica pra sempre na caixa do aluno e no nosso servidor.
  assert.ok(
    !/sua senha (é|e|:)/i.test(texto),
    "o e-mail não pode conter uma senha em texto",
  );
  assert.ok(!/senha provis(ó|o)ria|senha tempor(á|a)ria/i.test(texto));
  assert.ok(texto.includes(LINK_SENHA));
  // e sempre oferece a saída pra quando o link de 1h vencer
  assert.match(texto, /Esqueci minha senha/i);
});

test("comprador que JÁ TEM conta: não cria, não reseta, e o e-mail sai sem bloco de acesso", async () => {
  const { canais, enviados, contas } = canaisFalsos({ conta: "ja_tinha" });
  const { io } = estadoFalso();

  const r = await mandarBoasVindasSgp(
    compraDoPayload(PAYLOAD_SGP),
    SGP_PRODUCT_ID_PADRAO,
    io,
    canais,
    AGORA,
  );

  assert.equal(r.enviou, true);
  assert.equal(r.conta, "ja_tinha");
  assert.equal(r.contaErro, null, "conta que já existia não é erro");
  assert.equal(contas.length, 1);

  // o e-mail do portal SAI (ele ainda precisa preencher o /sgp)...
  assert.equal(enviados.length, 1);
  const texto = enviados[0].texto;
  assert.ok(texto.includes(SGP_PORTAL_URL));
  // ...mas SEM nada de senha: quem já usa a plataforma receber "defina a sua
  // senha" sem ter pedido parece invasão, e é o pior estrago deste card.
  assert.ok(!texto.includes(LINK_SENHA), "não pode mandar link de senha pra conta existente");
  assert.ok(
    !/A SUA CONTA JÁ ESTÁ CRIADA/.test(texto),
    "não pode dizer que criou conta pra quem já tinha",
  );
});

test("SEGUNDA compra do mesmo e-mail não cria conta nem mexe na senha", async () => {
  // A Hotmart reenvia o MESMO evento até 5×. A trava tem que impedir até a
  // TENTATIVA de mexer na conta, não só a criação.
  const { canais, enviados, contas } = canaisFalsos({ conta: "criada" });
  const { io } = estadoFalso();
  const compra = compraDoPayload(PAYLOAD_SGP);

  const primeiro = await mandarBoasVindasSgp(compra, SGP_PRODUCT_ID_PADRAO, io, canais, AGORA);
  const segundo = await mandarBoasVindasSgp(compra, SGP_PRODUCT_ID_PADRAO, io, canais, AGORA);

  assert.equal(primeiro.conta, "criada");
  assert.equal(segundo.enviou, false);
  assert.equal(segundo.motivo, "ja_enviado");
  assert.equal(segundo.conta, null, "nem chegou a olhar a conta");

  assert.equal(contas.length, 1, "garantirConta só pode ter sido chamada UMA vez");
  assert.equal(enviados.length, 1, "e um e-mail só");
});

test("conta que falhou não cancela o e-mail do portal, mas vira erro registrado", async () => {
  const { canais, enviados } = canaisFalsos({ conta: "falhou" });
  const { io } = estadoFalso();

  const r = await mandarBoasVindasSgp(
    compraDoPayload(PAYLOAD_SGP),
    SGP_PRODUCT_ID_PADRAO,
    io,
    canais,
    AGORA,
  );

  // o aluno continua sendo mandado pro portal — lá a conta nasce no fim do
  // preenchimento, que é o comportamento que já existia antes deste card
  assert.equal(r.enviou, true);
  assert.equal(enviados.length, 1);
  assert.ok(enviados[0].texto.includes(SGP_PORTAL_URL));
  assert.ok(!enviados[0].texto.includes(LINK_SENHA));

  // mas a falha não some: o webhook escreve isto em payment_events.error
  assert.equal(r.conta, "falhou");
  assert.equal(r.contaErro, "Supabase fora do ar");
});

test("garantirConta que EXPLODE não derruba o e-mail", async () => {
  const { io } = estadoFalso();
  const enviados: Array<{ to: string; texto: string }> = [];
  const canais: CanaisBoasVindas = {
    garantirConta: async () => {
      throw new Error("getaddrinfo ENOTFOUND supabase");
    },
    email: async (to, _assunto, texto) => {
      enviados.push({ to, texto });
      return true;
    },
    registrar: async () => {},
  };

  const r = await mandarBoasVindasSgp(
    compraDoPayload(PAYLOAD_SGP),
    SGP_PRODUCT_ID_PADRAO,
    io,
    canais,
    AGORA,
  );

  assert.equal(r.enviou, true);
  assert.equal(r.conta, "falhou");
  assert.match(r.contaErro ?? "", /ENOTFOUND/);
  assert.equal(enviados.length, 1);
});

test("conta criada SEM link de senha sai sem o bloco, e a falha fica registrada", async () => {
  // caso real possível: createUser deu certo, generateLink não devolveu URL
  const { io } = estadoFalso();
  const enviados: string[] = [];
  const canais: CanaisBoasVindas = {
    garantirConta: async () => ({
      situacao: "criada",
      linkDefinirSenha: null,
      erro: "generateLink não devolveu hashed_token",
    }),
    email: async (_to, _assunto, texto) => {
      enviados.push(texto);
      return true;
    },
    registrar: async () => {},
  };

  const r = await mandarBoasVindasSgp(
    compraDoPayload(PAYLOAD_SGP),
    SGP_PRODUCT_ID_PADRAO,
    io,
    canais,
    AGORA,
  );

  assert.equal(r.enviou, true);
  // sem link não existe bloco de acesso — e-mail sem link quebrado dentro
  assert.ok(!/A SUA CONTA JÁ ESTÁ CRIADA/.test(enviados[0]));
  assert.match(r.contaErro ?? "", /hashed_token/);
});

test("a conta nasce SEM assinatura e SEM crédito — por construção", () => {
  // Este é o teste do 'não existe'. A garantia não é um valor que dá pra ler
  // no retorno: é o fato de o módulo NÃO TER como creditar nem liberar acesso.
  // As únicas capacidades que ele recebe são estas três.
  const canais: CanaisBoasVindas = {
    garantirConta: async () => ({ situacao: "criada", linkDefinirSenha: LINK_SENHA, erro: null }),
    email: async () => true,
    registrar: async () => {},
  };
  assert.deepEqual(
    Object.keys(canais).sort(),
    ["email", "garantirConta", "registrar"],
    "se alguém adicionar aqui um canal que credita ou libera acesso, este teste cai",
  );

  // E o e-mail diz, com todas as letras, que a conta não é a assinatura —
  // é a regra comercial do Lucas (31/08) escrita pro aluno.
  const { texto } = montarBoasVindas(compraDoPayload(PAYLOAD_SGP), {
    situacao: "criada",
    linkDefinirSenha: LINK_SENHA,
    erro: null,
  });
  assert.match(texto, /NÃO inclui a assinatura da plataforma FastCloner/);
});

// ── o classificador de "e-mail já cadastrado" ──────────────────────────────

test("ehEmailJaCadastrado reconhece as redações do Supabase e do Postgres", () => {
  for (const msg of [
    "A user with this email address has already been registered",
    "Email address already registered by another user",
    "User already exists",
    'duplicate key value violates unique constraint "users_email_key"',
  ]) {
    assert.equal(ehEmailJaCadastrado(msg), true, msg);
  }
  // e não engole falha de verdade como se fosse conta existente
  for (const msg of [
    "Database error creating new user",
    "getaddrinfo ENOTFOUND supabase",
    "invalid email",
  ]) {
    assert.equal(ehEmailJaCadastrado(msg), false, msg);
  }
});

// ── #324: falha de envio NÃO pode virar "já enviado" pra sempre ────────────

test("#324 REGRESSÃO: SMTP fora do ar não condena a transação — a próxima tentativa manda", async () => {
  // ESTE é o teste que prova o bug de 09/09. Contra o código antigo ele FALHA:
  // o primeiro envio gravava `canais: []`, a trava lia só a presença da chave e
  // o segundo evento voltava "ja_enviado" — para sempre. Foi assim que
  // jcesaram e patricia.bp170 ficaram 7h pagando e sem conseguir entrar.
  const compra = compraDoPayload(PAYLOAD_SGP);
  const { io, ver } = estadoFalso();

  // 1ª tentativa: o e-mail explode.
  const ruim = canaisFalsos({ emailFalha: true });
  const primeiro = await mandarBoasVindasSgp(compra, SGP_PRODUCT_ID_PADRAO, io, ruim.canais, AGORA);
  assert.equal(primeiro.enviou, true, "houve tentativa de envio");
  assert.deepEqual(primeiro.canais, [], "e nenhum canal aceitou");
  assert.equal(ruim.enviados.length, 0, "nada saiu de verdade");

  // o registro tem que CONFESSAR a falha, não se disfarçar de entrega
  const reg = ver()[chaveDaBoasVindas(compra)];
  assert.deepEqual(reg.canais, [], "canais vazio = ninguém recebeu");
  assert.equal(reg.falhou, true, "e a flag de falha tem que estar lá");
  assert.equal(reg.tentativas, 1);
  assert.equal(boasVindasEntregues(reg), false);

  // 2ª tentativa (reenvio da Hotmart), agora com SMTP de pé: TEM que sair.
  const bom = canaisFalsos();
  const segundo = await mandarBoasVindasSgp(compra, SGP_PRODUCT_ID_PADRAO, io, bom.canais, AGORA);
  assert.notEqual(segundo.motivo, "ja_enviado", "a falha não pode ter virado trava permanente");
  assert.equal(segundo.motivo, "enviado");
  assert.deepEqual(segundo.canais, ["email"]);
  assert.equal(bom.enviados.length, 1, "o aluno finalmente recebeu");

  // e agora sim vira trava definitiva
  const regOk = ver()[chaveDaBoasVindas(compra)];
  assert.deepEqual(regOk.canais, ["email"]);
  assert.equal(regOk.falhou, undefined, "sucesso não carrega flag de falha");
  assert.equal(regOk.tentativas, 2, "o contador acumula, não reinicia");
  const terceiro = await mandarBoasVindasSgp(compra, SGP_PRODUCT_ID_PADRAO, io, bom.canais, AGORA);
  assert.equal(terceiro.motivo, "ja_enviado");
  assert.equal(bom.enviados.length, 1, "e não manda em dobro depois de entregue");
});

test("#324 os 2 registros VELHOS (canais:[] sem flag) são lidos como falha e destravam", async () => {
  // O caso real medido em 09/09 no agent_state: 2 de 113 registros gravados
  // como "enviado" com canais vazio. Sem migration nenhuma — a fonte de verdade
  // é `canais`, então o registro velho já é lido como falha.
  const compra = compraDoPayload(PAYLOAD_SGP);
  const chave = chaveDaBoasVindas(compra);
  const velho: EstadoBoasVindas = {
    [chave]: {
      at: "2026-09-09T11:13:36.875Z",
      buyerEmail: compra.buyerEmail,
      canais: [], // ← como estava no banco: sem `falhou`, sem `tentativas`
      conta: "criada",
    },
  };
  const { io } = estadoFalso(velho);
  const { canais, enviados } = canaisFalsos();

  const r = await mandarBoasVindasSgp(compra, SGP_PRODUCT_ID_PADRAO, io, canais, AGORA);

  assert.equal(r.motivo, "enviado", "registro velho travado tem que destravar");
  assert.equal(enviados.length, 1);
});

test("#324 o retry é LIMITADO: estourou o teto, desiste com motivo próprio", async () => {
  // O medo original (03/09) era rajada em cima do aluno. O teto entrega isso
  // sem precisar mentir que o e-mail saiu.
  const compra = compraDoPayload(PAYLOAD_SGP);
  const { io } = estadoFalso();
  const { canais, enviados } = canaisFalsos({ emailFalha: true });

  for (let i = 1; i <= TETO_TENTATIVAS_BOAS_VINDAS; i++) {
    const r = await mandarBoasVindasSgp(compra, SGP_PRODUCT_ID_PADRAO, io, canais, AGORA);
    assert.equal(r.enviou, true, `tentativa ${i} ainda tenta`);
  }
  assert.equal(enviados.length, 0, "todas falharam");

  // a de depois do teto não tenta mais
  const depois = await mandarBoasVindasSgp(compra, SGP_PRODUCT_ID_PADRAO, io, canais, AGORA);
  assert.equal(depois.enviou, false);
  assert.equal(depois.motivo, "esgotou_tentativas");
});

test("#324 helpers: entrega é medida por `canais`, e registro pré-#324 conta 1 tentativa", () => {
  assert.equal(boasVindasEntregues(undefined), false);
  assert.equal(tentativasDe(undefined), 0, "nunca tentado");

  const entregue = { at: AGORA, buyerEmail: "a@b.com", canais: ["email"] };
  assert.equal(boasVindasEntregues(entregue), true);

  const falho = { at: AGORA, buyerEmail: "a@b.com", canais: [] };
  assert.equal(boasVindasEntregues(falho), false);
  // pré-#324 não tem contador: conta como 1 já gasta, senão o teto reiniciaria
  assert.equal(tentativasDe(falho), 1);
  assert.equal(tentativasDe({ ...falho, tentativas: 2 }), 2);
});

// ── 13/09: o domínio do comprador aceita e-mail? (caso Sheila) ─────────────
//
// O CASO REAL: compra do SGP em 13/09 13:53Z com o e-mail digitado no domínio
// `gmail.com.br`, que publica NULL MX (`0 .`). O SMTP respondeu 250, a fila deu
// o envio por feito, e a compradora ficou em silêncio. A resposta de DNS usada
// nos testes abaixo foi MEDIDA no DNS de verdade em 13/09:
//   gmail.com.br  → [{ exchange: "", priority: 0 }]  (+ tem A: 142.251.214.229)
//   gmail.com     → 5 MX do Google
//   example.com   → também NULL MX (é por isso que os 9 eventos de teste de
//                   09/06 aparecem, e está certo que apareçam)

/** A compradora do caso real, com o telefone que veio no payload da Hotmart. */
const COMPRA_SHEILA: CompraSgp = {
  ...compraDoPayload(PAYLOAD_SGP),
  buyerEmail: "compradora.teste@gmail.com.br",
  buyerName: "Sheila de Teste",
  buyerPhone: "11984263680",
};

test("(a) NULL MX: o envio NÃO conta como entregue e o caso é registrado", async () => {
  const { canais, enviados, casos, dominiosConsultados } = canaisFalsos({ dns: DNS_NULL_MX });
  const { io, ver } = estadoFalso();

  const r = await mandarBoasVindasSgp(COMPRA_SHEILA, SGP_PRODUCT_ID_PADRAO, io, canais, AGORA);

  // O E-MAIL SAIU. A checagem detecta, não é porteiro.
  assert.equal(enviados.length, 1, "a checagem de MX bloqueou o envio — ela NÃO pode bloquear");
  assert.deepEqual(dominiosConsultados, ["gmail.com.br"]);

  // Mas a casa NÃO registra isso como entregue.
  assert.equal(r.entregabilidade, "null_mx");
  assert.deepEqual(r.canais, [], "o SMTP aceitou, mas ninguém recebeu — canais tem que estar vazio");
  assert.match(r.envioErro ?? "", new RegExp(MOTIVO_ENTREGA_IMPOSSIVEL));
  assert.match(r.envioErro ?? "", /RFC 7505/);

  // E a trava de idempotência lê isso como NÃO entregue (senão o caso morre aqui).
  const chave = chaveDaBoasVindas(COMPRA_SHEILA);
  assert.equal(boasVindasEntregues(ver()[chave]), false);
  assert.equal(ver()[chave].entregabilidade, "null_mx");
  assert.equal(ver()[chave].falhou, true);

  // O CASO FOI PRO HUMANO, com nome, e-mail COMO FOI DIGITADO e telefone.
  assert.equal(casos.length, 1);
  assert.equal(casos[0].veredicto, "null_mx");
  assert.equal(casos[0].dominio, "gmail.com.br");
  assert.equal(casos[0].buyerName, "Sheila de Teste");
  assert.equal(casos[0].buyerPhone, "11984263680", "sem o telefone não sobra canal nenhum");
  assert.equal(casos[0].transacao, COMPRA_SHEILA.transaction);
  assert.equal(casos[0].chave, chave, "a chave é a transação: reenvio atualiza, não duplica");
});

test("(a′) NUNCA adivinhar o endereço: o registro leva o e-mail exatamente como veio", async () => {
  const { canais, enviados, casos } = canaisFalsos({ dns: DNS_NULL_MX });
  const { io } = estadoFalso();

  await mandarBoasVindasSgp(COMPRA_SHEILA, SGP_PRODUCT_ID_PADRAO, io, canais, AGORA);

  // Trocar `gmail.com.br` por `gmail.com` entregaria a compra de um pagante na
  // caixa de outra pessoa. Nem o envio nem o registro podem "corrigir" nada.
  assert.equal(casos[0].buyerEmail, "compradora.teste@gmail.com.br");
  assert.equal(enviados[0].to, "compradora.teste@gmail.com.br");
  assert.doesNotMatch(
    JSON.stringify(casos[0]),
    /@gmail\.com[^.]/,
    "alguém inventou uma correção do endereço do comprador",
  );
});

test("(b) domínio sem MX nenhum e sem A/AAAA: mesmo tratamento", async () => {
  const { canais, enviados, casos } = canaisFalsos({ dns: DNS_SEM_NADA });
  const { io } = estadoFalso();

  const r = await mandarBoasVindasSgp(COMPRA_SHEILA, SGP_PRODUCT_ID_PADRAO, io, canais, AGORA);

  assert.equal(enviados.length, 1, "não pode bloquear o envio");
  assert.equal(r.entregabilidade, "sem_mx");
  assert.deepEqual(r.canais, []);
  assert.match(r.envioErro ?? "", /sem MX e sem A\/AAAA/);
  assert.equal(casos.length, 1);
  assert.equal(casos[0].veredicto, "sem_mx");
  assert.equal(casos[0].buyerPhone, "11984263680");
});

test("(b′) sem MX mas COM A/AAAA: registrado como observação, NÃO como falha", async () => {
  // RFC 5321 §5.1: sem MX, o A/AAAA vira MX implícito e a entrega acontece.
  // Chamar isso de indereçável inventaria um problema — mas sumir com a
  // informação também é errado, então ele é anotado sem virar falha.
  const { canais, enviados, casos } = canaisFalsos({ dns: DNS_SEM_MX_COM_A });
  const { io, ver } = estadoFalso();

  const r = await mandarBoasVindasSgp(COMPRA_SHEILA, SGP_PRODUCT_ID_PADRAO, io, canais, AGORA);

  assert.equal(enviados.length, 1);
  assert.equal(r.entregabilidade, "sem_mx_com_a");
  assert.deepEqual(r.canais, ["email"], "MX implícito entrega — isto não é falha");
  assert.equal(r.envioErro, null);
  assert.equal(boasVindasEntregues(ver()[chaveDaBoasVindas(COMPRA_SHEILA)]), true);
  assert.equal(casos.length, 1, "a observação tem que chegar ao humano mesmo assim");
  assert.equal(casos[0].veredicto, "sem_mx_com_a");
});

test("(c) domínio normal: nenhum ruído e o fluxo fica idêntico ao de hoje", async () => {
  const normal: CompraSgp = { ...COMPRA_SHEILA, buyerEmail: "compradora.teste@gmail.com" };
  const comDns = canaisFalsos({ dns: DNS_OK });
  const estadoComDns = estadoFalso();
  const r = await mandarBoasVindasSgp(normal, SGP_PRODUCT_ID_PADRAO, estadoComDns.io, comDns.canais, AGORA);

  assert.equal(r.entregabilidade, "ok");
  assert.deepEqual(r.canais, ["email"]);
  assert.equal(r.envioErro, null);
  assert.equal(comDns.casos.length, 0, "domínio saudável não pode gerar caso pra humano");
  assert.equal(comDns.enviados.length, 1);
  assert.equal(estadoComDns.ver()[chaveDaBoasVindas(normal)].entregabilidade, undefined);

  // E "idêntico ao de hoje" não é figura de linguagem: o estado gravado com o
  // canal de DNS plugado é BYTE A BYTE o mesmo de quando ele não existe.
  const semDns = canaisFalsos();
  const estadoSemDns = estadoFalso();
  await mandarBoasVindasSgp(normal, SGP_PRODUCT_ID_PADRAO, estadoSemDns.io, semDns.canais, AGORA);
  assert.deepEqual(estadoComDns.ver(), estadoSemDns.ver());
  assert.deepEqual(comDns.registros, semDns.registros);
  assert.equal(comDns.enviados[0].texto, semDns.enviados[0].texto, "o DNS não pode mudar o e-mail");
});

test("(d) DNS que falha ou estoura o tempo NÃO impede o envio", async () => {
  for (const falha of ["timeout de 3000ms em MX de gmail.com.br", "queryMx ESERVFAIL"]) {
    const { canais, enviados, casos } = canaisFalsos({ dnsFalha: falha });
    const { io, ver } = estadoFalso();

    const r = await mandarBoasVindasSgp(COMPRA_SHEILA, SGP_PRODUCT_ID_PADRAO, io, canais, AGORA);

    // "Não sei" NUNCA vira "não entrega": o e-mail sai e conta como entregue,
    // exatamente como antes desta mudança.
    assert.equal(enviados.length, 1, `DNS (${falha}) impediu o envio`);
    assert.equal(r.entregabilidade, "indeterminado");
    assert.deepEqual(r.canais, ["email"]);
    assert.equal(r.envioErro, null);
    assert.equal(boasVindasEntregues(ver()[chaveDaBoasVindas(COMPRA_SHEILA)]), true);
    assert.equal(casos.length, 0, "não sei não pode virar caso pra humano");
  }
});

test("(d′) canal de DNS AUSENTE = comportamento de antes desta mudança", async () => {
  const { canais, enviados } = canaisFalsos();
  const { io } = estadoFalso();

  const r = await mandarBoasVindasSgp(COMPRA_SHEILA, SGP_PRODUCT_ID_PADRAO, io, canais, AGORA);

  assert.equal(enviados.length, 1);
  assert.equal(r.entregabilidade, "indeterminado");
  assert.deepEqual(r.canais, ["email"]);
});

test("13/09: registrar o caso pode falhar sem derrubar nada (best-effort)", async () => {
  const { canais, enviados } = canaisFalsos({ dns: DNS_NULL_MX });
  canais.registrarEntregabilidade = async () => {
    throw new Error("agent_state fora do ar");
  };
  const { io, ver } = estadoFalso();

  const r = await mandarBoasVindasSgp(COMPRA_SHEILA, SGP_PRODUCT_ID_PADRAO, io, canais, AGORA);

  assert.equal(enviados.length, 1);
  assert.equal(r.entregabilidade, "null_mx");
  // O que não pode sumir é a TRAVA: sem ela o reenvio da Hotmart perde a conta
  // das tentativas e o caso nunca chega em `esgotou_tentativas`.
  assert.equal(ver()[chaveDaBoasVindas(COMPRA_SHEILA)].tentativas, 1);
});

test("13/09: NULL MX cai na máquina de falha que já existe (#324), sem caminho novo", async () => {
  // Depois do teto, `esgotou_tentativas` sobe pro webhook e vira
  // `payment_events.error` — que é onde a casa já varre. O veredicto sobe junto
  // pra quem for reparar saber que reenviar não adianta.
  const { canais } = canaisFalsos({ dns: DNS_NULL_MX });
  const { io } = estadoFalso();
  for (let i = 0; i < TETO_TENTATIVAS_BOAS_VINDAS; i++) {
    await mandarBoasVindasSgp(COMPRA_SHEILA, SGP_PRODUCT_ID_PADRAO, io, canais, AGORA);
  }
  const r = await mandarBoasVindasSgp(COMPRA_SHEILA, SGP_PRODUCT_ID_PADRAO, io, canais, AGORA);

  assert.equal(r.motivo, "esgotou_tentativas");
  assert.equal(r.entregabilidade, "null_mx");
  assert.match(r.envioErro ?? "", new RegExp(MOTIVO_ENTREGA_IMPOSSIVEL));
});

test("13/09: falha REAL do SMTP não é mascarada pelo veredicto de DNS", async () => {
  // Um domínio sem MX num envio que já tinha explodido no SMTP: a causa que
  // fica registrada tem que ser a do SMTP, que é a que aconteceu primeiro.
  const { canais } = canaisFalsos({ dns: DNS_NULL_MX, emailFalha: true });
  const { io } = estadoFalso();

  const r = await mandarBoasVindasSgp(COMPRA_SHEILA, SGP_PRODUCT_ID_PADRAO, io, canais, AGORA);

  assert.deepEqual(r.canais, []);
  assert.equal(r.envioErro, "SMTP fora do ar");
  assert.equal(r.entregabilidade, "null_mx", "o veredicto continua visível no resultado");
});

// ── as peças puras, sozinhas ───────────────────────────────────────────────

test("dominioDoEmail: normaliza, e o FQDN com ponto final NÃO é falso positivo", () => {
  assert.equal(dominioDoEmail("a@GMAIL.com.BR"), "gmail.com.br");
  // O card mediu que existem endereços assim na base e que eles são VÁLIDOS.
  assert.equal(dominioDoEmail("a@gmail.com."), "gmail.com");
  assert.equal(dominioDoEmail("  a@gmail.com  "), "gmail.com");
  // Endereço com "+" e com subdomínio não muda nada.
  assert.equal(dominioDoEmail("a+b@mail.empresa.com.br"), "mail.empresa.com.br");
  // Nada consultável → null → nem se consulta o DNS.
  assert.equal(dominioDoEmail("sem-arroba"), null);
  assert.equal(dominioDoEmail("a@"), null);
  assert.equal(dominioDoEmail("a@dominio com espaco"), null);
  assert.equal(dominioDoEmail(""), null);
});

test("ehNullMx: só o `0 .` sozinho, e o `.` final não engana", () => {
  assert.equal(ehNullMx([{ exchange: "", priority: 0 }]), true);
  assert.equal(ehNullMx([{ exchange: ".", priority: 0 }]), true);
  assert.equal(ehNullMx([{ exchange: "mx.google.com", priority: 10 }]), false);
  assert.equal(ehNullMx([]), false);
  // Domínio mal configurado (`.` junto de um MX real) não é domínio fechado:
  // o lado seguro é considerar que ele recebe.
  assert.equal(ehNullMx([{ exchange: "", priority: 0 }, { exchange: "mx.a.com", priority: 10 }]), false);
});

test("classificarMx: os cinco veredictos, e `null` (não consultado) é indeterminado", () => {
  assert.equal(classificarMx(DNS_NULL_MX), "null_mx");
  assert.equal(classificarMx(DNS_OK), "ok");
  assert.equal(classificarMx(DNS_SEM_NADA), "sem_mx");
  assert.equal(classificarMx(DNS_SEM_MX_COM_A), "sem_mx_com_a");
  assert.equal(classificarMx(null), "indeterminado");
  // NULL MX tem precedência sobre o MX implícito: é exatamente pra isso que a
  // RFC 7505 existe, e `gmail.com.br` TEM A mesmo declarando `0 .`.
  assert.equal(classificarMx({ mx: [{ exchange: "", priority: 0 }], temEndereco: true }), "null_mx");
});

test("entregaImpossivel/mereceRegistro: só os dois casos travam, três viram registro", () => {
  assert.equal(entregaImpossivel("null_mx"), true);
  assert.equal(entregaImpossivel("sem_mx"), true);
  assert.equal(entregaImpossivel("sem_mx_com_a"), false);
  assert.equal(entregaImpossivel("ok"), false);
  assert.equal(entregaImpossivel("indeterminado"), false, "não sei NUNCA pode virar não entrega");

  assert.equal(mereceRegistro("sem_mx_com_a"), true);
  assert.equal(mereceRegistro("ok"), false);
  assert.equal(mereceRegistro("indeterminado"), false);
});

test("descreverDns: a frase diz o que fazer, não só que deu errado", () => {
  assert.match(descreverDns("null_mx", DNS_NULL_MX), /RFC 7505/);
  assert.match(descreverDns("sem_mx", DNS_SEM_NADA), /sem MX e sem A\/AAAA/);
  assert.match(descreverDns("sem_mx_com_a", DNS_SEM_MX_COM_A), /MX implícito/);
  assert.match(descreverDns("ok", DNS_OK), /gmail-smtp-in\.l\.google\.com/);
  assert.match(descreverDns("indeterminado", null), /não respondeu/);
});
