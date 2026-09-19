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
 * ─────────────────────────────────────────────────────────────────────────
 * INCIDENTE #314 (medido 08/09, consumado 16/09): A FRASE ACIMA ESTAVA CERTA
 * E A IMPLEMENTAÇÃO ERA MAIS FRACA QUE ELA.
 *
 * A guarda original só rodava no ramo `if (!userIdDoEmail)`: ela protegia
 * contra gravar NULL por cima de um dono, mas NÃO contra gravar OUTRO DONO por
 * cima do dono atual. O comentário chamava isso de "transferência de
 * titularidade" e tratava como desejado. O preço, quando a conta de destino é
 * uma conta que o aluno nunca abriu:
 *
 *   Jesus Peres (CPF 15101360880) usa `diretoria@grupoperes.com.br` (347eccc3),
 *   onde gastou ~88.000 créditos em agosto. A compra está no e-mail
 *   `iehudaperes@grupoperes.com.br`. Em 01/09 a NOSSA carta mandou ele criar
 *   conta com o e-mail da compra; em 04/09 ele criou (e nunca logou nela).
 *   A partir daí, todo evento da Hotmart em `A1ZH3SEI` transferia a
 *   titularidade para a conta vazia:
 *     08/09 18:16:21Z  PURCHASE_APPROVED  → dono 347eccc3 → 4656e845,
 *                      e os 100.000 créditos do ciclo caíram na conta vazia
 *                      0,6s depois. Reparado na mão no mesmo dia.
 *     16/09 11:18:07Z  PURCHASE_COMPLETE  → transferiu DE NOVO. O reparo
 *                      manual durou 8 dias.
 *
 * O reparo manual não tem como durar: ele conserta a LINHA, e a linha é
 * reescrita a cada evento. Enquanto a decisão for "o e-mail manda", cada
 * conserto do #222 vira uma bomba armada — e a nossa própria carta de 01/09
 * pediu a 3 alunos exatamente o gesto que arma a bomba.
 *
 * A REGRA AGORA É A DO PRÓPRIO DOCSTRING, SEM EXCEÇÃO: **o lookup por e-mail
 * só ADICIONA dono — nunca REMOVE e nunca TROCA.** Linha sem dono recebe o
 * dono do e-mail; linha COM dono mantém o dono que tem.
 *
 * O QUE ISSO CUSTA, DITO SEM MAQUIAR: a transferência automática de
 * titularidade morre. Quem vinculou o dono errado à mão deixa de ser corrigido
 * sozinho pelo próximo webhook. Isso é aceito de propósito, por dois motivos:
 * (1) escolher dono por heurística é o que já errou 7 vezes neste projeto;
 * (2) a troca acontecia EM SILÊNCIO — é por isso que o caso do Jesus só
 * apareceu porque alguém foi conferir. Por isso a troca não some: ela vira
 * `titularidadeDivergente`, que o caller registra em `audit` para virar
 * chamado em vez de virar dano.
 * ─────────────────────────────────────────────────────────────────────────
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
 * @returns o dono a gravar — só ADICIONA dono; nunca remove nem troca
 */
export function donoDoEntitlement(
  userIdDoEmail: string | null,
  userIdGravado: string | null,
): string | null {
  // Linha que JÁ TEM dono manda. Vale contra NULL (#222) e vale contra outro
  // usuário (#314): o e-mail da compra não é autoridade para desligar ninguém
  // de uma compra que já está ligada a uma conta.
  if (userIdGravado) return userIdGravado;
  // Linha órfã: aí sim o e-mail ADICIONA o dono. Ausência de dono é o único
  // caso em que o lookup decide.
  return userIdDoEmail || null;
}

/**
 * A troca de titularidade que a regra acima passou a RECUSAR — para o caller
 * registrar em `audit` em vez de deixar passar calada.
 *
 * O #314 durou 8 dias e explodiu duas vezes porque a transferência não deixava
 * rastro nenhum: nem log, nem chamado, nem aviso ao dono antigo. `entitlements`
 * não tem trilha de auditoria (só `updated_at`, que é sobrescrito), então
 * transferência já revertida é estruturalmente invisível. Esta função é o
 * mínimo para que a próxima divergência apareça no minuto em que acontece.
 *
 * @returns true quando o e-mail da compra aponta para uma conta DIFERENTE da
 *          que já é dona da linha — o caso em que antes o dono era trocado.
 */
export function titularidadeDivergente(
  userIdDoEmail: string | null,
  userIdGravado: string | null,
): boolean {
  if (!userIdDoEmail || !userIdGravado) return false;
  return userIdDoEmail !== userIdGravado;
}
