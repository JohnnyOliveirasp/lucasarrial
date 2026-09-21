/**
 * Vídeos Virais 1.0 — a leitura do acervo que os ALUNOS alimentam.
 *
 * Separado do `acervo.ts` de propósito: aquele é a tela de garimpo da casa
 * (filtros por termo, score, reserva, exclusividade, descarte pessoal). Aqui
 * é uma vitrine simples — o que foi enviado, do mais novo pro mais velho.
 * Misturar os dois faria a tela do aluno herdar regras que não são dele.
 *
 * A linha de corte é a mig 118: `publico` e sem `removido_em`. É isso que
 * impede os 560 vídeos do garimpo da casa aparecerem aqui.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";
import { createPresignedGet } from "@/lib/r2/presigned";
import { imagesBucket, R2_BUCKETS } from "@/lib/r2/client";

type Admin = SupabaseClient<Database>;

export type ViralDaComunidade = {
  id: string;
  plataforma: string;
  url: string;
  autor: string | null;
  legenda: string | null;
  likes: number | null;
  views: number | null;
  duracaoSeg: number | null;
  publicadoEm: string | null;
  enviadoEm: string | null;
  /** true = foi ESTE aluno que enviou (marca o card e libera "meus envios"). */
  meu: boolean;
  /** Capa servida do nosso R2 quando existe cópia; senão a da rede (pode vencer). */
  thumbUrl: string | null;
  /** mp4 no nosso R2 — null enquanto o download não terminou. */
  videoUrl: string | null;
};

const COLUNAS =
  "id, plataforma, url, autor, legenda, likes, views, duracao_seg, publicado_em, enviado_em, enviado_por, thumb_url, thumb_r2_key, r2_key";

type Linha = {
  id: string;
  plataforma: string;
  url: string;
  autor: string | null;
  legenda: string | null;
  likes: number | null;
  views: number | null;
  duracao_seg: number | null;
  publicado_em: string | null;
  enviado_em: string | null;
  enviado_por: string | null;
  thumb_url: string | null;
  thumb_r2_key: string | null;
  r2_key: string | null;
};

export async function listarComunidade(
  admin: Admin,
  args: { userId: string; apenasMeus: boolean; limite: number; offset: number },
): Promise<{ videos: ViralDaComunidade[]; total: number }> {
  const limite = Math.min(60, Math.max(1, args.limite));
  const offset = Math.max(0, args.offset);

  let q = admin
    .from("viral_videos")
    .select(COLUNAS, { count: "exact" })
    .eq("publico", true)
    .is("removido_em", null)
    // nullsFirst: false — envio sem data não pode furar a fila do topo.
    .order("enviado_em", { ascending: false, nullsFirst: false })
    .range(offset, offset + limite - 1);

  if (args.apenasMeus) q = q.eq("enviado_por", args.userId);

  const { data, count, error } = await q;
  if (error) throw new Error(error.message);
  const linhas = (data ?? []) as unknown as Linha[];

  // Capa e vídeo assinados em paralelo: são 24 cards por página, e assinar em
  // série somaria o tempo de todos antes da tela aparecer.
  const videos = await Promise.all(
    linhas.map(async (l): Promise<ViralDaComunidade> => {
      const [thumb, video] = await Promise.all([
        l.thumb_r2_key
          ? createPresignedGet(imagesBucket(), l.thumb_r2_key, 6 * 3600).catch(() => null)
          : Promise.resolve(null),
        l.r2_key
          ? createPresignedGet(R2_BUCKETS.generations, l.r2_key, 6 * 3600).catch(() => null)
          : Promise.resolve(null),
      ]);
      return {
        id: l.id,
        plataforma: l.plataforma,
        url: l.url,
        autor: l.autor,
        legenda: l.legenda,
        likes: l.likes,
        views: l.views,
        duracaoSeg: l.duracao_seg,
        publicadoEm: l.publicado_em,
        enviadoEm: l.enviado_em,
        meu: l.enviado_por === args.userId,
        thumbUrl: thumb ?? l.thumb_url,
        videoUrl: video,
      };
    }),
  );

  return { videos, total: count ?? videos.length };
}
