"""Selecao de referencia automatica p/ inferencia (anti-filler).

O VoxCPM em modo continuation ECOA o conteudo/final da referencia no inicio de
cada chunk gerado. Se a referencia tiver tiques de fala ("entao", "nao", "ta",
"ne") nas bordas ou em excesso, o modelo "vaza" esse bordao na fala — foi a
causa do bug "entao nao" da voz Pri (a ref antiga, 120s aleatoria, terminava em
"...apertando o botao nao"). Em vez de cortar um trecho ALEATORIO longo, geramos
varios candidatos curtos em offsets diferentes, transcrevemos cada um e
escolhemos o de MENOR risco de bordao. Heuristica calibrada p/ pt-BR.

Ref: VoxCPM issues #272/#288 (palavra/artefato extra no inicio com ref no mesmo
idioma); usage_guide oficial ("Check prompt_text accuracy first").
Heuristica portada do A/B validado em frontend/_ab_pri_reference_test.cjs.
"""
from __future__ import annotations

import re
import subprocess
from pathlib import Path
from typing import Callable

import soundfile as sf

# Bordoes de fala pt-BR que o VoxCPM tende a ecoar quando aparecem na borda da
# referencia. Penalizados com peso maior na ULTIMA palavra (eco mais forte).
_BAD_EDGE = {"entao", "então", "nao", "não", "ta", "tá", "ne", "né"}


def score_reference_transcript(transcript: str, language: str = "pt") -> float:
    """Score de RISCO da referencia: quanto MENOR, melhor (menos bordao).

    Pune bordao na 1a/ultima palavra e excesso de "entao/nao/ta/ne", e o desvio
    do tamanho-alvo (~85 palavras p/ ~30s de fala). Bordoes so contam p/ pt-BR;
    em outros idiomas o score considera so o tamanho.
    """
    text = (transcript or "").strip()
    lower = text.lower()
    words = [w for w in re.split(r"\s+", lower) if w]
    if not words:
        return 9999.0
    score = 0.0
    # FRONTEIRA DE FRASE (caso "hoje" engolido 2026-07-17): ref que termina no
    # meio de frase faz o continuation emendar o texto novo como se fosse a
    # mesma fala — a 1a palavra da geracao sai atropelada/engolida (VoxCPM
    # issue #272: a cauda da ref vaza no inicio da saida). Pune forte a janela
    # sem pontuacao terminal no fim; leve a que comeca no meio de frase.
    if not re.search(r"[.!?…]\s*$", text):
        score += 30
    if text and text[0].islower():
        score += 8
    if language.startswith("pt"):
        first = words[0]
        last = re.sub(r"[.,!?;:]+$", "", words[-1])
        if first in _BAD_EDGE:
            score += 25
        if last in _BAD_EDGE:
            score += 40
        score += len(re.findall(r"\b(entao|então)\b", lower)) * 8
        score += len(re.findall(r"\b(nao|não)\b", lower)) * 10
        score += len(re.findall(r"\b(ta|tá|ne|né)\b", lower)) * 6
    # FRASE-TEMA repetida (caso "me levantar" 2026-07-16): se o bi/trigrama
    # FINAL da referencia aparece de novo no corpo, o continuation ecoa essa
    # frase nas emendas da geracao. Vale pra qualquer idioma.
    tokens = [re.sub(r"[.,!?;:…]+$", "", w) for w in words]
    for n in (3, 2):
        if len(tokens) >= n * 2 + 2:
            tail = " ".join(tokens[-n:])
            body = " ".join(tokens[:-n])
            if tail and tail in body:
                score += 60
                break
    score += abs(len(words) - 85) * 0.1
    return round(score * 10) / 10


def _audio_duration_seconds(path: Path) -> float:
    try:
        info = sf.info(str(path))
        return float(info.frames) / float(info.samplerate or 1)
    except Exception:
        return 0.0


