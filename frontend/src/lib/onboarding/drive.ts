/**
 * Download de arquivos do Google Drive pro onboarding via planilha.
 * Server-only.
 *
 * Os arquivos são tornados "qualquer um com o link – leitor" pelo Apps Script
 * da planilha ANTES do POST no webhook, então aqui basta o endpoint público de
 * download. Usamos drive.usercontent.google.com com confirm=t, que pula o
 * interstício de "arquivo grande demais pra verificação de vírus".
 *
 * ⚠️ Os módulos `node:*` entram por import ESTÁTICO. Com `await import(...)`
 * o bundle de produção devolve o namespace sem os named exports, e o
 * construtor importado assim explodia como "k is not a constructor" —
 * derrubando justamente o caso mais comum (aluno manda vídeo no lugar da
 * foto). Casos reais 14/08: linhas 346 e 398.
 */
import { open } from "node:fs/promises";
// A classificação do HTML e o motor de download em pedaços moram em módulos
// próprios (regra de 400 linhas por arquivo, _frank/01_REGRAS_DURAS.md #22).
// Reexportados aqui pra que `./drive.ts` continue sendo a porta de entrada
// única: nenhum chamador do repositório precisou mudar de import.
import { baixarEmPedacos, type DriveDeps } from "./drive-pedacos.ts";

export { classificarHtmlDoDrive, mensagemHtmlDoDrive, type TipoHtmlDrive } from "./drive-html.ts";
export { esquecerCotaExaurida, type DriveDeps } from "./drive-pedacos.ts";

export type DriveFile = {
  bytes: Buffer;
  contentType: string;
  filename: string | null;
};

// ── Arquivos que NÃO vieram do Drive (WeTransfer, Dropbox, OneDrive…) ──────
// lib/onboarding/links.ts já baixou pro disco. Registrar aqui faz os dois
// downloaders abaixo servirem do disco quando o "fileId" for um id local —
// e o importador (import.ts) não precisa saber de onde veio. O id local tem
// prefixo `lk_` + hash do link + nome, determinístico: a chave R2 continua
// idempotente e reprocessar não duplica.
const locais = new Map<string, { path: string; filename: string }>();

export function registrarArquivoLocal(id: string, path: string, filename: string): void {
  locais.set(id, { path, filename });
}

export function ehArquivoLocal(id: string): boolean {
  return locais.has(id);
}

/** MIME pelo nome — suficiente pra imagem/áudio/vídeo; o ffprobe decide o resto. */
function mimeDoNome(filename: string): string {
  const ext = filename.toLowerCase().split(".").pop() || "";
  const tabela: Record<string, string> = {
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", heic: "image/heic", gif: "image/gif",
    mp3: "audio/mpeg", wav: "audio/wav", m4a: "audio/mp4", aac: "audio/aac", ogg: "audio/ogg", flac: "audio/flac", opus: "audio/opus",
    mp4: "video/mp4", mov: "video/quicktime", mkv: "video/x-matroska", webm: "video/webm",
  };
  return tabela[ext] || "application/octet-stream";
}

export async function downloadDriveFile(
  fileId: string,
  maxBytes: number,
  deps: DriveDeps = {},
): Promise<DriveFile> {
  const local = locais.get(fileId);
  if (local) {
    const { readFile, stat } = await import("node:fs/promises");
    const size = (await stat(local.path)).size;
    if (size > maxBytes) throw new Error(`arquivo ${local.filename} de ${Math.round(size / 1e6)} MB passa do teto`);
    return { bytes: await readFile(local.path), contentType: mimeDoNome(local.filename), filename: local.filename };
  }

  // Em pedaços: cota retentada POR PEDAÇO, privado/desconhecido viram erro com
  // o dono certo (ver pedirFaixa). O acúmulo em RAM aqui é do contrato desta
  // função (ela devolve Buffer) e continua limitado por `maxBytes`; quem lida
  // com arquivo grande é o `downloadDriveFileToPath` abaixo.
  const partes: Buffer[] = [];
  const r = await baixarEmPedacos(fileId, maxBytes, deps, async (bloco) => {
    partes.push(bloco);
  });

  return { bytes: Buffer.concat(partes), contentType: r.contentType, filename: r.filename };
}


/**
 * Variante STREAMING: baixa direto pra um arquivo em disco (vídeos de
 * centenas de MB — caso A248: 878MB — sem Buffer gigante na RAM do app).
 */
export async function downloadDriveFileToPath(
  fileId: string,
  destPath: string,
  maxBytes: number,
  deps: DriveDeps = {},
): Promise<{ contentType: string; bytes: number }> {
  const local = locais.get(fileId);
  if (local) {
    const { copyFile, stat } = await import("node:fs/promises");
    const size = (await stat(local.path)).size;
    if (size > maxBytes) throw new Error(`arquivo ${local.filename} de ${Math.round(size / 1e6)} MB passa do teto`);
    await copyFile(local.path, destPath);
    return { contentType: mimeDoNome(local.filename), bytes: size };
  }

  // Em pedaços, direto pro disco: no pico só UM pedaço (PEDACO_BYTES) está em
  // RAM, nunca o arquivo — a proteção do A248 (878MB) continua valendo.
  const fh = await open(destPath, "w");
  try {
    const r = await baixarEmPedacos(fileId, maxBytes, deps, async (bloco) => {
      await fh.write(bloco);
    });
    return { contentType: r.contentType, bytes: r.bytes };
  } finally {
    await fh.close();
  }
}

/** Extensão a partir do filename OU do content-type (fallback). */
export function pickExtension(
  filename: string | null,
  contentType: string,
  fallback: string,
): string {
  const fromName = filename?.match(/\.([a-zA-Z0-9]{1,5})$/)?.[1]?.toLowerCase();
  if (fromName) return fromName;
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/mp4": "m4a",
    "audio/x-m4a": "m4a",
    "audio/flac": "flac",
    "audio/ogg": "ogg",
    "video/mp4": "mp4",
  };
  return map[contentType] ?? fallback;
}
