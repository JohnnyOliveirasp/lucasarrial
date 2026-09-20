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
import { inserirChamadoUnico } from "@/lib/incidents/gravar";
import { getTier } from "@/lib/video/tiers";

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

type CenaFalhada = {
  id: string;
  user_id: string;
  video_project_id: string;
  idx: number;
  video_tier: string | null;
};

/**
 * Abre (ou reaquece) UM chamado técnico por PROJETO quando o clipe de uma cena
 * falha. Best-effort: chamado é registro, nunca derruba o fluxo que o originou.
 *
 * POR QUE EXISTE (chamado #484, 19/09): esta era a ÚNICA perna de geração da
 * casa que falhava MUDA. As irmãs todas avisam — Animar Imagem, TTS, Vídeo
 * Clone e as três do Studio chamam `handleTechFailure`, e a perna de imagem
 * ainda guarda o erro cru em `kie_raw_error`. Aqui não havia chamado, nem
 * e-mail, nem coluna de erro cru: a mensagem do Kie era traduzida pra frase
 * amigável, gravada em `video_error` e o original morria no processo. Por isso
 * as 6 falhas seguidas do aluno em Bronze só chegaram à casa porque ele
 * reclamou no chat do app — e chegaram SEM a causa.
 *
 * POR QUE POR PROJETO E NÃO POR CENA: esta perna gera em LOTE (uma cena a cada
 * 5s de roteiro, dezenas delas) e, quando o titular do tier está ruim, o lote
 * inteiro falha junto. Um chamado por cena seria uma enxurrada; a assinatura
 * por projeto faz as N cenas — e as retentativas do aluno — virarem
 * OCORRÊNCIAS do mesmo cartão, que é o número que interessa a quem lê o quadro.
 *
 * LIMITE CONHECIDO E ACEITO: poll e webhook podem ver a MESMA falha e contar
 * duas ocorrências. Não há claim atômico aqui de propósito — o claim natural
 * ("só avisa quem tirou a cena de failed") silenciaria justamente o caso do
 * #484, porque o redespacho só marca `pending` DEPOIS que o Kie aceita: numa
 * falha de criação a cena continua `failed` da tentativa anterior, e da 2ª
 * tentativa em diante ninguém avisaria. Entre contar demais e ficar cego, a
 * casa prefere contar demais.
 */
async function abrirChamadoDeClipe(row: CenaFalhada, rawMessage: string): Promise<void> {
  try {
    const admin = getAdmin();
    const { data: profile } = await admin
      .from("profiles")
      .select("email")
      .eq("id", row.user_id)
      .maybeSingle();
    const email = (profile as { email?: string } | null)?.email ?? "(sem e-mail)";
    const tier = getTier(row.video_tier);
    const now = new Date().toISOString();

    await inserirChamadoUnico(admin, {
      kind: "generation",
      cause: "unknown",
      status: "open",
      signature: `video-scene-clip:${row.video_project_id}`,
      title:
        `Vídeo História: clipe de cena falhou${tier ? ` (${tier.label})` : ""} — ` +
        `${email} (projeto ${row.video_project_id.slice(0, 8)})`,
      occurrences: 1,
      affected_emails: [email],
      // CRU, como manda o #425: é por esta string que se descobre se foi 429,
      // timeout ou recusa de conteúdo. A frase de conforto fica em video_error.
      sample_error: rawMessage.slice(0, 1000),
      description:
        `Falhou o clipe da cena ${row.idx} do projeto ${row.video_project_id} ` +
        `(/app/videos/${row.video_project_id}), tier ${tier?.label ?? row.video_tier ?? "?"}. ` +
        `As demais cenas do MESMO projeto e as retentativas do aluno entram como ` +
        `ocorrências deste cartão.\n\n` +
        `⚠️ CONFERIR O EXTRATO À MÃO: esta perna NÃO tem estorno automático. O ` +
        `débito sai em /api/v1/videos/[id]/videos (ref_type "video_clips", ref_id = ` +
        `o PROJETO, lote agregado de started × preço do tier) e nada devolve quando ` +
        `o clipe falha depois de despachado — ao contrário do Animar Imagem, que ` +
        `estorna por "image_video_refund".\n\n` +
        `⚠️ Esta perna também NÃO tem o fallback de contingência: o titular do tier ` +
        `falhou e ninguém redespachou no reserva, então o aluno tende a repetir a ` +
        `tentativa no MESMO modelo que acabou de falhar.`,
      reported_by: "video-scene-clip",
      categoria: "tecnico",
      first_seen_at: now,
      last_seen_at: now,
    });
  } catch {
    /* best-effort: registro nunca derruba a entrega */
  }
}

/**
 * Marca o vídeo da cena como falha e ABRE O CHAMADO.
 *
 * Recebe o erro CRU — quem chama NÃO deve pré-traduzir. A tradução amigável
 * acontece só aqui (mesma regra que `images/video-sync.ts` já segue): entra
 * cru, sai cru pro diagnóstico e amigável pra tela.
 */
export async function failSceneVideo(sceneId: string, rawMessage: string): Promise<void> {
  const { data } = await getAdmin()
    .from("video_scenes")
    .update({ video_status: "failed", video_error: friendlyKieError(rawMessage).slice(0, 500) })
    .eq("id", sceneId)
    .select("id, user_id, video_project_id, idx, video_tier");

  const row = (data ?? [])[0] as unknown as CenaFalhada | undefined;
  if (!row) return;

  await abrirChamadoDeClipe(row, rawMessage);
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
    // CRU: friendlyKieError roda dentro de failSceneVideo (#425).
    await failSceneVideo(sceneId, info.failMsg || info.failCode || "geração falhou");
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
