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
 * o bundle de produção devolve o namespace sem os named exports, e
 * `new Transform(...)` explodia como "k is not a constructor" — derrubando
 * justamente o caso mais comum (aluno manda vídeo no lugar da foto).
 * Casos reais 14/08: linhas 346 e 398.
 */
import { createWriteStream } from "node:fs";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

export type DriveFile = {
  bytes: Buffer;
  contentType: string;
  filename: string | null;
};

/** Extrai o filename do Content-Disposition (filename* UTF-8 ou filename=""). */
function parseFilename(disposition: string | null): string | null {
  if (!disposition) return null;
  const star = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (star) {
    try {
      return decodeURIComponent(star[1]).trim();
    } catch {
      /* cai pro filename simples */
    }
  }
  const plain = disposition.match(/filename="?([^";]+)"?/i);
  return plain ? plain[1].trim() : null;
}

/**
 * Baixa um arquivo do Drive pelo fileId. Lança Error com mensagem legível
 * (vai pro writeback de "Erro" na planilha) se o arquivo não for público,
 * não existir ou passar do teto de tamanho.
 */
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
): Promise<DriveFile> {
  const local = locais.get(fileId);
  if (local) {
    const { readFile, stat } = await import("node:fs/promises");
    const size = (await stat(local.path)).size;
    if (size > maxBytes) throw new Error(`arquivo ${local.filename} de ${Math.round(size / 1e6)} MB passa do teto`);
    return { bytes: await readFile(local.path), contentType: mimeDoNome(local.filename), filename: local.filename };
  }
  const url =
    `https://drive.usercontent.google.com/download?id=${encodeURIComponent(fileId)}` +
    `&export=download&confirm=t`;

  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) {
    throw new Error(`Drive respondeu ${res.status} pro arquivo ${fileId}`);
  }

  const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
  // HTML = página de login/erro do Drive (arquivo privado ou id inválido).
  if (contentType.startsWith("text/html")) {
    throw new Error(
      `Arquivo ${fileId} não está público no Drive (veio página HTML, não o arquivo)`,
    );
  }

  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > maxBytes) {
    throw new Error(
      `Arquivo ${fileId} tem ${Math.round(declared / 1e6)}MB (teto ${Math.round(maxBytes / 1e6)}MB)`,
    );
  }

  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length === 0) throw new Error(`Arquivo ${fileId} veio vazio do Drive`);
  if (bytes.length > maxBytes) {
    throw new Error(
      `Arquivo ${fileId} tem ${Math.round(bytes.length / 1e6)}MB (teto ${Math.round(maxBytes / 1e6)}MB)`,
    );
  }

  return {
    bytes,
    contentType: contentType.split(";")[0] || "application/octet-stream",
    filename: parseFilename(res.headers.get("content-disposition")),
  };
}


/**
 * Variante STREAMING: baixa direto pra um arquivo em disco (vídeos de
 * centenas de MB — caso A248: 878MB — sem Buffer gigante na RAM do app).
 */
export async function downloadDriveFileToPath(
  fileId: string,
  destPath: string,
  maxBytes: number,
): Promise<{ contentType: string; bytes: number }> {
  const local = locais.get(fileId);
  if (local) {
    const { copyFile, stat } = await import("node:fs/promises");
    const size = (await stat(local.path)).size;
    if (size > maxBytes) throw new Error(`arquivo ${local.filename} de ${Math.round(size / 1e6)} MB passa do teto`);
    await copyFile(local.path, destPath);
    return { contentType: mimeDoNome(local.filename), bytes: size };
  }
  const url =
    `https://drive.usercontent.google.com/download?id=${encodeURIComponent(fileId)}` +
    `&export=download&confirm=t`;
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok || !res.body) {
    throw new Error(`Drive respondeu ${res.status} pro arquivo ${fileId}`);
  }
  const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
  if (contentType.startsWith("text/html")) {
    throw new Error(
      `Arquivo ${fileId} não está público no Drive (veio página HTML, não o arquivo)`,
    );
  }
  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > maxBytes) {
    throw new Error(
      `Arquivo ${fileId} tem ${Math.round(declared / 1e6)}MB (teto ${Math.round(maxBytes / 1e6)}MB)`,
    );
  }
  let total = 0;
  const contador = new Transform({
    transform(chunk: Buffer, _enc, cb) {
      total += chunk.length;
      if (total > maxBytes) {
        cb(new Error(`Arquivo ${fileId} passou de ${Math.round(maxBytes / 1e6)}MB no download`));
        return;
      }
      cb(null, chunk);
    },
  });
  await pipeline(Readable.fromWeb(res.body as never), contador, createWriteStream(destPath));
  if (total === 0) throw new Error(`Arquivo ${fileId} veio vazio do Drive`);
  return { contentType: contentType.split(";")[0] || "application/octet-stream", bytes: total };
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
