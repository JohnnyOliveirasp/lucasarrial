/**
 * O NOME da falha do RunPod — UM SÓ, para os DOIS observadores (#457/e811cbc7).
 *
 * O BUG, medido em 17/09: a MESMA falha tinha dois nomes dependendo de quem
 * chegou primeiro, e só um dos nomes ganhava reenvio automático.
 *
 *   - webhook (`webhooks/runpod/route.ts`): `out.error || payload.error ||
 *     \`RunPod ${payload.status}\`` → grava **"RunPod COMPLETED"**, que casa
 *     `"runpod completed"` em TRANSITORIAS (execucao.ts) → **reenvia de graça**;
 *   - poll (`generations/[id]/route.ts`): `out.error ?? "unknown"` → grava
 *     **"unknown"**, que não casa nada → **não reenvia**, falha e estorna.
 *
 * O gate de sucesso é IDÊNTICO nos dois (`COMPLETED && !out.error &&
 * out.uploaded`), então quem cai no caminho de falha cai pela mesma razão. O
 * que mudava era só o observador — e o aluno pagava por isso.
 *
 * ⛔ ISTO NÃO É TEÓRICO, O ESTILHAÇO JÁ ACONTECEU EM PRODUÇÃO. Medido no banco
 * em 17/09 23h: a mesma falha está aberta em DOIS chamados ao mesmo tempo —
 *   #457 `generation:unknown:runpod completed` · 9 ocorrências (webhook)
 *   #461 `generation:unknown:unknown`          · 1 ocorrência  (poll)
 * e a aluna **semeadorriquezas@gmail.com aparece nos DOIS**, com 43 minutos de
 * diferença: 21:25:16 pelo poll (virou #461, `request_attempts = 1`, sem
 * reenvio, estornada) e 22:08:27 pelo webhook (virou #457, com reenvio). Mesma
 * pessoa, mesmo dia, mesma falha, dois números de chamado. É a prova de que o
 * nome duplo não é detalhe de log: ele parte o chamado e tira o reenvio de quem
 * caiu no lado errado do sorteio.
 *
 * ⚠️ POR QUE O TEXTO NÃO MUDA, E NÃO PODE MUDAR AQUI: a assinatura do incidente
 * é derivada do texto do erro (`lib/incidents/classify.ts`, head de 120 chars),
 * e mexer nisso já estilhaçou a mesma falha em 4 incidentes antes. Esta função é
 * uma EXTRAÇÃO, não uma reescrita: ela devolve, byte a byte, o texto que o
 * webhook já devolvia desde sempre. Quem mudar o formato daqui muda a assinatura
 * dos dois caminhos de uma vez — e aí é cartão próprio, com migração pensada.
 *
 * ⚠️ `||` E NÃO `??`, DE PROPÓSITO. O webhook sempre usou `||`; o poll usava
 * `??`. Com `??`, um `out.error` de string VAZIA era gravado como erro vazio
 * (assinatura `generation:unknown:`, o balde cego que `classify.ts` já avisa que
 * "desabaria todas num único unknown"). Com `||`, string vazia cai no próximo
 * nome. Isto unifica no comportamento do webhook, que é o correto.
 *
 * Puro de propósito, zero imports (igual `identidade-pure.ts` e
 * `desfecho-pure.ts`): o alias "@/" não resolve em `node --test`, então a
 * decisão mora aqui e os routes só a chamam. Rodar, de dentro de frontend/:
 *   node --test src/lib/generations/erro-runpod-pure.test.ts
 */

/**
 * Monta o `error_message` de uma falha de job do RunPod, na ordem de
 * preferência de sempre: erro do worker → erro do job → o status cru.
 *
 * O terceiro caso é o que importa para o #457: chegar no caminho de falha com
 * `status = "COMPLETED"` e sem nenhum dos dois erros significa, por construção,
 * que a plataforma disse que o job DEU CERTO e não veio arquivo
 * (`out.uploaded` falsy). Isso é falha de encanamento, nunca defeito do material
 * do aluno — que é exatamente o critério de TRANSITORIAS.
 */
export function mensagemFalhaRunpod(
  outError: string | null | undefined,
  jobError: string | null | undefined,
  status: string,
): string {
  return outError || jobError || `RunPod ${status}`;
}
