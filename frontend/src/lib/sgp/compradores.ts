/**
 * SGP — TODO MUNDO que comprou, tenha começado o portal ou não (/admin/sgp).
 *
 * Pedido do Lucas (08/09): *"um painel com todas as pessoas que compraram o SGP,
 * independente de terem iniciado ou não, pra equipe entrar em contato"*, em
 * formato de planilha: Nome, Status, Data de Aquisição, Celular, E-mail, Data de
 * envio.
 *
 * ── O BURACO QUE ISTO TAPA (medido em 08/09, não suposto) ────────────────────
 * A tela de hoje lê `sgp_pedidos` e mostra 27 pedidos. Só que existem 103
 * compradores pagos do produto 7283229, e 90 deles NUNCA abriram o portal —
 * então não têm linha em `sgp_pedidos` e não aparecem em tela nenhuma. Eles não
 * estavam sendo filtrados por engano: a consulta atual não filtra ninguém (é um
 * select sem filtro). Eles simplesmente não existem naquela tabela. É por isso
 * que a correção é ADICIONAR uma fonte, e não consertar um filtro.
 *
 * ⚠️ A DECISÃO DE ARQUITETURA QUE NÃO PODE SER ERRADA: a base é a UNIÃO das duas
 * fontes, com chave por e-mail normalizado. Nunca um join a partir de um lado só:
 *  - partindo de `sgp_pedidos` perdem-se os 90 que compraram e não começaram;
 *  - partindo de `payment_events` perdem-se 12 pessoas que estão no portal SEM
 *    compra registrada (entraram antes de o webhook do SGP existir — ver o
 *    cabeçalho de `sgp-boas-vindas.ts`, que documenta o commit 4688e40 cegando
 *    o webhook pro produto 7283229 entre 09/06 e 04/09).
 * Quem está nas duas fontes aparece UMA vez.
 *
 * ── A COLUNA "FASTCLONER" (09/09) ───────────────────────────────────────────
 * Uma TERCEIRA fonte entrou depois, e ela é de outra natureza: `entitlements`
 * da plataforma, só pra dizer o que a pessoa paga no FastCloner HOJE. Ela é
 * INFORMATIVA e entra DEPOIS da união — não adiciona nem remove uma linha
 * sequer. Ver `assinaturaFastCloner` e o comentário em `montarCompradores`.
 *
 * Módulo PURO de propósito (sem banco, sem fetch, sem `new Date()` escondido —
 * o `agora` entra por parâmetro), pelo mesmo motivo do `painel.ts`: dá pra
 * testar a régua inteira com `node --test` sem subir nada.
 */
import type { SgpPedidoRow, SgpStatus } from "./types.ts";
import { normalizarWhatsapp } from "./types.ts";
import { ETAPA_HUMANA, SGP_PARADO_HORAS, tempoHumano } from "./painel.ts";
// A régua de acesso e a régua de "isto é dinheiro que entrou" vêm PRONTAS de
// `acesso-regra.ts` — é o mesmo módulo puro que o gate de acesso e o sweeper de
// compra órfã usam. Copiar qualquer uma das duas aqui era o caminho garantido
// pra esta coluna divergir do resto da casa no primeiro ajuste (foi assim que a
// regra do Pix duplicada mandou 12 alunos pagarem boleto vencido, 09/09).
import { entitlementValeAcesso, eventoEhPagamento } from "../payments/acesso-regra.ts";

const PARADO_MS = SGP_PARADO_HORAS * 60 * 60 * 1000;

/**
 * Status de quem PAGOU e nunca abriu o portal. Não existe em `sgp_pedidos` —
 * é um estado só desta tela, e é o estado de 90 das 115 linhas.
 *
 * Em português de gente, como manda a regra da casa: tela pra equipe é orientada
 * a AÇÃO, não a nome de coluna. O time lê "Comprou, não começou" e sabe o que
 * fazer; "sem linha em sgp_pedidos" não diz nada pra quem não tem o código.
 */
export const STATUS_NAO_COMECOU = "Comprou, não começou";

