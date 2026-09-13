/**
 * O CAMINHO PRÓPRIO DO SGP dentro do varredor de compra órfã — 08/09/2026.
 *
 * POR QUE ESTE ARQUIVO EXISTE
 * O `orphan-outreach.ts` descartava tudo que não fosse o produto 7851642
 * (FastCloner) na PRIMEIRA linha do laço, antes de qualquer guarda. Comprador
 * do SGP (7283229) nunca entrava na varredura: 19 pagantes sem conta, invisíveis.
 *
 * ⚠️ A CORREÇÃO ÓBVIA — trocar a constante por uma lista e usar `includes` —
 * ESTÁ ERRADA POR DOIS MOTIVOS INDEPENDENTES, e os dois foram medidos:
 *
 *  1. MANDARIA PROMESSA FALSA. O texto do convite diz, literalmente, "seus
 *     créditos do FastCloner já estão reservados". Comprador de SGP NÃO TEM
 *     crédito do FastCloner: pela regra comercial do Lucas (31/08) o SGP é
 *     produto SEPARADO e não dá a plataforma. Seria a casa gerando, por e-mail
 *     automático, exatamente a confusão que já produz chamado e pedido de
 *     reembolso toda semana (Celso, Caio, Ranieri).
 *
 *  2. NÃO MANDARIA E-MAIL NENHUM. Este é o motivo que ninguém vê de fora, e
 *     é o pior dos dois: a guarda seguinte, `compradorMereceConvite`, exige um
 *     ENTITLEMENT — e o webhook do SGP não cria entitlement de propósito ("Ele
 *     NÃO ganha acesso, crédito nem entitlement", hotmart/route.ts). Medido em
 *     produção em 08/09: dos 19 órfãos do SGP, 15 não têm entitlement nenhum e
 *     seriam descartados em silêncio. Alargar o filtro entregaria um PR verde,
 *     um card fechado e ZERO e-mails novos pra 15 das 19 pessoas — sucesso
 *     falso, que é mais caro que erro barulhento.
 *
 * Ou seja: o filtro de produto não era só um bug, ele estava PROTEGENDO contra
 * mandar a mensagem errada. O que falta é um caminho próprio, com texto próprio
 * e guardas próprias — que é o que este módulo decide.
 *
 * ⚠️ E AS 4 QUE PASSAM NA GUARDA PASSAM PELO MOTIVO ERRADO. As únicas 4 dos 19
 * que têm entitlement são as 4 compras de 09/06 — de ANTES do commit 4688e40
 * fechar a porta do produto —, e o entitlement delas é `active` com
 * `access_until = NULL`, que a régua `entitlementValeAcesso` lê como VITALÍCIO.
 * São compras de CURSO de ~R$500 segurando um acesso vitalício pendente à
 * plataforma. Isso é dívida de dados anterior a este card e NÃO se conserta
 * aqui (ver o corpo do PR); mas é a prova de que a régua da assinatura não
 * serve pra decidir o SGP nem quando ela deixa passar.
 *
 * A REGRA DO SGP, então, é outra: não se pergunta "tem acesso vivo?" (ele nunca
 * tem, por desenho), pergunta-se "pagou o curso, e alguém já contou pra ele
 * onde fica o portal?".
 *
 * Módulo puro de propósito (sem imports), no mesmo desenho do `orphan-ciclo.ts`
 * e do `sgp-boas-vindas.ts`: dá pra testar sem banco.
 * Rodar:  node --test src/lib/payments/orphan-sgp.test.ts
 */

/** Qual produto esta compra é, pro varredor. */
export type ProdutoDaCompra = "fastcloner" | "sgp" | "outro";

/**
 * Classifica a compra pelo código do produto.
 *
 * ⚠️ A ORDEM IMPORTA e é a mesma do `roteamentoDoProduto` do webhook: o
 * FastCloner é testado PRIMEIRO. Se alguém configurar o SGP com o mesmo id do
 * FastCloner (engano de ambiente), o FastCloner ganha — errar pro lado de
 * mandar o convite com créditos pra quem TEM créditos é muito mais barato que
 * errar pro lado de mandar "não inclui a plataforma" pra quem assinou.
 *
 * Sem id de produto no evento a compra é "outro": o varredor não adivinha. Isso
 * é DIFERENTE do webhook (que trata ausência como "nosso" pra não parar de
 * liberar acesso pago) e a diferença é proposital — aqui o efeito de errar não
 * é deixar de liberar acesso, é MANDAR E-MAIL ERRADO, então falha fechada.
 */
export function produtoDaCompra(args: {
  productId: string | null | undefined;
  produtoFastcloner: string;
  produtoSgp: string;
}): ProdutoDaCompra {
  const id = String(args.productId ?? "").trim();
  if (!id) return "outro";
  if (args.produtoFastcloner && id === args.produtoFastcloner) return "fastcloner";
  if (args.produtoSgp && id === args.produtoSgp) return "sgp";
  return "outro";
}

/**
 * Comprou os DOIS produtos? O FastCloner manda.
 *
 * Quem assinou a plataforma E comprou o curso tem crédito esperando, e o
 * convite do FastCloner é o que fala disso. O aviso do portal do SGP para essa
 * pessoa é problema do webhook (que já o manda na hora da compra), não do
 * varredor de órfão.
 */
