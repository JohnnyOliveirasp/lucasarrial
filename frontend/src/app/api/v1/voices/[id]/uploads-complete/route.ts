/**
 * POST /api/v1/voices/[id]/uploads-complete
 *
 * Frontend chama depois de fazer PUTs nas presigned URLs. Body:
 *   {
 *     uploaded_keys: string[]        // chaves R2 que foram subidas
 *     client_durations?: number[]    // duração medida no browser por arquivo (seconds)
 *   }
 *
 * ⚠️ `uploaded_keys` é ALEGAÇÃO, não fato (caso Hellen Grasso #526, 23/09):
 * o browser deu 7 PUTs por bem-sucedidos e só 2 objetos existiam no bucket.
 * Esta rota confiava na alegação, somava as durações medidas na TELA (dos 7)
 * e recusava por "áudio muito curto" — culpando a aluna por 5 arquivos que o
 * NOSSO envio perdeu em silêncio. Agora o bucket é conferido ANTES de
 * qualquer régua: faltou arquivo → 409 `upload_incomplete` nomeando o que
 * faltou, a voz CONTINUA em `uploading` e a tela reenvia só os faltantes.
 * (Se o aluno fechar a aba, o `rescue-stuck-uploads` segue de rede de
 * segurança — é a mesma classe de conferência que ele faz.)
 *
 * Validação Slice 2: soma client_durations >= MIN_TOTAL_SECONDS — mas SÓ
 * quando todos os arquivos chegaram (a decisão inteira mora em
 * `decidirDesfechoEnvio`, pura e testada).
 * Slice 3 vai re-validar no worker RunPod com Demucs+VAD reais.
 */
import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import {
  badRequest,
  jsonError,
  jsonOk,
  notFound,
  serverError,
  unauthorized,
} from "@/lib/api/responses";
import { decidirDesfechoEnvio } from "@/lib/audio/desfecho-envio";
import { getAdmin } from "@/lib/db/admin";
import type { VoiceStatus } from "@/lib/db/types";
import { r2, R2_BUCKETS } from "@/lib/r2/client";

type Ctx = { params: Promise<{ id: string }> };
type Body = {
  uploaded_keys: string[];
  client_durations?: number[];
};

export async function POST(request: NextRequest, ctx: Ctx) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();
  const { id } = await ctx.params;

  let body: Body;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  if (!Array.isArray(body.uploaded_keys) || body.uploaded_keys.length === 0) {
    return badRequest("'uploaded_keys' must be a non-empty array");
  }

  const admin = getAdmin();

  const { data: existing, error: loadErr } = await admin
    .from("voices")
    .select("id, status")
    .eq("id", id)
    .eq("user_id", auth.user_id)
    .maybeSingle();

  if (loadErr) return serverError("Failed to load voice");
  if (!existing) return notFound("Voice");
  if (existing.status !== "uploading") {
    return badRequest(
      `Voice status is '${existing.status}', cannot mark uploads complete`,
    );
  }

  // O que REALMENTE existe no bucket pra esta voz. `null` = a listagem
  // falhou: sem prova de perda não se acusa perda, e a decisão degrada pro
  // comportamento antigo (confiar na alegação) em vez de travar o aluno no
  // fim de um upload longo por uma falha transiente nossa.
  let objetosNoR2: Array<{ key: string; size: number }> | null = null;
  try {
    const out = await r2.send(
      new ListObjectsV2Command({
        Bucket: R2_BUCKETS.voices,
        Prefix: `${auth.user_id}/${id}/`,
      }),
    );
    objetosNoR2 = (out.Contents ?? []).map((o) => ({
      key: o.Key ?? "",
      size: o.Size ?? 0,
    }));
  } catch (e) {
    console.error(
      `[uploads-complete] listagem do R2 falhou pra voz ${id} — seguindo SEM conferência de chegada (comportamento antigo):`,
      e instanceof Error ? e.message : e,
    );
  }

  // Slice 2: validação de duração via medição do browser.
  const durations = Array.isArray(body.client_durations) ? body.client_durations : [];
  const totalSec = durations
    .filter((d): d is number => typeof d === "number" && Number.isFinite(d) && d > 0)
    .reduce((acc, d) => acc + d, 0);

  const desfecho = decidirDesfechoEnvio({
    chavesEsperadas: body.uploaded_keys,
    objetosNoR2,
    totalSegundos: totalSec,
    temMedicao: durations.length > 0,
  });

  if (desfecho.tipo === "envio_incompleto") {
    // Nada é gravado: a voz fica em `uploading` e o browser reenvia só o que
    // faltou (os presigned valem 6h) e chama esta rota de novo. Recusar aqui
    // com `rejected_too_short` era o bug — a duração de um envio pela metade
    // não mede a fala do aluno, mede a nossa perda.
    console.warn(
      `[uploads-complete] ENVIO INCOMPLETO voz ${id}: chegaram ${desfecho.chegaram} de ${desfecho.esperados} arquivos (faltam: ${desfecho.nomesFaltando.join(", ")})`,
    );
    return jsonError("upload_incomplete", desfecho.mensagem, 409, {
      esperados: desfecho.esperados,
      chegaram: desfecho.chegaram,
      missing_keys: desfecho.chavesFaltando,
      missing_names: desfecho.nomesFaltando,
    });
  }

  let nextStatus: VoiceStatus;
  let errorMessage: string | null = null;

  if (desfecho.tipo === "sem_medicao") {
    // Não medimos — passa pra "validating", Slice 3 valida no worker
    nextStatus = "validating";
  } else if (desfecho.tipo === "curto_demais") {
    // Todos os arquivos confirmados no bucket — só assim a régua de duração
    // tem licença pra falar (regra 2 do desfecho-envio).
    nextStatus = "rejected_too_short";
    errorMessage = desfecho.mensagem;
  } else {
    nextStatus = "awaiting_training";
  }

  const { data, error } = await admin
    .from("voices")
    .update({
      raw_audio_paths: body.uploaded_keys,
      duration_seconds: totalSec > 0 ? Math.round(totalSec) : null,
      status: nextStatus,
      error_message: errorMessage,
    })
    .eq("id", id)
    .eq("user_id", auth.user_id)
    .select("id, status, duration_seconds, raw_audio_paths, error_message")
    .single();

  if (error || !data) return serverError("Failed to update voice");
  return jsonOk({ voice: data });
}
