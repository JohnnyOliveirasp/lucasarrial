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
    # #108 (Kessuly 24/08): comecar no meio de frase ("americano. Na 18a...")
    # e' tao ruim quanto terminar no meio — o VoxCPM continua o TEXTO da ref
    # e o 1o chunk nasce atropelado. Antes pesava 8; agora pesa como o fim.
    if text and text[0].islower():
        score += 30
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


def _slice_window(src: Path, dst: Path, offset: float, seconds: float) -> bool:
    """Corta [offset, offset+seconds] de src -> dst (mono 16k). True se ok."""
    dst.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-ss", str(offset), "-i", str(src), "-t", str(seconds),
        "-ac", "1", "-ar", "16000", str(dst),
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    return r.returncode == 0 and dst.exists() and dst.stat().st_size > 0


# ── Corte em FRONTEIRA DE PALAVRA (caso Katia 2026-08) ─────────────────────
# O corte por tempo arbitrario acima decapita palavras nas DUAS pontas da
# referencia (~1 em 3 vozes novas nasce com farelo de palavra na borda) e o
# VoxCPM ecoa esse farelo nas geracoes. A cura provada manualmente: recortar em
# palavra completa. Aqui automatizamos com word_timestamps do faster_whisper —
# NUNCA heuristica de energia/silencio (testada e reprovada 2x).

# Folga do recorte alem da janela desejada, p/ a 1a/ultima palavra da regiao
# nao ser decapitada pelo proprio corte da janela folgada.
_WINDOW_SLACK_SECONDS = 1.5
# Respiro antes do ataque da 1a consoante / depois da ultima (nao come fonema).
_EDGE_PAD_SECONDS = 0.06
# Clipe ajustado menor que isso (fracao de ref_seconds) nao serve de referencia:
# descarta a candidata e segue pra proxima do ranking.
_MIN_SNAPPED_FRACTION = 0.6


def _word_field(w, name: str):
    """Le start/end/word de um objeto Word do faster_whisper OU de um dict."""
    if isinstance(w, dict):
        return w.get(name)
    return getattr(w, name, None)


_SENTENCE_END = re.compile(r"[.!?…]['\")\]]*$")


def _ends_sentence(w) -> bool:
    """A palavra fecha uma frase? (whisper deixa a pontuacao colada na palavra)."""
    return bool(_SENTENCE_END.search((_word_field(w, "word") or "").strip()))


def _trim_to_sentence(
    inside: list, ordered: list, min_seconds: float,
) -> "tuple[list, str]":
    """Encolhe `inside` para comecar em INICIO de frase e terminar em FIM de
    frase (chamado #108, caso Kessuly: a ref comecava em "americano. Na 18a
    peca..." — o VoxCPM continua o TEXTO da ref, e uma ref que comeca/termina
    no meio de frase faz cada chunk nascer atropelado ou com eco).

    Inicio de frase = 1a palavra do audio OU palavra cujo vizinho anterior (no
    audio inteiro, nao so na janela) fecha frase. Fim = ultima palavra que
    fecha frase. Se o recorte ficar menor que `min_seconds`, tenta so o fim
    (a borda que o score pune mais), depois so o inicio; se nada couber,
    devolve as palavras como vieram — a melhoria NUNCA descarta uma candidata
    por si so. Devolve (palavras, modo) com modo em
    {"sentence", "end_only", "start_only", "words"}.
    """
    if not inside:
        return inside, "words"
    pos = {id(w): i for i, w in enumerate(ordered)}
    starts = [
        w for w in inside
        if pos.get(id(w), 0) == 0 or _ends_sentence(ordered[pos[id(w)] - 1])
    ]
    ends = [w for w in inside if _ends_sentence(w)]

    def _dur(a, b) -> float:
        return float(_word_field(b, "end")) - float(_word_field(a, "start"))

    def _slice(a, b):
        ia, ib = pos[id(a)], pos[id(b)]
        return [w for w in inside if ia <= pos[id(w)] <= ib]

    if starts and ends:
        a, b = starts[0], ends[-1]
        if pos[id(a)] <= pos[id(b)] and _dur(a, b) >= min_seconds:
            return _slice(a, b), "sentence"
    if ends and _dur(inside[0], ends[-1]) >= min_seconds:
        return _slice(inside[0], ends[-1]), "end_only"
    if starts and _dur(starts[0], inside[-1]) >= min_seconds:
        return _slice(starts[0], inside[-1]), "start_only"
    return inside, "words"


