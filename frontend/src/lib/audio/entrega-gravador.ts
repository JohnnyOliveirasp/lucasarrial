/**
 * A régua da ENTREGA do Gravador: do que está na tela de gravar, o que a tela
 * de DESTINO (`/app/voice-cloning/new`) consegue mesmo somar sozinha.
 *
 * Por que existe (incidente #235, Alana):
 *
 * O Gravador libera o botão "Enviar para treinamento" quando a barra bate os
 * 20 min. Mas a barra e a tela de destino contam coisas diferentes: a barra
 * soma TODOS os clipes, e o destino só aceita os `MAX_ARQUIVOS_TREINO`
 * maiores (teto do backend, 20 arquivos por voz). Quem fecha os 20 min com
 * MUITOS clipes curtos ganha a CTA, cai na tela de criar voz com metade do
 * áudio importado e encontra o botão "Treinar" apagado — sem uma linha de
 * explicação, exatamente o "não evolui e volta pra Nova voz".
 *
 * O compromisso desta régua é o mesmo do `medicao.ts`: **o que a tela promete
 * não pode contradizer o que a tela seguinte faz**. Se o total gravado bate a
 * meta mas a entrega não bate, isso não é motivo pra ficar calado (nem pra
 * mentir liberando) — é motivo pra DIZER (`metaIlusoria`).
 *
 * Nota de escopo: os takes do celular (R2) são importados pelo destino, então
 * eles CONTAM aqui. O que não conta é o clipe que vai ser cortado pelo teto.
 */

/**
 * Teto de arquivos por voz imposto pelo backend. Vive aqui para os dois lados
 * (gravador e criação de voz) lerem o MESMO número — quando ele existia só
 * dentro do `voice-creator`, o gravador liberava a CTA contando clipe que o
 * destino ia descartar.
 */
export const MAX_ARQUIVOS_TREINO = 20;

/** Um clipe do Gravador, do ponto de vista da entrega. */
export type ClipeDoGravador = { seconds: number };

export type ResumoEntrega = {
  /** Tudo que a pessoa gravou (clipes + celular). É o número da barra. */
  totalGravado: number;
  /** Só o que a tela de destino consegue somar sozinha. É o número que MANDA. */
  aproveitados: number;
  /** Quantos clipes ficam de fora pelo teto de arquivos. */
  clipesForaDoTeto: number;
  /** Quantos segundos esses clipes levam embora. */
  segundosForaDoTeto: number;
  /** A CTA pode aparecer? Só quando o APROVEITADO bate a meta. */
  liberaEnvio: boolean;
  /**
   * A armadilha do #235: a barra já diz "meta atingida" mas a entrega não
   * fecha. Quando isto é verdade a tela é OBRIGADA a explicar — some a CTA e
   * o aluno precisa saber por quê.
   */
  metaIlusoria: boolean;
};

/**
 * Aplica no gravador a MESMA regra do destino: ordena por duração e mantém os
 * `maxArquivos` maiores (é o que o `voice-creator` faz ao importar), soma os
 * segundos do celular por cima.
 */
export function resumirEntregaDoGravador(
  clipes: readonly ClipeDoGravador[],
  segundosDoCelular: number,
  metaSegundos: number,
  maxArquivos: number = MAX_ARQUIVOS_TREINO,
): ResumoEntrega {
  const celular = Math.max(0, segundosDoCelular || 0);
  const teto = Math.max(0, maxArquivos);

  const duracoes = clipes
    .map((c) => Math.max(0, c.seconds || 0))
    .sort((a, b) => b - a);

  const dentro = duracoes.slice(0, teto);
  const fora = duracoes.slice(teto);

  const soma = (v: readonly number[]) => v.reduce((s, n) => s + n, 0);
  const aproveitados = soma(dentro) + celular;
  const totalGravado = aproveitados + soma(fora);
  const liberaEnvio = aproveitados >= metaSegundos;

  return {
    totalGravado,
    aproveitados,
    clipesForaDoTeto: fora.length,
    segundosForaDoTeto: soma(fora),
    liberaEnvio,
    metaIlusoria: totalGravado >= metaSegundos && !liberaEnvio,
  };
}
