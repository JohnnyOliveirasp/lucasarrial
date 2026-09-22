/**
 * Conferência do arquivo que o navegador subiu direto pro R2.
 *
 * Existe porque o presigned PUT é cego: ele aceita o que mandarem, do tamanho
 * que mandarem. Quem diz a verdade é o objeto depois de gravado — por isso o
 * /enviar pergunta AQUI o tamanho real antes de publicar o vídeo no acervo.
 */
import { HeadObjectCommand } from "@aws-sdk/client-s3";
import { r2, R2_BUCKETS } from "@/lib/r2/client";

/** Tamanho em bytes, ou null se o objeto não existe (upload não concluiu). */
export async function tamanhoNoR2(key: string): Promise<number | null> {
  try {
    const r = await r2.send(
      new HeadObjectCommand({ Bucket: R2_BUCKETS.generations, Key: key }),
    );
    return typeof r.ContentLength === "number" ? r.ContentLength : null;
  } catch {
    return null;
  }
}
