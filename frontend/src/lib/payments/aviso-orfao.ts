/**
 * Aviso de COMPRA ÓRFÃ — decisão, texto e orquestração (módulo PURO).
 *
 * POR QUE ESTE ARQUIVO EXISTE (incidente #239, Tiago, 02/09/2026):
 * o aviso já existia no webhook (`alertOrphanPurchase`) e NUNCA chegou em
 * ninguém. Medição de 03/09: 665 e-mails varridos na conta do Resend, de
 * 05/08 até 02/09, com ~46 aprovações órfãs no mesmo período — ZERO e-mails
 * "Compra aprovada SEM conta na plataforma". O aviso rodava e o envio morria
 * em silêncio, porque o código descartava o `boolean` do `sendEmail` e
 * engolia exceção num `catch {}` vazio: não havia como saber que ele falhou.
 *
 * Três coisas mudam aqui, e as três são o conserto:
 *  1. CANAL — o padrão da casa é o Telegram (mesmo par de envs do
 *     `tell_frank` em /api/v1/agent/actions). E-mail vira REFORÇO, não o
 *     único caminho.
 *  2. REGISTRO DURÁVEL — igual ao `tell_frank`: grava em `agent_state` ANTES
 *     de tentar qualquer canal. Recado que chega tarde é melhor que recado
 *     perdido, e o resultado de CADA canal fica gravado — silêncio deixa de
 *     ser indistinguível de sucesso.
 *  3. IDEMPOTÊNCIA — um entitlement avisa UMA vez. Renovação e reprocessamento
 *     do mesmo `external_id` não avisam de novo.
 *
 * O que este módulo NÃO faz, de propósito: adivinhar a conta do comprador.
 * Casar por nome ou por prefixo de e-mail é chute, e chute aqui libera produto
 * pago pra quem não pagou. O vínculo continua humano — a máquina só avisa.
 *
 * PURO de propósito: sem `@/` (o runner `node --test` não resolve o alias),
 * sem Next e sem Supabase. Os canais entram por parâmetro, então o fluxo
 * inteiro — inclusive a idempotência — é testável em `aviso-orfao.test.ts`.
 */

/** Tudo que a pessoa precisa pra agir, extraído do payload da Hotmart. */
export type CompraOrfa = {
  eventType: string;
  buyerEmail: string;
  buyerName: string | null;
  productCode: string | null;
  productName: string | null;
  /** número da cobrança (data.purchase.transaction) */
  transaction: string | null;
  /** chave do entitlement: código do assinante na assinatura */
  externalId: string;
};

export type RegistroAviso = {
  at: string;
  buyerEmail: string;
  /** canais que ACEITARAM o aviso (telegram / email); vazio = ninguém recebeu */
  canais: string[];
};

/** Estado persistido em `agent_state` (sem migration), chaveado por entitlement. */
export type EstadoAvisos = Record<string, RegistroAviso>;

export type MotivoAviso =
  | "enviado"
  | "ja_avisado"
  | "evento_nao_libera"
  | "produto_de_fora"
  | "sem_email_do_comprador";

export type ResultadoAviso = {
  /** true só quando ESTE evento gerou um aviso novo (mesmo que um canal falhe) */
  avisou: boolean;
  motivo: MotivoAviso;
  /** canais que aceitaram o aviso; vazio com motivo "enviado" = NINGUÉM recebeu */
  canais: string[];
};

/** Canais de saída. Cada um devolve true quando ACEITOU o aviso. */
export type CanaisAviso = {
  /** grava o recado durável (agent_state) — roda ANTES dos canais voláteis */
  registrar: (chave: string, aviso: TextoAviso, dados: CompraOrfa) => Promise<void>;
  telegram: (texto: string) => Promise<boolean>;
  email: (assunto: string, html: string) => Promise<boolean>;
};

/** Leitura/escrita do estado de idempotência. */
export type EstadoAvisosIO = {
  ler: () => Promise<EstadoAvisos>;
  gravar: (estado: EstadoAvisos) => Promise<void>;
};

export type TextoAviso = { assunto: string; texto: string; html: string };

/** Só evento que LIBERA acesso vira aviso. Revogação/pendência não. */
const EVENTOS_QUE_LIBERAM = new Set(["PURCHASE_APPROVED", "PURCHASE_COMPLETE"]);

/**
 * Chave de idempotência. Na assinatura o `external_id` é o código do
 * assinante e não muda na renovação — é exatamente o que a gente quer avisar
 * uma vez só. Quando o payload não trouxe id nenhum (fallback
 * `EVENTO:unknown`), cai no e-mail do comprador pra não avisar em loop.
 */
export function chaveDoAviso(d: Pick<CompraOrfa, "externalId" | "buyerEmail">): string {
  const id = (d.externalId ?? "").trim();
  return id && !id.endsWith(":unknown") ? id : `email:${d.buyerEmail.trim().toLowerCase()}`;
}

/**
 * O evento merece aviso?
 *
 * A trava de PRODUTO é o que separa CURSO de ASSINATURA. Curso (Fábrica de
 * Conteúdo Invisível, Sistema de Geração Pronto) NÃO dá acesso ao FastCloner:
 * avisar "compra sem conta" por causa de curso é ruído, e ruído faz o time
 * parar de ler o alerta. O webhook já descarta outro produto antes de chegar
 * aqui (route.ts: `ignored_other_product`); esta é a segunda barreira, pra
 * decisão e teste morarem no mesmo lugar.
 *
 * `productCode` nulo com `nossoProduto` configurado NÃO avisa: sem saber o
 * produto, o silêncio é mais barato que o ruído — o sweeper diário
 * (orphan-outreach) ainda cobre esse caso.
 */
