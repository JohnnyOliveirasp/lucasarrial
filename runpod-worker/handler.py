"""RunPod Serverless handler for VoxCPM2 — inference + LoRA training.

Routes (event['input']['type']):
  - "inference": gera audio a partir de texto (opcionalmente clonando voz).
  - "train":     treina LoRA a partir de dataset (paths no /workspace).

O modelo VoxCPM2 fica em /workspace/models/VoxCPM2 (baixado no primeiro start).
"""

from __future__ import annotations

import base64
import io
import json
import os
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

import runpod
import soundfile as sf
from huggingface_hub import snapshot_download

MODEL_ID = "openbmb/VoxCPM2"
MODEL_DIR = Path(os.environ.get("VOXCPM_MODEL_DIR", "/workspace/models/VoxCPM2"))
VOXCPM_REPO = Path(os.environ.get("VOXCPM_REPO", "/app/VoxCPM"))

_MODEL = None  # voxcpm.core.VoxCPM, carregado on-demand


def _log(level: str, msg: str, **meta: Any) -> None:
    entry = {"ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "level": level, "msg": msg}
    if meta:
        entry["meta"] = meta
    print(json.dumps(entry, ensure_ascii=False), flush=True)


def _ensure_model_downloaded() -> None:
    if MODEL_DIR.exists() and any(MODEL_DIR.glob("*.safetensors")):
        return
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    _log("info", "model.download.start", model=MODEL_ID, dir=str(MODEL_DIR))
    snapshot_download(repo_id=MODEL_ID, local_dir=str(MODEL_DIR))
    _log("info", "model.download.done", dir=str(MODEL_DIR))


def _load_model():
    global _MODEL
    if _MODEL is not None:
        return _MODEL
    from voxcpm import VoxCPM

    _ensure_model_downloaded()
    _log("info", "model.load.start", dir=str(MODEL_DIR))
    _MODEL = VoxCPM.from_pretrained(str(MODEL_DIR), load_denoiser=False)
    _log("info", "model.load.done", sample_rate=_MODEL.tts_model.sample_rate)
    return _MODEL


def _wav_to_base64(wav, sample_rate: int) -> str:
    buf = io.BytesIO()
    sf.write(buf, wav, sample_rate, format="WAV")
    return base64.b64encode(buf.getvalue()).decode("ascii")


def _handle_inference(inp: dict) -> dict:
    text = inp.get("text")
    if not text:
        return {"error": "missing 'text'"}

    model = _load_model()
    prompt_wav = inp.get("prompt_wav_path")
    prompt_text = inp.get("prompt_text")
    cfg_value = float(inp.get("cfg_value", 2.0))
    inference_timesteps = int(inp.get("inference_timesteps", 10))
    normalize = bool(inp.get("normalize", False))

    if (prompt_wav and not prompt_text) or (prompt_text and not prompt_wav):
        return {"error": "prompt_wav_path and prompt_text must be provided together"}

    _log("info", "inference.start", text_len=len(text), has_clone=bool(prompt_wav))
    t0 = time.monotonic()
    wav = model.generate(
        text=text,
        prompt_wav_path=prompt_wav,
        prompt_text=prompt_text,
        cfg_value=cfg_value,
        inference_timesteps=inference_timesteps,
        normalize=normalize,
    )
    elapsed = time.monotonic() - t0
    sample_rate = model.tts_model.sample_rate
    _log("info", "inference.done", elapsed_s=round(elapsed, 2), samples=len(wav))

    return {
        "audio_base64": _wav_to_base64(wav, sample_rate),
        "sample_rate": sample_rate,
        "duration_s": round(len(wav) / sample_rate, 3),
        "elapsed_s": round(elapsed, 2),
    }


def _handle_train(inp: dict) -> dict:
    config_path = inp.get("config_path")
    if not config_path:
        return {"error": "missing 'config_path' (path on /workspace)"}

    script = VOXCPM_REPO / "scripts" / "train_voxcpm_finetune.py"
    if not script.exists():
        return {"error": f"trainer not found at {script}"}

    env = os.environ.copy()
    env.setdefault("PYTORCH_CUDA_ALLOC_CONF", "expandable_segments:True")

    _log("info", "train.start", config=config_path)
    t0 = time.monotonic()
    proc = subprocess.run(
        [sys.executable, "-u", str(script), "--config_path", config_path],
        cwd=str(VOXCPM_REPO),
        env=env,
        capture_output=True,
        text=True,
    )
    elapsed = time.monotonic() - t0
    _log("info", "train.done", elapsed_s=round(elapsed, 2), returncode=proc.returncode)

    return {
        "returncode": proc.returncode,
        "elapsed_s": round(elapsed, 2),
        "stdout_tail": proc.stdout[-4000:] if proc.stdout else "",
        "stderr_tail": proc.stderr[-2000:] if proc.stderr else "",
    }


def handler(event: dict) -> dict:
    inp = event.get("input") or {}
    job_type = inp.get("type", "inference")
    _log("info", "job.start", type=job_type)
    try:
        if job_type == "inference":
            return _handle_inference(inp)
        if job_type == "train":
            return _handle_train(inp)
        return {"error": f"unknown type '{job_type}' (use 'inference' or 'train')"}
    except Exception as exc:
        _log("error", "job.failed", error=str(exc), type=job_type)
        return {"error": str(exc), "type": job_type}


if __name__ == "__main__":
    runpod.serverless.start({"handler": handler})
