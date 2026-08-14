/**
 * Curadoria PESSOAL dos virais (tabela viral_user_videos, migração 75).
 *
 * O catálogo (`viral_videos`) é comum a todos — toda busca alimenta o acervo
 * de todo mundo. O que é de cada um mora aqui: o que reservei ("vou usar
 * este"), o que joguei fora e o que já virou Video React.
 *
 * Regra que não pode ser quebrada: **reservar não baixa nada.** O mp4 só
 * desce quando a pessoa vai produzir de verdade — senão o R2 vira depósito
 * de vídeo que ninguém usou (decisão do Johnny, 14/08).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";

type Admin = SupabaseClient<Database>;

/** Teto de ids que a gente carrega pra filtrar em memória/query. */
const TETO_IDS = 2000;

export type EstadoPessoal = {
  reservado: boolean;
  usado: boolean;
  download_status: string;
  r2_key: string | null;
};

async function idsPor(
  admin: Admin,
  userId: string,
  coluna: "descartado" | "reservado" | "usado",
): Promise<string[]> {
  const { data, error } = await admin
    .from("viral_user_videos")
    .select("viral_id")
    .eq("user_id", userId)
    .eq(coluna, true)
    .limit(TETO_IDS);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => (r as { viral_id: string }).viral_id);
}

/** O que ESTE usuário jogou fora — some da grade dele, fica na dos outros. */
export const idsDescartados = (admin: Admin, userId: string) =>
  idsPor(admin, userId, "descartado");

/** O que ele guardou em "Meus Virais". */
export const idsReservados = (admin: Admin, userId: string) =>
  idsPor(admin, userId, "reservado");

/** Estado pessoal de um punhado de vídeos, pra pintar a grade. */
export async function estadosPessoais(
  admin: Admin,
  userId: string,
  viralIds: string[],
): Promise<Map<string, EstadoPessoal>> {
  const mapa = new Map<string, EstadoPessoal>();
  if (viralIds.length === 0) return mapa;
  const { data, error } = await admin
    .from("viral_user_videos")
    .select("viral_id, reservado, usado, download_status, r2_key")
    .eq("user_id", userId)
    .in("viral_id", viralIds.slice(0, TETO_IDS));
  if (error) throw new Error(error.message);
  for (const r of data ?? []) {
    const l = r as EstadoPessoal & { viral_id: string };
    mapa.set(l.viral_id, {
      reservado: l.reservado,
      usado: l.usado,
      download_status: l.download_status,
      r2_key: l.r2_key,
    });
  }
  return mapa;
}

/**
 * "N pessoas usando" (função virais_uso, migração 75). É o selo que substitui
 * a trava: ninguém perde o vídeo, mas todo mundo vê que ele já rodou.
 */
export async function contagemUso(
  admin: Admin,
  viralIds: string[],
): Promise<Map<string, number>> {
  const mapa = new Map<string, number>();
  if (viralIds.length === 0) return mapa;
  const { data, error } = await admin.rpc("virais_uso" as never, {
    ids: viralIds.slice(0, TETO_IDS),
  } as never);
  if (error) return mapa; // selo é enfeite: se falhar, a grade continua de pé
  for (const r of (data ?? []) as { viral_id: string; usando: number }[]) {
    mapa.set(r.viral_id, Number(r.usando));
  }
  return mapa;
}

/** "Vou usar este" / tirar de Meus Virais. NÃO baixa o vídeo. */
export async function reservar(
  admin: Admin,
  userId: string,
  viralId: string,
  reservado: boolean,
): Promise<void> {
  const agora = new Date().toISOString();
  const { error } = await admin.from("viral_user_videos").upsert(
    {
      user_id: userId,
      viral_id: viralId,
      reservado,
      reservado_em: reservado ? agora : null,
      // reservar de novo desfaz um descarte anterior — o gesto é explícito.
      ...(reservado ? { descartado: false, descartado_em: null } : {}),
    } as never,
    { onConflict: "user_id,viral_id" },
  );
  if (error) throw new Error(error.message);
}

/**
 * Descarte pessoal em lote. Some da MINHA grade e não volta em busca futura
 * — sem apagar nada pra ninguém.
 */
export async function descartar(
  admin: Admin,
  userId: string,
  viralIds: string[],
): Promise<number> {
  if (viralIds.length === 0) return 0;
  const agora = new Date().toISOString();
  const linhas = viralIds.slice(0, 500).map((viral_id) => ({
    user_id: userId,
    viral_id,
    descartado: true,
    descartado_em: agora,
  }));
  const { error, count } = await admin
    .from("viral_user_videos")
    .upsert(linhas as never, { onConflict: "user_id,viral_id", count: "exact" });
  if (error) throw new Error(error.message);
  return count ?? linhas.length;
}

/**
 * Faxina: joga fora tudo que ESTE usuário não guardou. O que ele reservou
 * nunca sai — é a curadoria dele, e perder isso seria pior do que não ter
 * a faxina (regra dura desde 14/08).
 */
export async function descartarNaoReservados(
  admin: Admin,
  userId: string,
  termoBusca?: string | null,
): Promise<number> {
  const [reservados, jaDescartados] = await Promise.all([
    idsReservados(admin, userId),
    idsDescartados(admin, userId),
  ]);
  const fora = new Set([...reservados, ...jaDescartados]);

  let q = admin.from("viral_videos").select("id").eq("descartado", false).limit(TETO_IDS);
  if (termoBusca) q = q.eq("termo_busca", termoBusca);
  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const alvos = (data ?? [])
    .map((r) => (r as { id: string }).id)
    .filter((id) => !fora.has(id));
  return descartar(admin, userId, alvos);
}

/** Marca que o vídeo virou Video React (alimenta o selo "N usando"). */
export async function marcarUsado(
  admin: Admin,
  userId: string,
  viralId: string,
): Promise<void> {
  const agora = new Date().toISOString();
  const { error } = await admin.from("viral_user_videos").upsert(
    {
      user_id: userId,
      viral_id: viralId,
      reservado: true,
      usado: true,
      usado_em: agora,
      arquivo_tocado_em: agora,
    } as never,
    { onConflict: "user_id,viral_id" },
  );
  if (error) throw new Error(error.message);
}
