"""Whisper fora do laco de chunk: transcricao com retry e QA da amostra.

O QA por chunk da geracao mora em tts_qa/ — este arquivo e' o whisper que o
TREINO usa (transcrever referencia, conferir a amostra pos-treino).
"""
from __future__ import annotations

import difflib
import re as _re
import unicodedata
from pathlib import Path

from worker_log import log as _log


def transcribe_with_retry(
    wav_path: Path, whisper_model: str, language: str, attempts: int = 3
) -> str | None:
    """Transcreve `wav_path` e devolve texto NÃO-vazio, ou None se falhar em
    todas as tentativas. Diferente de best-effort silencioso: cada falha é
    logada, e o chamador decide o que fazer com o None (aqui: não registrar a
    referência, em vez de gravar um meio-estado áudio-sem-texto)."""
    from voice_pipeline import transcribe_file

    for i in range(1, attempts + 1):
        try:
            text = transcribe_file(
                str(wav_path),
                model_name=whisper_model,
                language=language,
                log=lambda m: _log("info", "ref.whisper", detail=m),
            )
            text = (text or "").strip()
            if text:
                return text
            _log("error", "ref.transcribe.empty", attempt=i, attempts=attempts)
        except Exception as exc:
            _log("error", "ref.transcribe.error", attempt=i, attempts=attempts, error=str(exc))
    return None


def sample_qa_similarity(sample_path, whisper_model: str, language: str, expected: str):
    """Similaridade (0..1) entre a transcrição da amostra e o texto esperado.
    None = Whisper falhou (não bloqueia — QA é rede de segurança, não gate)."""
    import difflib
    import re as _re
    import unicodedata

    try:
        got = transcribe_with_retry(sample_path, whisper_model, language, attempts=2) or ""
    except Exception:
        return None

    def norm(s: str) -> list[str]:
        s = unicodedata.normalize("NFD", (s or "").lower())
        s = "".join(c for c in s if unicodedata.category(c) != "Mn")
        return [w for w in _re.sub(r"[^a-z0-9\s]", " ", s).split() if w]

    a, b = norm(expected), norm(got)
    if not b:
        return 0.0
    return round(difflib.SequenceMatcher(None, a, b).ratio(), 3)
