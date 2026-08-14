/**
 * Onboarding — gera 2-3 AVATARES do aluno a partir das fotos importadas
 * (correção Johnny 13/08: "pegar todas elas e enviar para gerar 2 ou 3
 * avatares dele"). Por conta da casa (credits_cost 0).
 *
 * Usa o mesmo caminho do /api/v1/images/generate (pickImageRoute +
 * kieCreateImageTask + row pending); o webhook/poll do Kie finaliza sozinho
 * e os avatares aparecem no HISTÓRICO como imagens GERADAS (regra do Johnny:
 * histórico é só de geradas). Idempotente pela marca idea="onboarding_avatar".
 */
import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";
import { imagesBucket } from "@/lib/r2/client";
import { createPresignedGet } from "@/lib/r2/presigned";
import { kieCreateImageTask, kieCallbackUrl } from "@/lib/kie/client";
import { pickImageRoute } from "@/lib/kie/failover";

type Admin = SupabaseClient<Database>;

const IDEA_MARCA = "onboarding_avatar";
const MAX_REFS = 6; // mesmo teto do /images/generate

/** 3 estilos fixos — likeness em primeiro lugar, vertical 3:4. */
const AVATARES: Array<{ nome: string; promptPt: string; promptEn: string }> = [
  {
    nome: "Avatar profissional",
    promptPt: "Retrato profissional de estúdio, fundo neutro, olhando pra câmera",
    promptEn:
      "Professional studio portrait of the exact same person as in the reference photos — identical face, photorealistic. Chest-up framing, looking straight at the camera, soft studio lighting, clean neutral background, smart-casual outfit. Vertical portrait.",
  },
  {
    nome: "Avatar criador",
    promptPt: "Retrato estilo criador de conteúdo, ambiente moderno e caloroso",
    promptEn:
      "Friendly content-creator portrait of the exact same person as in the reference photos — identical face, photorealistic. Chest-up, natural confident smile, modern warm interior softly blurred behind, natural window light. Vertical portrait.",
  },
  {
    nome: "Avatar cinematográfico",
    promptPt: "Retrato cinematográfico confiante, luz dramática suave",
    promptEn:
      "Cinematic confident portrait of the exact same person as in the reference photos — identical face, photorealistic. Chest-up, subtle dramatic rim lighting, dark elegant background with soft depth of field. Vertical portrait.",
  },
];

export type AvataresResult = {
  created: number;
  skipped: number;
  failed: Array<{ nome: string; error: string }>;
};

export async function gerarAvatares(
  admin: Admin,
  userId: string,
  refKeys: string[],
): Promise<AvataresResult> {
  const result: AvataresResult = { created: 0, skipped: 0, failed: [] };
  if (refKeys.length === 0) return result;

  // Idempotência: já gerou avatares do onboarding? Não duplica.
  const { count } = await admin
    .from("image_generations")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("idea", IDEA_MARCA);
  if ((count ?? 0) > 0) {
    result.skipped = AVATARES.length;
    return result;
  }

  const rota = await pickImageRoute();
  if (rota.blocked) {
    result.failed.push({ nome: "todos", error: "gerador de imagem indisponível (disjuntor)" });
    return result;
  }

  const inputKeys = refKeys.slice(0, MAX_REFS);
  const inputUrls = await Promise.all(
    inputKeys.map((k) => createPresignedGet(imagesBucket(), k, 24 * 3600)),
  );

  for (const avatar of AVATARES) {
    try {
      const { taskId } = await kieCreateImageTask(
        {
          prompt: avatar.promptEn,
          input_urls: inputUrls,
          aspect_ratio: "3:4",
          resolution: "1K",
        },
        { callBackUrl: kieCallbackUrl(), model: rota.model },
      );
      const { error: insertErr } = await admin.from("image_generations").insert({
        id: randomUUID(),
        user_id: userId,
        name: avatar.nome,
        prompt: avatar.promptPt,
        prompt_en: avatar.promptEn,
        idea: IDEA_MARCA,
        input_image_path: inputKeys[0],
        input_image_paths: inputKeys,
        aspect_ratio: "3:4",
        resolution: "1K",
        credits_cost: 0, // por conta da casa (onboarding)
        status: "pending",
        kie_task_id: taskId,
        kie_model: rota.model,
      });
      if (insertErr) throw new Error(insertErr.message);
      result.created++;
    } catch (e) {
      result.failed.push({
        nome: avatar.nome,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return result;
}
