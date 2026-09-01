/**
 * Quem é o dono de um entitlement na hora de gravar — a decisão que o
 * `grantAccess` errava.
 *
 * POR QUE ESTE ARQUIVO EXISTE (incidente #222, medido em 01/09/2026):
 * `grantAccess` monta o upsert com `user_id: findUserIdByEmail(buyer_email)`.
 * Quando a compra foi feita com um e-mail que NÃO tem perfil (caso "comprei
 * com um e-mail e criei a conta com outro"), esse lookup devolve NULL — e o
 * upsert grava NULL POR CIMA de um vínculo que já existia. Ou seja: o próximo
 * evento da Hotmart daquela assinatura (renovação, cancelamento, reenvio do
 * webhook) DESLIGA a compra do dono. E como `userId` fica null, o
 * `recomputeProfileAccess` nem é chamado — o aluno perde o acesso em silêncio,
 * sem nada no log e sem ninguém ser avisado.
 *
 * Isso é o que tornava frágil o conserto manual desses casos: vincular o
 * órfão na mão funcionava até o próximo webhook e apodrecia sozinho.
 *
 * A regra, em uma frase: **o lookup por e-mail só ADICIONA dono, nunca
 * REMOVE.** Não achar perfil para o e-mail da compra é ausência de
 * informação, não é a informação "esta compra não tem dono".
 *
 * Mora num arquivo próprio, sem nenhum import, de propósito: `entitlements.ts`
 * importa por alias (`@/lib/db/admin`), que o runner nativo do Node não
 * resolve sem loader, e por isso não dá para testar de lá (a mesma limitação
 * documentada em `lib/agent/manual.test.ts`). Aqui a decisão fica sob teste
 * de verdade em vez de sob leitura de fonte.
 */

/**
 * Decide o `user_id` que vai para o upsert do entitlement.
 *
 * @param userIdDoEmail  dono encontrado pelo e-mail da compra (NULL = não achou)
 * @param userIdGravado  dono que já está na linha do banco (NULL = órfã)
 * @returns o dono a gravar — nunca troca um dono existente por NULL
 */
export function donoDoEntitlement(
  userIdDoEmail: string | null,
  userIdGravado: string | null,
): string | null {
  // O e-mail da compra casou com um perfil: ele manda. Isso preserva o
  // comportamento de sempre, inclusive a transferência de titularidade quando
  // o e-mail passa a existir como conta.
  if (userIdDoEmail) return userIdDoEmail;
  // Não casou: mantém quem já era dono. NULL só sobrevive se já era NULL.
  return userIdGravado ?? null;
}
