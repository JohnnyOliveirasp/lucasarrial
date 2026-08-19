/**
 * Montagem do Video React — junta o viral e você num vídeo só.
 *
 * Os filtros aqui não são teoria: o caminho do `recorte` foi provado na mão
 * em 14/08 (foto → fundo verde pelo gpt-image-2 → clone → `chromakey` do
 * ffmpeg) e o recorte saiu limpo sobre fundo claro E escuro, sem franja
 * verde no cabelo. Os `split` são empilhamento puro, sem risco.
 *
 * Regras que vieram da conversa:
 * - o áudio do viral ABAIXA enquanto você fala (senão os dois competem)
 * - o vídeo final tem a duração da SUA fala
 * - **quando a fala passa do viral, o excedente é VOCÊ EM TELA CHEIA** — não
 *   o viral em loop. O caso do Johnny (14/08): fala de 14s pra um viral de
 *   9s; repetir 9 segundos de vídeo enquanto ele ainda fala fica amador.
 *   Se ele subiu uma cena, é ela que aparece nesse pedaço.
 */
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
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

/** Menos que isso não vale virar trecho separado — só encurta a fala. */
const MIN_EXCEDENTE_S = 1.5;

/**
 * Congela o último quadro por até 10s. É o cinto de segurança contra o clone
 * sair mais curto que a fala: melhor a imagem parada do que o vídeo acabar no
 * meio da frase (defeito que o Johnny pegou no 1º React, 14/08).
 */
const SEGURA_FIM = "tpad=stop_mode=clone:stop_duration=10,";

export type PlanoMontagem = {
  /** Quanto tempo o viral aparece. */
  segundosViral: number;
  /** Quanto tempo sobra de fala depois do viral acabar. */
  segundosExcedente: number;
};

/**
 * Divide o tempo entre "com viral" e "só você". Quem chama usa isso pra
 * avisar na tela ANTES de gastar crédito.
 */
export function planejar(args: { falaSegundos: number; viralSegundos: number }): PlanoMontagem {
  const viral = Math.min(args.falaSegundos, args.viralSegundos);
  const sobra = Math.max(0, args.falaSegundos - args.viralSegundos);
  return {
    segundosViral: viral,
    segundosExcedente: sobra >= MIN_EXCEDENTE_S ? sobra : 0,
  };
}

/** Trecho 1: o viral com você por cima (ou lado a lado). */
async function trechoComViral(args: {
  viral: string;
  avatar: string;
  saida: string;
  layout: LayoutMontagem;
  segundos: number;
}): Promise<void> {
  const { viral, avatar, saida, layout, segundos } = args;
  let filtro: string;
  // ⚠️ O clone pode sair um pouco mais curto que a fala. Sem isto o vídeo
  // simplesmente ACABA antes do áudio; com o tpad o último quadro congela e a
  // fala termina inteira.
  const AV = `[1:v]${SEGURA_FIM}`;
  if (layout === "recorte") {
    // Viral ocupa a tela; você entra recortado no canto inferior esquerdo.
    // 19/08, calibrado contra o reel de referência do Johnny (IG DO6uRUQATaa):
    // lá o avatar tem ~30% da largura e fica COLADO no canto — o corte da
    // cintura cai na borda da tela e o meio-corpo parece inteiro. Os 46% de
    // 17/08 dominavam a tela, e o y=H-h-120 deixava o avatar FLUTUANDO com um
    // vão embaixo, que era o que dava a impressão de "cortado".
    filtro = [
      `[0:v]scale=${L}:${A}:force_original_aspect_ratio=increase,crop=${L}:${A},setsar=1[bg]`,
      `${AV}chromakey=${VERDE}:${SIMILARIDADE}:${SUAVIDADE},scale=${Math.round(L * 0.32)}:-1[me]`,
      `[bg][me]overlay=x=0:y=H-h:format=auto[v]`,
    ].join(";");
  } else {
    const cima = layout === "viral-em-cima" ? "[0:v]" : AV;
    const baixo = layout === "viral-em-cima" ? AV : "[0:v]";
    const meia = A / 2;
    filtro = [
      `${cima}scale=${L}:${meia}:force_original_aspect_ratio=increase,crop=${L}:${meia},setsar=1[top]`,
      `${baixo}scale=${L}:${meia}:force_original_aspect_ratio=increase,crop=${L}:${meia},setsar=1[bot]`,
      `[top][bot]vstack=inputs=2[v]`,
    ].join(";");
  }
  await run(
    "ffmpeg",
    [
      "-y", "-v", "error",
      "-t", String(segundos), "-i", viral,
      "-t", String(segundos), "-i", avatar,
      "-filter_complex", filtro,
      "-map", "[v]", "-an",
      "-t", String(segundos), "-r", "30",
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
      saida,
    ],
    { timeout: 600_000, maxBuffer: 8 * 1024 * 1024 },
  );
}

