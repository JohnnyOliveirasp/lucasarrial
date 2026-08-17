/**
 * Onboarding — gera 2-3 AVATARES do aluno a partir das fotos importadas
 * (correção Johnny 13/08: "pegar todas elas e enviar para gerar 2 ou 3
 * avatares dele"). COBRADO do aluno (correção Johnny 17/08 — antes era por
 * conta da casa): mesmo preço e mesmo shape de débito do /images/generate,
 * então o estorno automático de falha do Kie (lib/images/finalize) funciona
 * igual. Sem saldo, o avatar NÃO é gerado (crédito é o único gate).
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
import { imageCreditCost } from "@/lib/kie/config";
import { bypassesBilling } from "@/lib/credits/access";
import { debitCredits, getBalance } from "@/lib/credits/service";

type Admin = SupabaseClient<Database>;

const IDEA_MARCA = "onboarding_avatar";
const MAX_REFS = 6; // mesmo teto do /images/generate

/** 3 cenários OFICIAIS (prompts do Johnny 13/08) — likeness em primeiro
 *  lugar, sempre olhando pra câmera, vertical 3:4. */
const AVATARES: Array<{ nome: string; promptPt: string; promptEn: string }> = [
  {
    nome: "Profissionalismo (escritório)",
    promptPt:
      "Eu em um escritório moderno e bem iluminado, sentado(a) à mesa, olhando diretamente para a câmera, com uma expressão confiante e simpática.",
    promptEn:
      "The exact same person as in the reference photos — identical face, photorealistic — in a modern, well-lit office, sitting at a desk, looking directly at the camera with a confident, friendly expression. Vertical portrait.",
  },
  {
    nome: "Autoridade (estúdio de podcast)",
    promptPt:
      "Eu em um estúdio de podcast, sentado(a) em frente a um microfone, olhando diretamente para a câmera, com uma expressão confiante e natural.",
    promptEn:
      "The exact same person as in the reference photos — identical face, photorealistic — in a podcast studio, sitting in front of a microphone, looking directly at the camera with a confident, natural expression. Vertical portrait.",
  },
  {
    nome: "Proximidade (ambiente de casa)",
    promptPt:
      "Eu em um ambiente aconchegante de casa, sentado(a) em um sofá, olhando diretamente para a câmera, com um sorriso natural e tranquilo.",
    promptEn:
      "The exact same person as in the reference photos — identical face, photorealistic — in a cozy home setting, sitting on a sofa, looking directly at the camera with a natural, relaxed smile. Vertical portrait.",
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

  // Mesma cobrança do /images/generate (equipe/admin não paga).
  const { data: prof } = await admin
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .maybeSingle();
  const billed = !bypassesBilling((prof as { email?: string } | null)?.email ?? null);
  const creditCost = imageCreditCost("1K");

  for (const avatar of AVATARES) {
    try {
      if (billed) {
        const bal = await getBalance(userId);
        if (bal.total < creditCost) {
          result.failed.push({
            nome: avatar.nome,
            error: `sem créditos (avatar custa ${creditCost}, saldo ${bal.total})`,
          });
          continue;
        }
      }
      const { taskId } = await kieCreateImageTask(
        {
          prompt: avatar.promptEn,
          input_urls: inputUrls,
          aspect_ratio: "3:4",
          resolution: "1K",
        },
        { callBackUrl: kieCallbackUrl(), model: rota.model },
      );
      const id = randomUUID();
      const { error: insertErr } = await admin.from("image_generations").insert({
        id,
        user_id: userId,
        name: avatar.nome,
        prompt: avatar.promptPt,
        prompt_en: avatar.promptEn,
        idea: IDEA_MARCA,
        input_image_path: inputKeys[0],
        input_image_paths: inputKeys,
        aspect_ratio: "3:4",
        resolution: "1K",
        credits_cost: billed ? creditCost : 0,
        status: "pending",
        kie_task_id: taskId,
        kie_model: rota.model,
      });
      if (insertErr) throw new Error(insertErr.message);

      // Debita após criar a row (mesmo shape/ordem do /images/generate —
      // o estorno automático do finalize casa com este débito pelo refId).
      if (billed) {
        await debitCredits({
          userId,
          amount: creditCost,
          kind: "image",
          refType: "image_generation",
          refId: id,
          note: "avatar do onboarding (1K)",
        });
      }
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
