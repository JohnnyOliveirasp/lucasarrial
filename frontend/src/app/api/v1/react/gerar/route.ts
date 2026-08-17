/**
 * POST /api/v1/react/gerar — coloca o Video React na fila (migração 76).
 * GET  ?job=<id>          — estado do job (a tela pergunta).
 *
 * Por que fila e não resposta direta: o clone roda no RunPod e leva minutos.
 * A rota faz o que é rápido (garante o mp4 do viral no R2) e registra o job;
 * o clone e a montagem acontecem em seguida, como no resto do app.
 */
import type { NextRequest } from "next/server";
import { gateAdmin } from "@/lib/admin/api";
import { badRequest, jsonOk, serverError } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { R2_BUCKETS } from "@/lib/r2/client";
import { deleteByPrefix } from "@/lib/r2/delete";
import { createPresignedGet } from "@/lib/r2/presigned";
import { baixarViral, marcarDownload } from "@/lib/virais/download";
import { marcarUsado } from "@/lib/virais/pessoal";
import {
  dispararClone,
  duracaoDeUrl,
  estadoClone,
  montarEEnviar,
  trazerParaR2,
} from "@/lib/react/gerar";
import type { LayoutMontagem } from "@/lib/react/montagem";
import {
  SUBTITLE_POSITIONS,
  SUBTITLE_PRESET_IDS,
  SUBTITLE_SIZES,
  type SubtitlePosition,
  type SubtitleSize,
} from "@/lib/video/subtitle-presets";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const LAYOUTS = new Set(["recorte", "viral-em-cima", "viral-embaixo"]);
/** Ritmo de fala em pt-BR (mesmo do roteiro). */
const PALAVRAS_POR_SEGUNDO = 2.5;

