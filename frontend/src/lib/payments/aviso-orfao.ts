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
 * ─────────────────────────────────────────────────────────────────────────────
 * SEGUNDA CORREÇÃO (09/09/2026): O WEBHOOK NÃO PODE DECIDIR ISSO
 *
 * O conserto acima resolveu "o aviso não chega". Criou o problema oposto: o
 * aviso passou a chegar sempre, e quase sempre errado. Medidos 7 disparos em 3
 * dias, todos falsos (vinicius, alfredo, brunno, andreviana, herysilva,
 * marilia, mateusnodesence); o último saiu 30 SEGUNDOS depois da compra, e no
 * caso `mariliarossini` a aluna JÁ tinha conta criada, entitlement vinculado e
 * 100.000 créditos no instante em que o alerta gritou "PAGANDO E SEM ACESSO".
 * Cinco dos sete eram trial de R$ 0 rotulado como "PAGANDO".
 *
 * A causa é ESTRUTURAL, não é uma guarda faltando: `avisarCompraOrfa` roda de
 * dentro do webhook da Hotmart, e o comprador paga na Hotmart ANTES de existir
 * conta na plataforma (quando o fluxo funciona, o perfil nasce ~3s depois).
 * No instante do disparo a conta nunca existe e a idade da compra é sempre
 * zero — nenhuma guarda de idade é possível ali, ela seria `0 > carência`,
 * falsa pra todo mundo, sempre.
 *
 * Então o webhook para de decidir e passa a só OBSERVAR (`observarCompraOrfa`):
 * grava o registro durável e não toca em canal volátil. Quem decide e notifica
 * é o sweeper diário (`orphan-outreach.ts`), que enxerga a idade real e
 * RE-VERIFICA se o caso ainda está órfão (`podeNotificarOrfao`).
 *
 * ⚠️ A ARMADILHA QUE ISSO QUASE VIROU, e o motivo dos estados serem separados:
 * se o registro do webhook fosse gravado na MESMA chave que o dedupe de quem
 * notifica, o sweeper leria "esse já foi avisado" em TODO mundo e nunca mais
 * falaria. Trocaríamos ruído por SILÊNCIO TOTAL, que é estritamente pior — é o
 * #239 de volta por outra porta. Por isso o webhook escreve em
 * `orphan_observacoes`, chave só de observação que ninguém lê pra decidir se
 * notifica, e o dedupe de quem fala continua sendo o `orphan_invites` do
 * sweeper.
 * ─────────────────────────────────────────────────────────────────────────────
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

/**
 * Por que este evento NÃO interessa. É a única parte da decisão que o webhook
 * ainda pode tomar sozinho: ela não depende do tempo nem do estado da conta,
 * só do próprio payload.
 */
export type MotivoRecusa = "evento_nao_libera" | "produto_de_fora" | "sem_email_do_comprador";

export type MotivoAviso = "enviado" | "ja_avisado" | MotivoRecusa;

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

/**
 * O que o webhook grava por entitlement observado. Repare no que NÃO tem aqui:
 * `canais`. Observação não é aviso, e este registro não autoriza ninguém a
 * ficar calado depois — ver o bloco "SEGUNDA CORREÇÃO" no topo.
 */
export type RegistroObservacao = {
  at: string;
  buyerEmail: string;
  externalId: string;
};

/** Estado da OBSERVAÇÃO (agent_state `orphan_observacoes`), nunca do aviso. */
export type EstadoObservacoes = Record<string, RegistroObservacao>;

export type ObservacoesIO = {
  ler: () => Promise<EstadoObservacoes>;
  gravar: (estado: EstadoObservacoes) => Promise<void>;
};

