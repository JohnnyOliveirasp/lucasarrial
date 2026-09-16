/**
 * SGP — a PORTA do "Confirmar e Enviar" (tela 4): o que cada status responde.
 *
 * Regra pura, sem I/O, porque a coisa que se errou aqui foi TEXTO, e texto que
 * culpa o aluno é o defeito mais caro deste módulo (armadilha do #72). Régua
 * sem teste é promessa; esta tem teste.
 *
 * ── Os dois defeitos que este arquivo fecha (medidos 15/09) ────────────────
 * `/api/v1/sgp/enviar` tinha UMA linha de recusa para todo o resto do universo:
 *
 *     if (["processando","pronto"].includes(status)) → 200 idempotente
 *     if (status !== "revisao") → 400 "Complete as etapas anteriores antes de enviar."
 *
 * e essa frase chega CRUA na tela do aluno (`sgp-enviar-form.tsx` joga
 * `error.message` direto no estado). Resultado, em dois estados diferentes:
 *
 *   1. `falhou` — o aluno completou TUDO e fomos NÓS que quebramos (o caso real
 *      de 15/09 foi CUDA out of memory no treino da voz). Dizer "complete as
 *      etapas anteriores" é devolver pra ele a culpa de um defeito nosso.
 *      Atenuado — não resolvido — por um redirect em `/sgp/revisao`, que só pega
 *      quem chega pela página; aba velha e botão voltar furam.
 *
 *   2. `enviado` — e este é PIOR, porque não tem atenuação nenhuma. `enviado` é
 *      fila LEGÍTIMA: o aluno enviou e está esperando. Não estava na lista do
 *      idempotente NEM na lista do redirect, então o caminho era normal, o botão
 *      ficava ativo, ele clicava e levava "Complete as etapas anteriores" tendo
 *      acabado de enviar. Caminho comum, sem mitigação.
 *
 * ── A régua ────────────────────────────────────────────────────────────────
 * A frase "complete as etapas anteriores" sobrevive em UM lugar só: nos estados
 * em que ela é VERDADE (`dados`, `foto`, `audio` — o aluno de fato não terminou
 * o wizard). Em todo o resto ela é mentira e sai.
 */
import type { SgpStatus } from "./types.ts";

export type PortaDoEnvio =
  /** Segue o fluxo normal: cria a conta e despacha o pedido. */
  | { acao: "enviar" }
  /**
   * Já foi enviado — responder 200 com `jaEnviado`, e não erro. Clicar duas
   * vezes num botão de envio é comportamento humano normal, não falha.
   */
  | { acao: "ja_enviado" }
  /** Recusa com um texto que vai DIRETO pros olhos do aluno. */
  | { acao: "recusar"; mensagem: string };

/**
 * Os estados em que o aluno realmente não terminou o wizard — e só neles a
 * frase original continua sendo verdade.
 */
const INCOMPLETOS: readonly SgpStatus[] = ["dados", "foto", "audio"];

/**
 * Os estados em que o pedido JÁ SAIU. `enviado` entra aqui: era a ausência dele
 * que fazia o aluno na fila levar "complete as etapas anteriores".
 */
const JA_SAIU: readonly SgpStatus[] = ["enviado", "processando", "pronto"];

/**
 * O texto do `falhou`. Três coisas, nesta ordem, e nenhuma é negociável:
 *   1. NÃO manda ele fazer nada — ele já fez a parte dele.
 *   2. NÃO afirma de quem é a culpa. O `erro` vem NULL na base inteira (268
 *      pedidos medidos em 15/09), e `classificarErro("")` devolveria "aluno" —
 *      exatamente a culpa indevida que este arquivo existe pra impedir. Sem
 *      motivo gravado, não se atribui dono.
 *   3. Aponta o acompanhamento, que é onde o motivo (quando existe) e o contato
 *      do suporte já moram.
 */
export function mensagemDeFalha(erro: string | null): string {
  const base =
    "O seu pedido já foi enviado — você não precisa refazer nada. " +
    "O preparo travou e a nossa equipe já foi avisada.";
  const detalhe = erro ? ` O que aconteceu: ${erro}` : "";
  return `${base}${detalhe} Acompanhe em /sgp/acompanhar.`;
}

/**
 * @param status   status atual do pedido
 * @param erro     `sgp_pedidos.erro` — o motivo técnico, quando já foi gravado.
 *                 A rota antiga não olhava para ele; por isso a mensagem de
 *                 falha não tinha como dizer nada de útil.
 */
export function portaDoEnvio(status: SgpStatus, erro: string | null = null): PortaDoEnvio {
  if (status === "revisao") return { acao: "enviar" };
  if (JA_SAIU.includes(status)) return { acao: "ja_enviado" };
  if (status === "falhou") return { acao: "recusar", mensagem: mensagemDeFalha(erro) };
  // `dados` | `foto` | `audio`: aqui a frase original é verdadeira.
  if (INCOMPLETOS.includes(status)) {
    return { acao: "recusar", mensagem: "Complete as etapas anteriores antes de enviar." };
  }
  // Inalcançável hoje (SGP_STATUS está coberto por inteiro). Se um status novo
  // nascer, ele cai aqui em vez de herdar por acidente a frase que culpa o
  // aluno — que foi como os dois defeitos acima começaram.
  return { acao: "recusar", mensagem: mensagemDeFalha(erro) };
}
