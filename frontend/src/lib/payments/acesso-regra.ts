/**
 * A REGRA DE ACESSO, PURA — zero import, pra poder ser testada com
 * `node --test` sem arrastar Supabase/Resend atrás.
 *
 * Ela morava dentro de `entitlements.ts`, que importa `@/lib/db/admin`; por isso
 * nunca teve teste próprio, apesar de ser a frase mais cara desta casa: é ela
 * que decide quem entra, quem tem crédito e quem recebe qual e-mail.
 * `entitlements.ts` re-exporta `entitlementValeAcesso` daqui, então quem já
 * importava de lá não muda uma linha. A regra é byte a byte a mesma.
 */

/**
 * "Este entitlement dá acesso AGORA?", em UM lugar só.
 *
 * ⚠️ "canceled" NAO e o mesmo que "sem acesso" (corrigido 20/08).
 *
 * Ate aqui so "active" contava. So que o proprio webhook, ao cancelar uma
 * assinatura, grava de proposito o access_until do periodo JA PAGO no
 * entitlement ("cancelamento de assinatura mantem o acesso ate o fim do
 * periodo") - e o recompute jogava esse valor fora no segundo seguinte,
 * zerando profiles.access_until. Quem cancelava perdia na hora o que tinha
 * comprado, que e o oposto da regra "quem pagou fica".
 *
 * A regra, por status:
 *   active    -> access_until NULL (vitalicio) OU futuro
 *   canceled  -> SO com data futura. NULL aqui e "acabou", nao "vitalicio":
 *                cancelamento sem periodo pago restante nao da acesso.
 *   refunded / chargeback / expired -> NUNCA. O dinheiro voltou ou nao entrou.
 *
 * POR QUE ISTO SAIU DA CLOSURE (06/09, incidente #290): o e-mail de boas-vindas
 * do SGP precisa responder "o comprador TEM a plataforma?" pra parar de dizer a
 * assinante pagante que ele nao tem. Se a resposta viesse de uma copia da regra,
 * as duas iam divergir no primeiro ajuste e o e-mail voltaria a mentir por outro
 * caminho. Quem responde ao aluno usa a MESMA regra que abre a porta pra ele.
 */
export function entitlementValeAcesso(
  e: { status: string; access_until: string | null },
  agoraIso: string,
): boolean {
  if (e.status === "active") return e.access_until === null || e.access_until > agoraIso;
  if (e.status === "canceled") return e.access_until !== null && e.access_until > agoraIso;
  return false;
}

/**
 * "Este comprador SEM CONTA tem o que ativar?" — a pergunta que decide se o
 * convite de compra órfã sai. Sao DUAS condicoes, e as duas sao necessarias.
 *
 * (1) ACESSO VIVO, pela regra unica acima — nao por `status === "active"`.
 *     Foi assim que esta guarda nasceu (#127, 24/08) e a correcao passou do
 *     ponto: `canceled` com `access_until` FUTURO TEM acesso ("quem pagou fica
 *     ate o fim do periodo"). Quem cancela sem nunca ter conseguido entrar
 *     cancela JUSTAMENTE por nao conseguir entrar, e era essa pessoa que a
 *     guarda calava.
 *
 * (2) PAGOU DE VERDADE. ⚠️ Esta condicao existe porque a (1) sozinha estava
 *     ERRADA, e o erro foi pego na bancada em 08/09 antes de subir. Medindo os
 *     13 orfaos que a guarda pulava: SETE eram trial de R$ 0 cancelado ou
 *     boleto que nunca foi pago (`BILLET_PRINTED`/`DELAYED`/`OVERDUE`). Convidar
 *     essa gente a "ativar seus creditos reservados" e o #127 de novo, so que
 *     com outra fantasia — `access_until` no futuro num trial cancelado e a
 *     armadilha "acesso vivo ≠ pagou" do incidente #138.
 *     A regra de pagamento e a mesma do `pagou_de_verdade.cjs`: valor > 0 **E**
 *     status COMPLETE/APPROVED. Valor sozinho nao serve — a Hotmart emite a
 *     mensalidade de R$ 97 em OVERDUE pra quem nunca pagou.
 *
 * Conferido caso a caso contra a Hotmart viva nos 13 (08/09): as duas condicoes
 * juntas acertam 13/13. Sobram 6 pagantes com janela viva e sem conta —
 * `herysilva.27` (ate 21/09), `gustavocasarotto` (12/09), `tisse.sa` (02/10),
 * `jkakorio` (19/09), `alinecuida` (10/09), `rodrigo.limas.1978` (30/09).
 *
 * Quem pagou uma compra AVULSA mas nao a assinatura fica de fora de proposito
 * (`neto_rocha`, `viniciusjc1903`): o que a avulsa da direito dentro do
 * FastCloner e decisao COMERCIAL, de gente, nao de sweeper (#173).
 */
export function compradorMereceConvite(
  ent: { status: string; access_until: string | null } | null,
  pagouAssinatura: boolean,
  agoraIso: string,
): boolean {
  if (!ent) return false;
  if (!pagouAssinatura) return false;
  return entitlementValeAcesso(ent, agoraIso);
}