/**
 * E-mail vira CHAVE de pessoa.
 *
 * Duas regras, e as duas têm caso real por trás:
 *  1. minúsculas e sem espaço — a Hotmart e o portal não combinam capitalização;
 *  2. no Gmail o PONTO no nome é ignorado pelo próprio Gmail
 *     (`herysilva27` e `herysilva.27` são a MESMA caixa), e o `+tag` também.
 *
 * ⚠️ HONESTIDADE SOBRE O ITEM 2: medido em 08/09, a regra do Gmail funde ZERO
 * linhas hoje — os 103 compradores já são 103 chaves distintas com ou sem ela.
 * Ela fica porque o custo é nenhum e porque o dia em que a mesma pessoa aparecer
 * escrita das duas formas ela viraria duas linhas e o time cobraria duas vezes
 * quem já enviou tudo. É seguro por construção nos dois lados: só normaliza
 * domínio do Google, onde a equivalência é garantida pelo próprio provedor.
 * NÃO se aplica a outros domínios — em muitos deles o ponto distingue pessoas
 * diferentes, e fundir seria trocar um duplicado por um dado errado.
 */
export function chaveEmail(email: string | null | undefined): string {
  const e = (email ?? "").trim().toLowerCase();
  const at = e.lastIndexOf("@");
  if (at <= 0) return e;
  const dominio = e.slice(at + 1);
  let local = e.slice(0, at);
  if (dominio === "gmail.com" || dominio === "googlemail.com") {
    local = (local.split("+")[0] ?? "").replace(/\./g, "");
  }
  return `${local}@${dominio}`;
}

/**
 * WhatsApp legível pro atendente. "5561993107338" → "(61) 99310-7338".
 *
 * Número que não é do Brasil (o `checkout_phone` real tem italiano no meio:
 * "393498533692") sai como veio — inventar máscara de DDD brasileiro em cima de
 * um número estrangeiro deixaria o telefone irreconhecível.
 */
export function telefoneLegivel(digitos: string): string {
  const m = /^55(\d{2})(\d{4,5})(\d{4})$/.exec(digitos);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : digitos;
}

// ───────────────────── A COLUNA "FASTCLONER" ─────────────────────
/**
 * Pedido do Lucas (09/09), palavras dele: *"não quero que tu se preocupe com o
 * quanto a pessoa pagou para nós, somente se preocupe com o quanto ela tá
 * pagando no FastCloner"*. O valor da compra do SGP não interessa nesta tela —
 * interessa a ASSINATURA DA PLATAFORMA que a pessoa tem HOJE.
 *
 * ⚠️ POR QUE NÃO É UM SIM/NÃO, e este é o ponto que decide o desenho: medido em
 * 09/09, dos 112 compradores de SGP apenas 11 têm assinatura viva do FastCloner
 * — e desses 11, só DOIS pagam de verdade (R$97). Os outros 9 são trial de R$0
 * na janela de 7 dias. Uma coluna "tem assinatura: sim/não" faria o time ler
 * "11 clientes pagantes" onde existem 2. Separar PAGA de TRIAL não é capricho de
 * apresentação: é a diferença entre um número certo e um número que engana.
 */
export type EstadoFastCloner = "paga" | "trial" | "nao_assina";

/** Uma linha de `entitlements` do produto da plataforma, já filtrada pela rota. */
export type EntitlementFastClonerBruto = {
  buyer_email: string;
  status: string;
  access_until: string | null;
};

/**
 * Um PURCHASE_APPROVED do produto da plataforma. O `valor`/`moeda` saem de
 * `purchase.price` e o `statusCompra` de `purchase.status` — os dois juntos,
 * nunca o valor sozinho (ver `eventoEhPagamento`: a Hotmart emite a mensalidade
 * de R$97 em OVERDUE pra quem nunca pagou).
 */
export type CobrancaFastClonerBruta = {
  email: string;
  valor: number | null;
  /** `purchase.price.currency_value`. Já apareceram GBP, EUR, USD, PYG, JPY. */
  moeda: string | null;
  statusCompra: string | null;
  recebidoEm: string;
};

export type AssinaturaFastCloner = {
  estado: EstadoFastCloner;
  /** Valor da cobrança mais recente. `null` = nenhuma cobrança registrada. */
  valor: number | null;
  moeda: string | null;
  /** Pronto pra tela: "R$97", "£0", "sem cobrança registrada". */
  valorTexto: string;
  /** ISO de até quando o acesso vale. `null` = vitalício ou não assina. */
  ate: string | null;
  /** Acesso vivo SEM data de fim (pagamento único). */
  vitalicio: boolean;
  /**
   * Tem cobrança > 0 que a Hotmart NÃO confirmou como paga (OVERDUE, DELAYED,
   * BILLET_PRINTED). Cai em `trial` de propósito — quem não pagou não é
   * pagante —, mas a tela precisa dizer POR QUE, senão vira um "R$97" mudo ao
   * lado da palavra trial e ninguém entende o número.
   */
  cobrancaNaoConfirmada: boolean;
};

