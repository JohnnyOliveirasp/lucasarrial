/**
 * EM QUE PASSO o aluno está — a linha que diz isso à Fast antes que ela mande
 * ele a lugar nenhum. Incidente #315.
 *
 * MORA NUM ARQUIVO PRÓPRIO, SEM IMPORT DE BANCO, DE PROPÓSITO: é a mesma razão
 * de `garantia.ts` (#198/#265) e de `porta-envio.ts` — o defeito aqui é TEXTO,
 * e texto errado sai bonito. Enquanto a decisão morasse dentro de `account.ts`,
 * que importa `@/lib/db/admin`, não haveria como testá-la com `node --test`.
 *
 * ── O QUE ESTAVA QUEBRADO (medido, não herdado) ─────────────────────────────
 * `buildAccountContext` monta TODO o contexto que a Fast recebe sobre o aluno e
 * consultava profiles, voices, generations, video_clones, image_generations,
 * video_projects e credit_transactions. Zero ocorrência de `sgp_pedidos` e zero
 * de login. Ou seja: ela estruturalmente NÃO PODIA saber (a) se existe pedido
 * no SGP, (b) em que passo ele está, (c) se o aluno algum dia entrou na conta.
 *
 * Sem esses três, o único enquadramento disponível para "cadê o meu material"
 * é a plataforma — e foi para lá que ela apontou. Caso do #315, comprador do
 * SGP orientado a entrar em fastcloner.com e clicar em Entrar, com as duas
 * pontas erradas: o próximo passo dele era o portal PÚBLICO (sem login) e a
 * conta dele nunca tinha recebido senha.
 *
 * ── AS TRÊS MEDIÇÕES QUE DESENHARAM ESTE ARQUIVO (17/09) ────────────────────
 *
 *  1. PROCURAR O PEDIDO SÓ POR `user_id` É SER CEGO A TODO PEDIDO EM ANDAMENTO.
 *     311 pedidos na base: 97 com `user_id`, 214 com `user_id` NULL. E a quebra
 *     por status não deixa dúvida sobre QUAIS são os nulos:
 *         dados 107 · foto 83 · audio 22 · revisao 2  → user_id preenchido: 0
 *         pronto 96                                   → user_id preenchido: 96
 *     O `user_id` só nasce no "Confirmar e Enviar" (ver `sgp/types.ts`). Então
 *     `lerPedido(userId)` acha EXCLUSIVAMENTE pedido já finalizado e não acha
 *     NENHUM dos 214 em andamento — que são precisamente aqueles em que a
 *     pergunta "em que passo ele está?" tem resposta útil. Daí a busca casar
 *     também por e-mail: 136 dos 214 têm perfil casável por e-mail hoje.
 *
 *  2. `last_sign_in_at` NÃO EXISTE EM `profiles`. Conferido no
 *     `information_schema`: a coluna mora em `auth.users`, e por isso a leitura
 *     vem da API de admin do Auth, não de um `select` em `profiles`. 655 dos
 *     2.739 perfis nunca logaram — não é caso de canto.
 *
 *  3. UM E-MAIL PODE TER VÁRIOS PEDIDOS, COM ESTADOS QUE SE CONTRADIZEM. 34
 *     e-mails têm 2+; o extremo é o perfil `b1bb9057` com 6
 *     (foto, foto, pronto, audio, foto, revisao). Por isso este arquivo NUNCA
 *     resume a pessoa a um pedido só: ele elege o que decide o PRÓXIMO PASSO e
 *     lista os outros. Reduzir a um só foi o erro que o painel do SGP já pagou
 *     — pelo ranking de AVANÇO o Rafael viraria "Entregue", escondendo os
 *     pedidos vivos dele a um clique de enviar.
 *
 * ⚠️ POR QUE O TEXTO MANDA, EM VEZ DE SÓ INFORMAR: porque entregar o dado cru
 * não bastou nas duas vezes anteriores. No #198 o contexto já trazia "Cadastro
 * em: 18/08" e a Fast ainda afirmou "7 primeiros dias"; no próprio #315 o
 * contexto dizia literalmente "Nenhum trabalho ainda (conta sem uso)" e ela
 * afirmou que o projeto "deve estar na lista de vídeos" — afirmação CONTRA o
 * dado presente. Então aqui a conclusão vem pronta e imperativa, igual à linha
 * da garantia.
 */
