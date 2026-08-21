/**
 * Resgate de voz parada em "uploading" com o áudio JÁ no R2. Server-only.
 *
 * 🐛 POR QUE EXISTE (achado 18/08, caso Fabio — 15 dias travado): o envio é
 * browser → R2 direto e só DEPOIS o browser chama `uploads-complete`, que é
 * quem grava raw_audio_paths e muda o status. Se a aba fecha, a rede cai ou o
 * celular dorme entre uma coisa e outra, os arquivos ficam no R2 e a voz fica
 * em "uploading" PARA SEMPRE — ninguém no servidor sabe que aquilo existe.
 * O aluno vê uma voz morta e some. Em 18/08 eram 26 vozes assim (13 alunos
 * sem nenhuma voz utilizável, 7 deles pagando).
 *
 * Aqui o servidor faz o que o browser não conseguiu: acha o áudio no R2 e
 * aplica a MESMA regra do uploads-complete (20min brutos = awaiting_training;
 * menos = rejected_too_short com o motivo). NÃO dispara treino e NÃO cobra —
 * quem decide treinar é o aluno, clicando.
 */
import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getAdmin } from "@/lib/db/admin";
import { r2, R2_BUCKETS } from "@/lib/r2/client";
import { createPresignedGet } from "@/lib/r2/presigned";
import { estimateSpeechSeconds } from "@/lib/audio/speech-estimate";
import type { VoiceStatus } from "@/lib/db/types";
import { MIN_TOTAL_SECONDS, mensagemCurtoDemais } from "@/lib/voices/regua-audio";

/** Só olha o que está parado há bastante tempo — upload grande demora. */
const STUCK_AFTER_MS = 30 * 60 * 1000;
/**
 * Linha sem NENHUM áudio no R2 e velha: o envio nunca começou. Apagar é o que
 * o POST /voices também faz (84f3197) — e é obrigatório aqui, senão essas
 * linhas voltam pra fila toda rodada e comem o teto, deixando quem TEM áudio
 * esperando pra sempre (foi o que aconteceu na 1ª limpeza, 18/08).
 */
const GHOST_AFTER_MS = 45 * 60 * 1000;
/** Teto por rodada: medir áudio custa CPU; o cron roda a cada 5min. */
const MAX_POR_RODADA = 3;
const MIN_BYTES = 10_000;
const EXT_AUDIO = /\.(mp3|wav|m4a|aac|ogg|opus|webm|mp4|flac)$/i;

export type RescueSummary = {
  checked: number;
  rescued: number;
  rejected: number;
  no_audio: number;
  /** linhas mortas (sem áudio nenhum) apagadas pra não entulhar a tela/fila */
  cleaned: number;
  errors: number;
};

/** Chaves de áudio que o browser subiu, na ordem do upload (prefixo NNN_). */
async function audiosNoR2(userId: string, voiceId: string): Promise<string[]> {
  const out = await r2.send(
    new ListObjectsV2Command({
      Bucket: R2_BUCKETS.voices,
      Prefix: `${userId}/${voiceId}/`,
    }),
  );
  return (out.Contents ?? [])
    .filter((o) => (o.Size ?? 0) > MIN_BYTES && EXT_AUDIO.test(o.Key ?? ""))
    .map((o) => o.Key as string)
    .sort();
}

export async function rescueStuckVoiceUploads(): Promise<RescueSummary> {
  const admin = getAdmin();
  const resumo: RescueSummary = {
    checked: 0, rescued: 0, rejected: 0, no_audio: 0, cleaned: 0, errors: 0,
  };

  const cutoff = new Date(Date.now() - STUCK_AFTER_MS).toISOString();
  const { data: paradas } = await admin
    .from("voices")
    .select("id, user_id, created_at")
    .eq("status", "uploading")
    .lt("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(MAX_POR_RODADA);

  for (const voz of (paradas ?? []) as {
    id: string;
    user_id: string;
    created_at: string;
  }[]) {
    resumo.checked += 1;
    try {
      const chaves = await audiosNoR2(voz.user_id, voz.id);
      if (chaves.length === 0) {
        // O aluno nunca chegou a subir nada — não há o que resgatar. Velha o
        // bastante = apaga (senão volta pra fila pra sempre e trava o teto).
        resumo.no_audio += 1;
        if (Date.now() - new Date(voz.created_at).getTime() > GHOST_AFTER_MS) {
          const { error } = await admin
            .from("voices")
            .delete()
            .eq("id", voz.id)
            .eq("status", "uploading");
          if (!error) resumo.cleaned += 1;
        }
        continue;
      }

      const urls = await Promise.all(
        chaves.map((k) => createPresignedGet(R2_BUCKETS.voices, k, 3600)),
      );
      const est = await estimateSpeechSeconds(urls);
      const total = est.reliable ? est.totalSeconds : 0;

      let status: VoiceStatus;
      let erro: string | null = null;
      if (!est.reliable) {
        // Medição falhou: não bloqueia ninguém — o start-training re-mede.
        status = "awaiting_training";
      } else if (total < MIN_TOTAL_SECONDS) {
        status = "rejected_too_short";
        erro = mensagemCurtoDemais(total);
      } else {
        status = "awaiting_training";
      }

      const { error } = await admin
        .from("voices")
        .update({
          raw_audio_paths: chaves,
          duration_seconds: total > 0 ? Math.round(total) : null,
          status,
          error_message: erro,
        })
        .eq("id", voz.id)
        .eq("status", "uploading"); // corrida com o browser: quem chegar primeiro
      if (error) throw new Error(error.message);

      if (status === "awaiting_training") resumo.rescued += 1;
      else resumo.rejected += 1;
      console.log(
        `[rescue-uploads] voz ${voz.id} (${chaves.length} áudios, ${Math.round(total / 60)}min) → ${status}`,
      );
    } catch (e) {
      resumo.errors += 1;
      console.error("[rescue-uploads]", voz.id, e instanceof Error ? e.message : e);
    }
  }
  return resumo;
}
