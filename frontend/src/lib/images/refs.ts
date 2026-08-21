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
import type { getAdmin } from "@/lib/db/admin";

/** O cliente admin do Supabase, sem arrastar os types gerados pra cá. */
type SupabaseLike = ReturnType<typeof getAdmin>;

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
/**
 * Apaga o ORIGINAL depois que a cópia em `refs/` já existe — o staging de
 * `<uid>/images/<uuid>/input_*` que ninguém mais usa.
 *
 * ⚠️ SÓ CHAME COM AS DUAS CONDIÇÕES SATISFEITAS (incidente c82c77e4):
 *  1. a chave é staging recém-criado pelo upload (o cliente diz `staging`), e
 *  2. NENHUMA geração referencia a chave.
 *
 * O conserto "óbvio" — apagar o original sempre que a adoção der certo — foi
 * MEDIDO em 21/08 e quebra produção: mesmo depois da mudança de 19/08, 31
 * payloads de geração ainda apontam direto pro original. Apagar ali apagaria
 * a foto de entrada do histórico desses alunos, que é exatamente o defeito
 * que a pasta `refs/` foi criada pra curar. Seria trocar 1,5 GB de disco por
 * histórico quebrado de aluno.
 *
 * Falhar aqui NÃO é erro do usuário: a referência dele já está salva. Se o
 * delete falhar, sobra um arquivo órfão — o mesmo custo de hoje, nada pior.
 */
export async function apagarStagingAdotado(
  admin: SupabaseLike,
  userId: string,
  original: string,
): Promise<boolean> {
  // Cinto: nunca apagar dentro de refs/ (é o destino, não a origem).
  if (!original.startsWith(`${userId}/images/`)) return false;
  if (ehReferenciaSalva(userId, original)) return false;

  // Suspensório: a chave não pode estar referenciada em LUGAR NENHUM.
  //
  // ⚠️ SÃO QUATRO CONSULTAS, E ISSO CUSTOU CARO (21/08). A primeira versão
  // olhava só `image_generations` e eu rodei a limpeza em massa com ela: 27
  // arquivos que `video_projects` referenciava foram apagados, quebrando 15
  // projetos de vídeo de 8 alunos. Deu pra restaurar tudo (a cópia vivia em
  // `refs/`), mas a lição é a trava: uma foto pode ser insumo de uma GERAÇÃO
  // DE IMAGEM **ou** de um PROJETO DE VÍDEO, e as duas tabelas guardam a
  // chave em colunas diferentes. Conferir uma e esquecer a outra é apagar
  // arquivo em uso achando que está limpando lixo.
  const [umPath, muitosPaths, refVideo, prodVideo] = await Promise.all([
    admin.from("image_generations").select("id").eq("input_image_path", original).limit(1),
    admin.from("image_generations").select("id").contains("input_image_paths", [original]).limit(1),
    admin.from("video_projects").select("id").contains("reference_image_paths", [original]).limit(1),
    admin.from("video_projects").select("id").contains("product_image_paths", [original]).limit(1),
  ]);
  // Erro de consulta não é "não tem referência": na dúvida, não apaga.
  const consultas = [umPath, muitosPaths, refVideo, prodVideo];
  if (consultas.some((c) => c.error)) return false;
  if (consultas.some((c) => (c.data?.length ?? 0) > 0)) return false;

  await r2.send(new DeleteObjectCommand({ Bucket: imagesBucket(), Key: original }));
  return true;
}

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
