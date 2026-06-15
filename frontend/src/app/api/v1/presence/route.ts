/**
 * POST /api/v1/presence → heartbeat de "online agora".
 * Qualquer usuário logado pinga; grava profiles.last_seen_at = now.
 * O /admin considera online quem foi visto nos últimos ~90s.
 */
import { createClient } from "@/lib/supabase/server";
import { getAdmin } from "@/lib/db/admin";
import { jsonOk, unauthorized } from "@/lib/api/responses";

export const dynamic = "force-dynamic";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return unauthorized();

  await getAdmin()
    .from("profiles")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", user.id);

  return jsonOk({ ok: true });
}
