/**
 * Que arquivo é este, DE VERDADE — pelos primeiros bytes, não pelo rótulo.
 * Server-only.
 *
 * 22/08: 15 linhas da planilha morreram em "nenhuma foto aproveitável" tendo
 * fotos perfeitas na pasta. O aluno mandou .HEIC (padrão do iPhone), o Drive
 * serve HEIC como `application/octet-stream`, e o import olhava só o
 * content-type: não começa com "image/" → "não é imagem" → o arquivo ia pro
 * caminho de vídeo, onde o ffprobe estourava com `moov atom not found`.
 * Cinco fotos boas viravam zero.
 *
 * É o mesmo veneno do .jfif (Kie recusando por EXTENSÃO) e do .mp4 que o Drive
 * entrega como octet-stream: o rótulo mente, quem decide é o conteúdo.
 *
 * HEIC ainda precisa virar JPEG — nada no resto do sistema (R2, Kie, avatares)
 * abre HEIC. A conversão sai do PRÓPRIO Drive: /thumbnail?sz=w4000 devolve a
 * foto em JPEG na resolução original (medido: 3024x4032, 910KB). Sem lib nova,
 * sem wasm no servidor — o `heic-to` do package.json só roda no navegador.
 */

/** Assinaturas de imagem que o sistema aceita. `heic` = precisa converter. */
export type TipoImagem = { mime: string; ext: string; heic: boolean };

const MARCAS_HEIF = new Set([
  "heic", "heix", "heim", "heis", "hevc", "hevx", "hevm", "hevs",
  "mif1", "msf1", "avif", "avis",
]);

/**
 * Identifica a imagem pelos magic bytes. Devolve null quando NÃO é imagem —
 * aí quem chama decide o que fazer (no import, tentar extrair frames de vídeo).
 */
export function sniffImagem(bytes: Buffer): TipoImagem | null {
  if (bytes.length < 12) return null;

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mime: "image/jpeg", ext: "jpg", heic: false };
  }
  // PNG: 89 "PNG" CR LF 1A LF
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { mime: "image/png", ext: "png", heic: false };
  }
  // GIF87a / GIF89a
  if (bytes.subarray(0, 4).toString("latin1") === "GIF8") {
    return { mime: "image/gif", ext: "gif", heic: false };
  }
  // WEBP: "RIFF" .... "WEBP"
  if (
    bytes.subarray(0, 4).toString("latin1") === "RIFF" &&
    bytes.subarray(8, 12).toString("latin1") === "WEBP"
  ) {
    return { mime: "image/webp", ext: "webp", heic: false };
  }
  // BMP
  if (bytes[0] === 0x42 && bytes[1] === 0x4d) {
    return { mime: "image/bmp", ext: "bmp", heic: false };
  }
  // TIFF (little/big endian)
  const tiff = bytes.subarray(0, 4);
  if (
    tiff.equals(Buffer.from([0x49, 0x49, 0x2a, 0x00])) ||
    tiff.equals(Buffer.from([0x4d, 0x4d, 0x00, 0x2a]))
  ) {
    return { mime: "image/tiff", ext: "tiff", heic: false };
  }
  // HEIC/HEIF/AVIF: caixa "ftyp" no offset 4 + marca conhecida no offset 8.
  if (bytes.subarray(4, 8).toString("latin1") === "ftyp") {
    const marca = bytes.subarray(8, 12).toString("latin1").toLowerCase();
    if (MARCAS_HEIF.has(marca)) {
      return { mime: "image/heic", ext: "heic", heic: true };
    }
  }
  return null;
}

/**
 * O que o aluno mandou, em PORTUGUÊS — pra mensagem de erro dizer a verdade.
 *
 * 22/08: a linha 24 recebeu "nenhuma foto aproveitável (não é imagem
 * (application/octet-stream); frames: vídeo sem duração legível)". O aluno
 * tinha mandado um **PDF**. A mensagem falava de octet-stream e de vídeo — nada
 * que ajudasse alguém a consertar.
 *
 * O veredito continua o mesmo (PDF não vira foto de referência: seria a página
 * de um documento, não o rosto). Muda só o que a pessoa lê.
 */
