/**
 * Suporte a fotos de iPhone (.heic/.heif) nos uploads de imagem — pedido
 * Johnny 01/08 (aluno teve que converter na mão pra PNG).
 *
 * A conversão roda NO NAVEGADOR (heic-to, wasm do libheif) e só carrega a lib
 * quando o arquivo é HEIC de verdade — quem manda PNG/JPG não baixa nada.
 * Server-side nada muda: o upload chega como JPEG normal.
 */

/** Extensão/MIME de HEIC/HEIF (iPhone manda MIME vazio às vezes — vale a extensão). */
export function isHeicFile(file: File): boolean {
  const type = (file.type || "").toLowerCase();
  if (type === "image/heic" || type === "image/heif") return true;
  return /\.heic$|\.heif$/i.test(file.name || "");
}

/** Lista pro atributo `accept` dos inputs de imagem (inclui HEIC). */
export const IMAGE_ACCEPT_WITH_HEIC =
  "image/png,image/jpeg,image/webp,image/heic,image/heif,.heic,.heif";

/**
 * Converte HEIC→JPEG no navegador; qualquer outro arquivo passa direto.
 * Falhou a conversão? Devolve o original — a validação normal do fluxo
 * dá a mensagem de erro de sempre (não pior que hoje).
 */
export async function ensureUploadableImage(file: File): Promise<File> {
  if (!isHeicFile(file)) return file;
  try {
    const { heicTo } = await import("heic-to");
    const blob = await heicTo({ blob: file, type: "image/jpeg", quality: 0.9 });
    const name = (file.name || "foto").replace(/\.(heic|heif)$/i, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg" });
  } catch {
    return file;
  }
}
