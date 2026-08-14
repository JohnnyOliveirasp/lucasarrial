/**
 * Montagem do Video React — junta o viral e você num vídeo só.
 *
 * Os filtros aqui não são teoria: o caminho do `recorte` foi provado na mão
 * em 14/08 (foto → fundo verde pelo gpt-image-2 → clone → `chromakey` do
 * ffmpeg) e o recorte saiu limpo sobre fundo claro E escuro, sem franja
 * verde no cabelo. Os `split` são empilhamento puro, sem risco.
 *
 * Regras de montagem que vieram da conversa:
 * - o áudio do viral ABAIXA enquanto você fala (senão os dois competem e não
 *   se entende nenhum)
 * - o vídeo final tem a duração da SUA fala; o viral é cortado/estendido pra
 *   acompanhar
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

export type LayoutMontagem = "recorte" | "viral-em-cima" | "viral-embaixo";

/** 9:16 — formato de TikTok/Reels. */
const L = 1080;
const A = 1920;

/** Verde do preparo da foto (mesmo tom que o prompt pede). */
const VERDE = "0x00B140";
/** Tolerâncias que funcionaram no teste de 14/08. */
const SIMILARIDADE = 0.16;
const SUAVIDADE = 0.04;

/**
 * Monta o vídeo final.
 *
 * @param viral  mp4 do viral (já baixado do TikTok)
 * @param avatar mp4 do clone — com fundo VERDE quando o layout for `recorte`
 * @param audio  a fala (TTS ou gravação); manda o tempo do vídeo final
 */
export async function montarReact(args: {
  viral: string;
  avatar: string;
  audio: string;
  saida: string;
  layout: LayoutMontagem;
  /** Duração da fala, em segundos — define o corte do viral. */
  segundos: number;
}): Promise<void> {
  const { viral, avatar, audio, saida, layout, segundos } = args;

  // O viral toca em loop curto se for menor que a fala: melhor repetir do que
  // deixar tela preta no fim.
  const entradaViral = ["-stream_loop", "-1", "-t", String(segundos), "-i", viral];
  const entradaAvatar = ["-i", avatar];
  const entradaAudio = ["-i", audio];

  let filtro: string;
  if (layout === "recorte") {
    // Viral ocupa a tela; você entra recortado no canto inferior esquerdo,
    // ocupando ~38% da largura (proporção do reel de referência do Lucas).
    filtro = [
      `[0:v]scale=${L}:${A}:force_original_aspect_ratio=increase,crop=${L}:${A},setsar=1[bg]`,
      `[1:v]chromakey=${VERDE}:${SIMILARIDADE}:${SUAVIDADE},scale=${Math.round(L * 0.38)}:-1[me]`,
      `[bg][me]overlay=x=24:y=H-h-120:format=auto[v]`,
    ].join(";");
  } else {
    const cima = layout === "viral-em-cima" ? "[0:v]" : "[1:v]";
    const baixo = layout === "viral-em-cima" ? "[1:v]" : "[0:v]";
    const meia = A / 2;
    filtro = [
      `${cima}scale=${L}:${meia}:force_original_aspect_ratio=increase,crop=${L}:${meia},setsar=1[top]`,
      `${baixo}scale=${L}:${meia}:force_original_aspect_ratio=increase,crop=${L}:${meia},setsar=1[bot]`,
      `[top][bot]vstack=inputs=2[v]`,
    ].join(";");
  }

  // Áudio: a fala manda; o som do viral fica embaixo (20%) pra dar contexto
  // sem competir. `amix` com duration=first prende ao tempo da fala.
  const filtroAudio = `[0:a]volume=0.2[vlow];[2:a]volume=1.0[fala];[vlow][fala]amix=inputs=2:duration=first:dropout_transition=0[a]`;

  await run(
    "ffmpeg",
    [
      "-y", "-v", "error",
      ...entradaViral,
      ...entradaAvatar,
      ...entradaAudio,
      "-filter_complex", `${filtro};${filtroAudio}`,
      "-map", "[v]", "-map", "[a]",
      "-t", String(segundos),
      "-r", "30",
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "128k",
      "-movflags", "+faststart",
      saida,
    ],
    { timeout: 600_000, maxBuffer: 8 * 1024 * 1024 },
  );
}
