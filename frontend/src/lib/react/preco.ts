/**
 * Preço do React — o número que faltava cobrar.
 *
 * ACHADO 22/09: a rota `/api/v1/react/gerar` nunca checou saldo nem debitou.
 * Enquanto o produto era só da equipe isso não doía (admin não paga). Aberto
 * ao aluno sem isto, cada geração dispararia minutos de GPU na RunPod **de
 * graça e sem limite** — o passo mais caro do produto seria o único grátis.
 *
 * Os números são os que a TELA já promete desde 14/08
 * (`react-passo-saida.tsx`): taxa fixa de 300 + o segundo do clone conforme o
 * motor (Padrão 2.0 = 105 cr/s, Turbo = 80 cr/s). Cobrar diferente do que
 * está escrito na tela seria pior que não cobrar.
 *
 * HeyGen não entra: ali o vídeo sai da conta do PRÓPRIO aluno (BYOK), então a
 * casa não tem custo de GPU pra repassar — cobra só a taxa fixa.
 */
import { getCloneTier } from "@/lib/video-clone/config";

/** LLM do roteiro + preparo + montagem com ffmpeg + legenda. */
export const REACT_TAXA_FIXA = 300;

export function custoDoReact(motor: string, segundos: number): number {
  const seg = Math.max(1, Math.ceil(segundos));
  if (motor === "heygen") return REACT_TAXA_FIXA;
  const tier = getCloneTier(motor);
  const porSegundo = tier?.creditsPerSecond ?? 105;
  return REACT_TAXA_FIXA + seg * porSegundo;
}

/** Frase única da recusa — a mesma na tela e na API. */
export const semSaldo = (custo: number, saldo: number) =>
  `Créditos insuficientes: este React custa ${custo.toLocaleString("pt-BR")} e você tem ${saldo.toLocaleString("pt-BR")}.`;