const SEM_ASSINATURA: AssinaturaFastCloner = {
  estado: "nao_assina",
  valor: null,
  moeda: null,
  valorTexto: "—",
  ate: null,
  vitalicio: false,
  cobrancaNaoConfirmada: false,
};

/**
 * Dinheiro legível SEM `Intl`: o módulo é puro e testado com `node --test`, e
 * `Intl` mudaria a saída conforme o locale de quem roda. Moeda que não está no
 * mapa sai com o código na frente ("PYG 50000") — feio de propósito, porque
 * inventar "R$" em cima de guarani é pior que feio, é errado.
 */
const SIMBOLO_MOEDA: Record<string, string> = { BRL: "R$", USD: "US$", EUR: "€", GBP: "£" };

export function valorLegivel(valor: number | null, moeda: string | null): string {
  if (valor === null || !Number.isFinite(valor)) return "sem cobrança registrada";
  const n = Number.isInteger(valor) ? String(valor) : valor.toFixed(2);
  const m = (moeda ?? "").trim().toUpperCase();
  const simbolo = SIMBOLO_MOEDA[m];
  if (simbolo) return `${simbolo}${n}`;
  return m ? `${m} ${n}` : n;
}

/**
 * O estado da assinatura de UMA pessoa no FastCloner.
 *
 * `entitlements` já vem filtrado pela pessoa (uma pessoa pode ter mais de uma
 * linha: assinatura antiga cancelada + a de hoje). `cobranca` é o
 * PURCHASE_APPROVED MAIS RECENTE do produto pra ela — o mais recente porque é
 * ele que diz o que ela paga HOJE; a compra de três meses atrás pode ser o
 * trial que virou assinatura, ou o contrário.
 */
export function assinaturaFastCloner(
  entitlements: EntitlementFastClonerBruto[],
  cobranca: CobrancaFastClonerBruta | null,
  agoraIso: string,
): AssinaturaFastCloner {
  const vivos = entitlements.filter((e) =>
    entitlementValeAcesso({ status: e.status, access_until: e.access_until }, agoraIso),
  );
  if (vivos.length === 0) return SEM_ASSINATURA;

  // Vitalício (access_until NULL num `active`) manda: é o acesso mais forte.
  const vitalicio = vivos.some((e) => e.access_until === null);
  const ate = vitalicio
    ? null
    : vivos.reduce<string | null>((maior, e) => (!maior || (e.access_until ?? "") > maior ? e.access_until : maior), null);

  const valor = cobranca?.valor ?? null;
  const moeda = cobranca?.moeda ?? null;
  const paga = cobranca ? eventoEhPagamento({ valor: cobranca.valor, status: cobranca.statusCompra }) : false;

  return {
    estado: paga ? "paga" : "trial",
    valor,
    moeda,
    valorTexto: valorLegivel(valor, moeda),
    ate,
    vitalicio,
    cobrancaNaoConfirmada: !paga && valor !== null && valor > 0,
  };
}

/**
 * Uma compra do SGP, já extraída do payload da Hotmart pela rota.
 * (A extração em si usa os helpers canônicos de `lib/payments/hotmart-payload.ts`
 * — aqui só entra o dado limpo, pro módulo continuar puro e testável.)
 */
export type CompraSgpBruta = {
  email: string;
  nome: string | null;
  /** `data.buyer.checkout_phone`, cru como a Hotmart mandou. */
  telefone: string | null;
  /** `received_at` do PURCHASE_APPROVED. */
  recebidoEm: string;
};

