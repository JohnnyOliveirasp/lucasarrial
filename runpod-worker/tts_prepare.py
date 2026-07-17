"""Máquina de Edição — E2 (job type: tts_prepare).

Prepara a narração TTS pro Editor, seguindo a MAQUINA_EDICAO_AUTOMATICA.md:
  §2.2  o áudio nasce de UMA chamada TTS (feita antes, job inference) —
        aqui ele é lapidado e virado em fundação de montagem
  §3.2A encolher pausas internas pra ~0,20s (modo A — fala TTS "minimalista
        na pausa"); saída SEMPRE .wav
  §3.1  transcrição word-timestamps DEPOIS do encolhimento (timestamps já
        saem certos — dispensa o remapear_palavras do estúdio local)
  §3.3  QA de fidelidade: similaridade transcrição×roteiro ≥ 0.75, senão o
        job devolve erro e o backend regenera o TTS

Input:  { audio_url, script, language?, output_upload_url,
          pausa_alvo_s?=0.20, noise_db?=-30, min_pausa_s?=0.36 }
Output: { tts_prepare: True, uploaded, words, transcript, similarity,
          duration_raw, duration_clean }
"""

from __future__ import annotations

import difflib
import re
import subprocess
import tempfile
import unicodedata
from pathlib import Path

from voice_pipeline.r2 import download_to_dir, upload_file_to_presigned_url

QA_MIN_SIMILARITY = 0.75


def _run(cmd: list[str]) -> subprocess.CompletedProcess:
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(f"ffmpeg: {r.stderr.strip()[-400:]}")
    return r


def _duration(path: Path) -> float:
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                        "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
                       capture_output=True, text=True)
    return float(r.stdout.strip())


def _detect_silences(path: Path, noise_db: int, min_s: float) -> list[tuple[float, float]]:
    r = subprocess.run(["ffmpeg", "-i", str(path), "-af",
                        f"silencedetect=noise={noise_db}dB:d={min_s}", "-f", "null", "-"],
                       capture_output=True, text=True)
    txt = r.stderr
    starts = [float(x) for x in re.findall(r"silence_start: (-?[\d.]+)", txt)]
    ends = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", txt)]
    out = []
    for i, s in enumerate(starts):
        e = ends[i] if i < len(ends) else None
        if e is not None and e > s:
            out.append((max(0.0, s), e))
    return out


def shrink_pauses(src: Path, dst: Path, pausa_alvo: float = 0.20,
                  noise_db: int = -30, min_s: float = 0.36) -> tuple[float, float]:
    """Modo A do estúdio: encolhe pausas internas > min_s pra pausa_alvo.
    Mantém pausa_alvo/2 de cada lado do corte. Devolve (dur_raw, dur_clean)."""
    total = _duration(src)
    silences = _detect_silences(src, noise_db, min_s)
    # Segmentos de ÁUDIO a manter: entre silêncios, com meia-pausa nas bordas.
    keep: list[tuple[float, float]] = []
    cur = 0.0
    half = pausa_alvo / 2
    for s, e in silences:
        if s <= 0.01 and e < total:      # silêncio de abertura: corta quase todo
            cur = max(0.0, e - half)
            continue
        keep.append((cur, min(total, s + half)))
        cur = max(cur, e - half)
    keep.append((cur, total))
    keep = [(a, b) for a, b in keep if b - a > 0.02]
    if not keep:
        keep = [(0.0, total)]
    # Render: um trim por segmento + concat (re-encode wav pcm — regra: .wav)
    parts = "".join(
        f"[0:a]atrim=start={a:.3f}:end={b:.3f},asetpts=PTS-STARTPTS[a{i}];"
        for i, (a, b) in enumerate(keep)
    )
    chain = "".join(f"[a{i}]" for i in range(len(keep)))
    fc = f"{parts}{chain}concat=n={len(keep)}:v=0:a=1[out]"
    _run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(src),
          "-filter_complex", fc, "-map", "[out]",
          "-ar", "44100", "-ac", "1", "-c:a", "pcm_s16le", str(dst)])
    return round(total, 3), round(_duration(dst), 3)


def _norm_tokens(s: str) -> list[str]:
    s = unicodedata.normalize("NFD", (s or "").lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return [w for w in re.sub(r"[^a-z0-9\s]", " ", s).split() if w]


def similarity(expected: str, got: str) -> float:
    a, b = _norm_tokens(expected), _norm_tokens(got)
    if not b:
        return 0.0
    return round(difflib.SequenceMatcher(None, a, b).ratio(), 3)


def handle_tts_prepare(inp: dict, log) -> dict:
    audio_url = inp.get("audio_url")
    script = (inp.get("script") or "").strip()
    output_upload_url = inp.get("output_upload_url")
    language = inp.get("language", "pt")
    if not audio_url or not output_upload_url:
        return {"error": "missing 'audio_url' or 'output_upload_url'"}
    if not script:
        return {"error": "missing 'script'"}

    job_dir = Path(tempfile.mkdtemp(prefix="ttsprep_"))
    src = download_to_dir([audio_url], job_dir / "in")[0]
    clean = job_dir / "clean.wav"

    dur_raw, dur_clean = shrink_pauses(
        src, clean,
        pausa_alvo=float(inp.get("pausa_alvo_s", 0.20)),
        noise_db=int(inp.get("noise_db", -30)),
        min_s=float(inp.get("min_pausa_s", 0.36)),
    )
    log("info", "tts_prepare.shrink", raw=dur_raw, clean=dur_clean)

    # Transcrição DEPOIS do encolhimento → timestamps certos sem remapear.
    from faster_whisper import WhisperModel
    model = WhisperModel("large-v3", device="cuda", compute_type="float16")
    segments, _ = model.transcribe(str(clean), language=language, word_timestamps=True)
    words: list[dict] = []
    for seg in segments:
        for w in seg.words or []:
            words.append({"start": round(w.start, 3), "end": round(w.end, 3),
                          "word": w.word})
    transcript = "".join(w["word"] for w in words).strip()
    if not words:
        return {"error": "no_speech", "detail": "transcrição vazia do TTS"}

    # §3.3 QA de fidelidade: motor de fala repete/troca palavra às vezes.
    # Reprovação NÃO usa a chave "error" (RunPod marcaria o job FAILED e o
    # backend perderia o similarity/transcript) — volta como COMPLETED com
    # qa_failed=True e o backend decide regenerar.
    sim = similarity(script, transcript)
    log("info", "tts_prepare.qa", similarity=sim)
    if sim < QA_MIN_SIMILARITY:
        return {"tts_prepare": False, "qa_failed": True, "similarity": sim,
                "transcript": transcript[:500]}

    upload_file_to_presigned_url(clean, output_upload_url, content_type="audio/wav")
    return {
        "tts_prepare": True,
        "uploaded": True,
        "words": words,
        "transcript": transcript,
        "similarity": sim,
        "duration_raw": dur_raw,
        "duration_clean": dur_clean,
    }
