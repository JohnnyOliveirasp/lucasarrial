/**
 * Disjuntor + roteamento de contingência do gerador de imagens (spec Johnny
 * 29/07): o GPT (gpt-image-2) é o TITULAR; o Seedream 5.0 Pro entra SOZINHO
 * quando o titular degrada e SAI SOZINHO quando ele volta. O aluno nunca
 * escolhe (nem sabe) o modelo — é contingência, não feature.
 *
 * Como funciona (janela de 15min sobre image_generations):
 * - Falha do titular = row `failed` do GPT OU retry cruzado (row do Seedream
 *   com retry_count=1 — só nasce quando uma task GPT falhou e a retentativa
 *   caiu no fallback).
 * - Disjuntor ABRE com 3+ falhas do titular e falhas ≥ sucessos dele
 *   (mesma régua do disjuntor original de 29/07, agora por modelo).
 * - Aberto + KIE_FALLBACK_ENABLED=true → novas tasks vão pro Seedream.
 *   Aberto + fallback desligado → 503 (comportamento antigo, não cobra).
 * - VOLTA automática: com tudo roteado pro fallback o titular para de gerar
 *   eventos; a janela esvazia → o próximo job testa o GPT (probe).
 * - Se o probe falhar, o retry cruzado salva o aluno E reabre o disjuntor na
 *   hora: basta 1 falha do titular quando há atividade recente do Seedream
 *   (evidência de que estamos em/perto do modo contingência).
 *
 * Server-only.
 */
import { getAdmin } from "@/lib/db/admin";
import {
  KIE_IMAGE_MODEL,
  KIE_FALLBACK_IMAGE_MODEL,
  kieFallbackEnabled,
  type KieImageModel,
} from "./config";

const WINDOW_MS = 15 * 60 * 1000;

export type ImageRoute =
  | { blocked: false; model: KieImageModel; degraded: boolean }
  | { blocked: true };

/**
 * Decide o modelo da PRÓXIMA geração (ou bloqueia, se o titular degradou e o
 * fallback está desligado). Chamar antes do createTask no POST /images/generate.
 */
export async function pickImageRoute(): Promise<ImageRoute> {
  const admin = getAdmin();
  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const base = () =>
    admin
      .from("image_generations")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since);

  const [gptFailedQ, gptReadyQ, crossRetryQ, seedreamAnyQ] = await Promise.all([
    base().eq("status", "failed").eq("kie_model", KIE_IMAGE_MODEL),
    base().eq("status", "ready").eq("kie_model", KIE_IMAGE_MODEL),
    base().eq("kie_model", KIE_FALLBACK_IMAGE_MODEL).eq("retry_count", 1),
    base().eq("kie_model", KIE_FALLBACK_IMAGE_MODEL),
  ]);

  const titularFails = (gptFailedQ.count ?? 0) + (crossRetryQ.count ?? 0);
  const titularOk = gptReadyQ.count ?? 0;
  const fallbackActive = (seedreamAnyQ.count ?? 0) > 0;

  const open =
    (titularFails >= 3 && titularFails >= titularOk) ||
    (titularFails >= 1 && fallbackActive);

  if (!open) return { blocked: false, model: KIE_IMAGE_MODEL, degraded: false };
  if (!kieFallbackEnabled()) return { blocked: true };
  return { blocked: false, model: KIE_FALLBACK_IMAGE_MODEL, degraded: true };
}
