/**
 * GET /api/v1/react/meus — os React que ESTA pessoa já criou.
 *
 * Pedido do Johnny (22/08): *"quando eu clico em React, não está aparecendo os
 * vídeos que foram criados, e deveriam aparecer abaixo numa lista"*. Não
 * existia — nem a lista nem esta rota: o wizard só sabia do rascunho atual e
 * de UM job por vez (`?job=` / `?viral=`). Vídeo pronto de ontem era invisível.
 *
 * ⚠️ O mp4 final mora no bucket de `generations`, que tem **TTL de 30 dias**.
 * Por isso a lista devolve `expirado` em vez de fingir que o link serve: o
 * aluno precisa saber que aquele vídeo não está mais lá, e não clicar num
 * play quebrado.
 */
import type { NextRequest } from "next/server";

import { gateAdmin } from "@/lib/admin/api";
import { jsonOk, serverError } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { imagesBucket, R2_BUCKETS } from "@/lib/r2/client";
import { objectExists } from "@/lib/r2/exists";
import { createPresignedGet } from "@/lib/r2/presigned";

export const dynamic = "force-dynamic";

type Linha = {
  id: string;
  status: string;
  erro: string | null;
  r2_key: string | null;
  segundos: number;
  criado_em: string;
  viral_id: string;
};

export async function GET(request: NextRequest) {
  const gate = await gateAdmin(request);
  if ("res" in gate) return gate.res;

  try {
    const admin = getAdmin();
    const { data, error } = await admin
      .from("react_jobs")
      .select("id, status, erro, r2_key, segundos, criado_em, viral_id")
      .eq("user_id", gate.auth.user_id)
      .order("criado_em", { ascending: false })
      .limit(60);
    if (error) return serverError(error.message);
    const linhas = (data ?? []) as unknown as Linha[];
    if (linhas.length === 0) return jsonOk({ videos: [] });

    // A capa de cada um sai do viral que originou. Uma consulta só.
    const viralIds = [...new Set(linhas.map((l) => l.viral_id).filter(Boolean))];
    const { data: virais } = await admin
      .from("viral_videos")
      .select("id, autor, thumb_url, thumb_r2_key")
      .in("id", viralIds);
    const porViral = new Map(
      ((virais ?? []) as unknown as Array<{
        id: string;
        autor: string | null;
        thumb_url: string | null;
        thumb_r2_key: string | null;
      }>).map((v) => [v.id, v]),
    );

    const videos = await Promise.all(
      linhas.map(async (l) => {
        const v = porViral.get(l.viral_id);
        // Miniatura: a cópia nossa quando existe (a do TikTok expira — mig 91).
        const capa = v?.thumb_r2_key
          ? await createPresignedGet(imagesBucket(), v.thumb_r2_key, 6 * 3600).catch(() => null)
          : (v?.thumb_url ?? null);

        let video_url: string | null = null;
        let expirado = false;
        if (l.status === "pronto" && l.r2_key) {
          // TTL de 30 dias: conferir é mais honesto que entregar link morto.
          if (await objectExists(R2_BUCKETS.generations, l.r2_key)) {
            video_url = await createPresignedGet(R2_BUCKETS.generations, l.r2_key, 3600).catch(() => null);
          } else {
            expirado = true;
          }
        }
        return {
          id: l.id,
          status: l.status,
          erro: l.erro,
          segundos: Number(l.segundos) || 0,
          criado_em: l.criado_em,
          autor: v?.autor ?? null,
          thumb_url: capa,
          video_url,
          expirado,
        };
      }),
    );

    return jsonOk({ videos });
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "Falha ao listar os seus React");
  }
}
