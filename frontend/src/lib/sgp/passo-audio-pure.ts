/**
 * Tela 3 do SGP (áudio) — as regras PURAS do botão "Continuar".
 *
 * Nasceu do caso da Catarina (Angola, 20/09): 37h parada nesta tela com UM
 * arquivo marcado "aprovado", `motivos: []`, `avisos: []`, ✓ verde na lista —
 * e o botão cinza. Faltavam 30 SEGUNDOS: ela tinha 1.170s de fala e a régua
 * pede 1.200 (SGP_AUDIO_MIN_SEGUNDOS). A tela dizia APROVADO e o botão não
 * andava; não havia uma linha explicando o que faltava, e a barra de progresso
 * em 97% não é uma explicação. Não tinha como ela adivinhar.
 *
 * É o mesmo conserto que a tela de FOTO ganhou em 14/09 (commit c08da4b9,
 * caso amanda.rosaleal@gmail.com): o motivo do bloqueio sai DAQUI e o
 * `disabled` do botão também, pra tela não poder dizer uma coisa e o botão
 * fazer outra. A tela de áudio tinha ficado no commit 8ac02ea4 (02/09), antes
 * do conserto.
 *
 * NÃO afrouxa nada. As condições são exatamente as de antes: fala aprovada
 * entre SGP_AUDIO_MIN_SEGUNDOS e SGP_AUDIO_MAX_SEGUNDOS, nada em voo, os 4
 * itens de CIENCIA_AUDIO. A régua de 20 min é de QUALIDADE DE TREINO — o
 * conserto é a tela CONTAR a verdade, não o portão ceder. A trava de verdade
 * continua no servidor, em api/v1/sgp/audio/concluir.
 */
import { CIENCIA_AUDIO, SGP_AUDIO_MAX_SEGUNDOS, SGP_AUDIO_MIN_SEGUNDOS } from "./types.ts";

export type MotivoBloqueioAudio =
  | { tipo: "ocupado" }
  | { tipo: "vazio" }
  | {
      tipo: "fala";
      /** Quanto falta, em segundos exatos. O caso da Catarina: 1.170 → 30. */
      faltamSegundos: number;
      /** O que já está somado, em segundos de FALA aprovada. */
      falaAprovada: number;
      /** Em que unidade isso vira texto (ver `comoDizer`). */
      unidade: "segundos" | "minutos";
      /** O número a mostrar, já convertido pra `unidade`. */
      quanto: number;
    }
  | { tipo: "excedeu"; sobramSegundos: number }
  | { tipo: "ciencia"; faltam: number };

export type EstadoPassoAudio = {
  /**
   * Soma dos segundos dos arquivos com status "aprovado".
   *
   * ⚠️ É tempo de FALA, não duração do arquivo: `SgpAudio.segundos` é gravado
   * como `Math.round(m.falaSegundos)` em api/v1/sgp/audio/route.ts:52, já
   * descontado o silêncio que o ffmpeg mediu. É exatamente o que o aluno não
   * tem como adivinhar sozinho, e por isso o texto do motivo diz isso em voz
   * alta.
   */
  falaAprovada: number;
  /** Quantos arquivos estão na lista da tela, em qualquer fase. */
  arquivos: number;
  /** Algum arquivo ainda subindo ou sendo analisado. */
  ocupado: boolean;
  /** Quantos dos itens de CIENCIA_AUDIO estão marcados. */
  ciencia: number;
};

/**
 * Em que unidade dizer o que falta.
 *
 * Abaixo de um minuto a conversa é em SEGUNDOS: arredondar os 30s da Catarina
 * pra "1 min" seria repetir o defeito em escala menor — ela iria gravar um
 * minuto achando que era isso, e o número na tela continuaria sem bater com a
 * régua.
 *
 * De um minuto pra cima arredonda pra CIMA (`ceil`), nunca pra baixo: dizer
 * "faltam 4 min" quando faltam 4min01s devolve o aluno ao botão cinza depois
 * de ele ter feito exatamente o que a tela pediu — que é o bug de origem.
 */
function comoDizer(faltamSegundos: number): { unidade: "segundos" | "minutos"; quanto: number } {
  return faltamSegundos < 60
    ? { unidade: "segundos", quanto: faltamSegundos }
    : { unidade: "minutos", quanto: Math.ceil(faltamSegundos / 60) };
}

/**
 * Tudo que impede o "Continuar" agora. Lista vazia = pode ir.
 *
 * Devolve TODOS os motivos (faltar áudio E faltar confirmação é um caso real),
 * pra tela não consertar um e descobrir o outro só no clique seguinte.
 */
export function motivosBloqueioAudio({
  falaAprovada,
  arquivos,
  ocupado,
  ciencia,
}: EstadoPassoAudio): MotivoBloqueioAudio[] {
  // Com arquivo em voo os números ainda vão mudar: dizer "faltam 12 min" no
  // meio de uma análise que pode somar 15 é uma mentira de meio minuto.
  if (ocupado) return [{ tipo: "ocupado" }];

  const motivos: MotivoBloqueioAudio[] = [];
  if (arquivos === 0) {
    // Lista vazia tem motivo PRÓPRIO: "faltam 20 min de fala aprovada" é
    // verdade, mas soa como se algo tivesse sido recusado. Aqui ainda não
    // houve envio nenhum, e a primeira frase da tela precisa dizer isso.
    motivos.push({ tipo: "vazio" });
  } else if (falaAprovada < SGP_AUDIO_MIN_SEGUNDOS) {
    const faltamSegundos = SGP_AUDIO_MIN_SEGUNDOS - falaAprovada;
    motivos.push({ tipo: "fala", faltamSegundos, falaAprovada, ...comoDizer(faltamSegundos) });
  } else if (falaAprovada > SGP_AUDIO_MAX_SEGUNDOS) {
    motivos.push({ tipo: "excedeu", sobramSegundos: falaAprovada - SGP_AUDIO_MAX_SEGUNDOS });
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
 * quatro itens marcados e o botão acende sem o aluno ter lido nada.
 */
export function cienciaAudioValida(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const marcados = new Set(raw.filter((c): c is string => typeof c === "string"));
  return CIENCIA_AUDIO.filter((c) => marcados.has(c));
}

/**
 * Dá pra gravar o RASCUNHO dos checkboxes por cima de `ciencia_audio`?
 *
 * Só enquanto o pedido está na tela 3 e ninguém registrou a ciência ainda.
 * Depois do /concluir, `ciencia_audio` deixa de ser rascunho e passa a ser o
 * registro do consentimento (o par com `ciencia_audio_at`) — uma volta à tela
 * 3 desmarcando um item não pode reescrever isso.
 */
export function podeGuardarRascunhoCienciaAudio(pedido: { status: string; ciencia_audio_at: string | null }): boolean {
  return pedido.status === "audio" && !pedido.ciencia_audio_at;
}
