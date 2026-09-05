/**
 * SGP — e-mail de BOAS-VINDAS da compra (pedido do Lucas, 03/09/2026).
 *
 * O QUE O LUCAS PEDIU: quem compra o "Sistema de Geração Pronto" na Hotmart
 * recebe, na hora, um e-mail mandando preencher os dados em /sgp.
 *
 * O BURACO QUE ISSO TAPA, medido em 03/09: 129 compras aprovadas do SGP em 7
 * dias; 35 pessoas (27,1%) criaram conta no FastCloner e ZERO (0,0%) chegaram
 * a começar o portal /sgp. Ninguém avisa essa gente que existe um portal pra
 * preencher — então ninguém preenche.
 *
 * ⚠️ POR QUE O EVENTO SUMIU (medido, não suposto — ver o PR):
 * o produto 7283229 ENTREGAVA PURCHASE_APPROVED no nosso webhook. Ele parou de
 * aparecer em `payment_events` em 09/06/2026 17h37Z porque às 18h50Z daquele
 * mesmo dia subiu o commit 4688e40, que passou a devolver 200
 * `ignored_other_product` — SEM GRAVAR NADA — pra todo produto diferente do
 * HOTMART_PRODUCT_ID. Ou seja: a ausência do 7283229 em `payment_events` é
 * FABRICADA PELO NOSSO CÓDIGO, não é prova de que a Hotmart parou de mandar.
 * Este módulo existe justamente pra reabrir a porta só pro SGP.
 *
 * ⚠️ ABERTURA DE 04/09 (weekly do Lucas, item 1 de 6): a compra aprovada passa a
 * CRIAR A CONTA do comprador na hora, e este mesmo e-mail passa a levar o
 * acesso. Motivo medido: 129 compras em 7 dias e só 2 chegaram ao portal; o
 * e-mail sozinho já converteu 2 em 14h, então o canal funciona e o que sobra é
 * a barreira de criar conta.
 *
 * A CONTA NASCE VAZIA — sem assinatura, sem `access_until` e sem crédito. Isso
 * não é descuido, é a regra comercial do Lucas (31/08). O que garante isso é o
 * desenho: este módulo NÃO recebe nenhuma capacidade de creditar ou liberar
 * acesso, e a criação da conta (em `sgp-boas-vindas-canal.ts`) chama só o
 * `createUser` do Supabase. O trigger `on_auth_user_created` (01_schema) só
 * insere a linha em `profiles`, cujos `credits_subscription`/`credits_extra`
 * são `not null default 0` (13_credits) e cujo `access_until` é NULL
 * (12_payments). Não existe trigger de insert em `profiles`.
 *
 * O QUE ESTE MÓDULO NÃO FAZ, DE PROPÓSITO:
 *  - não libera acesso ao FastCloner. Regra do Lucas (31/08): SGP é produto
 *    SEPARADO e NÃO dá a plataforma — quem quiser usar assina à parte. Já
 *    tivemos 3 alunos em 2 dias (Celso, Caio, Ranieri) criando conta achando
 *    que a compra do curso dava acesso. O texto daqui desfaz isso em vez de
 *    alimentar. Criar a CONTA não é liberar a PLATAFORMA, e o e-mail diz isso
 *    com todas as letras;
 *  - não credita nada, não mexe em entitlements, não revoga nada;
 *  - NÃO manda senha em texto no e-mail, e NÃO reseta a senha de quem já tem
 *    conta — ver `GarantirConta` abaixo.
 *
 * PURO de propósito e SEM NENHUM import: o runner `node --test` não resolve o
 * alias `@/`, e import relativo sem extensão também quebra o type-stripping.
 * Os canais e o estado entram por parâmetro, então o fluxo inteiro — inclusive
 * a idempotência — é testável em `sgp-boas-vindas.test.ts`. Mesmo desenho do
 * `aviso-orfao.ts`, que é o vizinho mais próximo deste problema.
 */

