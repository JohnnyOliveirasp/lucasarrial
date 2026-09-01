"""Do audio bruto do aluno ate um dataset limpo e treinavel.

Demucs (tira musica/ruido) -> normaliza mono 16k -> VAD acha a fala -> corta em
chunks. Depois mede o que SOBROU e descobre o idioma REAL do audio.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from audio_ops import run_ffmpeg_stereo_44k
from worker_log import log as _log


@dataclass(frozen=True)
class TrainDirs:
    """Os diretorios de UM job de treino."""
    job: Path
    raw: Path
    vocals: Path
    norm: Path
    dataset: Path
    lora_runs: Path

    @classmethod
    def para(cls, workspace: Path, voice_id: str) -> "TrainDirs":
        job = workspace / voice_id
        return cls(job=job, raw=job / "raw", vocals=job / "vocals",
                   norm=job / "norm", dataset=job / "dataset",
                   lora_runs=job / "lora_runs")


def _duracao_segundos(path: Path) -> float | None:
    import soundfile as sf
    try:
        info = sf.info(str(path))
        return float(info.frames) / float(info.samplerate or 1)
    except Exception:
        return None


def _preprocessar_um(src: Path, dirs: TrainDirs, next_idx: int) -> tuple[int, dict]:
    """Um arquivo do aluno -> N chunks no dataset. Devolve (chunks, stat).

    Demucs precisa de WAV stereo 44.1k e le via soundfile, o que falha em MP3 —
    por isso o ffmpeg gera um WAV stereo intermediario antes.
    """
    from voice_pipeline import (
        chunk_vad_segments,
        cut_audio_by_segments,
        extract_to_wav,
        separate_vocals_demucs,
        vad_segments_silero,
    )

    _log("info", "train.preprocess", file=src.name)
    stereo_wav = dirs.vocals / f"{src.stem}_in.wav"
    stereo_wav.parent.mkdir(parents=True, exist_ok=True)

    # Arquivo SEM faixa de audio (foto da pasta do Drive que entrou na lista —
    # incidente 910ea757) nao pode derrubar o treino inteiro: PULA e segue com
    # os que prestam. So falha o job se NENHUM arquivo servir (ai a mensagem ao
    # aluno e' verdadeira). O fix de raiz esta no import do onboarding; esta e'
    # a rede de baixo.
    try:
        run_ffmpeg_stereo_44k(src, stereo_wav)
    except RuntimeError as exc:
        _log("error", "train.preprocess.skipped", file=src.name, error=str(exc)[:200])
        return 0, {"file": src.name, "skipped": "sem faixa de audio"}

    vocals_wav = separate_vocals_demucs(
        stereo_wav, dirs.vocals, log=lambda m: _log("info", "demucs", detail=m)
    )
    normalized = dirs.norm / f"{src.stem}_mono16k.wav"
    extract_to_wav(vocals_wav, normalized, sample_rate=16000)

    vad = vad_segments_silero(normalized)
    # Calibracao 08/08 (ver docstring de chunk_vad_segments): gap 0.6->1.5s e
    # minimo 5->3s. O gap curto picotava a fala pausada e o descarte por <5s
    # comia ~80% do audio de quem fala bem (caso prof.pinheirofilho: 17,6min de
    # fala viravam 3,2min uteis -> "audio insuficiente" injusto).
    chunks = chunk_vad_segments(vad, min_seconds=3.0, max_seconds=30.0, merge_gap_seconds=1.5)
    cut = cut_audio_by_segments(normalized, chunks, dirs.dataset, start_index=next_idx)

    decoded = _duracao_segundos(normalized)
    stat = {
        "file": src.name,
        "decoded_s": round(decoded, 1) if decoded is not None else None,
        "vad_speech_s": round(sum(e - s for s, e in vad), 1),
        "chunks": len(cut),
    }
    _log("info", "train.preprocess.done", **stat)
    return len(cut), stat


def preparar_dataset(arquivos: list[Path], dirs: TrainDirs) -> tuple[int, list[dict]]:
    """Roda o pipeline por arquivo.

    Guardamos stats por arquivo (duracao decodificada, fala achada pelo VAD,
    chunks aproveitados): quando o treino zera, o output diz EXATAMENTE onde o
    audio morreu (decode? silencio? clipes curtos?) — no caso VOZ MAE 2 (21/07)
    os arquivos ja tinham sido apagados e ficamos sem como diagnosticar.
    """
    total, stats = 0, []
    for src in arquivos:
        n, stat = _preprocessar_um(src, dirs, total)
        total += n
        stats.append(stat)
    return total, stats


def segundos_uteis(dataset_dir: Path) -> float:
    """Audio UTIL pos-limpeza (anti-churn).

    O usuario manda 20min BRUTOS; Demucs+VAD podem descartar quase tudo (ruido,
    musica, silencio). Medimos o que SOBROU pra abortar ANTES do treino se for
    pouco — barato (~1min de GPU) e o backend estorna os creditos com a mensagem
    certa, em vez de entregar uma voz ruim.
    """
    total = 0.0
    for chunk in sorted(dataset_dir.glob("*.wav")):
        d = _duracao_segundos(chunk)
        if d is not None:
            total += d
    return round(total, 1)


def minimo_util_exigido() -> float:
    return float(os.environ.get("TRAIN_MIN_USEFUL_SECONDS", "600"))


def idioma_do_audio(dataset_dir: Path, whisper_model: str, language: str) -> str:
    """Idioma REAL do audio, nao o que o request disse.

    Caso Joana 2026-07-21: voz em ESPANHOL era transcrita como pt no pipeline
    inteiro (ref em portunhol c/ palavra inventada, textos de treino errados, QA
    no idioma errado). Detecta no 1o chunk limpo do dataset; confianca baixa cai
    no idioma do request (default pt). Vozes pt seguem identicas.
    """
    if os.environ.get("TRAIN_LANG_AUTODETECT", "1") in ("0", "false", "False", ""):
        return language
    primeiro = next(iter(sorted(dataset_dir.glob("*.wav"))), None)
    if primeiro is None:
        return language
    try:
        from voice_pipeline import detect_language
        detectado, prob = detect_language(primeiro, model_name=whisper_model)
        _log("info", "train.language.detected", language=detectado,
             probability=round(prob, 3), request_language=language)
        if detectado and prob >= float(os.environ.get("TRAIN_LANG_MIN_PROB", "0.6")):
            return detectado
    except Exception as exc:
        _log("error", "train.language.detect_failed", error=str(exc))
    return language
