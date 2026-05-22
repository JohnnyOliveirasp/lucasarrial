/**
 * Helpers de remoção no R2. Server-only.
 * Usados pelo delete de voz/LoRA pra limpar os buckets.
 */
import { DeleteObjectsCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { r2 } from "./client";

/** Deleta TODOS os objetos sob um prefixo (paginado, em lotes de 1000). */
export async function deleteByPrefix(bucket: string, prefix: string): Promise<number> {
  if (!prefix) throw new Error("deleteByPrefix: prefix vazio (proteção contra apagar o bucket todo)");
  let deleted = 0;
  let token: string | undefined;
  do {
    const list = await r2.send(
      new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token }),
    );
    const objects = (list.Contents ?? [])
      .map((o) => o.Key)
      .filter((k): k is string => typeof k === "string" && k.length > 0)
      .map((Key) => ({ Key }));
    if (objects.length > 0) {
      await r2.send(
        new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: objects, Quiet: true } }),
      );
      deleted += objects.length;
    }
    token = list.IsTruncated ? list.NextContinuationToken : undefined;
  } while (token);
  return deleted;
}

/** Deleta uma lista de chaves específicas (lotes de 1000). Ignora vazias. */
export async function deleteKeys(bucket: string, keys: Array<string | null | undefined>): Promise<number> {
  const valid = keys.filter((k): k is string => typeof k === "string" && k.length > 0);
  let deleted = 0;
  for (let i = 0; i < valid.length; i += 1000) {
    const batch = valid.slice(i, i + 1000).map((Key) => ({ Key }));
    await r2.send(
      new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: batch, Quiet: true } }),
    );
    deleted += batch.length;
  }
  return deleted;
}
