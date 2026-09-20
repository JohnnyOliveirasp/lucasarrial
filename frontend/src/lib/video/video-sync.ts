/**
 * Finaliza/sincroniza o CLIPE de vídeo de uma cena com o Kie — espelha
 * image-sync, mas grava em `video_scenes` (colunas video_*). Baixa o mp4 do Kie
 * e guarda no R2 (permanente; vira insumo da montagem final), servido via
 * presigned GET. Usado pelo poll (GET .../videos) e pelo webhook. Server-only.
 */
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { r2, imagesBucket } from "@/lib/r2/client";
import { getAdmin } from "@/lib/db/admin";
import { kieGetTask, friendlyKieError } from "@/lib/kie/client";
import { stripAudioTrack } from "@/lib/video/strip-audio";
import { addExtraCredits } from "@/lib/credits/service";
import { estornarRegenDaCena } from "@/lib/video/estorno-cena-regen";

function pickExt(url: string, contentType: string | null): string {
  if (contentType?.includes("webm")) return "webm";
  if (contentType?.includes("quicktime") || contentType?.includes("mov")) return "mov";
  const m = url.split("?")[0].match(/\.([a-z0-9]+)$/i);
  const ext = m?.[1]?.toLowerCase();
  if (ext && ["mp4", "webm", "mov"].includes(ext)) return ext;
  return "mp4";
}

function contentTypeFor(ext: string): string {
  if (ext === "webm") return "video/webm";
  if (ext === "mov") return "video/quicktime";
  return "video/mp4";
}

/** Key permanente do clipe da cena no R2. */
export function sceneVideoKey(userId: string, projectId: string, sceneId: string, ext: string): string {
  return `${userId}/videos/${projectId}/scenes/${sceneId}/clip.${ext}`;
}

/** Baixa o resultado (Kie), sobe pro R2 e marca a cena como ready. Lança em erro. */
export async function finalizeSceneVideo(
  sceneId: string,
  userId: string,
  projectId: string,
  resultUrl: string,
): Promise<void> {
  const res = await fetch(resultUrl, { cache: "no-store" });
  if (!res.ok) throw new Error(`download result ${res.status}`);

  const contentType = res.headers.get("content-type");
  const ext = pickExt(resultUrl, contentType);
  const baixado = Buffer.from(await res.arrayBuffer());
  const key = sceneVideoKey(userId, projectId, sceneId, ext);

  // Tira a faixa de áudio ANTES de subir (mesmo tratamento do Animar Imagem,
  // incidente #236 / PR #155). A cena usa os MESMOS modelos do Kie e o defeito
  // se repete aqui: MEDIDO em 03/09 sobre clipes já em produção — 24/24 bronze
  // (grok) e 11/11 prata (kling) subiram COM faixa aac, várias com pico de
  // -2,7 dBFS (som alto, não resíduo); 8/8 gold (seedance) já sobem mudos,
  // porque só a família seedance tem `generate_audio` em `buildVideoInput`.
  // Grok, Kling v3-turbo e Hailuo 2.3 têm input fechado, sem campo de áudio,
  // e o fallback de contingência troca o modelo por baixo (bronze→hailuo,
  // gold→kling) — então gatear por tier não protege e o corte é incondicional.
  //
  // Onde isso aparecia pro aluno: `video-scene-grid.tsx` toca o clipe com
  // `controls` e SEM `muted`, na tela de aprovação das cenas.
  //
  // SEGURO PARA A MONTAGEM FINAL (conferido em `render/worker.mjs` antes de
  // aplicar): o worker já normaliza cada clipe com `-an` e monta o áudio final
  // a partir do TTS (`-map 1:a` do audio.mp3), ou com `-an` quando
  // `sem_narracao`. A trilha final NUNCA vem do clipe da cena, então remover a
  // faixa aqui não muda um byte do render. Medido no clipe real 2576c81e: o
  // h264 sai com o MESMO md5 e o quadro normalizado pelo worker também.
  //
  // Efeito colateral medido e aceito: o `-c copy -an` usa a seleção padrão do
  // ffmpeg e, junto com o áudio, descarta a CAPA embutida (stream mjpeg com
  // `attached_pic=1`) que o Grok manda. Não faz falta — o pôster do player vem
  // de `scene.image_url` (a imagem da cena no R2), não da capa do contêiner —
  // e ainda deixa a escolha de stream do worker sem ambiguidade.
  //
  // Nunca lança: se o ffmpeg falhar, volta o original e a entrega segue.
  const bytes = await stripAudioTrack(baixado, ext);

  await r2.send(
    new PutObjectCommand({
      Bucket: imagesBucket(),
      Key: key,
      Body: bytes,
      ContentType: contentTypeFor(ext),
    }),
  );

  await getAdmin()
    .from("video_scenes")
    .update({ video_status: "ready", video_path: key, video_error: null })
    .eq("id", sceneId);
}

/** Estados em que a cena ainda está em andamento — os únicos falháveis. */
const STATUS_CENA_EM_ANDAMENTO = ["pending", "generating"] as const;