export function descreverArquivo(bytes: Buffer): string | null {
  if (bytes.length < 8) return null;
  const inicio = bytes.subarray(0, 8).toString("latin1");

  if (inicio.startsWith("%PDF")) return "um PDF";
  if (inicio.startsWith("PK\x03\x04")) return "um arquivo compactado (zip/docx/xlsx)";
  if (inicio.startsWith("Rar!")) return "um arquivo .rar";
  if (bytes.subarray(0, 4).toString("latin1") === "\x7fELF") return "um programa";
  if (inicio.startsWith("\xd0\xcf\x11\xe0")) return "um documento do Office antigo";
  if (inicio.startsWith("ID3") || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)) {
    return "um áudio MP3";
  }
  if (inicio.startsWith("OggS")) return "um áudio OGG";
  if (inicio.startsWith("fLaC")) return "um áudio FLAC";
  if (bytes.subarray(0, 4).toString("latin1") === "RIFF") return "um arquivo WAV/AVI";
  // ⚠️ HEIC também tem "ftyp" — sem conferir a marca, foto de iPhone seria
  // descrita como "um vídeo". No fluxo isso não chega aqui (sniffImagem pega
  // o HEIC antes), mas a função tem que dizer a verdade sozinha.
  if (bytes.subarray(4, 8).toString("latin1") === "ftyp") {
    const marca = bytes.subarray(8, 12).toString("latin1").toLowerCase();
    return MARCAS_HEIF.has(marca) ? "uma foto HEIC" : "um vídeo";
  }
  if (/^\s*<(!doctype|html)/i.test(bytes.subarray(0, 64).toString("latin1"))) {
    return "uma página da internet, não um arquivo";
  }
  return null;
}

/** O que pedir ao aluno quando o que ele mandou não serve como foto. */
export function comoMandarFoto(oQueMandou: string | null): string {
  return oQueMandou
    ? `Você enviou ${oQueMandou}. Precisamos de uma FOTO sua — JPG, PNG, ou a ` +
      `foto direto do celular (HEIC também serve).`
    : `O arquivo enviado não é uma foto. Precisamos de uma FOTO sua — JPG, PNG, ` +
      `ou a foto direto do celular (HEIC também serve).`;
}

/**
 * HEIC → JPEG usando a conversão do próprio Drive (`/thumbnail?sz=w4000`),
 * que devolve a foto na resolução original. `sz` é um TETO, não um alvo: uma
 * foto menor volta no tamanho dela, sem esticar.
 *
 * Lança se a resposta não for um JPEG de verdade — de novo, conferindo os
 * bytes, porque um erro do Drive também chega com HTTP 200.
 */
export async function heicParaJpegViaDrive(
  fileId: string,
  maxBytes: number,
): Promise<Buffer> {
  const url =
    `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w4000`;
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) {
    throw new Error(`Drive respondeu ${res.status} ao converter o HEIC ${fileId}`);
  }
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length === 0) {
    throw new Error(`conversão do HEIC ${fileId} voltou vazia`);
  }
  if (bytes.length > maxBytes) {
    throw new Error(
      `HEIC ${fileId} convertido tem ${Math.round(bytes.length / 1e6)}MB ` +
        `(teto ${Math.round(maxBytes / 1e6)}MB)`,
    );
  }
  const tipo = sniffImagem(bytes);
  if (!tipo || tipo.heic) {
    throw new Error(
      `conversão do HEIC ${fileId} não devolveu JPEG (veio ${tipo?.mime ?? "conteúdo irreconhecível"})`,
    );
  }
  return bytes;
}

/**
 * HEIC → JPEG SEM o Drive, pro arquivo que veio de WeTransfer/Dropbox/OneDrive.
 *
 * 22/08: o fix do HEIC mandava TODO HEIC pro /thumbnail do Drive — inclusive os
 * que nunca estiveram lá. Um arquivo de link (id com prefixo `lk_`) devolvia
 * "Drive respondeu 400 ao converter o HEIC" e a linha caía (caso real: 97).
 *
 * Aqui o ffmpeg decodifica localmente. Vale saber: HEIC do iPhone costuma vir
 * em GRADE de tiles 512×512 e o ffmpeg não remonta a grade — a imagem sai no
 * tamanho de um tile. É pior que a conversão do Drive, e por isso só entra
 * quando o Drive não é uma opção; ainda assim é uma foto de verdade, e a régua
 * do Johnny é "basta PELO MENOS 1 imagem".
 */
export async function heicParaJpegLocal(bytes: Buffer): Promise<Buffer> {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const { mkdtemp, writeFile, readFile, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const exec = promisify(execFile);

  const dir = await mkdtemp(join(tmpdir(), "heic-"));
  try {
    const entrada = join(dir, "in.heic");
    const saida = join(dir, "out.jpg");
    await writeFile(entrada, bytes);
    await exec("ffmpeg", ["-v", "error", "-i", entrada, "-frames:v", "1", "-y", saida], {
      timeout: 60_000,
    });
    const jpg = await readFile(saida);
    const tipo = sniffImagem(jpg);
    if (!tipo || tipo.heic) throw new Error("ffmpeg não devolveu JPEG");
    return jpg;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/** Troca a extensão do nome do arquivo (IMG_1616.HEIC → IMG_1616.jpg). */
export function trocarExtensao(nome: string | null, ext: string): string | null {
  if (!nome) return null;
  return nome.replace(/\.[a-zA-Z0-9]{1,5}$/, "") + "." + ext;
}
