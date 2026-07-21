"""Transcrição (Whisper) + manifesto JSONL + config YAML + run trainer."""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Callable, Optional

LogFn = Callable[[str], None]

# Cache do modelo Whisper por (model, device, compute_type) — reusado entre o
# treino e as inferências enquanto o worker está quente (evita recarregar 3GB).
_WHISPER_CACHE: dict = {}


def _get_whisper(model_name: str, device: str, compute_type: str):
    from faster_whisper import WhisperModel

    key = (model_name, device, compute_type)
    if key not in _WHISPER_CACHE:
        _WHISPER_CACHE[key] = WhisperModel(model_name, device=device, compute_type=compute_type)
    return _WHISPER_CACHE[key]


def detect_language(
    audio_path: Path | str,
    model_name: str = "large-v3",
    device: str = "cuda",
    compute_type: str = "float16",
) -> "tuple[str, float]":
    """Detecta o idioma FALADO no áudio (código ISO: 'pt'/'es'/'en'...) e a
    confiança 0..1. Caso Joana 2026-07-21: voz em espanhol era transcrita como
    pt em TODO o pipeline (ref em portunhol, dataset errado, QA no idioma
    errado). O chamador decide o fallback quando a confiança é baixa."""
    model = _get_whisper(model_name, device, compute_type)
    _segments, info = model.transcribe(
        str(audio_path), language=None, vad_filter=True, beam_size=1
    )
    return (info.language or "pt", float(info.language_probability or 0.0))


def transcribe_file(
    audio_path: Path | str,
    model_name: str = "large-v3",
    language: str = "pt",
    device: str = "cuda",
    compute_type: str = "float16",
    log: Optional[LogFn] = None,
) -> str:
    """Transcreve UM arquivo de áudio e retorna o texto (usado na inferência
    pra gerar a transcrição da referência automaticamente)."""
    if log:
        log(f"whisper transcribe {Path(audio_path).name} ({model_name}/{device})")
    model = _get_whisper(model_name, device, compute_type)
    segments, _info = model.transcribe(
        str(audio_path),
        language=language or "pt",
        vad_filter=True,
        beam_size=5,
    )
    return " ".join(seg.text.strip() for seg in segments).strip()


def transcribe_audio_folder(
    dataset_dir: Path,
    model_name: str = "large-v3",
    language: str = "pt",
    device: str = "cuda",
    compute_type: str = "float16",
    log: Optional[LogFn] = None,
) -> None:
    """Transcreve voice_*.wav e escreve voice_*.txt ao lado."""
    dataset_dir = Path(dataset_dir)
    wav_files = sorted(dataset_dir.glob("voice_*.wav"))
    if not wav_files:
        raise RuntimeError(f"Nenhum WAV em {dataset_dir}")

    if log:
        log(f"loading Whisper {model_name} ({device}/{compute_type})")
    model = _get_whisper(model_name, device, compute_type)

    for i, wav_path in enumerate(wav_files, start=1):
        segments, _info = model.transcribe(
            str(wav_path),
            language=language or "pt",
            vad_filter=True,
            beam_size=5,
        )
        text = " ".join(seg.text.strip() for seg in segments).strip()
        wav_path.with_suffix(".txt").write_text(text + "\n", encoding="utf-8")
        if log and i % 25 == 0:
            log(f"  whisper {i}/{len(wav_files)}")


def build_train_manifest(dataset_dir: Path, output_name: str = "train.jsonl") -> Path:
    """Lê pares voice_*.wav + voice_*.txt e escreve JSONL. Pula textos vazios."""
    dataset_dir = Path(dataset_dir)
    manifest_path = dataset_dir / output_name
    valid = 0
    with manifest_path.open("w", encoding="utf-8") as out:
        for wav_path in sorted(dataset_dir.glob("voice_*.wav")):
            txt_path = wav_path.with_suffix(".txt")
            if not txt_path.exists():
                continue
            text = txt_path.read_text(encoding="utf-8").strip()
            if not text:
                continue
            out.write(
                json.dumps(
                    {"audio": str(wav_path.resolve()), "text": text},
                    ensure_ascii=False,
                )
                + "\n"
            )
            valid += 1
    if valid == 0:
        raise RuntimeError("Nenhum par WAV/TXT válido para gerar train.jsonl.")
    return manifest_path