export type LinhaComprador = {
  /** e-mail normalizado — a identidade da linha, e a `key` da tabela. */
  chave: string;
  nome: string;
  email: string;
  /** Formatado pra leitura; "—" quando não há telefone em nenhuma fonte. */
  celular: string;
  /** Só dígitos com DDI, pro link do WhatsApp. `null` = sem telefone. */
  celularDigitos: string | null;
  /** Status em português de gente. Nunca o enum cru. */
  status: string;
  /** O status do pedido, quando existe. `null` = nunca começou o portal. */
  statusPedido: SgpStatus | null;
  /** ISO do PURCHASE_APPROVED mais antigo. `null` = sem compra registrada. */
  dataAquisicao: string | null;
  /**
   * Está no portal mas NÃO temos a compra em `payment_events`. A tela avisa —
   * a data fica VAZIA, nunca inventada.
   */
  semCompraRegistrada: boolean;
  /** `sgp_pedidos.enviado_em`. `null` = ainda não enviou o material. */
  enviadoEm: string | null;
  /** Há quanto tempo essa pessoa está esperando (ver `montarComprador`). */
  esperandoMs: number;
  esperandoTexto: string;
  /** Passou de 48h esperando e a bola está com ela ou com a gente. */
  parado: boolean;
  /** Chegou ao fim: material enviado e clone entregue. Não precisa de contato. */
  concluido: boolean;
  /**
   * O que essa pessoa paga no FastCloner HOJE.
   *
   * ⚠️ `null` significa NÃO CONSULTADO, e não "não assina" — quem monta as
   * linhas sem passar a fonte `fastcloner` não sabe nada sobre assinatura, e a
   * tela mostra "—" em vez de carimbar um "não assina" que ninguém mediu.
   * Estampar certeza que não existe é o defeito que esta casa mais paga caro.
   */
  fastcloner: AssinaturaFastCloner | null;
};

/**
 * Qual pedido representa a pessoa quando ela tem MAIS DE UM.
 *
 * Existe porque acontece de verdade: medido em 08/09, 27 pedidos são só 25
 * pessoas — o Otniel tem um pedido `pronto` e outro `dados` abandonado, e o João
 * Carlos tem um `dados` e um `audio`. Mostrar o `dados` do Otniel mandaria o
 * time cobrar fotos de alguém que JÁ recebeu o clone: alarme falso, e do tipo
 * que queima a confiança do time na tela.
 *
 * Então vence o pedido MAIS ADIANTADO. `pronto` ganha de `falhou` (a pessoa
 * recebeu o clone por outro pedido, o caso está resolvido pra ela) e `falhou`
 * ganha do wizard (já passou do envio, e alguém precisa olhar).
 */
const AVANCO: Record<SgpStatus, number> = {
  dados: 0,
  foto: 1,
  audio: 2,
  revisao: 3,
  enviado: 4,
  falhou: 5,
  processando: 6,
  pronto: 7,
};

export function escolherPedido(pedidos: SgpPedidoRow[]): SgpPedidoRow | null {
  let melhor: SgpPedidoRow | null = null;
  for (const p of pedidos) {
    if (!melhor) {
      melhor = p;
      continue;
    }
    const a = AVANCO[p.status] ?? -1;
    const b = AVANCO[melhor.status] ?? -1;
    if (a > b) melhor = p;
    // Empate no avanço: o que mexeu por último é o que reflete a pessoa hoje.
    else if (a === b && new Date(p.atualizado_em).getTime() > new Date(melhor.atualizado_em).getTime()) {
      melhor = p;
    }
  }
  return melhor;
}

/** Primeira data (a compra mais antiga daquele e-mail). */
function maisAntiga(a: string | null, b: string): string {
  if (!a) return b;
  return new Date(b).getTime() < new Date(a).getTime() ? b : a;
}

/**
 * Monta a linha de UMA pessoa a partir do que existir de cada lado.
 *
 * ⚠️ DE ONDE SAI O RELÓGIO, e este é o ponto que o pedido do Lucas marcou como
 * obrigatório: pra quem NUNCA começou não existe `atualizado_em` — usar aquela
 * coluna daria `NaN` e a pessoa nunca apareceria como parada. O relógio dela
 * conta da DATA DA COMPRA, que é desde quando ela pagou e não recebeu nada.
 */
