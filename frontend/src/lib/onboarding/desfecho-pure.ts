/**
 * O DESFECHO do onboarding, puro — sem banco, sem rede, sem alias `@/`.
 *
 * Por que existe (12/09, #364): a regra de "acabou de vez" decide o que o
 * aluno LÊ na tela do SGP, e até aqui ela não tinha um único teste porque
 * morava dentro de `statusOnboarding`, que fala com o Supabase. Separada
 * assim, a regra é testável por `node --test` (o runner não resolve `@/`,
 * lição do PR #159) e `pronto.ts` continua sendo só a busca dos dados.
 *
 * Não muda a régua de 22/08: ela está aqui inteira, mais a perna da foto.
 */

export type EntradaDesfecho = {
  /** O aluno passou pelo onboarding (tem avatar ou voz de importação). */
  onboarding: boolean;
  /** Houve pelo menos UMA tentativa de avatar. */
  houveAvatar: boolean;
  /** Avatares em `ready`. */
  prontos: number;
  /** Avatares em `pending`/`generating` — qualquer um segura o veredito. */
  pendentes: number;
  /** Status da voz que vale pro onboarding (`null` se não há voz). */
  vozStatus: string | null;
  /** Alguma voz do aluno em `validating` — a única em movimento de verdade. */
  vozTreinando: boolean;
  /** `error_message` da voz, quando houver. */
  vozErro?: string | null;
};

export type Desfecho = {
  pronto: boolean;
  falhou: boolean;
  motivo: string | null;
};

export const MOTIVO_AUDIO_CURTO =
  "o áudio enviado não chegou aos 20 minutos necessários para treinar a voz";
export const MOTIVO_FOTO = "não foi possível gerar o seu clone a partir das fotos enviadas";

export function desfechoOnboarding(e: EntradaDesfecho): Desfecho {
  // 22/08: exigir avatar pronto SEM NUNCA ter tentado gerar um trancava a
  // linha pra sempre (fernao82, dmaggioni, namaiimoveis, thiagoabadio — voz de
  // pé, zero foto importada). Se houve avatar, ele precisa ficar pronto; se
  // nunca houve, a voz pronta basta pra fechar a linha.
  const pronto =
    e.onboarding &&
    e.pendentes === 0 &&
    (e.houveAvatar ? e.prontos >= 1 : true) &&
    e.vozStatus === "ready";

  // Os status da voz são: validating | awaiting_training | ready | failed |
  // rejected_too_short. `awaiting_training` NÃO conta como morta de propósito
  // (o treino ainda pode disparar) — quem cuida dela é o prazo de 45min.
  const vozMorta = e.vozStatus === "failed" || e.vozStatus === "rejected_too_short";

  // 12/09 (#364): até aqui só a VOZ tinha desfecho terminal. Avatar `failed`
  // com voz `ready` não era nem pronto nem falhou, e `etapas.ts` gravava
  // "processando" PARA SEMPRE — a tela dizia "em andamento" pra uma imagem
  // morta, com `erro` NULO. Caso-prova: pedido fe00d4e2, 18h em silêncio.
  const avatarMorto = e.houveAvatar && e.prontos === 0 && e.pendentes === 0;
  // Só vale com a perna da VOZ já assentada: declarar fim com a voz a caminho
  // derrubaria uma linha que ia dar certo.
  const vozAssentada = e.vozStatus === "ready" || vozMorta;

  const falhou =
    e.onboarding &&
    !pronto &&
    e.pendentes === 0 &&
    !e.vozTreinando &&
    (vozMorta || (avatarMorto && vozAssentada));

  const motivo = !falhou
    ? null
    : vozMorta
      ? e.vozStatus === "rejected_too_short"
        ? MOTIVO_AUDIO_CURTO
        : "o treino da voz falhou" + (e.vozErro ? ": " + String(e.vozErro).slice(0, 160) : "")
      : // avatarMorto com a voz DE PÉ: quem morreu foi a foto. Dizer "o treino
        // da voz falhou" aqui seria mentira com prova no banco (voz `ready`).
        MOTIVO_FOTO;

  return { pronto, falhou, motivo };
}
