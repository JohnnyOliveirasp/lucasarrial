/**
 * Referências salvas do estúdio de imagem — a área que o histórico NÃO toca.
 *
 * O defeito de raiz (19/08, print do Johnny em _Bugs/video_react): a foto de
 * referência era um `input_*` DENTRO da pasta de uma geração
 * (`{user}/images/{id}/…`). Apagar aquela geração do histórico apagava os
 * inputs junto — e a referência fixa, que aponta pra lá, morria. A guarda de
 * 07/08 (d50010d) barrava antes de cobrar, mas a pessoa via a foto na tela e
 * o sistema dizia que ela não existia.
 *
 * A cura é tirar a referência do ciclo de vida da geração: quando uma foto
 * vira referência, ela é COPIADA para `{user}/refs/` — cópia server-side no
 * R2, sem download — e a referência passa a apontar pra cópia. O DELETE do
 * histórico continua apagando as pastas das gerações; `refs/` sobrevive.
 *
 * Migração (medida em 19/08): 38 perfis têm a referência no servidor
 * (onboarding) e migram por script; os ~570 restantes guardam a chave no
 * localStorage DE CADA NAVEGADOR — impossível enumerar do servidor. Esses
 * migram por ADOÇÃO: o estúdio adota a referência na primeira visita, e o
 * funil único (`persistFixedRef`) garante que toda referência nova já nasce
 * adotada.
 */
import { randomUUID } from "node:crypto";
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { imagesBucket, r2 } from "@/lib/r2/client";
import { objectExists } from "@/lib/r2/exists";
import { createPresignedGet } from "@/lib/r2/presigned";

export function refsPrefix(userId: string): string {
  return `${userId}/refs/`;
}

export function ehReferenciaSalva(userId: string, key: string): boolean {
  return key.startsWith(refsPrefix(userId));
}

/**
 * Copia a foto para `refs/` e devolve a chave da cópia.
 * Idempotente: chave que já mora em refs/ volta como está (se existir).
 * @throws se a origem não pertence ao usuário ou não existe mais.
 */
export async function adotarReferencia(userId: string, key: string): Promise<string> {
  const limpa = key.trim();
  if (!limpa.startsWith(`${userId}/`)) throw new Error("essa foto não é sua");
  const bucket = imagesBucket();
  if (!(await objectExists(bucket, limpa))) {
    throw new Error("essa foto não existe mais no acervo");
  }
  if (ehReferenciaSalva(userId, limpa)) return limpa;

  // Nome legível no fim da chave: a aba mostra o arquivo, não um uuid pelado.
  const nome = (limpa.split("/").pop() ?? "foto").replace(/^input_/, "").slice(-80);
  const destino = `${refsPrefix(userId)}${randomUUID().slice(0, 8)}_${nome}`;
  await r2.send(
    new CopyObjectCommand({
      Bucket: bucket,
      // CopySource exige URL-encoding por segmento (nome com acento quebrava).
      CopySource: `${bucket}/${limpa.split("/").map(encodeURIComponent).join("/")}`,
      Key: destino,
    }),
  );
  return destino;
}

export type ReferenciaSalva = { key: string; url: string; size: number; at: string | null };

/** Lista as referências salvas (mais novas primeiro), com URL de 1h. */
export async function listarReferencias(userId: string): Promise<ReferenciaSalva[]> {
  const bucket = imagesBucket();
  const res = await r2.send(
    new ListObjectsV2Command({ Bucket: bucket, Prefix: refsPrefix(userId), MaxKeys: 200 }),
  );
  const itens = (res.Contents ?? []).sort(
    (a, b) => (b.LastModified?.getTime() ?? 0) - (a.LastModified?.getTime() ?? 0),
  );
  return Promise.all(
    itens.map(async (o) => ({
      key: o.Key!,
      url: await createPresignedGet(bucket, o.Key!, 3600),
      size: o.Size ?? 0,
      at: o.LastModified?.toISOString() ?? null,
    })),
  );
}

/** Apaga UMA referência salva (só dentro do refs/ do dono). */
export async function apagarReferencia(userId: string, key: string): Promise<void> {
  if (!ehReferenciaSalva(userId, key) || key.includes("..")) {
    throw new Error("chave fora da área de referências");
  }
  await r2.send(new DeleteObjectCommand({ Bucket: imagesBucket(), Key: key }));
}
