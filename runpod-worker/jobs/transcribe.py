"""Job de TRANSCRICAO (backfill): audio existente -> texto da referencia."""
from __future__ import annotations

from downloads import ensure_local_from_url
from whisper_qa import transcribe_with_retry
from worker_config import WORKSPACE


def handle_transcribe(inp: dict) -> dict:
    """Baixa um áudio (audio_url) e devolve a transcrição. Usado pra preencher
    a `reference_transcript` de vozes antigas que subiram só o áudio."""
    audio_url = inp.get("audio_url")
    if not audio_url:
        return {"error": "missing 'audio_url'"}
    whisper_model = inp.get("whisper_model", "large-v3")
    language = inp.get("language", "pt")

    tmp_dir = WORKSPACE / "transcribe"
    audio_path = ensure_local_from_url(audio_url, tmp_dir, "transcribe")
    transcript = transcribe_with_retry(audio_path, whisper_model, language, attempts=3)
    if not transcript:
        return {"error": "transcription returned empty after retries"}
    return {"transcript": transcript, "transcript_len": len(transcript)}
