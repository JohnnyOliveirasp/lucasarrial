/**
 * Elegibilidade de ÁUDIO pro vídeo — quem entra, quem fica de fora, e POR QUÊ.
 *
 * Antes, a rota /api/v1/videos/audios filtrava `duration_seconds <= 90` no SQL:
 * o áudio acima do teto simplesmente SUMIA da tela, sem uma palavra. O aluno
 * com um áudio de 2min28 via "você ainda não tem áudios" e abria chamado
 * (caso #adc3ed99, sidneysantos100 — ele contornou sozinho subindo um .m4a do
 * computador, por tentativa e erro). Medido em 07/09: 304 de 3.532 áudios
 * prontos passam de 90s, atingindo 136 alunos — e 22 deles SÓ têm áudio longo,
 * ou seja, viam a tela de "vazio" tendo áudio íntegro no acervo.
 *
 * A regra de negócio (teto de 90s) está certa e não muda. O que muda é a
 * COMUNICAÇÃO: a lista passa a mostrar o áudio longo desabilitado, com o motivo
 * ao lado. Este módulo é a parte pura dessa decisão, compartilhada pelas duas
 * telas que listam áudio (wizard de vídeo e Vídeo Clone) pra não divergirem.
 */

/** Item mínimo que este módulo sabe classificar. */
export type ComDuracao = { duration_seconds: number | null };

/**
 * Passou do teto?
 *
 * Comparação ESTRITA (`> max`), de propósito: é exatamente o que a rota fazia
 * no SQL (`.lte(max)`) e é o que o backend do wizard cobra ao criar o projeto
 * (videos/route.ts: `gen.duration_seconds > MAX_AUDIO_SECONDS` → 400). Assim o
 * botão desabilitado e a recusa do servidor concordam sempre — nada aparece
 * clicável pra dar erro depois, nem some algo que o servidor aceitaria.
 *
 * Duração desconhecida (null) NÃO é tratada como longa: a rota já não devolve
 * linha sem duração, e na dúvida quem recusa é o servidor, com mensagem.
 */
export function acimaDoTeto(seconds: number | null | undefined, maxSeconds: number): boolean {
  return seconds != null && seconds > maxSeconds;
}

/**
 * Separa a lista em "dá pra usar" e "passou do teto", mantendo a ordem de
 * origem dentro de cada grupo (a rota já vem em created_at desc).
 *
 * `ordenados` = usáveis primeiro, longos depois. Importa porque as telas cortam
 * a lista (`slice(0, 20)`): sem isso, um punhado de áudios longos recentes
 * empurraria pra fora da tela justamente os que o aluno pode escolher.
 */
export function separarPorTeto<T extends ComDuracao>(
  items: T[],
  maxSeconds: number,
): { usaveis: T[]; longos: T[]; ordenados: T[] } {
  const usaveis: T[] = [];
  const longos: T[] = [];
  for (const item of items) {
    (acimaDoTeto(item.duration_seconds, maxSeconds) ? longos : usaveis).push(item);
  }
  return { usaveis, longos, ordenados: [...usaveis, ...longos] };
}

/**
 * Duração em português de gente: "8s", "1min30s", "2min28s".
 * Mesmo formato já usado no video-wizard/video-board — "148s" não diz nada pro
 * aluno, e o motivo da recusa precisa ser lido de relance.
 */
export function duracaoLegivel(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return "—";
  const total = Math.max(0, Math.round(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m}min${String(s).padStart(2, "0")}s` : `${s}s`;
}
