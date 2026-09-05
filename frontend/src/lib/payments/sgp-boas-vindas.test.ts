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
  opts: { emailFalha?: boolean; conta?: "criada" | "ja_tinha" | "falhou" } = {},
) {
  const enviados: Array<{ to: string; assunto: string; texto: string }> = [];
  const registros: Array<{ email: string; ok: boolean; erro: string | null }> = [];
  const contas: Array<{ email: string; nome: string | null }> = [];
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
  };
  return { canais, enviados, registros, contas };
}

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

test("o e-mail NÃO promete acesso ao FastCloner (regra do Lucas, 31/08)", () => {
  const { texto } = montarBoasVindas(compraDoPayload(PAYLOAD_SGP));
  assert.match(
    texto,
    /NÃO inclui a assinatura da plataforma FastCloner/,
    "sem esta frase o e-mail vira a origem do engano do Celso/Caio/Ranieri",
  );
  // e não pode convidar a pessoa a "acessar a plataforma" como se fosse dela
  assert.doesNotMatch(texto, /seu acesso (à|a) plataforma/i);
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
      erro: "generateLink não devolveu action_link",
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
  assert.match(r.contaErro ?? "", /action_link/);
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
