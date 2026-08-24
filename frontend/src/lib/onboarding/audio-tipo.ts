/**
 * Que arquivo é este, DE VERDADE — a versão pra ÁUDIO do `imagem-tipo.ts`.
 * Server-only.
 *
 * Por que existe (22/08, medido no R2): o link do ONEDRIVE do aluno devolvia a
 * PÁGINA DE LOGIN da Microsoft (HTML de ~300KB) e o import gravava esse HTML
 * no R2 **como .mp3** — a extensão vinha do fallback "mp3" do `pickExtension`,
 * porque a página não tem nome nem content-type de áudio. O worker tentava
 * treinar com HTML, não achava fala, e o aluno lia "grave num ambiente
 * silencioso, falando continuamente": culpado por um download NOSSO que
 * falhou. Casos reais: marlonwsmuniz (voz 0e2f5726) e lazevedo (voz 3d3c4da8).
 *
 * É o mesmo veneno que o `sniffImagem` já mata nas fotos: o rótulo mente,
 * quem decide é o conteúdo. Um HTML de 300KB nunca deveria chegar ao worker.
 */
// Com a extensão explícita: é o que deixa `node --test` (type stripping do
// Node ≥ 22.18) rodar o audio-tipo.test.ts sem build — o tsconfig já tem
// allowImportingTsExtensions.
import { MARCAS_HEIF } from "./imagem-tipo.ts";

export type TipoAudio = { mime: string; ext: string };

/**
 * Marcas de `ftyp` da família MP4 que carregam ÁUDIO (m4a puro ou vídeo de
 * onde o ffmpeg extrai a faixa, igual ao .mp4 que a régua já aceita).
 * HEIC/AVIF também têm `ftyp` — são FOTO, ficam de fora via MARCAS_HEIF.
 */
function tipoDoFtyp(marca: string): TipoAudio | null {
  if (MARCAS_HEIF.has(marca)) return null; // foto de iPhone, não áudio
  if (marca.startsWith("m4a") || marca.startsWith("m4b")) {
    return { mime: "audio/mp4", ext: "m4a" };
  }
  // isom/iso2/mp41/mp42/qt/3gp… — contêiner de vídeo/áudio; o worker extrai.
  return { mime: "video/mp4", ext: "mp4" };
}

/**
 * Identifica o áudio pelos magic bytes. Devolve null quando NÃO é um formato
 * que o treino saiba abrir — aí quem chama decide (ignorar, ou confirmar com
 * `probeAudioDuracaoLocal` se o rótulo insistir que é áudio).
 *
 * Cobre as EXTENSOES_AUDIO da régua: mp3 (ID3/sync, que também casa AAC
 * ADTS), wav (RIFF+WAVE), ogg/opus (OggS), flac (fLaC), m4a/aac/mp4/mov
 * (ftyp), webm/mkv (EBML), wma (ASF) e amr (#!AMR).
 */
export function sniffAudio(bytes: Buffer): TipoAudio | null {
  if (bytes.length < 12) return null;

  // ID3v2 (a cara do mp3 de gravador/WhatsApp)
  if (bytes.subarray(0, 3).toString("latin1") === "ID3") {
    return { mime: "audio/mpeg", ext: "mp3" };
  }
  // Frame sync MPEG (11 bits em 1) — também casa AAC ADTS (0xFFF).
  if (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) {
    return { mime: "audio/mpeg", ext: "mp3" };
  }
  // WAV: "RIFF" .... "WAVE" (RIFF+"AVI " é vídeo AVI, que a régua NÃO aceita)
  if (bytes.subarray(0, 4).toString("latin1") === "RIFF") {
    return bytes.subarray(8, 12).toString("latin1") === "WAVE"
      ? { mime: "audio/wav", ext: "wav" }
      : null;
  }
  // OGG (Vorbis/Opus)
  if (bytes.subarray(0, 4).toString("latin1") === "OggS") {
    return { mime: "audio/ogg", ext: "ogg" };
  }
  // FLAC
  if (bytes.subarray(0, 4).toString("latin1") === "fLaC") {
    return { mime: "audio/flac", ext: "flac" };
  }
  // Família MP4/QuickTime: caixa "ftyp" no offset 4.
  if (bytes.subarray(4, 8).toString("latin1") === "ftyp") {
    const marca = bytes.subarray(8, 12).toString("latin1").toLowerCase().trim();
    return tipoDoFtyp(marca);
  }
  // WebM/MKV: cabeçalho EBML
  if (bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) {
    return { mime: "video/webm", ext: "webm" };
  }
  // WMA/WMV: GUID do ASF
  if (
    bytes
      .subarray(0, 8)
      .equals(Buffer.from([0x30, 0x26, 0xb2, 0x75, 0x8e, 0x66, 0xcf, 0x11]))
  ) {
    return { mime: "audio/x-ms-wma", ext: "wma" };
  }
  // AMR (gravação de voz de celular antigo)
  if (bytes.subarray(0, 5).toString("latin1") === "#!AMR") {
    return { mime: "audio/amr", ext: "amr" };
  }
  return null;
}