/**
 * Código do produto "Sistema de Geração Pronto" na Hotmart.
 * Sobrescrevível por `HOTMART_SGP_PRODUCT_ID` — o padrão está aqui pra que o
 * merge deste PR já funcione sem depender de mexer no ambiente do servidor.
 */
export const SGP_PRODUCT_ID_PADRAO = "7283229";

/** Link do portal onde o aluno preenche tudo. */
export const SGP_PORTAL_URL = "https://fastcloner.com/sgp";

/** Tela de login — o caminho de recuperação quando o link de senha vence. */
export const LOGIN_URL = "https://fastcloner.com/login";

/**
 * Validade do link de definição de senha, EM TEXTO pro aluno.
 *
 * É a expiração do OTP de recovery do Supabase (1h no padrão, o mesmo número
 * que /api/v1/admin/users/recovery-link informa como `expires_in_minutes: 60`).
 *
 * ⚠️ POR QUE O E-MAIL SEMPRE OFERECE O "ESQUECI MINHA SENHA" LOGO ABAIXO:
 * 1 hora é curto pra um e-mail de compra, que a pessoa costuma abrir bem depois
 * — e o link vencido, sozinho, devolveria o aluno exatamente pra barreira que
 * este card veio derrubar. O "esqueci minha senha" não expira nunca e funciona
 * pro mesmo e-mail, então o caminho nunca fecha.
 */
export const VALIDADE_LINK_SENHA = "1 hora";

/**
 * Canal de dúvida sobre o CURSO (ordem do Lucas, 31/08): curso é o canal dele,
 * não o nosso. Sem esta linha, dúvida de curso cai na caixa do suporte@ e vira
 * resposta do bot da Fast sobre um produto que não é nosso.
 */
export const WHATSAPP_SUPORTE_CURSO = "(41) 99148-1573";

/** Tudo que o e-mail e a idempotência precisam, extraído do payload da Hotmart. */
export type CompraSgp = {
  eventType: string;
  buyerEmail: string;
  buyerName: string | null;
  productCode: string | null;
  productName: string | null;
  /** número da cobrança (data.purchase.transaction) — a chave de idempotência */
  transaction: string | null;
  /** no SGP não existe `data.subscription`, então isto cai na própria transação */
  externalId: string;
  /** data.purchase.status, em maiúsculas */
  purchaseStatus: string;
};

export type MotivoBoasVindas =
  | "enviado"
  | "ja_enviado"
  | "evento_nao_e_compra"
  | "pagamento_nao_confirmado"
  | "produto_nao_e_sgp"
  | "sem_email_do_comprador";

export type ResultadoBoasVindas = {
  /** true só quando ESTE evento gerou um e-mail novo (mesmo que o envio falhe) */
  enviou: boolean;
  motivo: MotivoBoasVindas;
  /** canais que aceitaram; vazio com motivo "enviado" = NINGUÉM recebeu */
  canais: string[];
  /** o que aconteceu com a conta; `null` quando nem chegamos a tentar */
  conta: SituacaoConta | null;
  /** erro da criação da conta, pra virar `payment_events.error` no chamador */
  contaErro: string | null;
};

/** Registro por transação já avisada (mora em `agent_state`, sem migration). */
export type RegistroBoasVindas = {
  at: string;
  buyerEmail: string;
  canais: string[];
  /**
   * Situação da conta no momento do aviso. Serve de auditoria barata: dá pra
   * responder "de quantas compras a conta nasceu aqui?" sem cruzar tabela
   * nenhuma. Opcional porque os registros gravados antes de 04/09 não têm.
   */
  conta?: SituacaoConta;
};

export type EstadoBoasVindas = Record<string, RegistroBoasVindas>;

export type EstadoBoasVindasIO = {
  ler: () => Promise<EstadoBoasVindas>;
  gravar: (estado: EstadoBoasVindas) => Promise<void>;
};

export type TextoBoasVindas = { assunto: string; texto: string };