export type ResultadoObservacao = {
  registrou: boolean;
  motivo: "registrado" | "ja_registrado" | MotivoRecusa;
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
}): { ok: true } | { ok: false; motivo: MotivoRecusa } {
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

/** Os dados brutos da compra, iguais no aviso e na observação. */
function dadosDaCompra(d: CompraOrfa): Array<[string, string]> {
  return [
    ["E-mail da compra", d.buyerEmail],
    ["Comprador", traco(d.buyerName)],
    ["Produto", `${traco(d.productName)} (${traco(d.productCode)})`],
    ["Transação", traco(d.transaction)],
    ["Assinatura (external_id)", traco(d.externalId)],
    ["Evento", d.eventType],
  ];
}

/**
 * Texto do aviso. Ordem obrigatória (regra do Johnny/Lucas de 01/09): primeiro
 * O QUE FAZER, em português simples, pra quem ATENDE e não mexe em código;
 * os dados brutos vêm depois. Aviso que só diz "compra órfã" obriga a
 * investigar do zero — este já entrega tudo que a ação exige.
 */
export function montarAviso(d: CompraOrfa): TextoAviso {
  const nome = traco(d.buyerName);
  const dados = dadosDaCompra(d);

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

/**
 * Texto do REGISTRO do webhook. Não é o texto do aviso, e a diferença é o
 * ponto: no instante do webhook a conta ainda não teve tempo de nascer, então
 * chamar isso de "PAGANDO E SEM ACESSO, tratar como urgente" (que é o que o
 * `montarAviso` diz, e diz certo depois da carência) seria só mudar o falso
 * positivo de lugar — do Telegram pro registro que a gente lê depois.
 *
 * Os DADOS são os mesmos; o que muda é a frase de cima, que diz a verdade do
 * momento: ainda não é um problema, e quem confere é o sweeper.
 */
export function montarObservacao(d: CompraOrfa): TextoAviso {
  const dados = dadosDaCompra(d);
  const assunto = `Registro: compra aprovada antes da conta existir — ${d.buyerEmail}`;
  const explicacao =
    "ISTO NÃO É UM ALERTA. É o registro de que a compra chegou e a conta ainda " +
    "não existia — o que é NORMAL, porque a pessoa paga na Hotmart antes de se " +
    `cadastrar. Se em ${CARENCIA_ORFAO_MS / (60 * 60 * 1000)}h ela ainda não ` +
    "tiver conta, o sweeper diário (orphan-outreach) fala com ela. Nada a fazer aqui.";

  const texto = [assunto, "", explicacao, "", "DADOS", ...dados.map(([k, v]) => `${k}: ${v}`)].join("\n");

  const html =
    `<p><strong>Isto não é um alerta.</strong> ${escapar(explicacao)}</p>` +
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
 * ⚠️ NENHUM caminho de produção chama esta função hoje (09/09/2026), e isso é
 * de propósito, não esquecimento. Ela era chamada pelo webhook, que é
 * exatamente onde ela não podia estar (bloco "SEGUNDA CORREÇÃO" no topo). O
 * webhook agora usa `observarCompraOrfa`; quem fala com o comprador é o
 * sweeper. O aviso PRA EQUIPE ("vá vincular à mão") ficou sem emissor, e
 * religá-lo no sweeper é uma decisão que precisa de gente: no dia em que este
 * card foi escrito havia 42 entitlements órfãos ativos acumulados (37 com mais
 * de 7 dias), então o primeiro sweep depois de religar mandaria uma rajada de
 * dezenas de mensagens de uma vez. Fica aqui, testada e pronta, com o problema
 * escrito em vez de escondido.
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

/**
 * O que o webhook faz agora: ANOTA que a compra chegou sem conta, e cala a
 * boca. Sem Telegram, sem e-mail — no instante do webhook não existe fato que
 * justifique acordar alguém (a conta ainda não teve tempo de nascer).
 *
 * O registro durável continua, e ele é o ponto: é o rastro que deixa o caso
 * auditável mesmo que o sweeper falhe amanhã. Idempotente por entitlement, com
 * estado PRÓPRIO (`ObservacoesIO` → `orphan_observacoes`), separado do dedupe
 * de quem notifica. Quem escreve aqui não silencia ninguém.
 */
export async function observarCompraOrfa(
  d: CompraOrfa,
  nossoProduto: string | null | undefined,
  io: ObservacoesIO,
  registrar: CanaisAviso["registrar"],
  agoraIso: string,
): Promise<ResultadoObservacao> {
  const decisao = deveAvisar({
    eventType: d.eventType,
    productCode: d.productCode,
    nossoProduto,
    buyerEmail: d.buyerEmail,
  });
  if (!decisao.ok) return { registrou: false, motivo: decisao.motivo };

  const chave = chaveDoAviso(d);
  const estado = await io.ler();
  if (estado[chave]) return { registrou: false, motivo: "ja_registrado" };

  await registrar(chave, montarObservacao(d), d);

  estado[chave] = { at: agoraIso, buyerEmail: d.buyerEmail, externalId: d.externalId };
  await io.gravar(estado);

  return { registrou: true, motivo: "registrado" };
}

/**
 * Quanto tempo a casa espera antes de tratar uma compra sem conta como
 * problema. Seis horas.
 *
 * De onde vem o número: quando o fluxo funciona, o perfil nasce SEGUNDOS depois
 * da compra (medido: 3s no caso Hugo Correa, 09/09). Qualquer coisa em minutos
 * já seria folga suficiente pro caminho feliz. Seis horas é folga pro caminho
 * infeliz mas normal — quem compra no celular, fecha o app e só vai criar a
 * conta à noite. Abaixo disso a gente volta a alarmar por gente que ainda ia
 * entrar; muito acima disso, o pagante travado espera demais.
 */
export const CARENCIA_ORFAO_MS = 6 * 60 * 60 * 1000;

export type MotivoNaoNotificar =
  | "sem_data_de_compra"
  | "conta_criada"
  | "vinculo_feito"
  | "dentro_da_carencia";

/**
 * "Ainda é órfão, DE VERDADE, agora?" — a guarda que o webhook não tinha como
 * ter. Roda no sweeper, imediatamente antes de falar, contra dados relidos do
 * banco (não contra o que era verdade no começo da varredura).
 *
 * A ordem das checagens é escolhida pelo MOTIVO que ela devolve, porque o
 * motivo é o que vai aparecer no log de quem for investigar: conta e vínculo
 * vêm antes da carência porque são decisivos e definitivos ("não é órfão"),
 * enquanto a carência é só "ainda não é hora".
 *
 * ⚠️ Repare no que esta função NÃO recebe: o VALOR da compra. Silenciar trial
 * de R$ 0 é tentador (5 dos 7 falsos positivos eram trial) e está errado: o
 * trial vira cobrança depois, e aí seria um pagante travado invisível pra
 * sempre. Valor pode ser sinal secundário em outro lugar — aqui não entra.
 *
 * Falha fechada: data ilegível não notifica (mesma escolha do `orphan-ciclo`).
 */
export function podeNotificarOrfao(args: {
  /** ISO da compra que ancora a carência. */
  compradoEm: string | null;
  /** existe perfil com o e-mail DA COMPRA? */
  temConta: boolean;
  /** o entitlement deste comprador já tem `user_id`? */
  vinculado: boolean;
  agoraMs: number;
  carenciaMs?: number;
}): { ok: true } | { ok: false; motivo: MotivoNaoNotificar } {
  if (args.temConta) return { ok: false, motivo: "conta_criada" };
  if (args.vinculado) return { ok: false, motivo: "vinculo_feito" };

  const compra = args.compradoEm ? Date.parse(args.compradoEm) : NaN;
  if (!Number.isFinite(compra)) return { ok: false, motivo: "sem_data_de_compra" };

  const carencia = args.carenciaMs ?? CARENCIA_ORFAO_MS;
  if (args.agoraMs - compra < carencia) return { ok: false, motivo: "dentro_da_carencia" };

  return { ok: true };
}