def _detect_sample_rates(pretrained_path: Path) -> tuple[int, int]:
    cfg = pretrained_path / "config.json"
    sample_rate, out_sample_rate = 16000, 48000
    if cfg.exists():
        try:
            data = json.loads(cfg.read_text(encoding="utf-8"))
            avc = data.get("audio_vae_config", {}) or {}
            sample_rate = int(avc.get("sample_rate", sample_rate))
            out_sample_rate = int(avc.get("out_sample_rate", out_sample_rate))
        except (json.JSONDecodeError, ValueError, OSError):
            pass
    return sample_rate, out_sample_rate


def create_training_config(
    voxcpm_repo: Path,
    train_manifest: Path,
    pretrained_path: Path,
    save_path: Path,
    run_name: str,
    max_steps: int = 500,
    save_interval: int = 250,
    batch_size: int = 1,
    grad_accum_steps: int = 1,
    learning_rate: float = 1e-4,
    log_interval: int = 10,
    lora_rank: int = 32,
    lora_alpha: int = 16,
) -> Path:
    save_path = Path(save_path)
    save_path.mkdir(parents=True, exist_ok=True)
    config_path = save_path / f"{run_name}_voxcpm2_lora.yaml"
    warmup_steps = max(1, int(max_steps * 0.1))
    sample_rate, out_sample_rate = _detect_sample_rates(Path(pretrained_path))

    content = f"""pretrained_path: {Path(pretrained_path).as_posix()}
train_manifest: {Path(train_manifest).as_posix()}
val_manifest: null
sample_rate: {sample_rate}
out_sample_rate: {out_sample_rate}
batch_size: {batch_size}
grad_accum_steps: {grad_accum_steps}
num_workers: 0
num_iters: {max_steps}
log_interval: {log_interval}
valid_interval: {save_interval}
save_interval: {save_interval}
learning_rate: {learning_rate}
weight_decay: 0.01
warmup_steps: {warmup_steps}
max_steps: {max_steps}
max_grad_norm: 1.0
save_path: {save_path.as_posix()}
tensorboard: null
lambdas:
  loss/diff: 1.0
  loss/stop: 1.0
lora:
  enable_lm: true
  enable_dit: true
  enable_proj: false
  r: {lora_rank}
  alpha: {lora_alpha}
  dropout: 0.0
  target_modules_lm:
  - q_proj
  - v_proj
  - k_proj
  - o_proj
  target_modules_dit:
  - q_proj
  - v_proj
  - k_proj
  - o_proj
"""
    config_path.write_text(content, encoding="utf-8")
    return config_path


def run_training(
    voxcpm_repo: Path,
    config_path: Path,
    log: Optional[LogFn] = None,
) -> dict:
    """Roda train_voxcpm_finetune.py via subprocess. Retorna {returncode, stdout_tail, stderr_tail}."""
    voxcpm_repo = Path(voxcpm_repo)
    config_path = Path(config_path)
    script = voxcpm_repo / "scripts" / "train_voxcpm_finetune.py"
    if not script.exists():
        raise FileNotFoundError(f"trainer not found at {script}")

    env = os.environ.copy()
    env["PYTHONUNBUFFERED"] = "1"
    env["PYTHONIOENCODING"] = "utf-8"
    env.setdefault("PYTORCH_CUDA_ALLOC_CONF", "expandable_segments:True")

    if log:
        log(f"running trainer cwd={voxcpm_repo} config={config_path.name}")

    proc = subprocess.run(
        [sys.executable, "-u", str(script), "--config_path", str(config_path)],
        cwd=str(voxcpm_repo),
        env=env,
        capture_output=True,
        text=True,
    )
    return {
        "returncode": proc.returncode,
        "stdout_tail": (proc.stdout or "")[-4000:],
        "stderr_tail": (proc.stderr or "")[-2000:],
    }