/**
 * O que aconteceu com a conta do comprador.
 *
 * As três situações são DIFERENTES de propósito, porque geram e-mails
 * diferentes:
 *  - `criada`   → conta nova + link pra definir a senha, que vai no e-mail;
 *  - `ja_tinha` → o e-mail já era do FastCloner. NÃO criamos nada e NÃO
 *                 mexemos na senha dele. O e-mail sai sem bloco de acesso;
 *  - `falhou`   → não deu pra criar (Supabase fora, e-mail recusado…). O
 *                 e-mail do portal sai MESMO ASSIM, porque mandar o aluno pro
 *                 /sgp continua valendo; o erro é registrado pelo chamador.
 */
export type SituacaoConta = "criada" | "ja_tinha" | "falhou";

export type ResultadoConta = {
  situacao: SituacaoConta;
  /**
   * Link de definição de senha. Só vem preenchido em `criada` — é gerado pelo
   * `generateLink` da API admin do Supabase (o mesmo de
   * /api/v1/admin/users/recovery-link).
   *
   * ⚠️ NUNCA carrega senha em texto: o link é de uso único e expira. Senha em
   * claro ficaria pra sempre na caixa do aluno e no nosso servidor de saída.
   */
  linkDefinirSenha: string | null;
  erro: string | null;
};

/**
 * Cria a conta do comprador, se ela ainda não existir.
 *
 * CONTRATO DE SEGURANÇA, e é o ponto mais perigoso deste fluxo:
 * quando o e-mail JÁ TEM conta, a implementação é OBRIGADA a devolver
 * `ja_tinha` sem tocar em nada. Um `generateLink`/reset disparado em cima de
 * uma conta ativa — de alguém que usa a plataforma e nunca pediu nada — é o
 * pior estrago que este card pode causar, e a Hotmart reenvia o mesmo evento
 * até 5×.
 */
export type GarantirConta = (d: {
  email: string;
  nome: string | null;
}) => Promise<ResultadoConta>;

export type CanaisBoasVindas = {
  /** manda o e-mail ao aluno; true quando o envio foi aceito */
  email: (to: string, assunto: string, texto: string) => Promise<boolean>;
  /** cria a conta do comprador (ou confirma que já existia) — ver `GarantirConta` */
  garantirConta: GarantirConta;
  /**
   * registra a TENTATIVA em `avisos_enviados` (best-effort: a migration 104
   * pode não estar aplicada, e nesse caso isto só loga).
   */
  registrar: (r: {
    email: string;
    assunto: string;
    ok: boolean;
    erro: string | null;
    referencia: string;
  }) => Promise<void>;
};

/**
 * Só a APROVAÇÃO manda e-mail. Em particular NÃO o PURCHASE_COMPLETE, que a
 * Hotmart manda de novo ~7,8 dias depois pela MESMA compra (é a mesma armadilha
 * que já duplicou crédito em 10/08). A idempotência por transação abaixo é a
 * segunda barreira; esta é a primeira.
 */
const EVENTO_QUE_AVISA = "PURCHASE_APPROVED";

/**
 * Espelha o `PAID_STATUSES` do webhook: PURCHASE_APPROVED pode chegar com o Pix
 * ainda por pagar. Mandar "envie suas fotos" pra quem só gerou o boleto é
 * prometer serviço que ainda não foi pago — quando o pagamento cai, a Hotmart
 * manda outro PURCHASE_APPROVED, agora APPROVED (comportamento observado nos
 * payloads reais do 7283229: trx HP2143144214 chegou BILLET_PRINTED 16h13 e
 * APPROVED 16h14).
 */
const STATUS_PAGOS = new Set(["APPROVED", "COMPLETE", "COMPLETED"]);

export type RotaDoProduto = "nosso" | "sgp" | "de_fora";

/**
 * Pra onde vai o evento, decidido só pelo código do produto.
 *
 * Existe como função pura porque é EXATAMENTE a linha que cegou a casa por 3
 * meses (commit 4688e40): a decisão morava solta dentro do handler e nunca teve
 * teste. Agora tem.
 *
 * A ordem importa: o SGP é testado ANTES do descarte, senão ele continua caindo
 * em `de_fora`. E se alguém configurar o SGP com o MESMO id do FastCloner
 * (engano de ambiente), o FastCloner ganha — errar pro lado de continuar
 * liberando acesso pago é muito mais barato que errar pro lado de parar de
 * liberar.
 */