/**
 * O arquivo é uma PÁGINA DA INTERNET (login, erro, interstício)?
 *
 * É o sintoma clássico de download quebrado: o servidor respondeu 200 com a
 * página de login no lugar do arquivo (OneDrive fez exatamente isso). Aceita
 * BOM/espaço na frente e não exige `<!DOCTYPE` — basta o começo ser markup e
 * ter cara de HTML nos primeiros bytes.
 */
export function ehPaginaWeb(bytes: Buffer): boolean {
  if (bytes.length === 0) return false;
  let inicio = 0;
  // BOM UTF-8
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    inicio = 3;
  }
  const cabeca = bytes.subarray(inicio, inicio + 1024).toString("latin1");
  const semEspaco = cabeca.replace(/^[\s\r\n]+/, "");
  if (!semEspaco.startsWith("<")) return false;
  return /<(!doctype\b|html\b|head\b|meta\b|title\b|script\b|body\b)/i.test(semEspaco);
}

/**
 * É um ZIP com arquivos dentro (pacote de mídia), e não um DOCUMENTO?
 *
 * Por que existe (22/08, medido no R2): o `abrirLink` decidia extrair pela
 * EXTENSÃO (`extname === ".zip"`) — o mesmo veneno do rótulo que este arquivo
 * inteiro existe pra matar. O link do fb_teixeira baixou com nome de token
 * (`ABCKC6LhbBddtGtwAVgWaNY`, sem extensão), então o unzip NUNCA rodou: os
 * 18MB de ZIP subiram pro R2 como `.mp3`, o worker não achou fala e o aluno
 * leu "grave num ambiente silencioso". O áudio dele estava DENTRO do zip
 * (`Audio IA.ogg`) — ele mandou certo, nós é que não abrimos o pacote.
 *
 * docx/xlsx/pptx/odt também são ZIP por dentro, mas são DOCUMENTO: extrair
 * daria uma pasta de XML e a mensagem "o zip veio vazio", que culpa o aluno
 * por outra coisa. O primeiro item do pacote denuncia qual é qual.
 */
export function ehZipDeArquivos(bytes: Buffer): boolean {
  // PK\x03\x04 = entrada normal; \x05\x06 = zip vazio; \x07\x08 = multi-volume.
  if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) return false;
  const terceiro = bytes[2];
  const quarto = bytes[3];
  const assinaturaZip =
    (terceiro === 0x03 && quarto === 0x04) ||
    (terceiro === 0x05 && quarto === 0x06) ||
    (terceiro === 0x07 && quarto === 0x08);
  if (!assinaturaZip) return false;
  // OOXML abre com "[Content_Types].xml"; ODF abre com "mimetype" +
  // "application/vnd.oasis...". Os dois aparecem nos primeiros bytes.
  const cabeca = bytes.subarray(0, 2048).toString("latin1");
  if (/\[Content_Types\]\.xml/.test(cabeca)) return false;
  if (/mimetypeapplication\/vnd\.(oasis|openxmlformats)/.test(cabeca)) return false;
  return true;
}

/**
 * Confirmação local com ffprobe: o conteúdo tem FAIXA DE ÁUDIO com duração
 * > 0? Devolve a duração em segundos, ou null se não for áudio legível.
 *
 * Só entra quando o `sniffAudio` não reconheceu a assinatura mas o rótulo
 * (extensão/content-type) insiste que é áudio — ex.: mp3 com lixo na frente.
 * Roda sobre ARQUIVO LOCAL de propósito: o ffprobe estático já segfaultou
 * lendo URL https direto (exit 139, saída vazia — lição de 22/08).
 */
export async function probeAudioDuracaoLocal(bytes: Buffer): Promise<number | null> {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const { mkdtemp, writeFile, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const exec = promisify(execFile);

  const dir = await mkdtemp(join(tmpdir(), "audio-tipo-"));
  try {
    const arquivo = join(dir, "probe.bin");
    await writeFile(arquivo, bytes);
    const { stdout } = await exec(
      "ffprobe",
      [
        "-v", "error",
        "-select_streams", "a:0",
        "-show_entries", "stream=codec_type",
        "-show_entries", "format=duration",
        "-of", "json",
        arquivo,
      ],
      { timeout: 30_000 },
    );
    const j = JSON.parse(stdout) as {
      streams?: Array<{ codec_type?: string }>;
      format?: { duration?: string };
    };
    const temFaixa = (j.streams ?? []).some((s) => s.codec_type === "audio");
    const duracao = Number(j.format?.duration ?? 0);
    return temFaixa && duracao > 0 ? duracao : null;
  } catch {
    return null;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * A mensagem-verdade do download quebrado, num lugar só (import de áudio,
 * import de imagem e links.ts usam a MESMA frase — é ela que o
 * `dependeDoAluno` e a orientação do route.ts reconhecem).
 */
export function motivoDownloadVeioPagina(oQueEsperava: "áudio" | "foto"): string {
  return (
    `não conseguimos baixar seu arquivo a partir desse link — ` +
    `veio uma página da internet (provavelmente pedindo login) no lugar ` +
    `do ${oQueEsperava === "áudio" ? "áudio" : "arquivo de foto"}`
  );
}
