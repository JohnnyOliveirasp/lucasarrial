/**
 * SGP — o PORTÃO da tela 1 (`/api/v1/sgp/inicio`): quem pode COMEÇAR o wizard.
 *
 * ── O BURACO QUE ISTO FECHA (medido 24/09, ordem do Johnny) ─────────────────
 * A tela 1 não conferia compra NENHUMA: qualquer pessoa com o link entrava no
 * portal e disparava trabalho que gasta GPU sem ter comprado o produto. Medido
 * em 24/09: há gente no portal que comprou só o FCI (7283335) — e o FCI NÃO dá
 * direito ao SGP. A ordem: *"fecha o portão. Só entra quem tem compra
 * confirmada."*
 *
 * ── A RÉGUA ─────────────────────────────────────────────────────────────────
 * 1. TEM compra confirmada do SGP (PURCHASE_APPROVED do produto 7283229 no
 *    `payment_events`, casado por `chaveEmail`) → ENTRA. É a MESMA fonte e a
 *    MESMA chave que a aba "Todos os compradores" usa (`compradores.ts`) —
 *    nunca uma segunda régua, senão o portão barra quem o painel chama de
 *    comprador.
 * 2. NÃO tem compra, mas JÁ EXISTE pedido em `sgp_pedidos` com esse e-mail →
 *    ENTRA. É a cláusula de quem já estava dentro, e ela existe por um caso
 *    REAL: 12 pessoas estão no portal SEM compra registrada porque o webhook
 *    ficou CEGO pro produto 7283229 entre 09/06 e 04/09 (ver o cabeçalho de
 *    `compradores.ts` e de `sgp-boas-vindas.ts`). Barrá-las seria expulsar
 *    comprador de verdade por um defeito NOSSO de registro. O custo assumido:
 *    quem entrou antes do portão sem comprar continua entrando — medido em
 *    24/09, e aceito, porque falso positivo (expulsar pagante) é pior que
 *    falso negativo (tolerar quem já estava).
 * 3. Nem compra, nem pedido → BARRA, com um texto que diz O QUE FAZER — nunca
 *    um 403 mudo (`step-dados-form.tsx` joga `error.message` direto na tela,
 *    então a mensagem daqui vai pros olhos do aluno; armadilha do #72: texto
 *    que culpa o aluno é o defeito mais caro do módulo vizinho `porta-envio`).
 *
 * Módulo PURO (zero import) pelo mesmo motivo de `porta-envio.ts` e
 * `acesso-regra.ts`: a frase que decide quem entra precisa de teste que roda
 * com `node --test` sem arrastar Supabase atrás.
 */

export type PortaoInicio =
  /** Segue a tela 1 normal: manda o código de 6 dígitos pro e-mail. */
  | { acao: "entrar" }
  /** Recusa com um texto que vai DIRETO pros olhos do aluno. */
  | { acao: "barrar"; mensagem: string };

/**
 * O texto do barrado. Três coisas, nesta ordem, nenhuma negociável:
 *  1. Diz O QUE aconteceu sem acusar ("não encontramos", não "você não tem") —
 *     a compra pode existir noutro e-mail, e a casa já respondeu "você está sem
 *     assinatura" a quem tinha pago dois dias antes noutro endereço (caso Marco
 *     Lovison, 23/09).
 *  2. Diz O QUE FAZER: usar o e-mail da compra.
 *  3. Aponta o suporte, que é quem resolve o caso que a régua não alcança.
 */
export const MENSAGEM_SEM_COMPRA =
  "Não encontramos uma compra do Sistema de Geração Pronto neste e-mail. " +
  "Se você comprou com outro e-mail, informe aqui o MESMO e-mail usado na compra. " +
  "Se acabou de comprar, aguarde alguns minutos e tente de novo. " +
  "Precisa de ajuda? Escreva para suporte@fastcloner.com informando o e-mail da compra.";

/**
 * @param temCompraSgp    existe PURCHASE_APPROVED do produto SGP pra
 *                        `chaveEmail(email)` em `payment_events`.
 * @param temPedidoAnterior  já existe linha em `sgp_pedidos` com essa mesma
 *                        `chaveEmail` — a cláusula de quem já estava dentro.
 */
export function portaoDoInicio(args: {
  temCompraSgp: boolean;
  temPedidoAnterior: boolean;
}): PortaoInicio {
  if (args.temCompraSgp) return { acao: "entrar" };
  if (args.temPedidoAnterior) return { acao: "entrar" };
  return { acao: "barrar", mensagem: MENSAGEM_SEM_COMPRA };
}
