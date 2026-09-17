/**
 * Formato de SAÍDA do Vídeo Clone × proporção da FOTO escolhida.
 *
 * Por que isto existe (caso quaglioandre@gmail.com, 13–19/08): ele gerou 8
 * clones, todos "ready", ZERO falhas, 43.360 créditos — partindo de fotos
 * 16:9 e recebendo vídeo em pé. Achou que era defeito, escalou 4 vezes e
 * pediu cancelamento. NÃO era defeito: o Vídeo Clone não tem opção de
 * formato, todo tier sai no mesmo quadro vertical (CLONE_TIERS em config.ts).
 * A falha foi nossa e é de COMUNICAÇÃO — a tela nunca disse isso antes de
 * cobrar.
 *
 * Duas regras que este módulo respeita de propósito:
 *  1. AVISO, NUNCA PORTÃO. Recortar uma foto deitada pra vertical é uso
 *     legítimo — quem quiser gerar assim, gera. Por isso aqui só sai
 *     informação; nada neste arquivo desabilita botão (ver o teste de
 *     regressão em formato-saida.test.ts).
 *  2. O número do quadro vem de CLONE_TIERS, não de literal na tela. Duplicar
 *     valor foi o que produziu o #414 e as reincidências #175/#178/#209.
 */
import { CLONE_TIERS } from "./config.ts";

export type OrientacaoImagem = "horizontal" | "vertical" | "quadrada" | "desconhecida";

/** O mínimo de um tier que interessa ao formato (CloneTier satisfaz isto). */
export type CloneTierLike = { id?: string; width: number; height: number };

/** Quadro de saída do vídeo, em pixels. */
export type FormatoSaida = { width: number; height: number; vertical: boolean };

/**
 * Tolerância pra chamar de "quadrada" o que é quadrado aos olhos.
 *
 * Os 3% são os MESMOS que /api/v1/images/import usa pra rotular a proporção de
 * um upload (aspectLabel). Sem isso, uma foto 1000×999 seria "horizontal" na
 * hora do upload (dimensões cruas) e "1:1" depois que a lista recarrega (rótulo
 * salvo) — o aviso de corte piscaria e sumiria sozinho. Alinhar as duas
 * tolerâncias faz a tela dizer a mesma coisa nos dois momentos.
 */
const TOLERANCIA_QUADRADA = 0.03;

/**
 * Proporção declarada da imagem → orientação.
 *
 * Aceita o que o banco realmente guarda em image_generations.aspect_ratio:
 * os rótulos curados ("16:9", "3:4", o legado "4:5") E a razão crua que o
 * import grava quando a foto não bate com nenhum rótulo ("1600:1000").
 * "auto", nulo ou ilegível viram "desconhecida" — é o caso em que a tela
 * degrada pro aviso genérico em vez de chutar.
 */
export function orientacaoDaImagem(aspect: string | null | undefined): OrientacaoImagem {
  if (typeof aspect !== "string") return "desconhecida";
  const m = /^\s*(\d+(?:[.,]\d+)?)\s*[:x×]\s*(\d+(?:[.,]\d+)?)\s*$/i.exec(aspect);
  if (!m) return "desconhecida";
  const w = Number(m[1].replace(",", "."));
  const h = Number(m[2].replace(",", "."));
  if (!(w > 0) || !(h > 0)) return "desconhecida";
  if (Math.abs(w - h) / Math.max(w, h) <= TOLERANCIA_QUADRADA) return "quadrada";
  return w > h ? "horizontal" : "vertical";
}

/**
 * O quadro de saída, se TODOS os tiers concordarem — e hoje concordam
 * (480×832 nos dois). Devolve null se algum dia divergirem: a foto é escolhida
 * ANTES do tier, então um número só vale como aviso enquanto valer pra
 * qualquer escolha. Melhor calar do que exibir o quadro do tier errado.
 * O teste trava isso: se alguém acrescentar um tier com outro quadro (ou
 * deitado), quebra aqui antes de a tela passar a mentir.
 */
export function formatoUnicoDaSaida(tiers: readonly CloneTierLike[] = CLONE_TIERS): FormatoSaida | null {
  const [primeiro, ...resto] = tiers;
  if (!primeiro) return null;
  if (resto.some((t) => t.width !== primeiro.width || t.height !== primeiro.height)) return null;
  return { width: primeiro.width, height: primeiro.height, vertical: primeiro.height > primeiro.width };
}

/** O que a tela mostra sobre o formato, dada a proporção da foto escolhida. */
export type AvisoDeFormato = {
  /** Quadro de saída pra escrever na tela (null = tiers divergem, não afirma). */
  formato: FormatoSaida | null;
  /** A foto é deitada e o vídeo em pé vai cortar as laterais dela. */
  cortaLaterais: boolean;
};

/**
 * Aviso de formato pra foto escolhida. `aspect` é o aspect_ratio do acervo ou
 * um "W:H" montado das dimensões do arquivo recém-enviado.
 *
 * Note que `cortaLaterais` é só o caso PIOR e mais surpreendente (foto
 * deitada). Foto quadrada ou em pé fora de 480×832 também perde borda; quem
 * cobre esses é o aviso genérico do formato, que aparece sempre.
 */
export function avisoDeFormato(aspect: string | null | undefined): AvisoDeFormato {
  const formato = formatoUnicoDaSaida();
  return {
    formato,
    cortaLaterais: formato !== null && formato.vertical && orientacaoDaImagem(aspect) === "horizontal",
  };
}
