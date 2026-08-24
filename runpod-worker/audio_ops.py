"""Operacoes de forma de onda: trim, crossfade, ffmpeg, wav->base64."""
from __future__ import annotations

import base64
import io
import subprocess
from pathlib import Path

import numpy as np
import soundfile as sf


def wav_to_base64(wav, sample_rate: int) -> str:
    buf = io.BytesIO()
    sf.write(buf, wav, sample_rate, format="WAV")
    return base64.b64encode(buf.getvalue()).decode("ascii")


def run_ffmpeg_stereo_44k(src: Path, dst: Path) -> None:
    import subprocess
    dst.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-i", str(src),
        "-vn", "-ac", "2", "-ar", "44100",
        str(dst),
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(f"ffmpeg stereo 44k failed: {r.stderr.strip()}")


def trim_silence(
    wav: np.ndarray, threshold: float = 0.005, pad_samples: int = 0
) -> np.ndarray:
    """Remove amostras de borda abaixo de `threshold` em amplitude absoluta.

    Default = -46 dB. Mantem `pad_samples` de cada lado quando ha audio ativo
    pra nao cortar consoante final/inicial. Se o sinal e' todo silencio, devolve
    como esta. Usado antes de concatenar chunks no chunking por frase: o VoxCPM
    costuma deixar uma "respiracao" no final de cada chunk + boot-up no comeco,
    e a soma disso vira pausa audivel entre chunks.
    """
    if wav.size == 0:
        return wav
    active = np.where(np.abs(wav) > threshold)[0]
    if active.size == 0:
        return wav
    start = max(0, int(active[0]) - pad_samples)
    end = min(wav.size, int(active[-1]) + 1 + pad_samples)
    return wav[start:end]


def crossfade_concat(wavs: list[np.ndarray], fade_samples: int) -> np.ndarray:
    """Concatena com fade linear no overlap de `fade_samples` entre wavs.

    Cada wav fica com a cauda decaindo de 1 -> 0 e a proxima entrando 0 -> 1 na
    mesma janela. A soma e' suave e nao tem clique. Se `fade_samples <= 0`,
    so concatena. Se a janela for maior que algum lado, ajusta pro min.
    """
    if not wavs:
        return np.zeros(0, dtype=np.float32)
    if fade_samples <= 0 or len(wavs) == 1:
        return np.concatenate([w.astype(np.float32, copy=False) for w in wavs])

    result = wavs[0].astype(np.float32, copy=True)
    for nxt in wavs[1:]:
        nxt = nxt.astype(np.float32, copy=False)
        f = max(0, min(fade_samples, len(result), len(nxt)))
        if f == 0:
            result = np.concatenate([result, nxt])
            continue
        fade_out = np.linspace(1.0, 0.0, f, dtype=np.float32)
        fade_in = np.linspace(0.0, 1.0, f, dtype=np.float32)
        overlap = result[-f:] * fade_out + nxt[:f] * fade_in
        result = np.concatenate([result[:-f], overlap, nxt[f:]])
    return result
