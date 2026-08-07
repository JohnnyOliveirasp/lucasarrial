/**
 * Existência de objeto no R2 via HEAD (barato, sem baixar).
 *
 * Caso 06/08 (diagnóstico do Vigia): excluir uma geração antiga do histórico
 * apaga do R2 também os INPUTS dela — inclusive a foto que ainda era a
 * referência fixa do estúdio (localStorage). O presign não valida existência,
 * então a chave morta só explodia DENTRO do Kie, já cobrada. Este helper
 * permite validar ANTES de criar a task.
 *
 * Falha inesperada do R2 (rede/5xx) retorna true — na dúvida deixa a geração
 * seguir; só 404 confirmado bloqueia.
 */
import { HeadObjectCommand } from "@aws-sdk/client-s3";
import { r2 } from "./client";

export async function objectExists(bucket: string, key: string): Promise<boolean> {
  try {
    await r2.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch (e) {
    const status = (e as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
    const name = (e as { name?: string })?.name ?? "";
    if (status === 404 || name === "NotFound" || name === "NoSuchKey") return false;
    return true; // erro transitório do R2 — não bloquear por isso
  }
}
