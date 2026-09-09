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
import { entitlementValeAcesso } from "./acesso-regra.ts";

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
 * QUEM CHAMA (09/09/2026): o sweeper diário, e SÓ ele, através de
 * `avisarLoteCompraOrfa` — nunca o webhook, que é exatamente onde esta função
 * não podia estar (bloco "SEGUNDA CORREÇÃO" no topo). Enquanto o emissor não
 * existia, o motivo escrito aqui era a RAJADA: religar direto no sweeper
 * mandaria dezenas de mensagens numa tacada só, porque existe um estoque de
 * órfãos acumulado (medidos 18 compradores pagos sem conta nenhuma em
 * 09/09/2026, 8 deles já com a janela de acesso vencida). A trava de rajada
 * está logo abaixo (`TETO_AVISOS_POR_VARREDURA`) e é ela que autoriza este
 * religamento.
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
  | "dentro_da_carencia"
  | "sem_entitlement"
  | "acesso_encerrado";

/** O entitlement MAIS RECENTE do comprador, relido no instante de notificar. */
export type EstadoEntitlement = { status: string; access_until: string | null };

/**
 * "Ainda é órfão, DE VERDADE, agora?" — a guarda que o webhook não tinha como
 * ter. Roda no sweeper, imediatamente antes de falar, contra dados relidos do
 * banco (não contra o que era verdade no começo da varredura).
 *
 * A ordem das checagens é escolhida pelo MOTIVO que ela devolve, porque o
 * motivo é o que vai aparecer no log de quem for investigar: conta, vínculo e
 * estado do acesso vêm antes da carência porque são decisivos e definitivos
 * ("não é órfão" / "não há o que ativar"), enquanto a carência é só "ainda não
 * é hora".
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * A GUARDA DE ESTADO (09/09/2026) — por que a carência sozinha não bastava
 *
 * A carência de 6h resolve o alerta que dispara em SEGUNDOS (PURCHASE_APPROVED,
 * no webhook). Ela é cega pro `PURCHASE_COMPLETE`, que a Hotmart manda DIAS
 * depois e passa folgado por qualquer carência. Dois casos reais medidos no
 * mesmo dia, e a diferença entre eles não é o tempo nem o valor, é o ESTADO:
 *
 *   FALSO POSITIVO (`gestao10.jessica`, external_id L61J1KMG): trial de R$ 0 em
 *   01/09, PURCHASE_COMPLETE em 09/09 → o alerta gritou "ele está PAGANDO e SEM
 *   ACESSO, tratar como urgente" 8 dias depois. O entitlement dela estava
 *   `canceled` com `access_until` em 08/09, JÁ VENCIDO: ela nunca pagou e o
 *   acesso dela já tinha acabado. As duas afirmações do alerta eram falsas.
 *
 *   VERDADEIRO (`ezwaymotors`, external_id 7D9WG7J8): trial em 25/08, pagou
 *   US$ 20 em 01/09, PURCHASE_COMPLETE em 09/09 → entitlement `active` com
 *   `access_until` em 25/09 (futuro) e `user_id` NULL. Pagante sem acesso de
 *   verdade, 8 dias parado. Esse TEM que continuar sendo notificado.
 *
 * Como a releitura acontece no instante de notificar, ela cobre o evento tardio
 * naturalmente: o que manda é o estado de AGORA, não o do dia da compra.
 *
 * ⚠️ O critério é o ESTADO do entitlement, NUNCA o valor da compra. Silenciar
 * trial de R$ 0 é tentador (5 dos 7 falsos positivos eram trial) e está errado:
 * o trial vira cobrança depois, e aí seria um pagante travado invisível pra
 * sempre. Por isso esta função continua sem receber valor nenhum — o que separa
 * a Jessica do EZ MOTORS é o entitlement, e os dois eram trial na origem.
 *
 * ⚠️ E a regra de acesso é IMPORTADA (`entitlementValeAcesso`), não reescrita.
 * Uma cópia local de "está ativo?" divergiria da regra que abre a porta pro
 * aluno no primeiro ajuste. Consequência que vem de graça e é proposital:
 * `canceled` com `access_until` FUTURO CONTINUA notificando — quem cancela sem
 * nunca ter conseguido entrar cancela justamente por não conseguir entrar, e
 * calar essa pessoa foi o excesso do #127 que a casa já corrigiu em 20/08.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Falha fechada em tudo: data ilegível não notifica, e comprador sem
 * entitlement nenhum também não (não há o que ativar — mesma escolha do
 * `compradorMereceConvite`).
 */