export function produtoQueMandaNoConvite(args: {
  comprouFastcloner: boolean;
  comprouSgp: boolean;
}): ProdutoDaCompra {
  if (args.comprouFastcloner) return "fastcloner";
  if (args.comprouSgp) return "sgp";
  return "outro";
}

/** Por que o aviso do SGP sai — ou não sai. Todo motivo é auditável no resumo. */
export type MotivoConviteSgp =
  | "manda"
  | "nao_pagou"
  | "estornado"
  | "ja_recebeu_boas_vindas"
  | "ja_avisado_pelo_varredor"
  | "recente_demais";

export type DecisaoConviteSgp = { manda: boolean; motivo: MotivoConviteSgp };

/**
 * O aviso do portal do SGP sai pra este comprador sem conta?
 *
 * As guardas, e o caso que cada uma existe pra impedir:
 *
 *  1. `pagou` — dinheiro que ENTROU de verdade (valor > 0 E status de
 *     pagamento, a régua do `eventoEhPagamento`). Sem isto, boleto impresso e
 *     Pix não pago viram "sua compra foi confirmada". É o #138 com outra roupa.
 *
 *  2. `estornado` — ⚠️ ESTA É NOVA E É OBRIGATÓRIA AQUI. No caminho do
 *     FastCloner quem barra o estorno é o entitlement (`refunded`/`chargeback`
 *     não valem acesso, #127). O SGP NÃO TEM ENTITLEMENT, então essa proteção
 *     simplesmente não existiria — e o SGP tem GARANTIA INCONDICIONAL DE 7
 *     DIAS, ou seja, é o produto da casa com MAIS chance de estorno. Sem esta
 *     linha, mandaríamos "envie suas fotos, a equipe vai montar seu clone" pra
 *     quem pediu o dinheiro de volta. A fonte aqui é o evento
 *     (PURCHASE_REFUNDED / CHARGEBACK / PROTEST / CANCELED / EXPIRED), porque é
 *     a única que existe pro SGP.
 *
 *  3. `jaRecebeuBoasVindas` — cruzamento com o `agent_state.sgp_boas_vindas`,
 *     que é o registro do e-mail que o WEBHOOK já manda na hora da compra.
 *     Medido em 08/09: 15 dos 19 órfãos JÁ receberam. Sem este cruzamento o
 *     conserto deste card gera 15 e-mails repetidos no primeiro dia — a "leva
 *     dupla" de 06/09 de novo, quando o mesmo aviso saiu 2× por não conferir o
 *     que já tinha sido enviado.
 *
 *  4. `jaAvisadoPeloVarredor` — o dedupe do próprio varredor.
 *     ⚠️ É PARA SEMPRE, e aqui isso está CERTO — ao contrário do FastCloner,
 *     onde o dedupe eterno calava assinante cobrado todo mês (`orphan-ciclo.ts`).
 *     O SGP é COMPRA AVULSA: não existe cobrança nova todo mês pra reabrir
 *     ciclo, então "1 aviso por pessoa" é o teto certo e não silencia ninguém
 *     que esteja pagando de novo.
 *
 *  5. `idadeMs` — a mesma carência do varredor: dá tempo do fluxo normal
 *     (o e-mail do webhook) acontecer antes de a gente falar por cima dele.
 *
 * As guardas de `hasAccount` e `jaTemDono` NÃO moram aqui: são compartilhadas e
 * já rodam antes, no `orphan-outreach.ts`, iguais pros dois produtos.
 */
export function decidirConviteSgp(args: {
  pagou: boolean;
  estornado: boolean;
  jaRecebeuBoasVindas: boolean;
  jaAvisadoPeloVarredor: boolean;
  idadeMs: number;
  carenciaMs: number;
}): DecisaoConviteSgp {
  // Ordem = do mais grave pro mais brando, pra que o motivo registrado no
  // resumo seja o mais informativo quando mais de um se aplica.
  if (!args.pagou) return { manda: false, motivo: "nao_pagou" };
  if (args.estornado) return { manda: false, motivo: "estornado" };
  if (args.jaRecebeuBoasVindas) return { manda: false, motivo: "ja_recebeu_boas_vindas" };
  if (args.jaAvisadoPeloVarredor) return { manda: false, motivo: "ja_avisado_pelo_varredor" };
  if (args.idadeMs < args.carenciaMs) return { manda: false, motivo: "recente_demais" };
  return { manda: true, motivo: "manda" };
}

/**
 * Eventos da Hotmart que significam "o dinheiro voltou ou nunca ficou".
 *
 * `PURCHASE_CANCELED` e `PURCHASE_EXPIRED` entram junto com os estornos de
 * propósito: pro SGP não há entitlement pra dizer o contrário, então o lado
 * seguro é calar. Falso silêncio custa um aviso a menos; falso aviso custa
 * "envie suas fotos" pra quem cancelou.
 */
export const EVENTOS_QUE_DESFAZEM = [
  "PURCHASE_REFUNDED",
  "PURCHASE_CHARGEBACK",
  "PURCHASE_PROTEST",
  "PURCHASE_CANCELED",
  "PURCHASE_EXPIRED",
] as const;

/** O que o `agent_state.orphan_invites_sgp` guarda por e-mail. */
export type RegistroConviteSgp = {
  /** ISO do aviso do portal que o varredor mandou. */
  at: string;
  /** ISO da compra que motivou o aviso — auditoria barata, sem cruzar tabela. */
  compraEm: string | null;
};