import type { SgpStatus } from "../sgp/types.ts";
import { diaBR } from "./garantia.ts";

/**
 * O portal de envio do SGP. PÚBLICO e sem conta — `app/[locale]/sgp/page.tsx`
 * não tem guarda de auth ("o dono do pedido é o cookie da sessão; a conta na
 * plataforma só nasce no Confirmar e Enviar"). Dizer isto EXPLICITAMENTE é
 * metade do conserto do #315: o aluno foi mandado para uma porta trancada
 * quando o passo que o destravava não pedia senha nenhuma.
 */
export const PORTAL_SGP = "https://fastcloner.com/sgp";

/**
 * Só o que esta decisão lê de um pedido. Deliberadamente mais estreito que
 * `SgpPedidoRow`: mantém a função testável sem montar a linha inteira e imune
 * às colunas opcionais (migrations 106/109/110/116) que podem não existir.
 */
export type PedidoNoContexto = {
  status: SgpStatus;
  criado_em?: string | null;
  atualizado_em?: string | null;
  enviado_em?: string | null;
  email_verificado_at?: string | null;
  codigo_expira_em?: string | null;
  erro?: string | null;
  /** Quantas fotos/áudios constam NO PEDIDO — não "quantas ele diz ter mandado". */
  fotos?: number | null;
  audios?: number | null;
  /** Casou pelo e-mail (pedido ainda sem `user_id`), não pela conta. */
  porEmail?: boolean;
};

/** O aluno ainda NÃO enviou: o material não chegou até nós. */
const NAO_ENVIADOS: readonly SgpStatus[] = ["dados", "foto", "audio", "revisao"];

/**
 * Quem decide o PRÓXIMO PASSO quando há vários pedidos. Menor = mais urgente.
 *
 * ⚠️ NÃO é o ranking de AVANÇO do painel (`compradores.escolherPedido`). Aquele
 * responde "até onde a pessoa chegou"; este responde "o que precisa acontecer
 * agora". Usar o de avanço aqui faria um pedido `pronto` antigo calar um
 * `revisao` vivo — que é o estado mais valioso que existe nesta fila (material
 * completo, falta um clique).
 */
const URGENCIA: Record<SgpStatus, number> = {
  falhou: 0, // nós quebramos; ele não tem nada a fazer
  revisao: 1, // um clique do fim
  audio: 2,
  foto: 3,
  dados: 4,
  enviado: 5, // na fila, esperando por nós
  processando: 6,
  pronto: 7, // entregue
};

/** A data mais recente que o pedido carrega, pra ordenar empate de urgência. */
const quando = (p: PedidoNoContexto): number => {
  const iso = p.atualizado_em ?? p.enviado_em ?? p.criado_em ?? null;
  const t = iso ? new Date(iso).getTime() : NaN;
  return Number.isFinite(t) ? t : 0;
};

/** O pedido que decide o próximo passo: mais urgente; empate, mais recente. */
export function pedidoQueDecide(pedidos: PedidoNoContexto[]): PedidoNoContexto | null {
  if (!pedidos.length) return null;
  return [...pedidos].sort(
    (a, b) => URGENCIA[a.status] - URGENCIA[b.status] || quando(b) - quando(a),
  )[0];
}

const dataBR = (iso: string | null | undefined): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : diaBR(d);
};

