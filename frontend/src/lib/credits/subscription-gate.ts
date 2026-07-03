/**
 * Gate de ASSINATURA (server-only) pras ações do wizard de vídeo.
 *
 * Diferente do gate de créditos (402 insufficient_credits quando o saldo não
 * cobre), este exige assinatura VIGENTE: quem cancelou e ficou com créditos
 * sobrando não gera vídeo. Allowlist da equipe/admin passa direto.
 *
 * Retorna null quando pode seguir, ou a Response 402 pronta pra devolver.
 */
import { getAdmin } from "@/lib/db/admin";
import { jsonError } from "@/lib/api/responses";
import { bypassesBilling, hasActiveAccess } from "./access";

export async function subscriptionGate(auth: {
  user_id: string;
  email: string | null;
}): Promise<Response | null> {
  if (bypassesBilling(auth.email)) return null;

  const { data } = await getAdmin()
    .from("profiles")
    .select("access_until")
    .eq("id", auth.user_id)
    .maybeSingle();

  if (hasActiveAccess(auth.email, data?.access_until ?? null)) return null;

  return jsonError(
    "subscription_required",
    "Assine o plano para criar vídeos.",
    402,
    { subscribed: false },
  );
}