/** Status de compra que significam dinheiro que ENTROU (regra do `pagou_de_verdade.cjs`). */
const STATUS_PAGO = new Set(["COMPLETE", "COMPLETED", "APPROVED"]);

/**
 * "Este evento de compra e dinheiro que entrou?" — valor > 0 **E** status de
 * pagamento. ⚠️ Nunca só o valor: OVERDUE/DELAYED/BILLET_PRINTED tambem
 * carregam os R$ 97, e foi lendo valor sem status que a casa devolveu
 * 1.356.554 creditos a 14 pessoas que nunca pagaram (18/08).
 */
export function eventoEhPagamento(
  ev: { valor: number | string | null | undefined; status: string | null | undefined },
): boolean {
  const v = typeof ev.valor === "string" ? Number(ev.valor) : ev.valor;
  if (!Number.isFinite(v as number) || (v as number) <= 0) return false;
  return STATUS_PAGO.has(String(ev.status ?? "").toUpperCase());
}

/**
 * Produtos de CURSO na Hotmart — comprar NÃO dá a plataforma.
 *
 * Regra do Lucas (31/08), a mesma que o webhook já obedece em
 * `route.ts` ("SGP: CURSO, não assinatura. Desvia ANTES de tudo"):
 *   7283229 — Sistema de Geração Pronto
 *   7283335 — Fábrica de Conteúdo Invisível
 *
 * Sobrescrevíveis por ambiente em quem chama (`HOTMART_SGP_PRODUCT_ID`); o
 * padrão mora aqui pra a regra valer sem depender do servidor.
 */
export const PRODUTOS_DE_CURSO_PADRAO = ["7283229", "7283335"] as const;

/**
 * A lista de curso VIGENTE: o padrão acima mais o SGP do ambiente
 * (`HOTMART_SGP_PRODUCT_ID`), que é o mesmo que o roteamento do webhook usa.
 *
 * ⚠️ Mora aqui, no módulo puro, e não em `entitlements.ts`, porque ela tem DOIS
 * consumidores que precisam enxergar exatamente o mesmo conjunto: o conserto
 * (`reconcileUserEntitlements`) e o detector
 * (`sgp/reconciliacao.ts::orfasQueSobraram`). Na primeira versão deste fix a
 * lista era privada do `entitlements.ts` e o detector chamava
 * `entitlementDaPlataforma` com o PADRÃO — as duas coincidem hoje
 * (`SGP_PRODUCT_ID_PADRAO` = 7283229 já está no padrão), mas um SGP novo em
 * ambiente faria o conserto pular a órfã por ser curso enquanto o detector a
 * contava como plataforma, abrindo "sobrou compra paga sem dono" justamente na
 * linha que o conserto decidiu NÃO ligar. Uma régua, um lugar, com teste.
 *
 * ⚠️ O padrão do SGP está repetido aqui como literal, em vez de importado de
 * `sgp-boas-vindas.ts`, para este módulo continuar com ZERO import — é o que
 * permite rodá-lo em `node --test` sem arrastar Supabase atrás, e é a razão de
 * ele existir. A cópia não fica solta: `acesso-regra.test.ts` importa a
 * constante de lá e ASSERTA que as duas são iguais, então divergir quebra o
 * teste em vez de virar defeito silencioso.
 */
const SGP_PADRAO = "7283229";

export function produtosDeCurso(
  env: Record<string, string | undefined> = process.env,
): string[] {
  const sgp = env.HOTMART_SGP_PRODUCT_ID?.trim() || SGP_PADRAO;
  return Array.from(new Set([sgp, ...PRODUTOS_DE_CURSO_PADRAO]));
}

/**
 * "Esta linha de entitlement é da PLATAFORMA?" — incidente
 * #2d0509b4 (08/09): 15 entitlements `active` com `access_until` NULL
 * (vitalício) em produto de CURSO, criados em 09/06, quando o webhook ainda
 * não tinha o roteamento por produto e mandava a compra do curso pro
 * `grantAccess` como se fosse assinatura.
 *
 * ⚠️ NULL/vazio devolve TRUE de propósito. Linha sem `product_code` é ausência
 * de informação, não a informação "é curso" — e tratar ausência como curso
 * tiraria acesso de pagante antigo cuja linha nasceu sem produto. Mesmo
 * princípio da guarda do #222 em `vinculo.ts`: na dúvida, NÃO se retira nada.
 *
 * Ela só responde "dá a plataforma?"; ela NÃO decide o que fazer com as 15
 * linhas que já existem — isso é decisão comercial, de gente.
 */
export function entitlementDaPlataforma(
  productCode: string | null | undefined,
  produtosDeCurso: readonly string[] = PRODUTOS_DE_CURSO_PADRAO,
): boolean {
  const p = String(productCode ?? "").trim();
  if (!p) return true;
  return !produtosDeCurso.includes(p);
}