export function montarComprador(
  chave: string,
  compra: { nome: string | null; email: string; telefone: string | null; recebidoEm: string } | null,
  pedido: SgpPedidoRow | null,
  agora: number,
  fastcloner: AssinaturaFastCloner | null = null,
): LinhaComprador {
  const nome = pedido?.nome?.trim() || compra?.nome?.trim() || "(sem nome)";
  const email = pedido?.email?.trim() || compra?.email?.trim() || chave;

  // O WhatsApp que a PESSOA digitou no portal manda: ele é mais novo que o do
  // checkout e já vem normalizado com DDI. O da Hotmart é a rede de segurança
  // dos 90 que nunca abriram o portal — sem ele, a tela não teria como ligar.
  const doPedido = pedido?.whatsapp?.trim() || null;
  const doCheckout = compra?.telefone ? normalizarWhatsapp(compra.telefone) : null;
  const celularDigitos = doPedido || doCheckout;

  const dataAquisicao = compra?.recebidoEm ?? null;
  const statusPedido = pedido?.status ?? null;

  // Sem pedido: o relógio corre desde a compra. Com pedido: desde a última vez
  // que ele andou, igual à fila de trabalho (painel.ts).
  const referencia = pedido ? new Date(pedido.atualizado_em).getTime() : dataAquisicao ? new Date(dataAquisicao).getTime() : NaN;
  const esperandoMs = Number.isFinite(referencia) ? Math.max(0, agora - referencia) : 0;

  const concluido = statusPedido === "pronto";
  // "Parado" é só quem ainda espera algo. Quem já recebeu o clone não é alarme,
  // e quem está no meio do processamento nosso também não é cobrança do time.
  const esperandoAlguem = statusPedido === null || statusPedido !== "pronto";
  const parado = esperandoAlguem && esperandoMs > PARADO_MS;

  return {
    chave,
    nome,
    email,
    celular: celularDigitos ? telefoneLegivel(celularDigitos) : "—",
    celularDigitos,
    status: statusPedido ? (ETAPA_HUMANA[statusPedido] ?? statusPedido) : STATUS_NAO_COMECOU,
    statusPedido,
    dataAquisicao,
    semCompraRegistrada: dataAquisicao === null,
    enviadoEm: pedido?.enviado_em ?? null,
    esperandoMs,
    esperandoTexto: Number.isFinite(referencia) ? tempoHumano(esperandoMs) : "—",
    parado,
    concluido,
    fastcloner,
  };
}

/**
 * A UNIÃO. Recebe as duas fontes cruas e devolve uma linha por PESSOA.
 *
 * Compras sem e-mail no payload são descartadas (não há como contatar nem como
 * casar com pedido); pedido sem e-mail entra pela própria chave vazia, que é
 * degenerada mas não some da tela — sumir seria esconder um caso real do time.
 */
export function montarCompradores(args: {
  compras: CompraSgpBruta[];
  pedidos: SgpPedidoRow[];
  agora: number;
  /**
   * A assinatura da plataforma, quando a rota consultou. OPCIONAL de propósito:
   * ⚠️ esta fonte é INFORMATIVA e não pode, em hipótese nenhuma, mudar quem
   * aparece na lista. A união continua sendo compras de SGP ∪ pedidos do
   * portal; ninguém entra por ter assinatura e — muito mais importante —
   * ninguém SOME por não ter. Quem não é passado aqui fica com `fastcloner:
   * null` ("não consultado"), nunca com "não assina".
   */
  fastcloner?: {
    entitlements: EntitlementFastClonerBruto[];
    cobrancas: CobrancaFastClonerBruta[];
  };
}): LinhaComprador[] {
  const { compras, pedidos, agora, fastcloner } = args;

  // 0) FastCloner por pessoa, na MESMA chave de e-mail do resto do módulo.
  //    (`chaveEmail` de novo, nunca uma segunda normalização — hoje isso já
  //    importa de verdade: `luciano.rezende.filho@gmail.com` assina a
  //    plataforma e comprou o SGP como `lucianorezendefilho@gmail.com`.)
  const agoraIso = new Date(agora).toISOString();
  const entPorChave = new Map<string, EntitlementFastClonerBruto[]>();
  const cobrancaPorChave = new Map<string, CobrancaFastClonerBruta>();
  if (fastcloner) {
    for (const e of fastcloner.entitlements) {
      const k = chaveEmail(e.buyer_email);
      const lista = entPorChave.get(k);
      if (lista) lista.push(e);
      else entPorChave.set(k, [e]);
    }
    for (const c of fastcloner.cobrancas) {
      const k = chaveEmail(c.email);
      const atual = cobrancaPorChave.get(k);
      // A MAIS RECENTE ganha: é ela que diz o que a pessoa paga hoje.
      if (!atual || c.recebidoEm > atual.recebidoEm) cobrancaPorChave.set(k, c);
    }
  }
  const assinaturaDe = (k: string): AssinaturaFastCloner | null =>
    fastcloner ? assinaturaFastCloner(entPorChave.get(k) ?? [], cobrancaPorChave.get(k) ?? null, agoraIso) : null;

  // 1) Compras agrupadas por pessoa, guardando a MAIS ANTIGA como aquisição.
  type Agrupada = { nome: string | null; email: string; telefone: string | null; recebidoEm: string };
  const porCompra = new Map<string, Agrupada>();
  for (const c of compras) {
    const k = chaveEmail(c.email);
    if (!k || !k.includes("@")) continue;
    const atual = porCompra.get(k);
    if (!atual) {
      porCompra.set(k, { nome: c.nome, email: c.email, telefone: c.telefone, recebidoEm: c.recebidoEm });
      continue;
    }
    atual.recebidoEm = maisAntiga(atual.recebidoEm, c.recebidoEm);
    // Compra mais nova costuma ter o cadastro mais completo: preenche o que falta.
    if (!atual.nome && c.nome) atual.nome = c.nome;
    if (!atual.telefone && c.telefone) atual.telefone = c.telefone;
  }

  // 2) Pedidos agrupados por pessoa (uma pessoa pode ter começado duas vezes).
  const porPedido = new Map<string, SgpPedidoRow[]>();
  for (const p of pedidos) {
    const k = chaveEmail(p.email);
    const lista = porPedido.get(k);
    if (lista) lista.push(p);
    else porPedido.set(k, [p]);
  }

  // 3) A união propriamente dita.
  const chaves = new Set<string>([...porCompra.keys(), ...porPedido.keys()]);
  const linhas: LinhaComprador[] = [];
  for (const k of chaves) {
    linhas.push(montarComprador(k, porCompra.get(k) ?? null, escolherPedido(porPedido.get(k) ?? []), agora, assinaturaDe(k)));
  }
  return linhas;
}

