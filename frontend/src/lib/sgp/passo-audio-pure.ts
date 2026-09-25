/**
 * Tela 3 do SGP (áudio) — as regras PURAS do botão "Continuar".
 *
 * Nasceu do caso katarinadasilva98 (#492): ela ficou com o botão cinza
 * faltando 30 SEGUNDOS de fala aprovada e a tela nunca disse isso — o único
 * texto era a barra de progresso, que já parecia cheia. É o mesmo defeito da
 * tela de foto (caso amanda.rosaleal, 13/09), consertado lá em c08da4b9 e
 * nunca espelhado aqui.
 *
 * O motivo do bloqueio passa a sair DAQUI, e o `disabled` do botão também —
 * assim a tela não pode dizer uma coisa e o botão fazer outra.
 *
 * NÃO afrouxa nada: as condições são exatamente as de antes (fala aprovada
 * entre SGP_AUDIO_MIN_SEGUNDOS e SGP_AUDIO_MAX_SEGUNDOS, nada em voo, os 4
 * itens de CIENCIA_AUDIO). E o portão mede FALA, não duração de arquivo:
 * medir-audio.ts desconta silêncio, e é `somaFalaDistinta` sobre os aprovados
 * que entra aqui — a mesma conta dos portões do servidor. A trava de verdade
 * continua no servidor, em api/v1/sgp/audio/concluir.
 */
import { CIENCIA_AUDIO, SGP_AUDIO_MAX_SEGUNDOS, SGP_AUDIO_MIN_SEGUNDOS } from "./types.ts";

export type MotivoBloqueioAudio =
  | { tipo: "ocupado" }
  | { tipo: "fala"; faltamSegundos: number }
  | { tipo: "excesso"; sobramSegundos: number }
  | { tipo: "ciencia"; faltam: number };

export type EstadoPassoAudio = {
  /**
   * Segundos de FALA aprovada e DISTINTA (somaFalaDistinta sobre os
   * aprovados) — nunca a duração dos arquivos.
   */
  totalFala: number;
  /** Algum arquivo ainda subindo ou sendo analisado. */
  ocupado: boolean;
  /** Quantos dos itens de CIENCIA_AUDIO estão marcados. */
  ciencia: number;
};

/**
 * Tudo que impede o "Continuar" agora. Lista vazia = pode ir.
 * Devolve TODOS os motivos (falta fala E falta confirmação é um caso real),
 * pra tela não consertar um e descobrir o outro só no clique seguinte.
 *
 * O motivo de fala diz QUANTOS SEGUNDOS FALTAM — foi exatamente o número que
 * a tela nunca mostrou pra katarinadasilva98.
 */
export function motivosBloqueioAudio({ totalFala, ocupado, ciencia }: EstadoPassoAudio): MotivoBloqueioAudio[] {
  // Com áudio em voo os números ainda vão mudar: dizer "faltam 3 min" no
  // meio da análise é uma mentira de meio segundo que assusta o aluno.
  if (ocupado) return [{ tipo: "ocupado" }];
  const motivos: MotivoBloqueioAudio[] = [];
  if (totalFala < SGP_AUDIO_MIN_SEGUNDOS) {
    // ceil: nunca prometer menos do que falta (29,2s → "faltam 30s").
    motivos.push({ tipo: "fala", faltamSegundos: Math.ceil(SGP_AUDIO_MIN_SEGUNDOS - totalFala) });
  } else if (totalFala > SGP_AUDIO_MAX_SEGUNDOS) {
    motivos.push({ tipo: "excesso", sobramSegundos: Math.ceil(totalFala - SGP_AUDIO_MAX_SEGUNDOS) });
  }
  if (ciencia < CIENCIA_AUDIO.length) motivos.push({ tipo: "ciencia", faltam: CIENCIA_AUDIO.length - ciencia });
  return motivos;
}

export function podeContinuarAudio(estado: EstadoPassoAudio): boolean {
  return motivosBloqueioAudio(estado).length === 0;
}

/**
 * Higieniza a lista de ciência que vem de fora (banco ou corpo do request):
 * só itens conhecidos, sem repetição, sempre na ordem de CIENCIA_AUDIO.
 *
 * O "sem repetição" importa: sem ele, quatro cópias de "silencio" contam como
 * quatro itens marcados.
 */
export function cienciaValida(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const marcados = new Set(raw.filter((c): c is string => typeof c === "string"));
  return CIENCIA_AUDIO.filter((c) => marcados.has(c));
}

/**
 * Dá pra gravar o RASCUNHO dos checkboxes por cima de `ciencia_audio`?
 *
 * Só enquanto o pedido está na tela 3 e ninguém registrou a ciência ainda.
 * Depois do /concluir, `ciencia_audio` deixa de ser rascunho e passa a ser o
 * registro do consentimento (o par com `ciencia_audio_at`) — uma volta à
 * tela 3 desmarcando um item não pode reescrever isso.
 */
export function podeGuardarRascunhoCienciaAudio(pedido: { status: string; ciencia_audio_at: string | null }): boolean {
  return pedido.status === "audio" && !pedido.ciencia_audio_at;
}