def _snap_bounds_to_words(
    words: list,
    region_start: float,
    region_end: float,
    pad: float = _EDGE_PAD_SECONDS,
    min_sentence_seconds: float = 0.0,
) -> "tuple[float, float, str] | None":
    """Ajusta [region_start, region_end] p/ fronteiras de PALAVRA COMPLETA e,
    quando `min_sentence_seconds` > 0, tambem p/ fronteiras de FRASE (#108).

    `words`: lista de palavras com .start/.end/.word (ou dicts), tempos no
    MESMO relogio de region_start/region_end. Escolhe a 1a palavra que COMECA
    dentro da regiao e a ultima que TERMINA dentro dela — palavra atravessando
    qualquer borda fica de fora. Devolve (start, end, transcript) ou None se
    nenhuma palavra inteira couber.
    """
    eps = 1e-6
    ordered = []
    for w in sorted(words or [], key=lambda w: _word_field(w, "start") or 0.0):
        ws, we = _word_field(w, "start"), _word_field(w, "end")
        if ws is None or we is None:
            continue
        ordered.append(w)
    inside = [
        w for w in ordered
        if _word_field(w, "start") >= region_start - eps
        and _word_field(w, "end") <= region_end + eps
    ]
    if not inside:
        return None
    if min_sentence_seconds > 0:
        inside, _modo = _trim_to_sentence(inside, ordered, min_sentence_seconds)
    transcript = " ".join(
        (_word_field(w, "word") or "").strip() for w in inside
    ).strip()
    transcript = re.sub(r"\s+", " ", transcript)
    if not transcript:
        return None
    start = max(0.0, float(_word_field(inside[0], "start")) - pad)
    end = float(_word_field(inside[-1], "end")) + pad
    return (start, end, transcript)


# Status do recorte por palavra: decide o que o laco de candidatas faz.
_SNAP_OK = "ok"                    # clipe recortado em palavra + transcript exato
_SNAP_DISCARD = "discard"          # ficou curto demais / sem palavra inteira -> proxima candidata
_SNAP_UNAVAILABLE = "unavailable"  # sem words (erro/modelo antigo) -> corte por tempo de hoje