export function roteamentoDoProduto(args: {
  eventProduct: string | null;
  nossoProduto: string | null | undefined;
  produtoSgp: string;
}): RotaDoProduto {
  const { eventProduct, nossoProduto, produtoSgp } = args;
  if (!eventProduct) return "nosso"; // sem produto no payload: comportamento antigo
  if (nossoProduto && eventProduct === nossoProduto) return "nosso";
  if (produtoSgp && eventProduct === produtoSgp) return "sgp";
  if (nossoProduto && eventProduct !== nossoProduto) return "de_fora";
  return "nosso";
}

/**
 * O Supabase recusou o `createUser` porque o e-mail JÁ EXISTE?
 *
 * Mora aqui, no módulo puro, porque é a linha que decide entre "a conta já era
 * dele, está tudo certo" e "falhou de verdade" — e errar pro lado errado ou
 * inventa erro em compra saudável, ou esconde uma falha real. O Supabase não
 * expõe um código estável pra isso, então casamos as redações conhecidas; o
 * `duplicate key` cobre o erro cru do Postgres quando ele vaza sem tradução.
 *
 * Errar aqui é seguro por construção: nos DOIS lados a conta existente não é
 * tocada — a diferença é só se o evento vira erro registrado ou não.
 */
export function ehEmailJaCadastrado(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    m.includes("already been registered") ||
    m.includes("already registered") ||
    m.includes("already exists") ||
    m.includes("duplicate key")
  );
}

/**
 * Chave de idempotência: a TRANSAÇÃO, que é uma cobrança específica.
 * (No SGP o `externalId` já cai na própria transação, porque o payload do curso
 * não tem `data.subscription` — mas dependemos da transação explicitamente, e
 * não desse detalhe.)
 * Sem transação no payload, cai no e-mail do comprador pra não avisar em loop.
 */
export function chaveDaBoasVindas(d: Pick<CompraSgp, "transaction" | "buyerEmail">): string {
  const trx = (d.transaction ?? "").trim();
  return trx ? trx : `email:${d.buyerEmail.trim().toLowerCase()}`;
}

/** O evento merece o e-mail de boas-vindas? */
export function deveMandarBoasVindas(args: {
  eventType: string;
  purchaseStatus: string;
  productCode: string | null;
  produtoSgp: string;
  buyerEmail: string | null;
}): { ok: true } | { ok: false; motivo: MotivoBoasVindas } {
  if (args.productCode !== args.produtoSgp) {
    return { ok: false, motivo: "produto_nao_e_sgp" };
  }
  if (args.eventType.toUpperCase() !== EVENTO_QUE_AVISA) {
    return { ok: false, motivo: "evento_nao_e_compra" };
  }
  if (!args.buyerEmail || !args.buyerEmail.trim()) {
    return { ok: false, motivo: "sem_email_do_comprador" };
  }
  // Status ausente = payload sem `purchase.status`; o webhook trata isso como
  // pago no caminho do FastCloner, e mantemos a mesma leitura.
  const status = (args.purchaseStatus ?? "").toUpperCase();
  if (status && !STATUS_PAGOS.has(status)) {
    return { ok: false, motivo: "pagamento_nao_confirmado" };
  }
  return { ok: true };
}

const primeiroNome = (nome: string | null): string => {
  const limpo = (nome ?? "").trim();
  if (!limpo) return "";
  return limpo.split(/\s+/)[0] ?? "";
};

