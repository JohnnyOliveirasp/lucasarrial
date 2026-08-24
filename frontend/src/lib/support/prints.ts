/**
 * Print de suporte guardado no R2 — caminho ÚNICO pro e-mail e pro WhatsApp.
 *
 * O e-mail já subia os prints do aluno e pendurava a chave no incidente (caso
 * Claudia, 14/08: sem isso o chamado nasce cego e alguém tem que abrir a caixa
 * do suporte na mão). O WhatsApp não subia nada — a Carol via a foto, respondia
 * e a imagem sumia junto com a conversa.
 *
 * Está num módulo próprio de propósito: duas cópias do mesmo `put` foi o erro
 * que se repetiu o dia todo (aviso do grupo, abertura de chamado).
 */
import { PutObjectCommand } from "@aws-sdk/client-s3";

import { r2, R2_BUCKETS } from "@/lib/r2/client";

/** Sobe um print e devolve a chave, ou null. Nunca lança: perder o print é
 *  ruim, derrubar o atendimento por causa dele é pior. */
export async function guardarPrintBytes(
  bytes: Uint8Array | Buffer,
  contentType: string,
  key: string,
): Promise<string | null> {
  try {
    await r2.send(
      new PutObjectCommand({
        Bucket: R2_BUCKETS.generations,
        Key: key,
        Body: bytes,
        ContentType: contentType,
      }),
    );
    return key;
  } catch (e) {
    console.error("[suporte/prints] falhou ao guardar:", e instanceof Error ? e.message : e);
    return null;
  }
}
