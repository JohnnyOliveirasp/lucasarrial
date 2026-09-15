/**
 * POST /api/v1/video-clone/transcribe
 * Transcreve (Whisper) um áudio RECÉM-ENVIADO pro Vídeo Clone e devolve
 * { text, duration_seconds } — pra pessoa VER o que o áudio fala antes de
 * gastar créditos. A validação definitiva continua no POST /video-clone.
 */
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { badRequest, jsonOk, serverError, unauthorized } from "@/lib/api/responses";
import { falhaDeAudio, recusaPorDuracao, transcribeUploadedAudio } from "@/lib/video/transcribe";
import { CLONE_MAX_AUDIO_SECONDS } from "@/lib/video-clone/config";

export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();

  let body: { audio_key?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return badRequest("Corpo inválido");
  }
  const audioKey = typeof body.audio_key === "string" ? body.audio_key.trim() : "";
  if (!audioKey.startsWith(`${auth.user_id}/video-clone/uploads/`)) {
    return badRequest("Áudio inválido.");
  }

  try {
    // A guarda de TAMANHO (25 MB, dentro do transcribeUploadedAudio) não
    // substitui esta: quem decide os 90s é a duração medida pelo Whisper.
    const t = await transcribeUploadedAudio(audioKey);
    const recusa = recusaPorDuracao(t.durationSeconds, CLONE_MAX_AUDIO_SECONDS);
    if (recusa) return badRequest(recusa);
    return jsonOk({ text: t.text, duration_seconds: t.durationSeconds });
  } catch (e) {
    // Incidente #251: este `catch` era MUDO e DESTRUÍA o erro do Whisper/R2 —
    // o aluno ficava com a prévia girando pra sempre e não sobrava NADA no log
    // pra descobrir por quê. O rastro deste PR FICA.
    console.error("[video-clone/transcribe] falhou:", {
      audio_key: audioKey,
      user_id: auth.user_id,
      erro: e instanceof Error ? (e.stack ?? e.message) : String(e),
    });
    // ⚠️ A MENSAGEM devolvida é a da main (`falhaDeAudio`), NÃO o texto genérico
    // que este PR propunha. A main evoluiu depois que este PR foi aberto: o
    // `falhaDeAudio` distingue 413 (>25 MB) e 400 (formato) e devolve frase
    // ÚTIL pro aluno, enquanto "Tente novamente" mandaria repetir o que vai
    // falhar igual. Ficam as duas metades boas: rastro no log daqui, mensagem
    // da main. (Caso valdirtrentotrg, 15/09 — MP4 de 60min.)
    return serverError(
      falhaDeAudio(e, { rota: "video-clone/transcribe", user: auth.user_id, audioKey }),
    );
  }
}