export function deveAvisar(args: {
  eventType: string;
  productCode: string | null;
  nossoProduto: string | null | undefined;
  buyerEmail: string | null;
}): { ok: true } | { ok: false; motivo: MotivoAviso } {
  if (!EVENTOS_QUE_LIBERAM.has(args.eventType.toUpperCase())) {
    return { ok: false, motivo: "evento_nao_libera" };
  }
  if (!args.buyerEmail || !args.buyerEmail.trim()) {
    return { ok: false, motivo: "sem_email_do_comprador" };
  }
  if (args.nossoProduto && args.productCode !== args.nossoProduto) {
    return { ok: false, motivo: "produto_de_fora" };
  }
  return { ok: true };
}

const traco = (v: string | null | undefined) => (v && v.trim() ? v.trim() : "—");

/**
 * Texto do aviso. Ordem obrigatória (regra do Johnny/Lucas de 01/09): primeiro
 * O QUE FAZER, em português simples, pra quem ATENDE e não mexe em código;
 * os dados brutos vêm depois. Aviso que só diz "compra órfã" obriga a
 * investigar do zero — este já entrega tudo que a ação exige.
 */
export function montarAviso(d: CompraOrfa): TextoAviso {
  const nome = traco(d.buyerName);
  const dados: Array<[string, string]> = [
    ["E-mail da compra", d.buyerEmail],
    ["Comprador", nome],
    ["Produto", `${traco(d.productName)} (${traco(d.productCode)})`],
    ["Transação", traco(d.transaction)],
    ["Assinatura (external_id)", traco(d.externalId)],
    ["Evento", d.eventType],
  ];

  const oQueFazer = [
    `1. Falar com ${nome} no e-mail ${d.buyerEmail} e perguntar com QUAL e-mail ele entra no FastCloner.`,
    "2. Com a resposta na mão, um humano vincula a compra à conta. NÃO adivinhe pelo nome nem pelo começo do e-mail.",
    "3. Até vincular, ele está PAGANDO e SEM ACESSO. Tratar como urgente.",
  ];

  const assunto = `⚠️ Compra paga SEM conta na plataforma: ${d.buyerEmail}`;

  const texto = [
    assunto,
    "",
    "O QUE FAZER",
    ...oQueFazer,
    "",
    "DADOS",
    ...dados.map(([k, v]) => `${k}: ${v}`),
  ].join("\n");

  const html =
    `<p><strong>Uma compra foi aprovada e não existe conta com o e-mail do comprador.</strong> ` +
    `O acesso e os créditos ficam parados até alguém vincular.</p>` +
    `<p><strong>O QUE FAZER</strong></p><ol>${oQueFazer
      .map((l) => `<li>${escapar(l.replace(/^\d+\.\s*/, ""))}</li>`)
      .join("")}</ol>` +
    `<p><strong>DADOS</strong></p><ul>${dados
      .map(([k, v]) => `<li><strong>${escapar(k)}:</strong> ${escapar(v)}</li>`)
      .join("")}</ul>`;

  return { assunto, texto, html };
}

/** Escape local: o módulo é puro e não importa o helper do Resend (alias `@/`). */
export function escapar(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);
}

/**
 * Avisa a equipe UMA vez por entitlement.
 *
 * Ordem proposital: decide → checa idempotência → GRAVA o durável → dispara os
 * canais → grava o estado com o resultado de cada canal. O durável primeiro
 * porque foi justamente o canal volátil que falhou calado no #239.
 *
 * Marca como avisado mesmo se TODOS os canais falharem — senão a Hotmart
 * reenviando o evento viraria uma rajada de tentativas. O que denuncia a falha
 * é `canais: []` no retorno e no estado, que o chamador registra em
 * `payment_events.error`.
 */
export async function avisarCompraOrfa(
  d: CompraOrfa,
  nossoProduto: string | null | undefined,
  io: EstadoAvisosIO,
  canais: CanaisAviso,
  agoraIso: string,
): Promise<ResultadoAviso> {
  const decisao = deveAvisar({
    eventType: d.eventType,
    productCode: d.productCode,
    nossoProduto,
    buyerEmail: d.buyerEmail,
  });
  if (!decisao.ok) return { avisou: false, motivo: decisao.motivo, canais: [] };

  const chave = chaveDoAviso(d);
  const estado = await io.ler();
  if (estado[chave]) return { avisou: false, motivo: "ja_avisado", canais: estado[chave].canais };

  const aviso = montarAviso(d);
  await canais.registrar(chave, aviso, d);

  const entregues: string[] = [];
  if (await canais.telegram(aviso.texto)) entregues.push("telegram");
  if (await canais.email(aviso.assunto, aviso.html)) entregues.push("email");

  estado[chave] = { at: agoraIso, buyerEmail: d.buyerEmail, canais: entregues };
  await io.gravar(estado);

  return { avisou: true, motivo: "enviado", canais: entregues };
}