/**
 * O texto do e-mail.
 *
 * TRÊS COISAS SÃO OBRIGATÓRIAS AQUI, e cada uma tem um caso por trás:
 *
 *  1. O LINK e O QUE TER EM MÃOS vêm no topo. O aluno abre o portal, descobre
 *     que precisa de 20 minutos de áudio que ele não gravou, e abandona: é
 *     exatamente o funil medido (0 de 129 começaram, e a única aluna real do
 *     /sgp está parada no passo "foto" há 2,3 dias).
 *  2. NÃO PROMETER O FASTCLONER. Regra do Lucas de 31/08. Celso, Caio e
 *     Ranieri compraram curso e foram criar conta achando que tinham a
 *     plataforma; o e-mail que os traria pra cá não pode ser a origem disso.
 *  3. DÚVIDA DE CURSO VAI PRO CANAL DO LUCAS, não pra nossa caixa. Sem essa
 *     linha o aluno responde este e-mail e cai no bot da Fast, que atende
 *     FastCloner e não tem o que dizer sobre o curso.
 *
 * Os números (4–6 fotos, 20–60 min) espelham SGP_FOTOS_MIN/MAX e
 * SGP_AUDIO_MIN/MAX_SEGUNDOS de `lib/sgp/types.ts`. Estão escritos aqui porque
 * este módulo é sem import; o teste importa as constantes de verdade e falha se
 * alguém mudar a régua e esquecer o e-mail.
 *
 * O BLOCO DE ACESSO (04/09) entra SÓ quando a conta acabou de ser criada. Quem
 * já tinha conta não recebe nada disso — receber "defina a sua senha" sem ter
 * pedido é assustador e, pra quem já usa a plataforma, parece invasão. O texto
 * do portal, que já funciona, não muda uma vírgula.
 */
export function montarBoasVindas(d: CompraSgp, conta?: ResultadoConta): TextoBoasVindas {
  const nome = primeiroNome(d.buyerName);
  const assunto = "Seu Sistema de Geração Pronto: comece por aqui";

  // Só a conta RECÉM-CRIADA ganha o bloco, e só se o link veio de fato.
  const blocoAcesso =
    conta?.situacao === "criada" && conta.linkDefinirSenha
      ? [
          "A SUA CONTA JÁ ESTÁ CRIADA",
          "",
          `Criamos a sua conta com este mesmo e-mail (${d.buyerEmail}). É nela que`,
          "o seu clone vai ficar quando a nossa equipe terminar de montar. Defina a",
          "sua senha aqui:",
          "",
          conta.linkDefinirSenha,
          "",
          `Esse link é de uso único e expira em ${VALIDADE_LINK_SENHA}. Se ele vencer, entre em`,
          `${LOGIN_URL} e clique em "Esqueci minha senha" — com este`,
          "mesmo e-mail você define a sua senha na hora.",
          "",
        ]
      : [];

  const texto = [
    `Oi${nome ? `, ${nome}` : ""}!`,
    "",
    "A sua compra do Sistema de Geração Pronto foi confirmada. A partir de",
    "agora a nossa equipe monta e configura o seu clone (rosto e voz) pra você",
    "não precisar configurar nada sozinho.",
    "",
    "O PRIMEIRO PASSO É SEU: preencher os seus dados e enviar o material.",
    "",
    SGP_PORTAL_URL,
    "",
    "O QUE TER EM MÃOS ANTES DE COMEÇAR",
    "",
    "- De 4 a 6 fotos suas: boa luz, fundo limpo, rosto nítido e sem óculos",
    "  escuros nem boné.",
    "- De 20 a 60 minutos de áudio da sua voz: grave no mesmo ambiente, sem",
    "  ruído de fundo, falando de forma natural.",
    "",
    "Quanto melhor esse material, melhor fica o seu clone. Você recebe um",
    "e-mail a cada etapa e não precisa fazer mais nada além de enviar tudo.",
    "",
    ...blocoAcesso,
    "IMPORTANTE: o Sistema de Geração Pronto é a montagem do seu clone pela",
    "nossa equipe. Ele NÃO inclui a assinatura da plataforma FastCloner — se",
    "você também quiser usar a plataforma para gerar os seus vídeos, ela é",
    "contratada à parte.",
    "",
    `Dúvida sobre o curso ou sobre a sua compra: chame o suporte no WhatsApp ${WHATSAPP_SUPORTE_CURSO}.`,
    "Problema para enviar as fotos ou o áudio no portal: é só responder este e-mail.",
    "",
    "— Equipe FastCloner",
  ].join("\n");

  return { assunto, texto };
}