/**
 * Marca o vídeo da cena como falha + ESTORNO AUTOMÁTICO da regeração.
 *
 * O caso que originou isto (#485, medido 20/09): esta função só escrevia
 * `failed` e ia embora. Resultado — `video_clip_regen` acumulou 301 débitos
 * (−781.180 cr) desde 07/07 com ZERO estornos, enquanto o irmão Animar Imagem
 * (`lib/images/video-sync.ts:120-130`) devolvia desde 11/07.
 *
 * O desenho é o mesmo do irmão: TRANSIÇÃO IDEMPOTENTE primeiro — só quem tira
 * a cena de `pending`/`generating` dispara a contingência, o que fecha a
 * corrida webhook × poll. Quem perdeu a corrida (ou chegou com a cena já
 * `failed`/`ready`) só atualiza o texto do erro e sai sem tocar em dinheiro.
 *
 * ⚠️ SÓ a perna `video_clip_regen` é estornada aqui, e não é preguiça: nela o
 * `ref_id` do débito é a própria cena (1:1). O débito de `video_clips` é
 * AGREGADO por projeto (videos/route.ts:211-220) e devolver por cena a partir
 * dele exige mudar a granularidade do débito — decisão de produto, fora deste
 * conserto. Enquanto isso, uma cena que falhou na PRIMEIRA leva continua sem
 * estorno automático; o aluno recupera clicando em Regerar (aí sim 1:1).
 *
 * LANÇA se o estorno falhar, e antes disso devolve a cena pro estado anterior
 * pra que o próximo poll/webhook tente de novo. É de propósito: cena sem marcar
 * é um incômodo visível e recuperável; crédito sumindo em silêncio é o defeito
 * que este arquivo está consertando.
 */
export async function failSceneVideo(sceneId: string, message: string): Promise<void> {
  const admin = getAdmin();
  const erro = message.slice(0, 500);

  const { data: claimed } = await admin
    .from("video_scenes")
    .update({ video_status: "failed", video_error: erro })
    .eq("id", sceneId)
    .in("video_status", STATUS_CENA_EM_ANDAMENTO)
    .select("id, user_id");
  const cena = (claimed ?? [])[0] as { id: string; user_id: string } | undefined;
  if (!cena) {
    // Não venceu a transição. Dois motivos possíveis, e nenhum estorna:
    //  · outra via (webhook × poll) já falhou esta cena e já cuidou do estorno;
    //  · falha PRÉ-despacho (generate-scene-video.ts), quando a cena ainda está
    //    `ready` de um clipe anterior ou nula — e aí não houve débito nenhum,
    //    porque o débito do regen só é gravado depois do "started".
    // Em ambos, o texto do erro ainda precisa chegar ao aluno.
    await admin
      .from("video_scenes")
      .update({ video_status: "failed", video_error: erro })
      .eq("id", sceneId);
    return;
  }

  try {
    const r = await estornarRegenDaCena(
      { admin, creditar: addExtraCredits },
      { userId: cena.user_id, sceneId },
    );
    // Log nos DOIS desfechos: "não estornei" é a decisão que mais precisa de
    // rastro — foi a ausência dela que deixou o #485 rodar calado desde 07/07.
    console.warn(
      `[video-sync] cena ${sceneId} falhou — estorno ${r.aplicado ? "APLICADO" : "não"}: ${r.motivo}`,
    );
  } catch (e) {
    const detalhe = e instanceof Error ? e.message : String(e);
    console.error(`[video-sync] ESTORNO FALHOU na cena ${sceneId}: ${detalhe}`);
    // Desfaz a marcação pra que a próxima passada do poll/webhook reentre aqui
    // e tente devolver de novo. Guardado por `video_status = failed` pra não
    // atropelar um estado que outra via tenha escrito nesse meio-tempo.
    try {
      await admin
        .from("video_scenes")
        .update({ video_status: "pending" })
        .eq("id", sceneId)
        .eq("video_status", "failed");
    } catch {
      // Best-effort: se nem desfazer der, o erro original é o que importa.
    }
    throw e;
  }
}

/** Consulta o Kie e atualiza o vídeo da cena (poll/webhook). */
export async function syncSceneVideo(
  sceneId: string,
  userId: string,
  projectId: string,
  taskId: string,
): Promise<void> {
  const info = await kieGetTask(taskId);

  if (info.state === "success") {
    const url = info.resultUrls[0];
    if (!url) {
      await failSceneVideo(sceneId, "Kie retornou sucesso sem vídeo");
      return;
    }
    try {
      await finalizeSceneVideo(sceneId, userId, projectId, url);
    } catch (e) {
      await failSceneVideo(
        sceneId,
        e instanceof Error ? `salvar resultado: ${e.message}` : "salvar resultado falhou",
      );
    }
    return;
  }

  if (info.state === "fail") {
    await failSceneVideo(sceneId, friendlyKieError(info.failMsg || info.failCode || "geração falhou"));
    return;
  }

  if (info.state === "generating") {
    await getAdmin()
      .from("video_scenes")
      .update({ video_status: "generating" })
      .eq("id", sceneId)
      .in("video_status", ["pending"]);
  }
}
