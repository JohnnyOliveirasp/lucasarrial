/**
 * Decisão PURA do estorno órfão (incidente 1970fcaa, 22/08) — testável com
 * `node --test`, zero dependências.
 *
 * O buraco: failImageGeneration reivindica a row com
 * `.eq(id).in(status, [pending, generating]).select()` e, se o claim volta
 * vazio, retorna. Só que "claim vazio" tem DOIS motivos diferentes:
 *
 *  (a) a row EXISTE mas já saiu de pending/generating — outra via (corrida
 *      webhook × poll) finalizou antes. Não fazer nada é CORRETO: quem
 *      ganhou o claim já disparou a contingência.
 *  (b) a row NÃO EXISTE MAIS — o aluno apagou do histórico com a geração em
 *      voo (o DELETE de /api/v1/images hard-deleta). O débito segue no
 *      extrato e ninguém estorna: aluno cobrado, sem imagem, em silêncio.
 *
 * O código antigo tratava (b) como (a). Esta função separa os dois casos; a
 * IDEMPOTÊNCIA do estorno em si (nunca devolver duas vezes) não é dela: fica
 * no refundOriginalDebit (failure-alert.ts), que só devolve enquanto houver
 * mais débitos que estornos no par (ref_type, ref_id) — mesmo mecanismo já
 * usado por todos os estornos automáticos.
 */

export type FalhaSemClaim =
  /** Row existe fora de pending/generating: outra via finalizou. Não mexe. */
  | "ja_finalizada_por_outra_via"
  /** Row sumiu mas nunca houve débito (equipe/admin/bypass). Nada a devolver. */
  | "sem_cobranca"
  /** Row sumiu E há débito no extrato: estornar por ref_id. */
  | "estornar_orfao";

export function decidirFalhaSemClaim(a: {
  /** A row ainda está no banco (em qualquer status)? */
  rowAindaExiste: boolean;
  /** Existe débito (amount < 0, ref_type image_generation) pra este ref_id? */
  houveDebito: boolean;
}): FalhaSemClaim {
  if (a.rowAindaExiste) return "ja_finalizada_por_outra_via";
  return a.houveDebito ? "estornar_orfao" : "sem_cobranca";
}