export function podeNotificarOrfao(args: {
  /** ISO da compra que ancora a carência. */
  compradoEm: string | null;
  /** existe perfil com o e-mail DA COMPRA? */
  temConta: boolean;
  /** o entitlement deste comprador já tem `user_id`? */
  vinculado: boolean;
  /** o entitlement MAIS RECENTE deste comprador, relido agora; null = nenhum */
  entitlement: EstadoEntitlement | null;
  agoraMs: number;
  carenciaMs?: number;
}): { ok: true } | { ok: false; motivo: MotivoNaoNotificar } {
  if (args.temConta) return { ok: false, motivo: "conta_criada" };
  if (args.vinculado) return { ok: false, motivo: "vinculo_feito" };

  if (!args.entitlement) return { ok: false, motivo: "sem_entitlement" };
  if (!entitlementValeAcesso(args.entitlement, new Date(args.agoraMs).toISOString())) {
    return { ok: false, motivo: "acesso_encerrado" };
  }

  const compra = args.compradoEm ? Date.parse(args.compradoEm) : NaN;
  if (!Number.isFinite(compra)) return { ok: false, motivo: "sem_data_de_compra" };

  const carencia = args.carenciaMs ?? CARENCIA_ORFAO_MS;
  if (args.agoraMs - compra < carencia) return { ok: false, motivo: "dentro_da_carencia" };

  return { ok: true };
}

/* ══════════════════════════════════════════════════════════════════════════
 * TRAVA DE RAJADA (09/09/2026) — o que faltava pra religar o aviso à equipe
 *
 * A carência e a guarda de estado resolvem "o aviso está ERRADO". Sobrou "o
 * aviso vem TODO DE UMA VEZ": o emissor ficou desligado porque existe um
 * ESTOQUE de órfãos acumulado, e a primeira varredura depois de religar
 * despejaria a pilha inteira no Telegram da equipe. Alerta que chega às
 * dezenas não é lido — é o #239 de novo, agora por excesso em vez de silêncio.
 *
 * O desenho é um teto POR VARREDURA, e a parte que importa não é o teto: é o
 * que acontece com o resto. Quem passa do teto NÃO é avisado, NÃO é marcado
 * como avisado e NÃO é descartado — fica idêntico na fila e é a primeira coisa
 * que a próxima varredura pega, porque a ordem é do MAIS ANTIGO pro mais novo.
 * Com 18 órfãos e teto 5, o estoque drena em 4 varreduras sem nunca perder
 * ninguém e sem nenhuma rajada.
 *
 * ⚠️ CAP SILENCIOSO É PROIBIDO. Um teto que não conta o que ficou de fora
 * transforma "só avisei 5" em "só existem 5 casos" — mentira por omissão, e
 * pior que a rajada, porque a rajada pelo menos é visível. Por isso o resumo
 * carrega `emFila` e `fraseDaFila` existe: toda saída deste lote diz quantos
 * eram, quantos foram e quantos ficaram esperando.
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * Quantos avisos à equipe uma varredura pode disparar. Cinco.
 *
 * De onde vem o número: é quanta coisa uma pessoa lê e AGE no mesmo dia. Cada
 * aviso destes é trabalho manual (falar com o comprador, descobrir o e-mail da
 * conta, vincular à mão); mandar 18 de uma vez não faz o time resolver 18, faz
 * ele parar de ler. Cinco por dia drena o estoque medido em 09/09/2026 (18
 * órfãos) em quatro varreduras, que é rápido o bastante pra quem espera e
 * devagar o bastante pra ser lido.
 *
 * É teto de RAJADA, não de casos: o que não coube continua na fila, inteiro.
 */
export const TETO_AVISOS_POR_VARREDURA = 5;

/** Um órfão confirmado, pronto pra virar aviso. */
export type CandidatoAviso = {
  /**
   * ISO que ancora a ANTIGUIDADE (a compra que deixou a pessoa esperando).
   * É por este campo que a fila se ordena — quem espera há mais tempo passa
   * na frente.
   */
  compradoEm: string;
  compra: CompraOrfa;
};

export type ResumoLoteAvisos = {
  /** órfãos confirmados que chegaram no lote (antes de qualquer corte) */
  candidatos: number;
  /** já tinham aviso registrado; não contam pro teto nem pra fila */
  jaAvisados: number;
  /** avisos que ESTA varredura disparou */
  avisados: number;
  /** cortados pelo teto: continuam elegíveis, intactos, pra próxima varredura */
  emFila: number;
  /** avisados cujos canais voláteis TODOS falharam (só o durável guardou) */
  semCanal: number;
  /** o lote recusou (produto de fora, evento que não libera, sem e-mail) */
  recusados: number;
  /** exceção no meio do aviso: NÃO foi marcado, volta na próxima varredura */
  erros: number;
};

/**
 * Mais antigo primeiro. Data ilegível vai pro FIM (não dá pra provar que é
 * velha, e furar a fila com lixo é como o mais urgente perde a vez), e o
 * desempate é pela chave, pra ordem ser determinística — varredura que embaralha
 * a fila a cada rodada nunca drena estoque nenhum.
 */
function porAntiguidade(a: CandidatoAviso, b: CandidatoAviso): number {
  const ta = Date.parse(a.compradoEm);
  const tb = Date.parse(b.compradoEm);
  const va = Number.isFinite(ta);
  const vb = Number.isFinite(tb);
  if (va && vb && ta !== tb) return ta - tb;
  if (va !== vb) return va ? -1 : 1;
  return chaveDoAviso(a.compra).localeCompare(chaveDoAviso(b.compra));
}