def _cut_snapped_candidate(
    primary: Path,
    clip: Path,
    offset: float,
    ref_seconds: int,
    duration: float,
    transcribe_words_fn: "Callable[[Path], list | None]",
    log: Callable[..., None],
) -> "tuple[str, str | None]":
    """Corta a candidata em FRONTEIRA DE PALAVRA. Devolve (status, transcript).

    Passos: corta uma janela FOLGADA (offset±slack), transcreve com timestamps
    de palavra, acha a 1a/ultima palavra inteiramente dentro da regiao desejada
    e re-corta nesses limites. O transcript devolvido e EXATAMENTE as palavras
    do clipe (sem 2a passada de whisper).
    """
    win_start = max(0.0, offset - _WINDOW_SLACK_SECONDS)
    win_end = offset + ref_seconds + _WINDOW_SLACK_SECONDS
    if duration > 0:
        win_end = min(duration, win_end)
    padded = clip.with_name(clip.stem + "_padded.wav")
    try:
        if not _slice_window(primary, padded, win_start, win_end - win_start):
            log(level="error", event="reference.snap.pad_slice_failed", offset=offset)
            return (_SNAP_UNAVAILABLE, None)
        try:
            words = transcribe_words_fn(padded)
        except Exception as exc:  # whisper nunca derruba o treino por isso
            log(level="error", event="reference.snap.words_error",
                offset=offset, error=str(exc))
            words = None
        if not words:
            log(level="info", event="reference.snap.no_words", offset=offset)
            return (_SNAP_UNAVAILABLE, None)
        # Tempos do whisper sao relativos ao clipe folgado; a regiao desejada
        # [offset, offset+ref_seconds] vira [offset-win_start, ...] nesse relogio.
        rel_start = offset - win_start
        snapped = _snap_bounds_to_words(
            words, rel_start, rel_start + ref_seconds,
            min_sentence_seconds=ref_seconds * _MIN_SNAPPED_FRACTION,
        )
        if snapped is None:
            log(level="info", event="reference.snap.no_full_word", offset=offset)
            return (_SNAP_DISCARD, None)
        start, end, transcript = snapped
        log(level="info", event="reference.snap.sentence",
            offset=offset,
            starts_sentence=not transcript[:1].islower(),
            ends_sentence=bool(_SENTENCE_END.search(transcript)))
        if end - start < ref_seconds * _MIN_SNAPPED_FRACTION:
            log(level="info", event="reference.snap.too_short",
                offset=offset, snapped_seconds=round(end - start, 2))
            return (_SNAP_DISCARD, None)
        if not _slice_window(padded, clip, start, end - start):
            log(level="error", event="reference.snap.cut_failed", offset=offset)
            return (_SNAP_UNAVAILABLE, None)
        log(level="info", event="reference.snap.ok", offset=offset,
            snapped_seconds=round(end - start, 2), words=len(transcript.split()))
        return (_SNAP_OK, transcript)
    finally:
        try:
            padded.unlink(missing_ok=True)
        except OSError:
            pass


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
    transcribe_words_fn: "Callable[[Path], list | None] | None" = None,
) -> "list[tuple[Path, str]]":
    """Como select_reference_clip, mas devolve TODAS as candidatas válidas
    RANQUEADAS (melhor primeiro). Usado pelo QA pós-treino: se a amostra sair
    contaminada com a 1ª referência, o handler tenta a 2ª, a 3ª…

    Com `transcribe_words_fn` (palavras com .start/.end/.word), cada candidata
    é recortada em FRONTEIRA DE PALAVRA em vez de tempo arbitrário — ver
    _cut_snapped_candidate. Sem words disponíveis, cai no corte por tempo.
    """
    files = [f for f in norm_files if f and f.exists()]
    if not files:
        return []
    primary = max(files, key=_audio_duration_seconds)
    duration = _audio_duration_seconds(primary)
    offsets = _candidate_offsets(duration, ref_seconds, max_candidates)
    work_dir.mkdir(parents=True, exist_ok=True)

    def _rank_pass(
        words_fn: "Callable[[Path], list | None] | None",
        name_suffix: str = "",
    ) -> "list[tuple[float, Path, str]]":
        ranked: "list[tuple[float, Path, str]]" = []
        for i, off in enumerate(offsets):
            clip = work_dir / f"ref_cand_{i}_{int(off)}s{name_suffix}.wav"
            transcript: "str | None" = None
            if words_fn is not None:
                status, snapped = _cut_snapped_candidate(
                    primary, clip, off, ref_seconds, duration,
                    words_fn, log,
                )
                if status == _SNAP_DISCARD:
                    continue  # curta demais / sem palavra inteira: proxima candidata
                if status == _SNAP_OK:
                    transcript = snapped
                # _SNAP_UNAVAILABLE: cai no corte por tempo abaixo (fallback).
            if transcript is None:
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
            ranked.append((score, clip, transcript))
        return ranked

    scored = _rank_pass(transcribe_words_fn)
    if not scored and transcribe_words_fn is not None:
        # TODAS as candidatas morreram no snap por palavra (ex.: audio sem
        # nenhuma palavra inteira nas janelas). A melhoria NUNCA pode quebrar
        # o treino: refaz o laco inteiro com o corte por TEMPO da main.
        log(level="warning", event="reference.snap.all_discarded_time_retry",
            candidates=len(offsets))
        scored = _rank_pass(None, name_suffix="_time")

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
