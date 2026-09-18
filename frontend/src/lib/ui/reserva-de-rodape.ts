/**
 * A régua da FAIXA DE RODAPÉ: quanto de espaço a página precisa reservar no
 * fim para que nenhum conteúdo termine EMBAIXO de um elemento `fixed`.
 *
 * POR QUE ESTE ARQUIVO EXISTE (a mesma colisão, três vezes):
 *
 *   28/07 — a pill do Gravador (canto inferior direito) sumia atrás do balão
 *           da Fast. Resposta da época: mudar a pill para o centro.
 *   14/08 — o balão da Fast cobriu o "Continuar" do wizard e travou o Johnny.
 *           Resposta da época: deixar o balão ARRASTÁVEL
 *           (use-arrastavel.tsx).
 *   18/09 — o mesmo balão cobriu o MESMO "Continuar" outra vez, agora porque
 *           o passo 01 cresceu (banner "achei N gravações", PR #330):
 *           sobreposição medida de 108x36 px em 360/390 px de largura, e o
 *           `elementFromPoint` no canto do botão devolvia o balão, não o
 *           botão.
 *
 * As duas respostas anteriores tiraram O ELEMENTO da frente. Nenhuma delas
 * impede a próxima tela de crescer para dentro da faixa — e arrastar joga no
 * aluno um problema que ele não tem como adivinhar que existe.
 *
 * A regra daqui inverte o sentido: quem cede é a PÁGINA. Todo elemento
 * `fixed` ancorado no rodapé declara a faixa que ocupa, o conteúdo reserva a
 * MAIOR faixa declarada, e aí, com a página no fim da rolagem, não sobra
 * conteúdo debaixo de nada. Vale para qualquer tela do /app — inclusive as
 * que ainda não existem.
 *
 * Pura de propósito (sem DOM): é o pedaço que dá para provar com
 * `node --test src/lib/ui/reserva-de-rodape.test.ts`.
 */

/** Variável CSS lida pelo `<main>` do layout do /app. */
export const VAR_RESERVA = "--fc-reserva-rodape";

/** Respiro entre o fim do conteúdo e o topo do elemento fixo. */
export const FOLGA_PX = 12;

/**
 * Até onde um elemento fixo pode SUBIR (px a partir da base da janela).
 *
 * Existe por causa do arrasto: a reserva acompanha a posição do balão, então
 * um balão estacionado no alto da tela pediria uma reserva do tamanho da
 * tela — um buraco enorme no fim de toda página. Limitando o arrasto à faixa
 * de baixo, a reserva tem teto conhecido e a garantia continua valendo em
 * QUALQUER posição permitida (não é um `cap` que abandona a regra no extremo:
 * é o extremo que deixa de existir).
 */
export const FRACAO_MAX_DA_JANELA = 0.4;

/**
 * Quanto reservar, dado o TOPO do elemento fixo (coordenada de viewport) e a
 * altura da janela.
 *
 * É a distância do topo do elemento até a base da janela, mais a folga. Se o
 * elemento está fora da tela por baixo, não há o que reservar (0).
 */
export function reservaDaFaixa(
  topoDoElemento: number,
  alturaDaJanela: number,
  folga: number = FOLGA_PX,
): number {
  if (!Number.isFinite(topoDoElemento) || !Number.isFinite(alturaDaJanela)) return 0;
  // Elemento inteiramente abaixo da dobra não ocupa faixa nenhuma — e aí nem
  // a folga se aplica (senão um elemento fora da tela ainda pediria espaço).
  if (topoDoElemento >= alturaDaJanela) return 0;
  const bruta = alturaDaJanela - topoDoElemento + folga;
  if (bruta <= 0) return 0;
  // Nunca mais que a própria janela: reserva maior que a tela é sempre um
  // defeito de medição, e o estrago (página inteira de vazio) é pior que a
  // colisão que ela evitaria.
  return Math.min(alturaDaJanela, Math.round(bruta));
}

/**
 * Teto do `bottom` de um elemento arrastável, em px a partir da base — o que
 * mantém a reserva dentro de um tamanho defensável.
 */
export function tetoDaFaixa(alturaDaJanela: number, fracao: number = FRACAO_MAX_DA_JANELA): number {
  if (!Number.isFinite(alturaDaJanela) || alturaDaJanela <= 0) return 0;
  return Math.floor(alturaDaJanela * fracao);
}