/**
 * Reparte o lote em TRÊS, sem perder ninguém: `avisar` (até o teto, os mais
 * antigos), `fila` (o resto, que a próxima varredura pega) e `jaAvisados`
 * (dedupe — esses não ocupam vaga do teto, senão um estoque de já-avisados
 * travaria a fila pra sempre).
 *
 * Puro de propósito: é aqui que mora a decisão da rajada, e ela é testável sem
 * banco, sem Telegram e sem relógio.
 */
export function selecionarParaAvisar(
  candidatos: CandidatoAviso[],
  estado: EstadoAvisos,
  teto: number = TETO_AVISOS_POR_VARREDURA,
): { avisar: CandidatoAviso[]; fila: CandidatoAviso[]; jaAvisados: CandidatoAviso[] } {
  const jaAvisados: CandidatoAviso[] = [];
  const pendentes: CandidatoAviso[] = [];
  for (const c of candidatos) {
    if (estado[chaveDoAviso(c.compra)]) jaAvisados.push(c);
    else pendentes.push(c);
  }
  pendentes.sort(porAntiguidade);
  const corte = Math.max(0, teto);
  return { avisar: pendentes.slice(0, corte), fila: pendentes.slice(corte), jaAvisados };
}

/**
 * A frase que denuncia a fila. Existe como função pura (e não como um
 * `console.log` solto) pra ser testável: "o teto contou o que ficou de fora" é
 * um requisito, e requisito que ninguém testa é requisito que some no primeiro
 * refactor.
 */
export function fraseDaFila(r: ResumoLoteAvisos, teto: number = TETO_AVISOS_POR_VARREDURA): string {
  const partes = [
    `${r.candidatos} órfão(s) confirmado(s)`,
    `${r.avisados} avisado(s) agora`,
    r.emFila > 0
      ? `${r.emFila} NA FILA pra próxima varredura (teto de ${teto} por varredura — não sumiram)`
      : "fila vazia",
  ];
  if (r.jaAvisados > 0) partes.push(`${r.jaAvisados} já tinham sido avisados antes`);
  if (r.semCanal > 0) partes.push(`${r.semCanal} sem canal volátil (só o registro durável guardou)`);
  if (r.recusados > 0) partes.push(`${r.recusados} recusado(s) pela regra do aviso`);
  if (r.erros > 0) partes.push(`${r.erros} falharam e voltam na próxima (não foram marcados)`);
  return partes.join(" · ");
}

/**
 * Dispara os avisos de UMA varredura, respeitando o teto.
 *
 * Duas escolhas que parecem detalhe e são o coração da coisa:
 *
 * 1. QUEM NÃO COUBE NÃO É TOCADO. O estado só recebe quem `avisarCompraOrfa`
 *    efetivamente processou; a fila não é lida, não é marcada, não é gravada.
 *    Um teto que marcasse o excedente "pra não repetir" seria descarte
 *    silencioso com outro nome, e o pagante travado nunca mais seria assunto.
 *
 * 2. O ESTADO É GRAVADO A CADA AVISO, não uma vez no fim. É `avisarCompraOrfa`
 *    quem grava, e deixar assim é proposital: se a varredura morrer no terceiro
 *    de cinco, os dois primeiros continuam marcados e não viram aviso repetido
 *    amanhã. Um punhado de upserts por dia é barato; alerta duplicado gasta a
 *    paciência de quem lê, que é o recurso que este arquivo inteiro protege.
 *
 * Exceção num candidato NÃO derruba o lote e NÃO marca ninguém: conta em
 * `erros` e o caso volta na próxima varredura (falha fechada em direção a
 * tentar de novo, igual ao resto do fluxo).
 */
export async function avisarLoteCompraOrfa(
  candidatos: CandidatoAviso[],
  nossoProduto: string | null | undefined,
  io: EstadoAvisosIO,
  canais: CanaisAviso,
  agoraIso: string,
  teto: number = TETO_AVISOS_POR_VARREDURA,
  log: (msg: string) => void = (m) => console.log(m),
): Promise<ResumoLoteAvisos> {
  const estado = await io.ler();
  const { avisar, fila, jaAvisados } = selecionarParaAvisar(candidatos, estado, teto);

  const resumo: ResumoLoteAvisos = {
    candidatos: candidatos.length,
    jaAvisados: jaAvisados.length,
    avisados: 0,
    emFila: fila.length,
    semCanal: 0,
    recusados: 0,
    erros: 0,
  };

  for (const c of avisar) {
    try {
      const r = await avisarCompraOrfa(c.compra, nossoProduto, io, canais, agoraIso);
      if (r.avisou) {
        resumo.avisados += 1;
        if (r.canais.length === 0) resumo.semCanal += 1;
      } else if (r.motivo === "ja_avisado") {
        // corrida com outra varredura: o dedupe pegou. Não é erro.
        resumo.jaAvisados += 1;
      } else {
        resumo.recusados += 1;
      }
    } catch (e) {
      resumo.erros += 1;
      log(`[aviso-orfao] aviso de ${c.compra.buyerEmail} falhou (volta na próxima): ${
        e instanceof Error ? e.message : String(e)
      }`);
    }
  }

  log(`[aviso-orfao] ${fraseDaFila(resumo, teto)}`);
  return resumo;
}
