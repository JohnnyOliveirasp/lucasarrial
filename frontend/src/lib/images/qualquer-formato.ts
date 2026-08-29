/**
 * "Ele pode subir qualquer formato de foto" (Johnny, SGP 29/08).
 *
 * HEIC/HEIF do iPhone já viravam JPEG no navegador (`ensureUploadableImage`).
 * O que sobrava (GIF, BMP, TIFF, AVIF, SVG, JPEG com extensão estranha…) era
 * recusado pelo presigned, que só aceita JPG/PNG/WEBP. Aqui o navegador
 * decodifica o que ele souber abrir e re-salva como JPEG — sem lib nova.
 * O que nem o navegador abre volta como está e a API explica o motivo.
 */
import { ensureUploadableImage } from "./heic";

const ACEITOS = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function paraFormatoAceito(original: File): Promise<File> {
  const file = await ensureUploadableImage(original);
  if (ACEITOS.has((file.type || "").toLowerCase())) return file;
  if (typeof createImageBitmap !== "function") return file;
  try {
    const bmp = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    canvas.getContext("2d")?.drawImage(bmp, 0, 0);
    bmp.close();
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", 0.92));
    if (!blob) return file;
    const nome = (file.name || "foto").replace(/\.[a-z0-9]+$/i, "") + ".jpg";
    return new File([blob], nome, { type: "image/jpeg" });
  } catch {
    return file;
  }
}
