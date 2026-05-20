"""Pré-processamento de áudio: ffmpeg → Demucs → Silero VAD → chunk → cut.

Portado de VoiceLoraStudio/voice_lora_studio/core.py.
"""

from __future__ import annotations

import math
import shutil
import subprocess
from pathlib import Path
from typing import Callable, Optional

LogFn = Callable[[str], None]


def _ensure_command(name: str) -> None:
    if shutil.which(name) is None:
        raise RuntimeError(f"Comando não encontrado no PATH: {name}")


def extract_to_wav(
    input_path: Path,
    output_wav: Path,
    sample_rate: int = 16000,
    log: Optional[LogFn] = None,
) -> Path:
    """Converte qualquer formato pra WAV mono no sample_rate desejado via ffmpeg."""
    _ensure_command("ffmpeg")
    input_path = Path(input_path)
    if not input_path.exists():
        raise FileNotFoundError(input_path)
    output_wav = Path(output_wav)
    output_wav.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-i", str(input_path),
        "-vn", "-ac", "1", "-ar", str(sample_rate),
        str(output_wav),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg failed: {result.stderr.strip()}")
    if log:
        log(f"extracted -> {output_wav.name}")
    return output_wav


_DEMUCS_MODEL_CACHE: dict = {}


def separate_vocals_demucs(
    input_wav: Path,
    output_dir: Path,
    model_name: str = "htdemucs",
    device: str = "cuda",
    log: Optional[LogFn] = None,
) -> Path:
    """Separa stem 'vocals' usando API low-level do Demucs.

    Saída: <output_dir>/<basename>_vocals.wav (44.1 kHz stereo).
    """
    import numpy as np
    import soundfile as sf
    import torch
    import julius
    from demucs.pretrained import get_model
    from demucs.apply import apply_model

    input_wav = Path(input_wav)
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    out_path = output_dir / f"{input_wav.stem}_vocals.wav"

    if out_path.exists():
        if log:
            log(f"demucs cache hit: {out_path.name}")
        return out_path

    if log:
        log(f"demucs ({model_name}/{device}) on {input_wav.name}")

    audio_np, sr = sf.read(str(input_wav), dtype="float32")
    if audio_np.ndim == 1:
        audio_np = np.stack([audio_np, audio_np], axis=0)
    else:
        audio_np = audio_np.T

    audio_t = torch.from_numpy(audio_np)

    cache_key = (model_name, device)
    if cache_key not in _DEMUCS_MODEL_CACHE:
        model = get_model(model_name)
        model.to(device).eval()
        _DEMUCS_MODEL_CACHE[cache_key] = model
    model = _DEMUCS_MODEL_CACHE[cache_key]

    target_sr = int(model.samplerate)
    if sr != target_sr:
        audio_t = julius.resample_frac(audio_t, sr, target_sr)

    audio_t = audio_t.to(device).unsqueeze(0)
    with torch.no_grad():
        out = apply_model(model, audio_t, device=device, progress=False, num_workers=0)

    vocals_idx = model.sources.index("vocals")
    vocals = out[0, vocals_idx].cpu().numpy().T

    sf.write(str(out_path), vocals, target_sr)
    return out_path


def vad_segments_silero(
    input_wav: Path,
    sample_rate: int = 16000,
    min_silence_ms: int = 250,
    threshold: float = 0.5,
) -> list[tuple[float, float]]:
    """Retorna lista de (start_sec, end_sec) onde há fala."""
    import soundfile as sf
    import numpy as np
    import torch
    from silero_vad import load_silero_vad, get_speech_timestamps

    input_wav = Path(input_wav)
    audio, sr = sf.read(str(input_wav))
    if audio.ndim > 1:
        audio = audio.mean(axis=1)
    if sr != sample_rate:
        raise ValueError(f"Sample rate {sr} != {sample_rate}; rerun extract_to_wav.")

    tensor = torch.from_numpy(audio.astype(np.float32))
    model = load_silero_vad()
    raw = get_speech_timestamps(
        tensor,
        model,
        sampling_rate=sample_rate,
        threshold=threshold,
        min_silence_duration_ms=min_silence_ms,
        return_seconds=True,
    )
    return [(float(s["start"]), float(s["end"])) for s in raw]


def chunk_vad_segments(
    segments: list[tuple[float, float]],
    min_seconds: float = 5.0,
    max_seconds: float = 30.0,
    merge_gap_seconds: float = 0.6,
) -> list[tuple[float, float]]:
    """Agrupa segmentos VAD em chunks min..max segundos.

    - Subdivide segmentos > max_seconds em pedaços iguais
    - Une contíguos com gap <= merge_gap_seconds
    - Descarta resultado final < min_seconds
    """
    if not segments:
        return []

    expanded: list[tuple[float, float]] = []
    for s, e in segments:
        dur = e - s
        if dur <= max_seconds:
            expanded.append((s, e))
        else:
            n = math.ceil(dur / max_seconds)
            step = dur / n
            for i in range(n):
                expanded.append((s + i * step, s + (i + 1) * step))

    out: list[tuple[float, float]] = []
    cur_start, cur_end = expanded[0]
    for nxt_start, nxt_end in expanded[1:]:
        gap = nxt_start - cur_end
        new_dur = nxt_end - cur_start
        if gap <= merge_gap_seconds and new_dur <= max_seconds:
            cur_end = nxt_end
        else:
            out.append((cur_start, cur_end))
            cur_start, cur_end = nxt_start, nxt_end
    out.append((cur_start, cur_end))
    return [(s, e) for s, e in out if (e - s) >= min_seconds]


def cut_audio_by_segments(
    input_wav: Path,
    segments: list[tuple[float, float]],
    output_dir: Path,
    prefix: str = "voice_",
    start_index: int = 0,
    log: Optional[LogFn] = None,
) -> list[Path]:
    """Corta o WAV em pedaços segundo a lista (start,end). Cria .txt vazio ao lado."""
    _ensure_command("ffmpeg")
    input_wav = Path(input_wav)
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    written: list[Path] = []
    for i, (start, end) in enumerate(segments):
        duration = end - start
        idx = start_index + i
        out_path = output_dir / f"{prefix}{idx:04d}.wav"
        cmd = [
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
            "-ss", f"{start:.3f}",
            "-i", str(input_wav),
            "-t", f"{duration:.3f}",
            "-ac", "1", "-ar", "16000",
            str(out_path),
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            if log:
                log(f"[skip] segment {idx} failed: {result.stderr.strip()}")
            continue
        out_path.with_suffix(".txt").write_text("", encoding="utf-8")
        written.append(out_path)
    if log:
        log(f"cut {len(written)} segments")
    return written
