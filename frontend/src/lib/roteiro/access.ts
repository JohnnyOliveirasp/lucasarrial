/**
 * Gate do Gerador de Roteiros — GRADUADO (ordem do Johnny 13/08).
 *
 * Ficou em pré-produção admin-only de 10/08 a 13/08; liberado pra todos os
 * assinantes junto com a mudança do menu (item "Gerador de Roteiros" abaixo
 * do Dashboard). O parâmetro fica pra manter a assinatura das rotas.
 */
export async function roteiroAllowedEmail(_email: string | null | undefined): Promise<boolean> {
  return true;
}
