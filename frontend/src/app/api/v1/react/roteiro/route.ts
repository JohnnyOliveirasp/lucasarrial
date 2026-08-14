/**
 * POST /api/v1/react/roteiro — a LLM assiste o viral e escreve o comentário.
 *
 * Baixa SÓ o áudio (yt-dlp -x), transcreve e manda pro modelo com o prompt de
 * reaction. Não baixa o vídeo: o mp4 só desce na hora de montar.
 *
 * O tamanho do roteiro sai da duração do viral — a fala tem que caber, senão
 * sobra áudio sem imagem na montagem (regra que veio da pergunta do Johnny
 * sobre o CTA, 14/08).
 */
import type { NextRequest } from "next/server";
import { gateAdmin } from "@/lib/admin/api";
import { badRequest, jsonError, jsonOk, serverError } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { LinkError } from "@/lib/roteiro/link";
import {
  contarPalavras,
  escreverReact,
  ouvirViral,
  palavrasAlvo,
  segundosEstimados,
} from "@/lib/react/roteiro";

export const dynamic = "force-dynamic";
/** Baixar áudio + Whisper + LLM: ~40s no caso comum, 300s cobre o pior. */
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

  const { data: viral } = await getAdmin()
    .from("viral_videos")
    .select("id, url, autor, legenda, duracao_seg")
    .eq("id", viralId)
    .maybeSingle();
  if (!viral?.url) return badRequest("Vídeo não encontrado no acervo.");

  const duracao = Number(viral.duracao_seg ?? 0) || 30;

  try {
    const ouvido = await ouvirViral(viral.url);
    const { roteiro, model } = await escreverReact({
      transcricao: ouvido.transcript,
      legenda: viral.legenda,
      autor: viral.autor,
      duracaoSeg: duracao,
    });

    return jsonOk({
      roteiro,
      model,
      transcricao: ouvido.transcript.slice(0, 4000),
      tem_fala: ouvido.transcript.trim().length > 0,
      palavras: contarPalavras(roteiro),
      palavras_alvo: palavrasAlvo(duracao),
      segundos_estimados: segundosEstimados(roteiro),
      duracao_viral: Math.round(duracao),
    });
  } catch (e) {
    if (e instanceof LinkError) {
      // Erro sobre o VÍDEO (fora do ar, longo demais, exige login) — não é
      // falha nossa, e a mensagem já vem pronta em pt-BR.
      return jsonError("link_error", e.message, 422);
    }
    console.error("[react/roteiro]", e instanceof Error ? e.message : e);
    return serverError("Não consegui escrever o roteiro agora. Tente de novo.");
  }
}
