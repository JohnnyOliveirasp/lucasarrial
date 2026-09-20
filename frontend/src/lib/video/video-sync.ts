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
import { addExtraCredits } from "@/lib/credits/service";

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
  video_credits_cost: number | null;
};

const CENA_CAMPOS = "id, user_id, video_project_id, idx, video_tier, video_credits_cost";

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
        `O estorno desta tentativa é AUTOMÁTICO desde o #485 (ref_type ` +
        `"video_clip_refund", ref_id = a CENA, valor = video_credits_cost). Se o ` +
        `extrato do aluno não tiver a linha, foi porque nada tinha sido cobrado ` +
        `nesta tentativa — não porque a casa ficou com o dinheiro.\n\n` +
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
 * Devolve o que ESTA tentativa cobrou, e só ela.
 *
 * POR QUE NÃO DÁ PRA USAR O `handleTechFailure` DAS IRMÃS (#485, medido em
 * produção em 20/09): aquele caminho chama `refundOriginalDebit`, que devolve o
 * VALOR INTEIRO do débito casado por `(user_id, ref_type, ref_id)`. Serve pra
 * Animar Imagem porque lá 1 débito = 1 imagem. Aqui não: o débito do lote
 * (`/api/v1/videos/[id]/videos`, ref_type "video_clips") tem `ref_id` = o
 * PROJETO e valor `started × costPer`, ou seja N cenas numa linha só. Estornar
 * por ele devolveria o lote inteiro na PRIMEIRA cena que falhasse — inclusive as
 * que deram certo. Isso é estorno a MAIOR, que é dar dinheiro que não era do
 * aluno, e é por isso que esta perna ficou sem estorno em vez de copiar a irmã.
 *
 * O valor certo já está gravado na própria linha da cena:
 * `video_scenes.video_credits_cost`, escrito por `generate-scene-video.ts` como
 * `billed ? costPer : 0`. Ele é exato pras DUAS pernas (o lote e o
 * `video_clip_regen`, que cobram o mesmo `costPer` por cena) e já vem 0 quando a
 * geração foi por conta da casa — então conta da casa não vira estorno de graça
 * (regra 8 das regras duras).
 */
async function estornarClipeDaCena(row: CenaFalhada): Promise<void> {
  const valor = row.video_credits_cost ?? 0;
  if (valor <= 0) return; // nada foi cobrado nesta tentativa (conta da casa / não faturado)
  try {
    await addExtraCredits({
      userId: row.user_id,
      amount: valor,
      refType: "video_clip_refund",
      refId: row.id,
    });
  } catch {
    /* best-effort: o estorno nunca derruba o fluxo que o originou */
  }
}

/**
 * Marca o vídeo da cena como falha, ESTORNA a tentativa e ABRE O CHAMADO.
 *
 * Recebe o erro CRU — quem chama NÃO deve pré-traduzir. A tradução amigável
 * acontece só aqui (mesma regra que `images/video-sync.ts` já segue): entra
 * cru, sai cru pro diagnóstico e amigável pra tela.
 *
 * ⚠️ AS DUAS METADES TÊM GARANTIAS OPOSTAS, E ISSO É DE PROPÓSITO (#485):
 *
 * - O **estorno** precisa de EXATAMENTE-UMA-VEZ: poll e webhook enxergam a
 *   mesma falha, e pagar duas vezes é dinheiro saindo errado. Por isso ele anda
 *   pendurado no CLAIM ATÔMICO (`.in(["pending","generating"])`): só quem
 *   realmente virou a linha devolve.
 * - O **chamado** precisa de PELO-MENOS-UMA-VEZ, e o comentário de
 *   `abrirChamadoDeClipe` explica por quê: da 2ª tentativa em diante a cena já
 *   está `failed`, o claim não casaria e o #484 voltaria a ser mudo. Contar
 *   ocorrência demais é barato; ficar cego não é.
 *
 * Quem perde o claim, então, NÃO estorna mas AINDA abre chamado. Misturar as
 * duas garantias numa só é o erro que este comentário existe pra impedir.
 *
 * O claim também é o que torna o estorno correto na RETENTATIVA: o redespacho
 * põe a cena de volta em `pending`, então a próxima falha ganha o claim e
 * devolve de novo — que é o certo, porque o aluno pagou de novo.
 *
 * ⚠️ `cobrado` DIZ SE ESTA TENTATIVA CHEGOU A COBRAR, e não é detalhe:
 * `video_credits_cost` só é escrito quando o Kie ACEITA a tarefa
 * (`generate-scene-video.ts`), e as duas pernas de débito só cobram depois
 * disso. Numa falha de CRIAÇÃO nada foi cobrado, mas a linha pode carregar o
 * custo VELHO de uma tentativa anterior — e, se a cena ainda estiver `pending`
 * daquela tentativa em voo, o claim casaria e a casa devolveria um débito que
 * ainda vai ser entregue. Por isso quem chama declara: `syncSceneVideo` (falha
 * assíncrona do que já foi despachado) passa `true`; `startSceneVideo` (o Kie
 * recusou, ninguém pagou) passa `false`.
 */
export async function failSceneVideo(
  sceneId: string,
  rawMessage: string,
  opts: { cobrado: boolean },
): Promise<void> {
  const admin = getAdmin();
  const friendly = friendlyKieError(rawMessage).slice(0, 500);
  const marcar = { video_status: "failed" as const, video_error: friendly };

  const { data: claimed } = await admin
    .from("video_scenes")
    .update(marcar)
    .eq("id", sceneId)
    .in("video_status", ["pending", "generating"])
    .select(CENA_CAMPOS);

  let row = (claimed ?? [])[0] as unknown as CenaFalhada | undefined;

  if (row) {
    if (opts.cobrado) await estornarClipeDaCena(row);
  } else {
    // Não ganhou o claim (corrida, ou cena que já estava `failed` de uma
    // tentativa anterior): mantém a escrita do estado como era antes do #485,
    // sem estornar — nesta tentativa não houve débito novo pra devolver.
    const { data } = await admin
      .from("video_scenes")
      .update(marcar)
      .eq("id", sceneId)
      .select(CENA_CAMPOS);
    row = (data ?? [])[0] as unknown as CenaFalhada | undefined;
  }

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
      await failSceneVideo(sceneId, "Kie retornou sucesso sem vídeo", { cobrado: true });
      return;
    }
    try {
      await finalizeSceneVideo(sceneId, userId, projectId, url);
    } catch (e) {
      await failSceneVideo(
        sceneId,
        e instanceof Error ? `salvar resultado: ${e.message}` : "salvar resultado falhou",
        { cobrado: true },
      );
    }
    return;
  }

  if (info.state === "fail") {
    // CRU: friendlyKieError roda dentro de failSceneVideo (#425).
    await failSceneVideo(sceneId, info.failMsg || info.failCode || "geração falhou", {
      cobrado: true,
    });
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