/**
 * Manda o e-mail de boas-vindas UMA vez por transação.
 *
 * Ordem proposital, copiada do `aviso-orfao.ts`: decide → checa idempotência →
 * dispara o canal → GRAVA o estado com o resultado. E marca como enviado mesmo
 * quando o envio falha, senão a Hotmart reenviando o mesmo evento (ela reenvia
 * até 5×) viraria uma rajada de tentativas em cima do aluno. Quem denuncia a
 * falha é `canais: []` no retorno, que o chamador escreve em
 * `payment_events.error`, e a linha `ok=false` em `avisos_enviados`.
 */
export async function mandarBoasVindasSgp(
  d: CompraSgp,
  produtoSgp: string,
  estadoIO: EstadoBoasVindasIO,
  canais: CanaisBoasVindas,
  agoraIso: string,
): Promise<ResultadoBoasVindas> {
  const decisao = deveMandarBoasVindas({
    eventType: d.eventType,
    purchaseStatus: d.purchaseStatus,
    productCode: d.productCode,
    produtoSgp,
    buyerEmail: d.buyerEmail,
  });
  if (!decisao.ok) {
    return { enviou: false, motivo: decisao.motivo, canais: [], conta: null, contaErro: null };
  }

  const chave = chaveDaBoasVindas(d);
  const estado = await estadoIO.ler();
  if (estado[chave]) {
    return { enviou: false, motivo: "ja_enviado", canais: [], conta: null, contaErro: null };
  }

  // CONTA — depois da trava de idempotência, de propósito: o reenvio da Hotmart
  // (até 5×) para na linha acima e nunca chega aqui. A segunda barreira é a
  // própria `garantirConta`, que devolve `ja_tinha` sem tocar em nada.
  //
  // Falhar aqui NÃO cancela o e-mail: mandar o aluno pro portal continua
  // valendo mesmo sem conta (o /sgp cria a conta no fim do preenchimento, que é
  // o comportamento que já existia). O erro vai no retorno pro chamador
  // registrar em `payment_events.error`.
  let conta: ResultadoConta;
  try {
    conta = await canais.garantirConta({ email: d.buyerEmail, nome: d.buyerName });
  } catch (e) {
    conta = {
      situacao: "falhou",
      linkDefinirSenha: null,
      erro: e instanceof Error ? e.message : String(e),
    };
  }

  const { assunto, texto } = montarBoasVindas(d, conta);
  const referencia = `webhook hotmart ${d.eventType} · transação ${d.transaction ?? "—"}`;

  let ok = false;
  let erro: string | null = null;
  try {
    ok = await canais.email(d.buyerEmail, assunto, texto);
    if (!ok) erro = "canal de e-mail recusou o envio";
  } catch (e) {
    ok = false;
    erro = e instanceof Error ? e.message : String(e);
  }

  // Best-effort e DEPOIS do envio: registrar nunca pode derrubar o aviso.
  try {
    await canais.registrar({ email: d.buyerEmail, assunto, ok, erro, referencia });
  } catch {
    // `registrarAviso` já é à prova de falha; este catch é o cinto do suspensório.
  }

  const aceitos = ok ? ["email"] : [];
  estado[chave] = {
    at: agoraIso,
    buyerEmail: d.buyerEmail,
    canais: aceitos,
    conta: conta.situacao,
  };
  try {
    await estadoIO.gravar(estado);
  } catch {
    // Estado não gravado = risco de mandar de novo no reenvio da Hotmart.
    // Ainda assim é melhor que derrubar o webhook e devolver 500 (aí a Hotmart
    // reenvia de propósito, e o aluno recebe do mesmo jeito).
  }

  return {
    enviou: true,
    motivo: "enviado",
    canais: aceitos,
    conta: conta.situacao,
    contaErro: conta.erro,
  };
}