export async function POST(request: NextRequest) {
  const gate = await gateAdmin(request);
  if ("res" in gate) return gate.res;

  let b: Record<string, unknown>;
  try {
    b = (await request.json()) as Record<string, unknown>;
  } catch {
    return badRequest("Corpo inválido");
  }

  const viralId = typeof b.viral_id === "string" ? b.viral_id : "";
  const layout = typeof b.layout === "string" ? b.layout : "";
  const roteiro = typeof b.roteiro === "string" ? b.roteiro.trim() : "";
  const cta = typeof b.cta === "string" ? b.cta.trim() : "";
  const fotoUrl = typeof b.foto_url === "string" ? b.foto_url : null;
  const audioUrl = typeof b.audio_url === "string" ? b.audio_url : null;
  const fundoUrl = typeof b.fundo_url === "string" && b.fundo_url ? b.fundo_url : null;
  // Legenda: mesmos presets do editor de vídeo (validados pela lista oficial).
  const legendaEstilo =
    typeof b.legenda_estilo === "string" && SUBTITLE_PRESET_IDS.includes(b.legenda_estilo)
      ? b.legenda_estilo
      : "none";
  const legendaPosicao =
    typeof b.legenda_posicao === "string" &&
    SUBTITLE_POSITIONS.includes(b.legenda_posicao as SubtitlePosition)
      ? (b.legenda_posicao as SubtitlePosition)
      : null;
  const legendaTamanho =
    typeof b.legenda_tamanho === "string" &&
    SUBTITLE_SIZES.includes(b.legenda_tamanho as SubtitleSize)
      ? (b.legenda_tamanho as SubtitleSize)
      : null;

  if (!viralId) return badRequest("Faltou o vídeo.");
  if (!LAYOUTS.has(layout)) return badRequest("Layout inválido.");
  if (roteiro.length < 20) return badRequest("Roteiro curto demais.");
  if (!fotoUrl) return badRequest("Falta a foto preparada.");

  const admin = getAdmin();
  const userId = gate.auth.user_id;

  const { data: viral } = await admin
    .from("viral_videos")
    .select("id, url, duracao_seg")
    .eq("id", viralId)
    .maybeSingle();
  if (!viral?.url) return badRequest("Vídeo não encontrado no acervo.");

  // Trava anti-duplicata (caso Johnny 17/08): a tela mostrou estado velho de
  // "erro", ele apertou Gerar de novo e nasceu um SEGUNDO clone do mesmo
  // vídeo — pro aluno seria clone pago em dobro (105 cr/s). Já existe job em
  // voo pro mesmo viral? Devolve ELE em vez de abrir outro.
  const { data: emVoo } = await admin
    .from("react_jobs")
    .select("id, status, segundos")
    .eq("user_id", userId)
    .eq("viral_id", viralId)
    .in("status", ["fila", "baixando", "clonando", "montando"])
    .order("criado_em", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (emVoo) {
    return jsonOk({
      job_id: (emVoo as { id: string }).id,
      status: (emVoo as { status: string }).status,
      segundos: (emVoo as { segundos: number }).segundos,
      ja_existia: true,
    });
  }

  // A estimativa por palavras é só o plano B. Quem manda é o áudio: com a
  // conta `palavras ÷ 2,5` o clone saía curto e o vídeo cortava a fala no fim
  // (bug do 1º React, 14/08). Medimos o mp3 antes de pedir o clone.
  const palavras = [roteiro, cta].join(" ").trim().split(/\s+/).filter(Boolean).length;
  const estimado = Math.max(1, Math.round(palavras / PALAVRAS_POR_SEGUNDO));
  const medido = audioUrl ? await duracaoDeUrl(audioUrl) : null;
  const segundos = medido ? Math.ceil(medido + 0.35) : estimado;

  const { data: job, error } = await admin
    .from("react_jobs")
    .insert({
      user_id: userId,
      viral_id: viralId,
      layout,
      roteiro,
      cta: cta || null,
      foto_url: fotoUrl,
      audio_url: audioUrl,
      segundos,
      legenda_estilo: legendaEstilo,
      legenda_posicao: legendaPosicao,
      legenda_tamanho: legendaTamanho,
      status: "baixando",
    } as never)
    .select("id")
    .single();
  if (error || !job) {
    console.error("[react/gerar] insert", error?.message);
    return serverError("Não consegui criar o pedido.");
  }
  const jobId = (job as { id: string }).id;

  // O mp4 do viral é a única peça que dá pra garantir agora — e é rápida.
  // É AQUI que o arquivo nasce: guardar na prateleira nunca baixou nada.
  try {
    const { data: ja } = await admin
      .from("viral_user_videos")
      .select("r2_key, download_status")
      .eq("user_id", userId)
      .eq("viral_id", viralId)
      .maybeSingle();

    let r2Key = ja?.download_status === "pronto" ? ja.r2_key : null;
    if (!r2Key) {
      const baixado = await baixarViral({ url: viral.url, userId, viralId });
      r2Key = baixado.r2Key;
      await marcarDownload(admin, userId, viralId, { status: "pronto", r2Key });
    }
    // Vira "usado": alimenta o selo "N pessoas usando" na galeria.
    await marcarUsado(admin, userId, viralId);

    // A foto vem do Kie por URL temporária — traz pro nosso lado antes que
    // expire, e é ela (fundo verde) que vai pro clone.
    const fotoKey = await trazerParaR2(fotoUrl, `${userId}/react/${jobId}/avatar.png`, "image/png");
    const audioKey = audioUrl
      ? await trazerParaR2(audioUrl, `${userId}/react/${jobId}/fala.mp3`, "audio/mpeg")
      : null;
    if (!audioKey) {
      await admin
        .from("react_jobs")
        .update({ status: "erro", erro: "Falta o áudio da fala.", atualizado_em: new Date().toISOString() } as never)
        .eq("id", jobId);
      return badRequest("Gere o áudio antes (passo da voz).");
    }

    // Fundo do trecho final (opcional): sai da galeria de imagens do aluno.
    let fundoKey: string | null = null;
    if (fundoUrl) {
      try {
        fundoKey = await trazerParaR2(
          fundoUrl,
          `${userId}/react/${jobId}/fundo.png`,
          "image/png",
        );
      } catch {
        fundoKey = null; // fundo é enfeite: não derruba o pedido
      }
    }

    const cloneKey = `${userId}/react/${jobId}/clone.mp4`;
    const cloneJob = await dispararClone({ fotoKey, audioKey, saidaKey: cloneKey, segundos });

    await admin
      .from("react_jobs")
      .update({
        viral_r2_key: r2Key,
        foto_url: fotoKey,
        audio_url: audioKey,
        clone_job_id: cloneJob,
        clone_r2_key: cloneKey,
        fundo_key: fundoKey,
        status: "clonando",
        atualizado_em: new Date().toISOString(),
      } as never)
      .eq("id", jobId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "falha ao baixar o viral";
    await admin
      .from("react_jobs")
      .update({ status: "erro", erro: msg, atualizado_em: new Date().toISOString() } as never)
      .eq("id", jobId);
    return serverError(msg);
  }

  return jsonOk({ job_id: jobId, status: "clonando", segundos });
}

/**
 * DELETE ?job=<id> — joga o React fora (arquivos do R2 + a linha da fila).
 * Pedido do Johnny 15/08: "precisa aparecer um botão para deletar o vídeo".
 * Apaga o job inteiro pela pasta, não só o mp4 final: o clone, o avatar e a
 * fala daquele pedido não servem pra mais nada.
 */
export async function DELETE(request: NextRequest) {
  const gate = await gateAdmin(request);
  if ("res" in gate) return gate.res;
  const id = (request.nextUrl.searchParams.get("job") ?? "").trim();
  if (!id) return badRequest("Faltou o id do pedido.");

  const admin = getAdmin();
  const { data } = await admin
    .from("react_jobs")
    .select("id, status")
    .eq("id", id)
    .eq("user_id", gate.auth.user_id)
    .maybeSingle();
  if (!data) return badRequest("Pedido não encontrado.");

  try {
    await deleteByPrefix(R2_BUCKETS.generations, `${gate.auth.user_id}/react/${id}/`);
  } catch (e) {
    console.error("[react/gerar:delete] R2", e instanceof Error ? e.message : e);
    // Arquivo órfão é chato, mas travar o "apagar" é pior: segue e some da lista.
  }
  const { error } = await admin.from("react_jobs").delete().eq("id", id).eq("user_id", gate.auth.user_id);
  if (error) return serverError("Não consegui apagar o pedido.");
  return jsonOk({ apagado: id });
}

export async function GET(request: NextRequest) {
  const gate = await gateAdmin(request);
  if ("res" in gate) return gate.res;
  const pedido = (request.nextUrl.searchParams.get("job") ?? "").trim();

  const admin = getAdmin();
  const COLUNAS =
    "id, status, erro, r2_key, segundos, layout, viral_r2_key, clone_job_id, clone_r2_key, audio_url, viral_id, criado_em, legenda_estilo, legenda_posicao, legenda_tamanho, fundo_key";
  // Sem id = "tem algum pedido meu em voo?". A tela pergunta isso ao abrir:
  // o job do Johnny de 14/08 nasceu antes de o rascunho guardar o jobId e
  // ficou órfão — parado em "clonando" porque ninguém perguntava por ele.
  const { data } = pedido
    ? await admin
        .from("react_jobs")
        .select(COLUNAS)
        .eq("id", pedido)
        .eq("user_id", gate.auth.user_id)
        .maybeSingle()
    : await admin
        .from("react_jobs")
        .select(COLUNAS)
        .eq("user_id", gate.auth.user_id)
        .order("criado_em", { ascending: false })
        .limit(1)
        .maybeSingle();
  if (!data) return jsonOk({ job: null });
  const id = data.id;

  // Duração do viral: é ela que diz onde o vídeo acaba e começa o "só você".
  // A capa vem junto: é ela que a tela usa de miniatura enquanto monta.
  const { data: v } = await admin
    .from("viral_videos")
    .select("duracao_seg, thumb_url")
    .eq("id", data.viral_id)
    .maybeSingle();
  const viralSegundos = Number(v?.duracao_seg ?? 0) || 15;
  const thumbUrl = v?.thumb_url ?? null;

  /** Link tocável do vídeo pronto — sem isso a tela não tem o que mostrar. */
  async function comVideo<T extends { r2_key?: string | null }>(row: T) {
    const key = row.r2_key;
    const video_url = key
      ? await createPresignedGet(R2_BUCKETS.generations, key, 3600).catch(() => null)
      : null;
    return { ...row, video_url, thumb_url: thumbUrl };
  }

  // O job só anda quando alguém pergunta — mesmo padrão do Vídeo Clone.
  if (data.status === "clonando" && data.clone_job_id) {
    try {
      const st = await estadoClone(data.clone_job_id);
      if (st.status === "COMPLETED") {
        await admin
          .from("react_jobs")
          .update({ status: "montando", atualizado_em: new Date().toISOString() } as never)
          .eq("id", id);
        const saidaKey = `${gate.auth.user_id}/react/${id}/final.mp4`;
        const key = await montarEEnviar({
          viralKey: data.viral_r2_key!,
          cloneKey: data.clone_r2_key!,
          audioKey: data.audio_url!,
          layout: data.layout as LayoutMontagem,
          segundos: Number(data.segundos) || 20,
          viralSegundos: viralSegundos,
          saidaKey,
          legendaEstilo: data.legenda_estilo,
          legendaPosicao: data.legenda_posicao as SubtitlePosition | null,
          legendaTamanho: data.legenda_tamanho as SubtitleSize | null,
          fundoKey: data.fundo_key,
        });
        await admin
          .from("react_jobs")
          .update({ status: "pronto", r2_key: key, atualizado_em: new Date().toISOString() } as never)
          .eq("id", id);
        return jsonOk(await comVideo({ ...data, status: "pronto", r2_key: key }));
      }
      if (["FAILED", "CANCELLED", "TIMED_OUT"].includes(st.status)) {
        await admin
          .from("react_jobs")
          .update({
            status: "erro",
            erro: st.error ?? `clone ${st.status}`,
            atualizado_em: new Date().toISOString(),
          } as never)
          .eq("id", id);
        return jsonOk({ ...data, status: "erro", erro: st.error ?? st.status, thumb_url: thumbUrl });
      }
    } catch (e) {
      console.error("[react/gerar:get]", e instanceof Error ? e.message : e);
      await admin
        .from("react_jobs")
        .update({
          status: "erro",
          // O FIM da mensagem é onde mora o stderr do ffmpeg ("Command
          // failed: <comando>\n<stderr>") — guardar o começo escondia a
          // causa real (caso montagem 17/08, 2 falhas ilegíveis).
          erro:
            e instanceof Error
              ? (e.message.length > 600 ? "…" : "") + e.message.slice(-600)
              : "falha na montagem",
          atualizado_em: new Date().toISOString(),
        } as never)
        .eq("id", id);
      return jsonOk({ ...data, status: "erro" });
    }
  }

  return jsonOk(await comVideo(data));
}