def _slice_window(src: Path, dst: Path, offset: float, seconds: int) -> bool:
    """Corta [offset, offset+seconds] de src -> dst (mono 16k). True se ok."""
    dst.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-ss", str(offset), "-i", str(src), "-t", str(seconds),
        "-ac", "1", "-ar", "16000", str(dst),
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    return r.returncode == 0 and dst.exists() and dst.stat().st_size > 0


def _candidate_offsets(duration: float, ref_seconds: int, max_candidates: int) -> list[float]:
    """Offsets espacados dentro de [margem, duration-ref_seconds-margem].

    Evita o comeco/fim do audio (saudacao de abertura e CTA de fechamento sao os
    trechos mais carregados de bordao). Se o audio mal cobre uma janela, devolve
    so o offset 0.
    """
    usable = duration - ref_seconds
    if usable <= 0:
        return [0.0]
    margin = min(ref_seconds, usable * 0.1)
    lo = margin
    hi = max(margin, duration - ref_seconds - margin)
    if hi <= lo:
        return [round(lo, 1)]
    n = max(1, min(max_candidates, int(usable // ref_seconds)))
    if n == 1:
        return [round(lo, 1)]
    step = (hi - lo) / (n - 1)
    return [round(lo + i * step, 1) for i in range(n)]


def select_reference_candidates(
    norm_files: list[Path],
    work_dir: Path,
    ref_seconds: int,
    transcribe_fn: Callable[[Path], "str | None"],
    language: str = "pt",
    max_candidates: int = 6,
    log: Callable[..., None] = lambda **k: None,
) -> "list[tuple[Path, str]]":
    """Como select_reference_clip, mas devolve TODAS as candidatas válidas
    RANQUEADAS (melhor primeiro). Usado pelo QA pós-treino: se a amostra sair
    contaminada com a 1ª referência, o handler tenta a 2ª, a 3ª…
    """
    files = [f for f in norm_files if f and f.exists()]
    if not files:
        return []
    primary = max(files, key=_audio_duration_seconds)
    duration = _audio_duration_seconds(primary)
    offsets = _candidate_offsets(duration, ref_seconds, max_candidates)
    work_dir.mkdir(parents=True, exist_ok=True)

    scored: "list[tuple[float, Path, str]]" = []
    for i, off in enumerate(offsets):
        clip = work_dir / f"ref_cand_{i}_{int(off)}s.wav"
        if not _slice_window(primary, clip, off, ref_seconds):
            log(level="error", event="reference.candidate.slice_failed", offset=off)
            continue
        transcript = (transcribe_fn(clip) or "").strip()
        if not transcript:
            log(level="info", event="reference.candidate.empty", offset=off)
            continue
        score = score_reference_transcript(transcript, language=language)
        log(level="info", event="reference.candidate", offset=off, score=score,
            transcript_len=len(transcript))
        scored.append((score, clip, transcript))

    if scored:
        scored.sort(key=lambda t: t[0])
        log(level="info", event="reference.selected", source=primary.name,
            score=scored[0][0], seconds=ref_seconds, candidates=len(scored))
        return [(clip, transcript) for _, clip, transcript in scored]

    # Fallback: primeiros ref_seconds do 1o arquivo (melhor que nada).
    fb = work_dir / "ref_fallback.wav"
    if _slice_window(files[0], fb, 0.0, ref_seconds):
        transcript = (transcribe_fn(fb) or "").strip()
        if transcript:
            log(level="info", event="reference.fallback", source=files[0].name)
            return [(fb, transcript)]
    return []


def select_reference_clip(
    norm_files: list[Path],
    work_dir: Path,
    ref_seconds: int,
    transcribe_fn: Callable[[Path], "str | None"],
    language: str = "pt",
    max_candidates: int = 6,
    log: Callable[..., None] = lambda **k: None,
) -> "tuple[Path, str] | None":
    """Escolhe a melhor janela de `ref_seconds` (compat: 1ª do ranking)."""
    ranked = select_reference_candidates(
        norm_files, work_dir, ref_seconds, transcribe_fn,
        language=language, max_candidates=max_candidates, log=log,
    )
    return ranked[0] if ranked else None
