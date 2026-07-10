"""Vídeo Estúdio F0 — "áudio impecável" (job type: audio_edit).

Porte do editor de referência do Lucas (EXPORT_PLATAFORMA/codigo_fonte/core/
editor.py), regras A1-A3 do 01_EDICAO_REGRAS.md:
  1. corta o áudio em FALAS separadas por pausa (silencedetect)
  2. transcreve CADA fala isoladamente com word timestamps (o whisper esconde
     repetições quando transcreve o áudio inteiro de uma vez)
  3. fala parecida com uma das 2 seguintes = tentativa repetida -> fica a ÚLTIMA
  4. renderiza o áudio limpo (pads de respiro ~0,2s) + palavras remapeadas
     pro timeline novo + relatório do que foi cortado

Input:  { audio_url, output_upload_url, language?, whisper_model? }
Output: { edited, uploaded, duration_raw, duration_clean, kept_takes,
          removed_takes, words: [{start,end,word}], report }
"""

from __future__ import annotations

import difflib
import os
import re
import subprocess
import tempfile
from pathlib import Path

from voice_pipeline.r2 import download_to_dir, upload_file_to_presigned_url

MAX_AUDIO_SECONDS = float(os.environ.get("STUDIO_MAX_AUDIO_SECONDS", "600"))
# Fronteiras de fala (calibração do editor de referência, não mexer sem A/B):
NOISE_DB = -35        # threshold do silencedetect
MIN_PAUSE_S = 0.45    # pausa que separa duas falas
MIN_SPEECH_S = 0.35   # fala menor que isso é ruído
PAD_IN_S = 0.18       # respiro antes de cada fala mantida
PAD_OUT_S = 0.25      # respiro depois de cada fala mantida
SIM_THRESHOLD = 0.55  # similaridade de texto que marca tentativa repetida
PREFIX_WORDS = 4      # prefixo igual (n palavras) também marca repetição


def _run(cmd: list[str]) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, capture_output=True, text=True)


def _duration(path: Path) -> float:
    r = _run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
              "-of", "default=noprint_wrappers=1:nokey=1", str(path)])
    return float(r.stdout.strip())


def _detect_silences(path: Path) -> list[tuple[float, float | None]]:
    r = _run(["ffmpeg", "-i", str(path), "-af",
              f"silencedetect=noise={NOISE_DB}dB:d={MIN_PAUSE_S}", "-f", "null", "-"])
    txt = r.stderr
    starts = [float(x) for x in re.findall(r"silence_start: (-?[\d.]+)", txt)]
    ends = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", txt)]
    return [(max(0.0, s), ends[i] if i < len(ends) else None)
            for i, s in enumerate(starts)]


def _split_speeches(path: Path) -> list[tuple[float, float]]:
    """Divide em (ini, fim) de cada fala usando os silêncios como fronteira."""
    total = _duration(path)
    speeches: list[tuple[float, float]] = []
    cursor = 0.0
    for s, e in _detect_silences(path):
        e = total if e is None else e
        if s - cursor >= MIN_SPEECH_S:
            speeches.append((round(cursor, 2), round(s, 2)))
        cursor = e
    if total - cursor >= MIN_SPEECH_S:
        speeches.append((round(cursor, 2), round(total, 2)))
    return speeches


def _transcribe_speeches(
    wav: Path, speeches: list[tuple[float, float]], model_name: str,
    language: str, log,
) -> list[dict]:
    """Transcreve cada fala ISOLADA (anti-vício do whisper). Words em
    timestamps GLOBAIS do áudio original."""
    from voice_pipeline.training import _get_whisper

    try:
        model = _get_whisper(model_name, "cuda", "float16")
    except Exception as exc:  # noqa: BLE001 — sem GPU (teste local): cai pra CPU
        log("warn", "audio_edit.whisper.cpu_fallback", error=str(exc)[:200])
        model = _get_whisper(model_name, "cpu", "int8")

    tmp = Path(tempfile.mkdtemp(prefix="falas_"))
    out: list[dict] = []
    for i, (a, b) in enumerate(speeches):
        piece = tmp / f"f{i:03d}.wav"
        r = _run(["ffmpeg", "-y", "-loglevel", "error", "-ss", str(a), "-to", str(b),
                  "-i", str(wav), "-ac", "1", "-ar", "16000", str(piece)])
        if r.returncode != 0:
            raise RuntimeError(f"ffmpeg fala {i}: {r.stderr.strip()[:200]}")
        segments, _info = model.transcribe(
            str(piece), language=language, word_timestamps=True,
        )
        words = []
        for seg in segments:
            for w in (seg.words or []):
                words.append({"start": round(a + w.start, 3),
                              "end": round(a + w.end, 3),
                              "word": w.word})
        text = " ".join(w["word"].strip() for w in words)
        out.append({"ini": a, "fim": b, "texto": text, "words": words})
        log("info", "audio_edit.speech", index=i, seconds=round(b - a, 1),
            text=text[:60])
    return out


def _norm(txt: str) -> str:
    t = re.sub(r"[^\wáéíóúâêôãõç ]", "", txt.lower())
    return re.sub(r"\s+", " ", t).strip()


