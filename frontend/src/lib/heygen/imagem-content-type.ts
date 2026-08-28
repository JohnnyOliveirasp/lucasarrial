/**
 * Que content-type mandar pro `/v1/asset` do HeyGen — decidido pelos BYTES.
 * Server-only.
 *
 * 28/08: o aluno recebia, cru, a recusa do HeyGen:
 *   "Content type not match image/jpeg != image/webp"
 * A causa era um fallback binário copiado em 4 lugares, que rotulava como
 * `image/jpeg` QUALQUER coisa que não fosse PNG:
 *
 *   const ct = res.headers.get("content-type")?.includes("png")
 *     ? "image/png" : "image/jpeg";
 *
 * O caminho real da queixa é o look importado da PRÓPRIA conta HeyGen: o CDN
 * deles serve WebP, nós carimbávamos "image/jpeg" em cima de bytes webp, e o
 * HeyGen — que confere — recusava. O aluno pagava por um erro nosso de rótulo.
 *
 * É o mesmo veneno do .jfif (Kie recusando por extensão), do HEIC servido como
 * octet-stream e do OneDrive devolvendo HTML como .mp3: **o rótulo mente, quem
 * decide é o conteúdo**. Por isso aqui não se lê header nem extensão — só os
 * magic bytes, pelo `sniffImagem` que já existe e já é testado.
 *
 * Sem dependência nova (sharp/jimp/file-type estão fora de propósito): magic
 * byte se lê com Uint8Array puro.
 */
// Extensão explícita: é o que deixa `node --test` (type stripping do Node
// ≥ 22.18) rodar o teste sem build — o tsconfig tem allowImportingTsExtensions.
import { sniffImagem, descreverArquivo } from "../onboarding/imagem-tipo.ts";

/** Os únicos content-types que mandamos pro `/v1/asset`. */
export type ContentTypeHeygen = "image/jpeg" | "image/png" | "image/webp";

const ACEITOS = new Set<string>(["image/jpeg", "image/png", "image/webp"]);

/**
 * O content-type VERDADEIRO da imagem, ou `null` se for um formato que não
 * mandamos pro HeyGen (GIF, BMP, TIFF, HEIC… ou nem imagem).
 *
 * Nunca "chuta" jpeg pra tentar a sorte: chutar é exatamente o que produziu a
 * recusa que este arquivo existe pra matar.
 */
export function contentTypeImagemHeygen(bytes: Uint8Array): ContentTypeHeygen | null {
  const tipo = sniffImagem(cabeca(bytes));
  if (!tipo || !ACEITOS.has(tipo.mime)) return null;
  return tipo.mime as ContentTypeHeygen;
}

/**
 * A mensagem que o ALUNO lê quando a foto não serve. Diz o que ele mandou de
 * verdade — "Você enviou um PDF" ajuda; "Content type not match" não.
 */
export function erroImagemNaoSuportada(bytes: Uint8Array): string {
  const head = cabeca(bytes);
  const tipo = sniffImagem(head);
  // É imagem, só não é uma das três que o HeyGen aceita (GIF/BMP/TIFF/HEIC).
  if (tipo) {
    const nome = tipo.heic ? "HEIC" : tipo.ext.toUpperCase();
    return (
      `Essa foto está em ${nome}, formato que o HeyGen não aceita. ` +
      `Envie em JPG, PNG ou WebP.`
    );
  }
  const oQueMandou = descreverArquivo(head);
  return oQueMandou
    ? `Você enviou ${oQueMandou}. Precisamos de uma FOTO em JPG, PNG ou WebP.`
    : `Formato de imagem não suportado. Envie a foto em JPG, PNG ou WebP.`;
}

/**
 * Só o começo do arquivo: `sniffImagem`/`descreverArquivo` leem no máximo os
 * 12 primeiros bytes. Copiar 16 evita duplicar uma foto de 8MB na memória a
 * cada upload (`Buffer.from(uint8array)` COPIA o array inteiro).
 */
function cabeca(bytes: Uint8Array): Buffer {
  return Buffer.from(bytes.subarray(0, 16));
}
