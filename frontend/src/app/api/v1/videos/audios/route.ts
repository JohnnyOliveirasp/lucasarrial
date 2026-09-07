/**
 * /api/v1/videos/audios
 *   GET → lista os áudios PRONTOS do aluno (status=ready, com duração medida,
 *         fora a amostra do treino). Com nome da voz + presigned URL.
 *
 * Passo 1 do wizard ("escolher áudio") e seletor do Vídeo Clone.
 *
 * ⚠️ O corte de duração NÃO acontece mais aqui (era `.lte(MAX_AUDIO_SECONDS)`).
 * Motivo: filtrar no SQL fazia o áudio acima do teto SUMIR da tela sem uma
 * palavra — o aluno com um áudio de 2min28 lia "você ainda não tem áudios" e
 * abria chamado (caso #adc3ed99, sidneysantos100). Medido em 07/09: 304 de
 * 3.532 áudios prontos passam de 90s, atingindo 136 alunos — 22 deles SÓ têm
 * áudio longo, ou seja, viam o estado vazio com o acervo cheio e íntegro.
 *
 * O teto continua valendo, em dois lugares que não mudaram: a TELA marca o
 * áudio longo como indisponível com o motivo ao lado (quem decide é
 * lib/video/audio-eligibility, com o MESMO corte estrito que o SQL fazia), e o
 * POST que cria o vídeo recusa com 400 (videos/route.ts e video-clone/route.ts).
 * A rota só parou de esconder linha.
 */
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { jsonOk, serverError, unauthorized } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { R2_BUCKETS } from "@/lib/r2/client";
import { createPresignedGet } from "@/lib/r2/presigned";

export async function GET(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();

  const admin = getAdmin();
  // A amostra automática do treino (`${userId}/${voiceId}/sample.wav`, criada
  // pelo finalize-training pro aluno OUVIR a voz) NÃO é insumo de vídeo: é uma
  // frase fixa de ~10s ("Oi! Esta é a minha voz clonada..."). 65 alunos já
  // fizeram lip-sync em cima dela achando que era áudio deles (caso itamar,
  // 25-26/07) e o vídeo sai "ruim" sem nenhum erro no log. Filtro pelo PATH,
  // não pelo name: o path é determinístico e o aluno consegue renomear a linha.
  const { data: gens, error } = await admin
    .from("generations")
    .select("id, voice_id, name, text_raw, duration_seconds, audio_path, created_at")
    .eq("user_id", auth.user_id)
    .eq("status", "ready")
    .not("duration_seconds", "is", null)
    .not("audio_path", "like", "%/sample.wav")
    .order("created_at", { ascending: false });

  if (error) return serverError("Failed to list audios");
  const rows = gens ?? [];

  // Nomes das vozes (uma query, mapeada).
  const voiceIds = [...new Set(rows.map((g) => g.voice_id))];
  const nameById = new Map<string, string>();
  if (voiceIds.length) {
    const { data: voices } = await admin.from("voices").select("id, name").in("id", voiceIds);
    for (const v of voices ?? []) nameById.set(v.id, v.name);
  }

  const items = await Promise.all(
    rows.map(async (g) => {
      let audio_url: string | null = null;
      if (g.audio_path) {
        try {
          audio_url = await createPresignedGet(R2_BUCKETS.generations, g.audio_path, 60 * 60);
        } catch {
          audio_url = null;
        }
      }
      return {
        id: g.id,
        voice_name: nameById.get(g.voice_id) ?? "—",
        name: g.name,
        text_raw: g.text_raw,
        duration_seconds: g.duration_seconds,
        created_at: g.created_at,
        audio_url,
      };
    }),
  );

  return jsonOk({ audios: items });
}
