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
  return (await objectHead(bucket, key)).exists;
}

/**
 * Mesmo HEAD, devolvendo também o TAMANHO — o peso é a resposta do #199.
 *
 * Um aluno mandou 14 fotos originais de câmera (340 MB somados) pro Gerador de
 * Imagem e o Kie devolveu `generate playground failed, task id is blank` três
 * vezes seguidas. Medido pelo Frank em 30/08: até ~129 MB passa, a partir de
 * ~317 MB falhou 3/3, nas duas famílias de modelo — não é a CONTAGEM (15 refs
 * geraram ready 20 vezes), é a SOMA dos bytes. Como já existe um HEAD por
 * referência pra checar se a foto morreu, o peso vem de graça na mesma passada.
 *
 * `bytes` é null quando o HEAD falhou por erro transitório: na dúvida a
 * geração segue, igual ao `objectExists`.
 */
export async function objectHead(
  bucket: string,
  key: string,
): Promise<{ exists: boolean; bytes: number | null }> {
  try {
    const r = await r2.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return { exists: true, bytes: typeof r.ContentLength === "number" ? r.ContentLength : null };
  } catch (e) {
    const status = (e as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
    const name = (e as { name?: string })?.name ?? "";
    if (status === 404 || name === "NotFound" || name === "NoSuchKey") return { exists: false, bytes: null };
    return { exists: true, bytes: null }; // erro transitório do R2 — não bloquear por isso
  }
}
