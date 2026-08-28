/**
 * Reenvio automático da geração que estourou o teto de execução (#15).
 *
 * POR QUE existe, com a prova de 28/08: o aluno viktoraraujo mandou 208 chars,
 * o job pendurou e morreu no teto (491s). Nove minutos depois ele refez o
 * MESMO texto (209 chars, mesma voz) e saiu em 89s. Em 17 ocorrências do #15
 * desde 30/07 o padrão é esse — texto curto pendurando até o teto, sem relação
 * com tamanho (média de 619 chars nos timeouts contra 626 do geral). Não é
 * régua: é worker travado. Refazer resolve, e até aqui quem refazia era o
 * aluno — depois de esperar 8 minutos e ver "falhou".
 *
 * O QUE FAZ: no caminho de falha (webhook e poll), quando o erro é
 * executionTimeout e a geração ainda está na 1ª tentativa, manda o MESMO input
 * pro RunPod num job novo e mantém a row como está. O aluno vê a geração
 * continuar; não há estorno nem novo débito, porque a geração é a mesma.
 *
 * LIMITES (de propósito):
 *  - UMA tentativa extra. `request_attempts` é o claim atômico: webhook e poll
 *    correm juntos e só um leva o reenvio. Se o reenvio também estourar, o
 *    caminho normal assume — falha, estorno e e-mail pro suporte, como hoje.
 *  - SÓ executionTimeout. Erro de worker (OOM, modelo, áudio) repetiria o
 *    mesmo defeito e só faria o aluno esperar em dobro.
 *  - Geração anterior à migration 99 não tem `request_params`: sem o input
 *    exato, não reenvia (reconstruir por default perderia o ritmo escolhido
 *    na tela). Cai no caminho de hoje.
 *
 * Nada aqui pode derrubar o estorno: qualquer erro devolve "nao_aplica" e o
 * chamador segue pro caminho de falha de sempre.
 */
import { getAdmin } from "@/lib/db/admin";
import { R2_BUCKETS } from "@/lib/r2/client";
import { createPresignedGet, createPresignedPut } from "@/lib/r2/presigned";
import { runpodSubmitInference, webhookUrlFor } from "@/lib/runpod/client";
import { faseTelemetriaInput } from "@/lib/generations/fase-telemetria";
import {
  ehTimeoutDeExecucao,
  inferenceExecutionTimeoutMs,
} from "@/lib/generations/execucao";

/** Envios ao RunPod por geração: o original + UM reenvio. */
const MAX_ENVIOS = 2;
const PRESIGN_EXPIRES = 60 * 60; // 1h, igual ao envio original

export type ResultadoReenvio =
  /** Job novo no ar; o chamador NÃO deve falhar a geração. */
  | "reenviado"
  /** Outro caminho (webhook×poll) levou o reenvio; o chamador para por aqui. */
  | "ja_tratado"
  /** Não é caso de reenvio; o chamador segue pro caminho de falha de hoje. */
  | "nao_aplica";

type GenRow = {
  voice_id: string | null;
  text_normalized: string | null;
  audio_path: string | null;
  reference_audio_path: string | null;
  request_params: Record<string, unknown> | null;
  request_attempts: number | null;
};

export async function tentarReenviar(
  generationId: string,
  rawError: string,
): Promise<ResultadoReenvio> {
  if (!ehTimeoutDeExecucao(rawError)) return "nao_aplica";
  try {
    const admin = getAdmin();
    const { data } = await admin
      .from("generations")
      .select(
        "voice_id, text_normalized, audio_path, reference_audio_path, request_params, request_attempts",
      )
      .eq("id", generationId)
      .maybeSingle();
    const gen = data as GenRow | null;
    if (!gen?.request_params || !gen.audio_path) return "nao_aplica";

    const tentativas = gen.request_attempts ?? 1;
    if (tentativas >= MAX_ENVIOS) return "nao_aplica";

    // CLAIM ATÔMICO antes de falar com a RunPod: as duas condições juntas
    // (tentativa atual + ainda em andamento) garantem que webhook e poll não
    // disparem dois jobs pro mesmo texto. A row NÃO passa por "failed" — o
    // aluno continua vendo a geração andar.
    const { data: claim } = await admin
      .from("generations")
      .update({ status: "pending", request_attempts: tentativas + 1 } as never)
      .eq("id", generationId)
      .eq("request_attempts", tentativas)
      .in("status", ["pending", "generating"])
      .select("voice_id");
    if (!claim || claim.length === 0) return "ja_tratado";

    // URLs assinadas expiram — são as únicas partes do input refeitas aqui.
    // As chaves vêm da própria geração (saída e referência) e da voz (LoRA).
    let loraPath: string | null = null;
    if (gen.voice_id) {
      const { data: voice } = await admin
        .from("voices")
        .select("lora_path")
        .eq("id", gen.voice_id)
        .maybeSingle();
      loraPath = (voice as { lora_path?: string | null } | null)?.lora_path ?? null;
    }

    const input: Record<string, unknown> = {
      ...gen.request_params,
      output_upload_url: await createPresignedPut(
        R2_BUCKETS.generations,
        gen.audio_path,
        "audio/wav",
        PRESIGN_EXPIRES,
      ),
      ...faseTelemetriaInput(generationId),
    };
    if (loraPath) {
      input.lora_url = await createPresignedGet(R2_BUCKETS.voices, loraPath, PRESIGN_EXPIRES);
    }
    if (gen.reference_audio_path) {
      input.prompt_wav_url = await createPresignedGet(
        R2_BUCKETS.voices,
        gen.reference_audio_path,
        PRESIGN_EXPIRES,
      );
    }

    const job = await runpodSubmitInference(input, {
      webhook: webhookUrlFor("generation"),
      executionTimeoutMs: inferenceExecutionTimeoutMs((gen.text_normalized ?? "").length),
    });

    // Só agora o job velho deixa de valer: o webhook atrasado dele chega com
    // outro id e o gate de status já terá mudado de mãos.
    await admin
      .from("generations")
      .update({ runpod_job_id: job.id } as never)
      .eq("id", generationId);

    console.log(`[generations/reenviar] #15 reenviado ${generationId} -> job ${job.id}`);
    return "reenviado";
  } catch (e) {
    // Devolveu o claim? Não: a row segue "pending" com attempts=2, e o
    // chamador cai no caminho de falha, que reivindica por status e estorna.
    console.error(
      "[generations/reenviar]",
      e instanceof Error ? e.message : e,
    );
    return "nao_aplica";
  }
}
