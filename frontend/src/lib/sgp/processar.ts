/**
 * SGP — "Confirmar e Enviar" (tela 4). É o que a planilha fazia depois de
 * importar, sem o Drive: as fotos aprovadas JÁ são referências do aluno e os
 * áudios aprovados JÁ estão na voz `awaiting_training`.
 *
 *  1. pedido → `processando`, aceite LGPD com hora
 *  2. e-mail "começamos" (régua de `lib/onboarding/avisos.ts`, SMTP suporte@)
 *  3. clone de FOTO: 1 imagem social (Kie, 525 cr) via `gerarAvatares`
 *  4. VOZ: `dispararTreinoOnboarding` (10k cr; saldo pode ficar negativo —
 *     mig 88; o aluno só usa a plataforma depois de assinar)
 *  Quem fecha o pedido (`pronto` + e-mail final) é o mesmo caminho da planilha:
 *  `verificarOnboardingPronto` no callback do Kie / fim do treino.
 */
import { getAdmin } from "@/lib/db/admin";
import { AVATAR_SOCIAL, gerarAvatares } from "@/lib/onboarding/avatares";
import { avisoComecamos } from "@/lib/onboarding/avisos";
import { dispararTreinoOnboarding } from "@/lib/onboarding/treino";
import { atualizarPedido, lerPedido } from "@/lib/sgp/pedido";

export type EnvioResultado = { ok: boolean; erros: string[] };

export async function enviarPedido(userId: string): Promise<EnvioResultado> {
  const admin = getAdmin();
  const pedido = await lerPedido(userId);
  if (!pedido) throw new Error("Comece pela tela de dados.");
  if (pedido.status !== "revisao") {
    if (["enviado", "processando", "pronto"].includes(pedido.status)) return { ok: true, erros: [] };
    throw new Error("Complete as etapas anteriores antes de enviar.");
  }
  const refs = (pedido.fotos ?? []).filter((f) => f.status === "aprovada").map((f) => f.key);
  if (refs.length < 4) throw new Error("Faltam fotos aprovadas.");
  if (!pedido.voice_id) throw new Error("Faltam áudios aprovados.");

  const agora = new Date().toISOString();
  await atualizarPedido(userId, { status: "processando", enviado_em: agora, aceite_lgpd_at: agora, erro: null });

  const { data: prof } = await admin.from("profiles").select("email, display_name").eq("id", userId).maybeSingle();
  const p = prof as { email: string; display_name: string | null } | null;
  if (p?.email) await avisoComecamos(p.email, p.display_name).catch(() => {});

  const erros: string[] = [];

  const foto = await gerarAvatares(admin, userId, refs, [AVATAR_SOCIAL]);
  for (const f of foto.failed) erros.push(`clone de foto: ${f.error}`);

  try {
    const t = await dispararTreinoOnboarding(admin, userId, pedido.voice_id);
    if (!t.ok) erros.push(`treino da voz: ${t.reason}`);
  } catch (e) {
    erros.push(`treino da voz: ${e instanceof Error ? e.message : String(e)}`);
  }

  if (erros.length) await atualizarPedido(userId, { erro: erros.join(" · ") });
  return { ok: erros.length === 0, erros };
}
