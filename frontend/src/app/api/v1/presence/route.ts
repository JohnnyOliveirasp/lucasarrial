/**
 * POST /api/v1/presence → heartbeat de "online agora".
 * Qualquer usuário logado pinga; grava profiles.last_seen_at = now.
 * O /admin considera online quem foi visto nos últimos ~150s.
 *
 * Trava de escrita (Disk IO Budget do Supabase 07/08): só grava se o último
 * visto tem mais de 45s — pings de várias abas do mesmo aluno viram UM update
 * (UPDATE que não casa a WHERE não gera WAL).
 */
import { createClient } from "@/lib/supabase/server";
import { getAdmin } from "@/lib/db/admin";
import { jsonOk, unauthorized } from "@/lib/api/responses";

export const dynamic = "force-dynamic";

const MIN_WRITE_GAP_MS = 45_000;

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return unauthorized();

  const cutoff = new Date(Date.now() - MIN_WRITE_GAP_MS).toISOString();
  await getAdmin()
    .from("profiles")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", user.id)
    .or(`last_seen_at.is.null,last_seen_at.lt.${cutoff}`);

  return jsonOk({ ok: true });
}