/** O que o pedido significa e o que a Fast deve fazer com ele. */
function fraseDoStatus(p: PedidoNoContexto): string {
  const enviado = dataBR(p.enviado_em);
  switch (p.status) {
    case "dados":
      return (
        "ele está no COMEÇO do wizard (passo DADOS) e o material NÃO chegou até nós. " +
        `Consta no pedido: ${p.fotos ?? 0} foto(s) e ${p.audios ?? 0} áudio(s).`
      );
    case "foto":
      return (
        "ele está no passo das FOTOS e o pedido NÃO foi enviado ainda. " +
        `Consta no pedido: ${p.fotos ?? 0} foto(s) e ${p.audios ?? 0} áudio(s).`
      );
    case "audio":
      return (
        "ele está no passo do ÁUDIO e o pedido NÃO foi enviado ainda. " +
        `Consta no pedido: ${p.fotos ?? 0} foto(s) e ${p.audios ?? 0} áudio(s).`
      );
    case "revisao":
      return (
        "o material dele está COMPLETO e falta SÓ clicar em “Confirmar e Enviar” — " +
        "o pedido ainda NÃO chegou até nós. É o empurrão mais curto que existe: diga " +
        "exatamente isso, que falta um clique, e não peça material novo."
      );
    case "enviado":
      return (
        `ele JÁ ENVIOU${enviado ? ` em ${enviado}` : ""} e está na FILA. ` +
        "Ele não precisa fazer nada e NÃO peça material de novo."
      );
    case "processando":
      return (
        "o pedido dele está EM PREPARO agora. Ele não precisa fazer nada e NÃO peça " +
        "material de novo."
      );
    case "pronto":
      return `o pedido dele foi ENTREGUE${enviado ? ` (enviado em ${enviado})` : ""}.`;
    case "falhou":
      return (
        "o preparo do pedido FALHOU do NOSSO lado. Ele NÃO precisa refazer nada — " +
        "não devolva a culpa pra ele; escale pra equipe." +
        (p.erro ? ` Motivo gravado: ${p.erro.slice(0, 120)}` : "")
      );
    default:
      // Status novo não herda por acidente uma frase que manda o aluno agir.
      return "o estado do pedido dele não é um que eu reconheça — NÃO afirme em que passo ele está; escale pra equipe.";
  }
}

/**
 * A linha do LOGIN. `desconhecido` existe e não é descuido: se a leitura do
 * Auth falhar, o certo é a Fast CALAR sobre login em vez de afirmar "nunca
 * entrou" — é o princípio do #282, erro de leitura não pode virar afirmação
 * sobre a conta de um pagante.
 */
export function linhaDoLogin(entrada: {
  ultimoLogin?: string | null;
  desconhecido?: boolean;
}): string {
  if (entrada.desconhecido) {
    return (
      "  · Login: NÃO consegui conferir agora — não afirme nem que ele entrou, " +
      "nem que nunca entrou."
    );
  }
  const quandoLogin = dataBR(entrada.ultimoLogin);
  if (!quandoLogin) {
    return (
      "  · Login: ⚠️ NUNCA ENTROU na conta (nenhum login registrado). Ele " +
      "provavelmente nunca definiu senha, e o link de primeiro acesso é de uso " +
      "único e vence. NÃO diga “entre no app e clique em Entrar” como se " +
      "bastasse: ou aponte um caminho que não exige login, ou escale pra equipe " +
      "gerar um link de acesso novo."
    );
  }
  return `  · Login: último acesso em ${quandoLogin}.`;
}

/** Inventário curto quando o e-mail tem mais de um pedido (34 e-mails hoje). */
function linhaDosOutros(pedidos: PedidoNoContexto[], eleito: PedidoNoContexto): string {
  const outros = pedidos.filter((p) => p !== eleito);
  if (!outros.length) return "";
  const lista = outros
    .map((p) => {
      const d = dataBR(p.atualizado_em ?? p.criado_em);
      return `${p.status}${d ? ` (${d})` : ""}`;
    })
    .join(", ");
  return (
    `\n  · ⚠️ Este e-mail tem ${pedidos.length} pedidos no SGP. Os outros: ${lista}. ` +
    "Um pedido ENTREGUE não cobre os outros, e um pedido vazio não apaga uma " +
    "entrega — se ele falar de material, confirme de QUAL pedido se trata."
  );
}