/**
 * Trecho 2: o viral acabou e sobra fala. Aparece VOCÊ em tela cheia — ou a
 * cena que você subiu (foto/vídeo), com você recortado por cima.
 */
async function trechoSoVoce(args: {
  avatar: string;
  saida: string;
  segundos: number;
  /** Começa aqui dentro do clone (o pedaço que ainda não foi usado). */
  inicio: number;
  cena?: string | null;
  layoutRecorte: boolean;
}): Promise<void> {
  const { avatar, saida, segundos, inicio, cena, layoutRecorte } = args;

  if (cena) {
    // Cena de fundo (imagem ou vídeo) com você por cima.
    const recorte = layoutRecorte
      ? `chromakey=${VERDE}:${SIMILARIDADE}:${SUAVIDADE},`
      : "";
    // ⚠️ Imagem parada quer `-loop 1`; `-stream_loop` é pra vídeo. Trocar os
    // dois dá um clipe de 1 frame (ou um erro seco) em vez de fundo.
    const parada = /\.(png|jpe?g|webp|gif|bmp)$/i.test(cena);
    await run(
      "ffmpeg",
      [
        "-y", "-v", "error",
        ...(parada
          ? ["-loop", "1", "-framerate", "30"]
          : ["-stream_loop", "-1"]),
        "-t", String(segundos), "-i", cena,
        "-ss", String(inicio), "-t", String(segundos), "-i", avatar,
        "-filter_complex",
        [
          `[0:v]scale=${L}:${A}:force_original_aspect_ratio=increase,crop=${L}:${A},setsar=1[bg]`,
          `[1:v]${SEGURA_FIM}${recorte}scale=${Math.round(L * 0.42)}:-1[me]`,
          `[bg][me]overlay=x=(W-w)/2:y=H-h-160:format=auto[v]`,
        ].join(";"),
        "-map", "[v]", "-an",
        "-t", String(segundos), "-r", "30",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
        saida,
      ],
      { timeout: 600_000, maxBuffer: 8 * 1024 * 1024 },
    );
    return;
  }

  // Sem cena: você em tela cheia. No layout de recorte o fundo é verde, então
  // ele vira um fundo escuro sólido em vez de aparecer verde na tela.
  const filtro = layoutRecorte
    ? `[1:v]${SEGURA_FIM}chromakey=${VERDE}:${SIMILARIDADE}:${SUAVIDADE},scale=${L}:-1[me];[0:v][me]overlay=(W-w)/2:(H-h)/2:format=auto[v]`
    : `[1:v]${SEGURA_FIM}scale=${L}:${A}:force_original_aspect_ratio=increase,crop=${L}:${A},setsar=1[v]`;

  await run(
    "ffmpeg",
    [
      "-y", "-v", "error",
      "-f", "lavfi", "-t", String(segundos), "-i", `color=c=0x101820:s=${L}x${A}:r=30`,
      "-ss", String(inicio), "-t", String(segundos), "-i", avatar,
      "-filter_complex", filtro,
      "-map", "[v]", "-an",
      "-t", String(segundos), "-r", "30",
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
      saida,
    ],
    { timeout: 600_000, maxBuffer: 8 * 1024 * 1024 },
  );
}

/**
 * Monta o vídeo final.
 *
 * @param viral  mp4 do viral (já baixado do TikTok)
 * @param avatar mp4 do clone — com fundo VERDE quando o layout for `recorte`
 * @param audio  a fala (TTS ou gravação); manda o tempo do vídeo final
 * @param cena   fundo do excedente/CTA, se a pessoa subiu algum
 */
