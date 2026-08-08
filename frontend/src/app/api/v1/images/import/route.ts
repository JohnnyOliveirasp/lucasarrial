/**
 * /api/v1/images/import
 *   POST { key, width?, height? } → salva um UPLOAD próprio no acervo
 *   "Minhas fotos" (image_generations, sem prompt).
 *
 * Motivo (bug Johnny 08/08): foto enviada no Vídeo Clone vivia só na seleção
 * da tela — trocar pra uma foto do histórico descartava o upload e a pessoa
 * tinha que subir tudo de novo. Agora todo upload vira item permanente do
 * acervo: copia do bucket de uploads (TTL 30d) pro bucket PERMANENTE de
 * imagens e cria a linha (status ready, credits 0, prompt vazio — ok Johnny).
 */
import type { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { CopyObjectCommand } from "@aws-sdk/client-s3";
import { authenticate } from "@/lib/api/auth";
import { badRequest, jsonOk, serverError, unauthorized } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { imagesBucket, r2, R2_BUCKETS } from "@/lib/r2/client";
import { createPresignedGet } from "@/lib/r2/presigned";

/** Proporções que o app conhece — o rótulo do acervo usa a mais próxima. */
const KNOWN_ASPECTS: Array<[string, number]> = [
  ["1:1", 1],
  ["4:5", 4 / 5],
  ["5:4", 5 / 4],
  ["3:4", 3 / 4],
  ["4:3", 4 / 3],
  ["2:3", 2 / 3],
  ["3:2", 3 / 2],
  ["9:16", 9 / 16],
  ["16:9", 16 / 9],
];

function aspectLabel(w: number, h: number): string {
  if (!(w > 0) || !(h > 0)) return "auto";
  const r = w / h;
  let best: [string, number] = KNOWN_ASPECTS[0];
  for (const cand of KNOWN_ASPECTS) {
    if (Math.abs(cand[1] - r) < Math.abs(best[1] - r)) best = cand;
  }
  // Fora de ~3% de qualquer proporção conhecida → mostra a razão crua.
  return Math.abs(best[1] - r) / r <= 0.03 ? best[0] : `${w}:${h}`;
}

export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();

  let body: { key?: unknown; width?: unknown; height?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return badRequest("Corpo inválido");
  }
  const key = typeof body.key === "string" ? body.key.trim() : "";
  const width = typeof body.width === "number" && Number.isFinite(body.width) ? Math.round(body.width) : 0;
  const height = typeof body.height === "number" && Number.isFinite(body.height) ? Math.round(body.height) : 0;

  // Ownership por prefixo — mesmo contrato do POST /video-clone.
  const prefix = `${auth.user_id}/video-clone/uploads/`;
  if (!key.startsWith(prefix)) return badRequest("Arquivo inválido.");

  const id = randomUUID();
  const ext = (key.split(".").pop() || "jpg").toLowerCase().slice(0, 5);
  const destKey = `${auth.user_id}/uploads/${id}.${ext}`;

  try {
    await r2.send(
      new CopyObjectCommand({
        Bucket: imagesBucket(),
        // CopySource = "bucket/chave" com a chave URL-encodada.
        CopySource: `${R2_BUCKETS.generations}/${encodeURIComponent(key)}`,
        Key: destKey,
      }),
    );
  } catch (e) {
    console.error("[images/import] copy falhou:", e instanceof Error ? e.message : e);
    return serverError("Não consegui salvar a foto no acervo. Tente novamente.");
  }

  const admin = getAdmin();
  const { error: insertErr } = await admin.from("image_generations").insert({
    id,
    user_id: auth.user_id,
    name: "Foto enviada",
    prompt: "",
    input_image_path: "",
    aspect_ratio: aspectLabel(width, height),
    resolution: width > 0 && height > 0 ? `${width}×${height}` : "original",
    credits_cost: 0,
    image_path: destKey,
    status: "ready",
    kie_model: "upload",
  });
  if (insertErr) {
    console.error("[images/import] insert falhou:", insertErr.message);
    return serverError("Não consegui salvar a foto no acervo. Tente novamente.");
  }

  const image_url = await createPresignedGet(imagesBucket(), destKey, 60 * 60).catch(() => null);
  return jsonOk({ image: { id, image_url } }, 201);
}
