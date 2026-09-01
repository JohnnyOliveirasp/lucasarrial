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

/**
 * Os únicos content-types que o `/v1/asset` do HeyGen aceita.
 *
 * 01/09 — a correção de 28/08 (f3c0e90) parou de MENTIR o rótulo, mas passou a
 * mandar `image/webp` VERDADEIRO pro `/v1/asset`, e a doc oficial do endpoint
 * (developers.heygen.com/reference/upload-asset) lista, textualmente:
 *   "Supported types: png, jpeg, mp4, webm, mp3, wav, pdf, srt."
 * WebP não está lá. Ou seja: o rótulo passou a ser honesto, e a recusa passou a
 * ser legítima — o aluno que importa o look da PRÓPRIA conta HeyGen (cujo CDN
 * serve WebP) seguia bloqueado. Aceitar webp aqui era prometer um upload que o
 * HeyGen não faz.
 *
 * ⚠️ Não confundir com o R2/nosso app: webp é imagem boa e continua válida em
 * todo o resto do produto. A restrição é do DESTINO (o asset do HeyGen).
 */
export type ContentTypeHeygen = "image/jpeg" | "image/png";

const ACEITOS = new Set<string>(["image/jpeg", "image/png"]);

/**
 * O content-type VERDADEIRO da imagem, ou `null` se for um formato que o
 * `/v1/asset` não aceita (WebP, GIF, BMP, TIFF, HEIC… ou nem imagem).
 *
 * Nunca "chuta" jpeg pra tentar a sorte: chutar é exatamente o que produziu a
 * recusa que este arquivo existe pra matar.
 */
export function contentTypeImagemHeygen(bytes: Uint8Array): ContentTypeHeygen | null {
  const tipo = sniffImagem(cabeca(bytes));
  if (!tipo || !ACEITOS.has(tipo.mime)) return null;
  return tipo.mime as ContentTypeHeygen;
}

/** De onde veio a foto — muda o QUE O ALUNO PODE FAZER a respeito. */
export type OrigemImagemHeygen = "upload" | "plataforma" | "look_heygen";

/**
 * A mensagem que o ALUNO lê quando a foto não serve. Diz o que ele mandou de
 * verdade — "Você enviou um PDF" ajuda; "Content type not match" não.
 *
 * A `origem` existe porque a saída depende de onde a foto nasceu: quem fez
 * upload troca o arquivo, mas quem escolheu um look da conta HeyGen **não tem
 * arquivo pra trocar** — mandar "envie em JPG ou PNG" ali é um beco sem saída.
 */
export function erroImagemNaoSuportada(
  bytes: Uint8Array,
  origem: OrigemImagemHeygen = "upload",
): string {
  const head = cabeca(bytes);
  const tipo = sniffImagem(head);

  if (tipo) {
    const nome = tipo.heic ? "HEIC" : tipo.ext.toUpperCase();
    // O look vem do CDN do HeyGen: o aluno não escolheu o formato e não tem
    // como reexportar. A saída real é o caminho de upload (que ele já
    // descobriu sozinho no relato do #171: "subir PNG a mão funciona").
    if (origem === "look_heygen") {
      return (
        `A foto desse avatar vem do HeyGen em ${nome}, e a API de upload do ` +
        `HeyGen só aceita JPG e PNG — por isso ela não pode ser reenviada ` +
        `automaticamente. Use "Enviar foto" e mande a mesma imagem em JPG ou PNG.`
      );
    }
    if (origem === "plataforma") {
      return (
        `Essa imagem da plataforma está em ${nome}, formato que o HeyGen não ` +
        `aceita. Gere ou escolha uma imagem em JPG ou PNG.`
      );
    }
    return `Essa foto está em ${nome}, formato que o HeyGen não aceita. Envie em JPG ou PNG.`;
  }

  const oQueMandou = descreverArquivo(head);
  return oQueMandou
    ? `Você enviou ${oQueMandou}. Precisamos de uma FOTO em JPG ou PNG.`
    : `Formato de imagem não suportado. Envie a foto em JPG ou PNG.`;
}

/**
 * Só o começo do arquivo: `sniffImagem`/`descreverArquivo` leem no máximo os
 * 12 primeiros bytes. Copiar 16 evita duplicar uma foto de 8MB na memória a
 * cada upload (`Buffer.from(uint8array)` COPIA o array inteiro).
 */
function cabeca(bytes: Uint8Array): Buffer {
  return Buffer.from(bytes.subarray(0, 16));
}
