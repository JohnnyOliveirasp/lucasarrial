/**
 * O que o painel de progresso do envio de áudios mostra, em função do estado.
 *
 * Está fora do componente por um motivo: a regra que o #289 quebrou é uma
 * INVARIANTE ("enquanto o botão estiver apagado, a tela tem que estar
 * falando"), e invariante sem teste volta. Aqui ela é uma função pura e o
 * teste ao lado prova, sobre a linha do tempo real de um envio, que a regra
 * antiga tinha buraco e esta não tem.
 *
 * #289 (Elane, 06/09): 20 clipes, 27,6 min de áudio. A condição de exibição
 * era `step === "submitting" || (step === "upload" && files.some(uploading))`.
 * O `some(uploading)` cai pra falso no instante em que o último arquivo fica
 * "done" — então o painel sumia durante o `uploads-complete` e a navegação,
 * deixando na tela só um botão apagado. Ela achou que travou, refez, tentou
 * pelo celular e abriu chamado. Nada estava quebrado.
 */

export type FaseEnvio = "preparando" | "enviando" | "finalizando";

/**
 * Depois de tanto tempo sem o XHR mover um byte, a tela passa a dizer que
 * parece parado. Só AVISA — não cancela nem manda recarregar: `uploadOne` já
 * tenta cada arquivo até MAX_UPLOAD_ATTEMPTS sozinho, e mandar recarregar no
 * meio de um upload que ia se resolver é justamente o estrago do #289.
 */
export const AVISO_PARADO_MS = 120_000;

export type EstadoEnvio = {
  /** A trava anti-clique-duplo. Ligada = existe envio em curso. */
  busy: boolean;
  fase: FaseEnvio;
  /** 0..100, somado dos eventos de progresso do XHR. Medida real de banda. */
  overall: number;
  /** Há quanto tempo `overall` não muda. */
  paradoMs: number;
};

export type PainelEnvio = {
  visivel: boolean;
  /** Largura da barra, 0..100. */
  barra: number;
  /** A porcentagem numérica só aparece quando ela significa alguma coisa. */
  mostraPorcentagem: boolean;
  /** Minutos parados a exibir, ou `null` se não é hora de assustar ninguém. */
  avisoParadoMin: number | null;
};

export function painelDeEnvio(e: EstadoEnvio): PainelEnvio {
  if (!e.busy) {
    return { visivel: false, barra: 0, mostraPorcentagem: false, avisoParadoMin: null };
  }

  // "Enviando" é a única fase em que a barra mede a banda do aluno. Nas outras
  // duas quem corre é o servidor: em "preparando" nenhum byte subiu (0) e em
  // "finalizando" já subiram todos (100). Nenhuma das duas inventa avanço.
  const enviando = e.fase === "enviando";
  const barra = e.fase === "finalizando" ? 100 : enviando ? e.overall : 0;

  // O aviso de parado só cabe em "enviando": nas outras fases não há byte
  // nenhum para andar, e cobrar progresso ali acusaria de travado um envio que
  // está apenas esperando o servidor responder.
  const avisoParadoMin =
    enviando && e.paradoMs >= AVISO_PARADO_MS ? Math.floor(e.paradoMs / 60_000) : null;

  return { visivel: true, barra, mostraPorcentagem: enviando, avisoParadoMin };
}
