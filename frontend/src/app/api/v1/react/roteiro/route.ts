/**
 * POST /api/v1/react/roteiro — o Gemini ASSISTE o viral e escreve o comentário.
 *
 * 🔴 Reescrito em 14/08 depois do teste do Johnny: a primeira versão mandava
 * só a transcrição pro DeepSeek, que não vê vídeo — e ele inventava. Agora o
 * vídeo inteiro (imagem + áudio) vai pro Gemini, que transcreve a fala E
 * interpreta o que está na tela. Se não houver fala, ele descreve mesmo assim.
 *
 * Reaproveita o mp4 que já estiver no R2; só baixa se ainda não existir — e o
 * arquivo baixado aqui serve depois pra montagem.
 */
import fs from "node:fs/promises";
import path from "node:path";
import type { NextRequest } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { gateAdmin } from "@/lib/admin/api";
import { badRequest, jsonError, jsonOk, serverError } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { r2, R2_BUCKETS } from "@/lib/r2/client";
import { baixarViral, DownloadViralError, marcarDownload } from "@/lib/virais/download";
import { assistirEEscrever, pastaTemporaria } from "@/lib/react/assistir";
import { contarPalavras, palavrasAlvo, segundosEstimados } from "@/lib/react/roteiro";

export const dynamic = "force-dynamic";
/** Baixar (se preciso) + Gemini: ~20s no caso comum. */
export const maxDuration = 300;

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

  const { data: viral } = await admin
    .from("viral_videos")
    .select("id, url, autor, legenda, duracao_seg")
    .eq("id", viralId)
    .maybeSingle();
  if (!viral?.url) return badRequest("Vídeo não encontrado no acervo.");

  const duracao = Number(viral.duracao_seg ?? 0) || 30;
  const dir = await pastaTemporaria();
  const arquivo = path.join(dir, "viral.mp4");

  try {
    // 1. O mp4: usa o que já está no R2; só baixa se ainda não existir.
    const { data: meu } = await admin
      .from("viral_user_videos")
      .select("r2_key, download_status")
      .eq("user_id", userId)
      .eq("viral_id", viralId)
      .maybeSingle();

    let key = meu?.download_status === "pronto" ? meu.r2_key : null;
    if (!key) {
      const baixado = await baixarViral({ url: viral.url, userId, viralId });
      key = baixado.r2Key;
      await marcarDownload(admin, userId, viralId, { status: "pronto", r2Key: key });
    }
    const obj = await r2.send(new GetObjectCommand({ Bucket: R2_BUCKETS.generations, Key: key! }));
    await fs.writeFile(arquivo, Buffer.from(await obj.Body!.transformToByteArray()));

    // 2. O Gemini assiste (imagem + áudio) e escreve.
    const alvo = palavrasAlvo(duracao);
    const leitura = await assistirEEscrever({
      caminhoMp4: arquivo,
      autor: viral.autor,
      legenda: viral.legenda,
      duracaoSeg: duracao,
      palavrasAlvo: alvo,
    });

    return jsonOk({
      roteiro: leitura.roteiro,
      transcricao: leitura.transcricao.slice(0, 4000),
      descricao: leitura.descricao,
      tem_fala: leitura.temFala,
      palavras: contarPalavras(leitura.roteiro),
      palavras_alvo: alvo,
      segundos_estimados: segundosEstimados(leitura.roteiro),
      duracao_viral: Math.round(duracao),
    });
  } catch (e) {
    if (e instanceof DownloadViralError) {
      // Fato sobre o vídeo (saiu do ar, etc), não falha nossa.
      return jsonError("video_error", e.message, 422);
    }
    console.error("[react/roteiro]", e instanceof Error ? e.message : e);
    return serverError("Não consegui assistir esse vídeo agora. Tente de novo.");
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
