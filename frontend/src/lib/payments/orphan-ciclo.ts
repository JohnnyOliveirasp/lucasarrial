/**
 * Quando o convite de compra órfã pode FALAR DE NOVO — medido em 08/09/2026.
 *
 * POR QUE ESTE ARQUIVO EXISTE
 * O dedupe do `orphan-outreach.ts` era por E-MAIL e PARA SEMPRE: quem recebeu
 * o convite e o lembrete único de 3 dias nunca mais era procurado. Numa compra
 * avulsa isso está certo. Numa ASSINATURA MENSAL está errado, e o erro tem a
 * forma mais cara possível: a pessoa é cobrada todo mês por uma plataforma em
 * que nunca conseguiu entrar, e a casa, que sabe disso, fica calada.
 *
 * Medido em produção (08/09), no `agent_state.orphan_invites` (180 e-mails):
 * 66 compradores tiveram PURCHASE_APPROVED **pago** DEPOIS do último contato.
 * A maioria criou conta e o `hasAccount` já os poupa. Sobraram, sem conta e com
 * janela paga viva:
 *   josephgois@hotmail.com     convite 04/08, lembrete 07/08 → pagou R$97 em 17/08
 *   isaias.enf@gmail.com       convite 04/08, lembrete 07/08 → pagou R$97 em 18/08
 *   scandovieri41@hotmail.com  convite 04/08, lembrete 07/08 → pagou R$97 em 26/08
 *   ezwaymotors@gmail.com      convite 26/08, lembrete 30/08 → pagou US$20 em 01/09
 *   caplastica@hotmail.com     convite 04/08, lembrete 07/08 → pagou R$194 (13+28/08)
 * Os quatro primeiros foram escritos À MÃO em 08/09 porque o sweeper não podia.
 *
 * E O MOTIVO DE ISSO SER URGENTE HOJE: o `5aef886` (PR #211), mergeado nesta
 * mesma manhã, alargou `compradorMereceConvite` citando 6 pagantes com janela
 * viva e sem conta. Conferido um a um contra o estado do dedupe: `tisse.sa` e
 * `rodrigo.limas.1978` não têm registro e recebem; `herysilva.27`,
 * `gustavocasarotto` e `jkakorio` estão calados PARA SEMPRE e `alinecuida` só
 * alcança o lembrete. Ou seja, o fix de hoje chegaria a 2 dos 6 que ele nomeia.
 * PR mergeado não é PR que funciona.
 *
 * A REGRA
 * O ciclo é do PAGAMENTO, não do e-mail. Pagamento novo depois do ciclo que já
 * foi atendido reabre o convite (e o lembrete). Sem pagamento novo, silêncio —
 * o teto continua sendo 1 convite + 1 lembrete POR COBRANÇA, então um assinante
 * mensal vê no máximo ~2 mensagens por mês, e só enquanto NÃO tiver conta.
 *
 * ⚠️ A ARMADILHA QUE QUASE ENTROU AQUI: comparar as duas datas como STRING.
 * O `payment_events.received_at` chega `2026-08-17T14:13:47.982633+00:00` e o
 * estado grava `2026-08-17T14:13:47.982Z`. Lexicograficamente o `6` de `982633`
 * vem ANTES do `Z`, então o MESMO instante compara como "mais antigo" e o ciclo
 * nunca reabriria — falha silenciosa, sem erro nenhum. Aqui compara-se em
 * milissegundos, de propósito. Data inválida NÃO reabre ciclo (falha fechada:
 * na dúvida, não manda e-mail).
 *
 * Módulo puro de propósito (sem imports): dá pra testar sem banco.
 * Rodar:  node --test src/lib/payments/orphan-ciclo.test.ts
 */

/** O que o `agent_state.orphan_invites` guarda por e-mail. */
export type RegistroConvite = {
  /** ISO do convite que abriu o ciclo corrente. */
  first: string;
  /** ISO do lembrete único do ciclo corrente, ou null se ainda não saiu. */
  reminder: string | null;
  /**
   * ISO do PAGAMENTO que o ciclo corrente atendeu. Ausente nos registros
   * criados antes de 08/09 — nesses, o ciclo é ancorado no `first`, que é o
   * comportamento que reabre para quem pagou depois de ter sido calado.
   */
  cicloEm?: string | null;
};

export type AcaoConvite = "convite" | "lembrete" | "nada";

/** Milissegundos de um ISO, ou null se não der pra ler. */
function ms(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

/**
 * Âncora do ciclo corrente: o pagamento que ele atendeu, ou — em registro
 * antigo, sem `cicloEm` — a data do próprio convite.
 */
export function ancoraDoCiclo(registro: RegistroConvite): string | null {
  return registro.cicloEm ?? registro.first ?? null;
}

/**
 * O que fazer com este comprador AGORA.
 *
 * Ordem:
 *   1. nunca foi procurado                    → convite
 *   2. pagamento mais novo que o ciclo atual   → convite (ciclo reaberto)
 *   3. lembrete do ciclo ainda não saiu e já venceu a espera → lembrete
 *   4. resto                                   → nada
 */
export function decidirAcaoConvite(args: {
  registro: RegistroConvite | undefined | null;
  /** ISO do último PURCHASE_APPROVED pago deste comprador (null se nenhum). */
  ultimoPagamentoIso: string | null;
  agoraMs: number;
  lembreteAposMs: number;
}): AcaoConvite {
  const { registro, ultimoPagamentoIso, agoraMs, lembreteAposMs } = args;
  if (!registro) return "convite";

  const pagamento = ms(ultimoPagamentoIso);
  const ancora = ms(ancoraDoCiclo(registro));
  // Falha fechada: sem pagamento legível ou sem âncora legível, não reabre.
  if (pagamento !== null && ancora !== null && pagamento > ancora) return "convite";

  const first = ms(registro.first);
  if (!registro.reminder && first !== null && agoraMs - first > lembreteAposMs) {
    return "lembrete";
  }
  return "nada";
}

/** O registro que fica gravado depois de mandar o convite que abre um ciclo. */
export function registroDoConvite(
  agoraIso: string,
  ultimoPagamentoIso: string | null,
  anterior?: RegistroConvite | null,
): RegistroConvite {
  return {
    first: agoraIso,
    reminder: null,
    cicloEm: ultimoPagamentoIso ?? anterior?.cicloEm ?? anterior?.first ?? null,
  };
}
