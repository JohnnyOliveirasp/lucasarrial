/**
 * POST /api/v1/virais/download — baixa o mp4 de um viral guardado.
 *
 * É AQUI que o arquivo nasce. Guardar em "Meus Virais" não baixa nada
 * (decisão do Johnny 14/08): o R2 só recebe o que a pessoa vai produzir de
 * verdade. Por isso o link é resolvido na hora — a URL de CDN que a busca
 * salvou expira em horas.
 *
 * GET ?id= devolve só o estado (a tela pergunta enquanto baixa).
 */
import type { NextRequest } from "next/server";
import { gateAdmin } from "@/lib/admin/api";
import { badRequest, jsonError, jsonOk, serverError } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { baixarViral, DownloadViralError, marcarDownload } from "@/lib/virais/download";

export const dynamic = "force-dynamic";
/** Vídeo de 2min em 1080p leva ~30s; 300s cobre o pior caso com folga. */
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const gate = await gateAdmin(request);
  if ("res" in gate) return gate.res;
  const id = (request.nextUrl.searchParams.get("id") ?? "").trim();
  if (!id) return badRequest("Faltou o id do vídeo.");

  const { data } = await getAdmin()
    .from("viral_user_videos")
    .select("download_status, r2_key, download_erro")
    .eq("user_id", gate.auth.user_id)
    .eq("viral_id", id)
    .maybeSingle();

  return jsonOk({
    download_status: data?.download_status ?? "nao_baixado",
    r2_key: data?.r2_key ?? null,
    erro: data?.download_erro ?? null,
  });
}

export async function POST(request: NextRequest) {
  const gate = await gateAdmin(request);
  if ("res" in gate) return gate.res;

  let body: { viral_id?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return badRequest("Corpo inválido");
  }
  const viralId = typeof body.viral_id === "string" ? body.viral_id : "";
  if (!viralId) return badRequest("Faltou o id do vídeo.");

  const admin = getAdmin();
  const userId = gate.auth.user_id;

  // Precisa estar no acervo — e é daqui que sai a URL do post (nunca o
  // video_url salvo, que já expirou).
  const { data: viral } = await admin
    .from("viral_videos")
    .select("id, url, autor")
    .eq("id", viralId)
    .maybeSingle();
  if (!viral?.url) return badRequest("Vídeo não encontrado no acervo.");

  // Já baixado? Não gasta banda de novo — só carimba o uso (régua dos 60 dias).
  const { data: jaTem } = await admin
    .from("viral_user_videos")
    .select("download_status, r2_key")
    .eq("user_id", userId)
    .eq("viral_id", viralId)
    .maybeSingle();
  if (jaTem?.download_status === "pronto" && jaTem.r2_key) {
    await marcarDownload(admin, userId, viralId, { status: "pronto", r2Key: jaTem.r2_key });
    return jsonOk({ download_status: "pronto", r2_key: jaTem.r2_key, reaproveitado: true });
  }

  await marcarDownload(admin, userId, viralId, { status: "baixando" });
  try {
    const { r2Key, bytes } = await baixarViral({ url: viral.url, userId, viralId });
    await marcarDownload(admin, userId, viralId, { status: "pronto", r2Key });
    console.log(`[virais/download] ok @${viral.autor ?? "?"} ${(bytes / 1_048_576).toFixed(1)}MB → ${r2Key}`);
    return jsonOk({ download_status: "pronto", r2_key: r2Key, bytes });
  } catch (e) {
    const msg = e instanceof DownloadViralError ? e.message : "Não consegui baixar esse vídeo agora.";
    const code = e instanceof DownloadViralError ? e.code : "falhou";
    await marcarDownload(admin, userId, viralId, { status: "erro", erro: msg });
    console.error("[virais/download]", code, e instanceof Error ? e.message : e);
    // "saiu do ar" é fato sobre o vídeo, não falha nossa — 422, não 500.
    return code === "fora_do_ar"
      ? jsonError("gone", msg, 422)
      : serverError(msg);
  }
}