export async function montarReact(args: {
  viral: string;
  avatar: string;
  audio: string;
  saida: string;
  layout: LayoutMontagem;
  segundos: number;
  viralSegundos: number;
  cena?: string | null;
  /** .ass já escrito no disco (mesmos presets do editor). Sem ele, sai limpo. */
  ass?: string | null;
  /** Pasta com os TTFs — o libass acha a fonte pelo nome da família. */
  fontsDir?: string | null;
}): Promise<void> {
  const { viral, avatar, audio, saida, layout, segundos, viralSegundos, cena, ass, fontsDir } = args;
  const dir = path.dirname(saida);
  const plano = planejar({ falaSegundos: segundos, viralSegundos });

  const parte1 = path.join(dir, "p1.mp4");
  await trechoComViral({
    viral,
    avatar,
    saida: parte1,
    layout,
    segundos: plano.segundosViral,
  });

  let videoMudo = parte1;
  if (plano.segundosExcedente > 0) {
    const parte2 = path.join(dir, "p2.mp4");
    await trechoSoVoce({
      avatar,
      saida: parte2,
      segundos: plano.segundosExcedente,
      inicio: plano.segundosViral,
      cena,
      layoutRecorte: layout === "recorte",
    });
    // concat pelo demuxer: os dois trechos saíram do mesmo encoder.
    const lista = path.join(dir, "partes.txt");
    await fs.writeFile(lista, `file '${parte1.replace(/\\/g, "/")}'\nfile '${parte2.replace(/\\/g, "/")}'\n`);
    videoMudo = path.join(dir, "juntos.mp4");
    await run(
      "ffmpeg",
      ["-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", lista, "-c", "copy", videoMudo],
      { timeout: 300_000 },
    );
  }

  // Áudio: a fala manda; o som do viral fica embaixo (20%) pra dar contexto
  // sem competir. O viral só toca no trecho em que ele aparece.
  // ⚠️ Nem todo viral TEM áudio (caso Johnny 17/08: vídeo da igreja veio
  // sem stream de som e o `[1:a]` derrubava o ffmpeg com "matches no
  // streams" — 2 gerações perdidas). Sem áudio no viral, entra só a fala.
  // A legenda entra AQUI, no mesmo passe: com `subtitles` o vídeo precisa ser
  // reencodado (não dá pra copiar o stream), então juntar as duas coisas
  // economiza um encode inteiro.
  const legenda = ass ? filtroLegenda(ass, fontsDir) : null;
  const viralTemSom = await temAudio(viral);
  await run(
    "ffmpeg",
    [
      "-y", "-v", "error",
      "-i", videoMudo,
      ...(viralTemSom ? ["-t", String(plano.segundosViral), "-i", viral] : []),
      "-i", audio,
      ...(viralTemSom
        ? [
            "-filter_complex",
            `[1:a]volume=0.2,apad=whole_dur=${segundos}[vlow];[2:a]volume=1.0[fala];[vlow][fala]amix=inputs=2:duration=first:dropout_transition=0[a]`,
            "-map", "0:v", "-map", "[a]",
          ]
        : ["-map", "0:v", "-map", "1:a"]),
      "-t", String(segundos),
      ...(legenda
        ? ["-vf", legenda, "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p"]
        : ["-c:v", "copy"]),
      "-c:a", "aac", "-b:a", "128k",
      "-movflags", "+faststart",
      saida,
    ],
    { timeout: 900_000, maxBuffer: 8 * 1024 * 1024 },
  );
}

/** O viral tem stream de áudio? (TikTok às vezes entrega vídeo mudo.) */
async function temAudio(arquivo: string): Promise<boolean> {
  try {
    const { stdout } = await run(
      "ffprobe",
      ["-v", "error", "-select_streams", "a", "-show_entries", "stream=index", "-of", "csv=p=0", arquivo],
      { timeout: 30_000 },
    );
    return stdout.trim().length > 0;
  } catch {
    return false;
  }
}

/**
 * Filtro `subtitles=` com os caminhos escapados.
 * ⚠️ O ffmpeg parseia o filtergraph ANTES do filtro: `:` e `\` no caminho
 * quebram o parse (pego na mão em 14/08). Como chamamos por execFile (sem
 * shell), o argumento chega literal — UMA barra por caractere especial. Com
 * duas, o libavfilter corta o valor e diz "No option name near ...".
 */
function filtroLegenda(ass: string, fontsDir?: string | null): string {
  const esc = (p: string) => p.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'");
  const partes = [`subtitles='${esc(ass)}'`];
  if (fontsDir) partes.push(`fontsdir='${esc(fontsDir)}'`);
  return partes.join(":");
}