/**
 * Ordem da planilha (pedido do Lucas): *"quem está esperando há mais tempo"*
 * primeiro.
 *
 * Com um degrau antes: quem JÁ RECEBEU o clone (`pronto`) desce pro fim. Sem
 * isso, uma entrega feita há 30 dias — que não precisa de contato nenhum —
 * ficaria no topo da lista de quem a equipe tem que ligar, exatamente como já
 * tinha acontecido na fila de trabalho (ver `ordenar` em painel.ts).
 */
export function ordenarCompradores(linhas: LinhaComprador[]): LinhaComprador[] {
  return [...linhas].sort((a, b) => {
    if (a.concluido !== b.concluido) return a.concluido ? 1 : -1;
    return b.esperandoMs - a.esperandoMs;
  });
}

export type ResumoCompradores = {
  /** Todas as linhas da planilha. */
  total: number;
  /** Compraram e nunca abriram o portal — o buraco que este painel revela. */
  naoComecaram: number;
  /** Começaram o portal (em qualquer etapa, inclusive entregue). */
  comecaram: number;
  /** Entregues. */
  entregues: number;
  /** Estão no portal sem compra registrada — a data de aquisição fica vazia. */
  semCompraRegistrada: number;
  /** Esperando há mais de 48h e ainda não receberam. */
  parados: number;
  /** Sem telefone em nenhuma das duas fontes: a equipe não consegue ligar. */
  semTelefone: number;
  /**
   * Quantas linhas tiveram a assinatura consultada. `0` = a fonte não foi
   * passada, e aí os três contadores abaixo são zero por ignorância, não por
   * medição — a tela só os mostra quando este número é maior que zero.
   */
  fastclonerConsultados: number;
  /** Pagam a plataforma de verdade (valor > 0 e pagamento confirmado). */
  fastclonerPagantes: number;
  /** Têm acesso vivo mas NÃO pagam: trial de R$0, ou cobrança não confirmada. */
  fastclonerTrial: number;
  /** Não têm assinatura viva nenhuma — a esmagadora maioria (101 de 112 em 09/09). */
  fastclonerNaoAssina: number;
};

export function resumirCompradores(linhas: LinhaComprador[]): ResumoCompradores {
  return {
    total: linhas.length,
    naoComecaram: linhas.filter((l) => l.statusPedido === null).length,
    comecaram: linhas.filter((l) => l.statusPedido !== null).length,
    entregues: linhas.filter((l) => l.concluido).length,
    semCompraRegistrada: linhas.filter((l) => l.semCompraRegistrada).length,
    parados: linhas.filter((l) => l.parado).length,
    semTelefone: linhas.filter((l) => l.celularDigitos === null).length,
    fastclonerConsultados: linhas.filter((l) => l.fastcloner !== null).length,
    fastclonerPagantes: linhas.filter((l) => l.fastcloner?.estado === "paga").length,
    fastclonerTrial: linhas.filter((l) => l.fastcloner?.estado === "trial").length,
    fastclonerNaoAssina: linhas.filter((l) => l.fastcloner?.estado === "nao_assina").length,
  };
}