/**
 * O bloco do SGP + primeiro acesso, pronto pro prompt.
 *
 * `temPedido = false` NÃO afirma que ele não é comprador do SGP: a conta não
 * registra o que foi comprado de curso (no caso do #315 o comprador tinha ZERO
 * linha em `payment_events`). Então a instrução é condicional — e é justamente
 * a que faltava: o envio é num portal PÚBLICO, sem login.
 */
export function blocoSgpParaAgente(
  entrada: {
    pedidos: PedidoNoContexto[];
    ultimoLogin?: string | null;
    loginDesconhecido?: boolean;
    /** A leitura de `sgp_pedidos` falhou — não afirme "não tem pedido". */
    pedidosDesconhecidos?: boolean;
  },
): string {
  const cabeca = "SGP / PRIMEIRO ACESSO (calculado pelo sistema — obedeça este bloco):";
  const login = linhaDoLogin({
    ultimoLogin: entrada.ultimoLogin,
    desconhecido: entrada.loginDesconhecido,
  });

  if (entrada.pedidosDesconhecidos) {
    return [
      cabeca,
      login,
      "  · Pedido no SGP: NÃO consegui ler agora. Não afirme que ele tem nem que " +
        "não tem pedido, e não mande procurar material em menu nenhum; se o " +
        "assunto for o material do SGP, escale pra equipe.",
    ].join("\n");
  }

  const eleito = pedidoQueDecide(entrada.pedidos);

  if (!eleito) {
    return [
      cabeca,
      login,
      "  · Pedido no SGP: NENHUM consta para esta conta (procurei pela conta E " +
        "pelo e-mail). Se ele disser que já mandou fotos/áudios, então NADA " +
        "CHEGOU até nós: NÃO afirme que o material está em algum menu do app e " +
        "NÃO mande ele procurar lá. O envio do SGP é feito no portal PÚBLICO " +
        `${PORTAL_SGP}, que NÃO exige login nem senha — diga isso com essas ` +
        "palavras, é o mal-entendido que mais trava esses casos. Se ele " +
        "insistir que enviou, pergunte por qual canal e ofereça receber por " +
        "resposta de e-mail.",
    ].join("\n");
  }

  const partes: string[] = [cabeca, login, `  · Pedido no SGP: ${fraseDoStatus(eleito)}`];

  // O código de verificação do e-mail venceu e o e-mail nunca foi verificado:
  // ele está travado num portão, e mandar "continue o cadastro" sem dizer isso
  // é mandar pra parede — mesma forma do Pix vencido do #319.
  const codigoVenceu =
    NAO_ENVIADOS.includes(eleito.status) &&
    !eleito.email_verificado_at &&
    !!eleito.codigo_expira_em &&
    new Date(eleito.codigo_expira_em).getTime() < Date.now();
  if (codigoVenceu) {
    partes.push(
      `  · ⚠️ O código de verificação do e-mail dele VENCEU em ${dataBR(eleito.codigo_expira_em)} ` +
        "e o e-mail nunca foi verificado: ele precisa pedir um código NOVO no " +
        "portal pra conseguir continuar. NÃO mande usar o código antigo.",
    );
  }

  // Onde ele continua. Só pra quem ainda não enviou: para quem está na fila ou
  // já foi entregue, apontar o portal de envio seria pedir trabalho refeito.
  if (NAO_ENVIADOS.includes(eleito.status)) {
    partes.push(
      `  · Onde ele continua: ${PORTAL_SGP} — portal PÚBLICO, NÃO exige login ` +
        "nem senha. Diga isso explicitamente.",
    );
  }

  if (eleito.porEmail) {
    partes.push(
      "  · Este pedido casou pelo E-MAIL (ainda sem conta vinculada, porque o " +
        "vínculo só nasce no “Confirmar e Enviar”).",
    );
  }

  return partes.join("\n") + linhaDosOutros(entrada.pedidos, eleito);
}