def _mark_repetitions(speeches_tx: list[dict]) -> list[dict]:
    """Fala parecida com alguma das 2 SEGUINTES -> descarta (fica a última).
    Também descarta fragmentos abortados curtos e falas vazias/ruído."""
    n = len(speeches_tx)
    for f in speeches_tx:
        f["manter"] = True
        f["motivo"] = ""
    for i in range(n - 1):
        a = _norm(speeches_tx[i]["texto"])
        if not a:
            speeches_tx[i]["manter"] = False
            speeches_tx[i]["motivo"] = "vazio/ruído"
            continue
        for j in (i + 1, i + 2):
            if j >= n:
                break
            b = _norm(speeches_tx[j]["texto"])
            if not b:
                continue
            sim = difflib.SequenceMatcher(None, a, b).ratio()
            aw, bw = a.split(), b.split()
            pa, pb = aw[:PREFIX_WORDS], bw[:PREFIX_WORDS]
            same_prefix = len(pa) >= 2 and pa == pb[:len(pa)]
            # Fragmento abortado: curto E retomado com as MESMAS 2+ palavras
            # iniciais. Exigir 2 palavras (não só o começo do texto) evita
            # cortar retórica intencional tipo "Roteiros genéricos? Morrerão.
            # Roteiros com pessoalidade viverão." (bug do teste do Lucas
            # 2026-07-10: 'roteiros genéricos' removida com sim=0.27).
            fragment = 2 <= len(aw) <= 5 and len(bw) >= 2 and aw[:2] == bw[:2]
            if sim >= SIM_THRESHOLD or same_prefix or fragment:
                speeches_tx[i]["manter"] = False
                speeches_tx[i]["motivo"] = f"repetida (sim={sim:.2f} c/ fala {j})"
                break
    # última fala nunca é comparada pra frente; vazia também descarta
    if n and not _norm(speeches_tx[-1]["texto"]):
        speeches_tx[-1]["manter"] = False
        speeches_tx[-1]["motivo"] = "vazio/ruído"
    return speeches_tx


def _build_edl(speeches_tx: list[dict], total: float):
    """Segmentos mantidos com pads (sem sobreposição) + words no timeline novo
    + relatório humano-legível."""
    report, segs, words = [], [], []
    t_new = 0.0
    prev_end = 0.0
    for f in speeches_tx:
        mark = "mantida" if f["manter"] else "REMOVIDA"
        line = f"[{f['ini']:7.2f}-{f['fim']:7.2f}] {mark}: {f['texto'][:90]}"
        if f["motivo"]:
            line += f"  <- {f['motivo']}"
        report.append(line)
        if not f["manter"]:
            continue
        a = max(prev_end, f["ini"] - PAD_IN_S)
        b = min(total, f["fim"] + PAD_OUT_S)
        if b <= a:
            continue
        segs.append((round(a, 3), round(b, 3)))
        for w in f["words"]:
            words.append({"start": round(w["start"] - a + t_new, 3),
                          "end": round(w["end"] - a + t_new, 3),
                          "word": w["word"]})
        t_new += b - a
        prev_end = b
    return segs, words, "\n".join(report)


def _render_clean(src: Path, segs: list[tuple[float, float]], out_wav: Path) -> None:
    """Concatena os segmentos mantidos num WAV mono 44.1k (qualidade de player,
    e insumo das fases seguintes do Estúdio)."""
    parts = []
    for i, (a, b) in enumerate(segs):
        parts.append(f"[0:a]atrim=start={a}:end={b},asetpts=PTS-STARTPTS[a{i}]")
    chain = "".join(f"[a{i}]" for i in range(len(segs)))
    fc = ";".join(parts) + f";{chain}concat=n={len(segs)}:v=0:a=1[a]"
    r = _run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(src),
              "-filter_complex", fc, "-map", "[a]",
              "-ac", "1", "-ar", "44100", "-c:a", "pcm_s16le", str(out_wav)])
    if r.returncode != 0:
        raise RuntimeError(f"ffmpeg render: {r.stderr.strip()[:300]}")


def handle_audio_edit(inp: dict, log) -> dict:
    audio_url = inp.get("audio_url")
    output_upload_url = inp.get("output_upload_url")
    if not audio_url or not output_upload_url:
        return {"error": "missing 'audio_url' or 'output_upload_url'"}
    language = inp.get("language", "pt")
    model_name = inp.get("whisper_model", "large-v3-turbo")

    job_dir = Path(tempfile.mkdtemp(prefix="audio_edit_"))
    raw = download_to_dir([audio_url], job_dir / "raw")[0]

    # WAV de trabalho em qualidade cheia (a fonte pode ser webm/opus do gravador)
    wav = job_dir / "source.wav"
    r = _run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(raw),
              "-vn", "-ac", "1", "-ar", "44100", "-c:a", "pcm_s16le", str(wav)])
    if r.returncode != 0:
        return {"error": f"audio inválido: {r.stderr.strip()[:200]}"}

    total = _duration(wav)
    if total > MAX_AUDIO_SECONDS:
        return {"error": "audio_too_long", "duration_raw": round(total, 2),
                "max_seconds": MAX_AUDIO_SECONDS}

    speeches = _split_speeches(wav)
    log("info", "audio_edit.speeches", count=len(speeches),
        duration=round(total, 1))
    if not speeches:
        return {"error": "no_speech", "duration_raw": round(total, 2)}

    tx = _transcribe_speeches(wav, speeches, model_name, language, log)
    tx = _mark_repetitions(tx)
    segs, words, report = _build_edl(tx, total)
    if not segs:
        return {"error": "no_speech", "duration_raw": round(total, 2)}

    clean = job_dir / "clean.wav"
    _render_clean(wav, segs, clean)
    clean_dur = _duration(clean)

    upload_file_to_presigned_url(clean, output_upload_url, content_type="audio/wav")
    log("info", "audio_edit.done", duration_raw=round(total, 2),
        duration_clean=round(clean_dur, 2),
        removed=sum(1 for f in tx if not f["manter"]))

    return {
        "edited": True,
        "uploaded": True,
        "duration_raw": round(total, 2),
        "duration_clean": round(clean_dur, 2),
        "kept_takes": sum(1 for f in tx if f["manter"]),
        "removed_takes": sum(1 for f in tx if not f["manter"]),
        "words": words,
        "report": report,
    }
