"""QA de RITMO por chunk (caso Ellen / Johnny, 25/08).

O VoxCPM articula mais rapido que a pessoa mesmo com referencia lenta — e
varia POR CHUNK (medido na voz do Johnny: 2,2 -> 3,0 -> 1,9 -> 2,9 pal/s no
mesmo audio). A Ellen fala a ~2,2 palavras/s de ARTICULACAO (mediana de todos
os arquivos dela); o clone saiu a 2,65 e o texto de 60s virou 41s.

Regua = velocidade natural da pessoa (`voices.speech_rate_wps`, medida no
treino ou offline). Pra voz antiga sem o valor, a regua e' a articulacao da
propria referencia (medida uma vez por job).

Dois remedios, nesta ordem:
  1. REGENERAR o chunk (amostragem nova) e ficar com o mais perto da regua;
  2. o residuo e' ajustado com `atempo` do ffmpeg (WSOLA, preserva o timbre
     e o pitch), limitado a `max_stretch` (0,8 = no maximo 25% mais longo).

GATE MACIO: nunca falha o job; sem medida (whisper mudo) devolve o chunk como
veio. Articulacao = palavras / segundos FALANDO (sem as pausas) — pausas sao
tratadas na montagem, nao aqui.
"""
from __future__ import annotations

import subprocess
import tempfile
from pathlib import Path
from typing import Callable

import numpy as np
import soundfile as sf

from worker_log import log as _log


def articulation_wps(words: list) -> "float | None":
    """palavras / segundos falando. None se nao ha material pra medir."""
    if not words or len(words) < 5:
        return None
    falando = 0.0
    for w in words:
        s = w.get("start") if isinstance(w, dict) else getattr(w, "start", None)
        e = w.get("end") if isinstance(w, dict) else getattr(w, "end", None)
        if s is None or e is None:
            continue
        falando += max(0.0, float(e) - float(s))
    if falando < 1.0:
        return None
    return round(len(words) / falando, 2)


def measure_file_rate(path: "Path | str", whisper_model: str, language: str) -> "float | None":
    """Articulacao de um arquivo (ex.: a referencia, uma vez por job)."""
    try:
        from voice_pipeline import transcribe_words
        return articulation_wps(transcribe_words(path, model_name=whisper_model, language=language))
    except Exception as exc:
        _log("error", "inference.rate_qa.measure_error", error=str(exc))
        return None


def measure_seg_rate(seg: np.ndarray, sample_rate: int, whisper_model: str, language: str) -> "float | None":
    """Articulacao de um chunk em memoria."""
    if seg is None or seg.size < int(sample_rate * 0.5):
        return None
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        p = Path(tmp.name)
    try:
        sf.write(str(p), seg, sample_rate)
        return measure_file_rate(p, whisper_model, language)
    finally:
        p.unlink(missing_ok=True)


def stretch(seg: np.ndarray, sample_rate: int, factor: float) -> np.ndarray:
    """Muda a duracao SEM mudar o pitch (ffmpeg atempo). factor < 1 = mais
    lento/longo. Erro no ffmpeg devolve o segmento original (nunca derruba)."""
    if seg is None or seg.size == 0 or abs(factor - 1.0) < 0.02:
        return seg
    with tempfile.TemporaryDirectory() as d:
        src = Path(d) / "in.wav"
        dst = Path(d) / "out.wav"
        sf.write(str(src), seg, sample_rate)
        try:
            subprocess.run(
                ["ffmpeg", "-y", "-v", "error", "-i", str(src),
                 "-filter:a", f"atempo={factor:.4f}", "-ar", str(sample_rate), str(dst)],
                check=True, timeout=120, capture_output=True,
            )
            out, sr = sf.read(str(dst), dtype="float32")
            if out.ndim > 1:
                out = out[:, 0]
            return out
        except Exception as exc:
            _log("error", "inference.rate_qa.stretch_error", error=str(exc)[:200], factor=factor)
            return seg


def apply_rate_qa(
    seg: np.ndarray,
    idx: int,
    sample_rate: int,
    target_wps: "float | None",
    regen_fn: Callable[[], np.ndarray],
    whisper_model: str,
    language: str,
    tolerance: float,
    retries: int,
    max_stretch: float,
    qa_stats: dict,
) -> np.ndarray:
    """Segura o ritmo do chunk perto de `target_wps`. Devolve o chunk final."""
    if not target_wps or target_wps <= 0:
        return seg
    limite = target_wps * (1.0 + tolerance)
    qa_stats["rate_checked"] = qa_stats.get("rate_checked", 0) + 1
    medido = measure_seg_rate(seg, sample_rate, whisper_model, language)
    if medido is None:
        qa_stats["rate_none"] = qa_stats.get("rate_none", 0) + 1
        return seg
    best_seg, best_rate = seg, medido
    tentativa = 0
    while best_rate > limite and tentativa < retries:
        tentativa += 1
        qa_stats["rate_regens"] = qa_stats.get("rate_regens", 0) + 1
        novo = regen_fn()
        r = measure_seg_rate(novo, sample_rate, whisper_model, language)
        _log("info", "inference.rate_qa.regen", idx=idx, tentativa=tentativa,
             antes=best_rate, depois=r, alvo=target_wps)
        if r is not None and r < best_rate:
            best_seg, best_rate = novo, r
    fator = 1.0
    if best_rate > limite:
        fator = max(max_stretch, target_wps / best_rate)
        best_seg = stretch(best_seg, sample_rate, fator)
        qa_stats["rate_stretched"] = qa_stats.get("rate_stretched", 0) + 1
    if medido > limite:
        qa_stats["rate_flagged"] = qa_stats.get("rate_flagged", 0) + 1
    _log("info", "inference.rate_qa", idx=idx, medido=medido, alvo=target_wps,
         final=best_rate, regens=tentativa, fator=round(fator, 3))
    return best_seg
