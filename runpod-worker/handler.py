"""RunPod Serverless handler — VoxCPM2 voice cloning.

Rotas (event['input']['type']):
  - "train":      pipeline completo Demucs+VAD+Whisper+train+upload LoRA
  - "inference":  gera áudio a partir de texto + LoRA opcional
  - "health":     ping (warmup, debug)

Payload de `train`:
  {
    "type": "train",
    "voice_id": "<uuid>",
    "audio_urls": ["https://r2.../audio_001.mp3?sig=...", ...],
    "lora_upload_url": "https://r2.../lora.safetensors?sig=PUT...",
    "max_steps": 500,            (opcional)
    "language": "pt"             (opcional, default "pt")
  }

Resposta:
  {
    "voice_id": "...",
    "lora_uploaded": true,
    "elapsed_seconds": 847.3,
    "steps": 500,
    "trainer_returncode": 0,
    "stdout_tail": "...",
    "stderr_tail": "..."
  }
"""

from __future__ import annotations

import base64
import io
import json
import os
import shutil
import time
import traceback
from pathlib import Path
from typing import Any

import runpod
import soundfile as sf
from huggingface_hub import snapshot_download

# NNPACK não é suportado no hardware dos workers e polui o log com milhares de
# warnings "Could not initialize NNPACK". Desligar elimina o spam (cosmético).
try:
    import torch

    torch.backends.nnpack.enabled = False
except Exception:
    pass

MODEL_ID = "openbmb/VoxCPM2"
MODEL_DIR = Path(os.environ.get("VOXCPM_MODEL_DIR", "/workspace/models/VoxCPM2"))
VOXCPM_REPO = Path(os.environ.get("VOXCPM_REPO", "/app/VoxCPM"))
WORKSPACE = Path(os.environ.get("WORKSPACE_DIR", "/workspace/jobs"))

_MODEL = None  # voxcpm.core.VoxCPM, carregado lazy para inferência


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


# ───────────────────────────────────────────────────────────────
# TRAIN
# ───────────────────────────────────────────────────────────────

def _handle_train(inp: dict) -> dict:
    from voice_pipeline import (
        download_to_dir,
        upload_file_to_presigned_url,
        extract_to_wav,
        separate_vocals_demucs,
        vad_segments_silero,
        chunk_vad_segments,
        cut_audio_by_segments,
        transcribe_audio_folder,
        build_train_manifest,
        create_training_config,
        run_training,
    )

    voice_id = inp.get("voice_id") or "anonymous"
    audio_urls = inp.get("audio_urls") or []
    lora_upload_url = inp.get("lora_upload_url")
    max_steps = int(inp.get("max_steps", 500))
    save_interval = int(inp.get("save_interval", max(50, max_steps // 4)))
    language = inp.get("language", "pt")
    whisper_model = inp.get("whisper_model", "large-v3")

    if not audio_urls:
        return {"error": "missing 'audio_urls'"}
    if not lora_upload_url:
        return {"error": "missing 'lora_upload_url'"}

    job_dir = WORKSPACE / voice_id
    raw_dir = job_dir / "raw"
    vocals_dir = job_dir / "vocals"
    norm_dir = job_dir / "norm"
    dataset_dir = job_dir / "dataset"
    lora_runs = job_dir / "lora_runs"
    run_name = f"voice_{voice_id[:8]}"

    if job_dir.exists():
        shutil.rmtree(job_dir, ignore_errors=True)
    job_dir.mkdir(parents=True, exist_ok=True)

    t0 = time.monotonic()
    _ensure_model_downloaded()

    _log("info", "train.download.start", count=len(audio_urls))
    downloaded = download_to_dir(audio_urls, raw_dir)
    _log("info", "train.download.done", count=len(downloaded))

    # Pipeline por arquivo
    next_idx = 0
    for src in downloaded:
        _log("info", "train.preprocess", file=src.name)
        # Demucs precisa de WAV stereo 44.1k; nosso extract gera mono 16k.
        # Estratégia: passa direto pro Demucs (que aceita qualquer formato via soundfile).
        # Mas Demucs lê via soundfile e isso falha em MP3 — então extract pra WAV intermediário stereo.
        # Solução simples: ffmpeg → WAV stereo 44.1k temp; Demucs lê; depois normaliza pra mono 16k.
        stereo_wav = vocals_dir / f"{src.stem}_in.wav"
        stereo_wav.parent.mkdir(parents=True, exist_ok=True)
        _run_ffmpeg_stereo_44k(src, stereo_wav)

        vocals_wav = separate_vocals_demucs(stereo_wav, vocals_dir, log=lambda m: _log("info", "demucs", detail=m))
        normalized = norm_dir / f"{src.stem}_mono16k.wav"
        extract_to_wav(vocals_wav, normalized, sample_rate=16000)

        vad = vad_segments_silero(normalized)
        chunks = chunk_vad_segments(vad, min_seconds=5.0, max_seconds=30.0)
        cut = cut_audio_by_segments(normalized, chunks, dataset_dir, start_index=next_idx)
        next_idx += len(cut)
        _log("info", "train.preprocess.done", file=src.name, chunks=len(cut))

    if next_idx == 0:
        return {"error": "no usable speech segments after VAD/chunk"}

    _log("info", "train.whisper.start", model=whisper_model)
    transcribe_audio_folder(
        dataset_dir,
        model_name=whisper_model,
        language=language,
        log=lambda m: _log("info", "whisper", detail=m),
    )
    _log("info", "train.whisper.done")

    manifest = build_train_manifest(dataset_dir)
    config = create_training_config(
        VOXCPM_REPO,
        manifest,
        MODEL_DIR,
        save_path=lora_runs / run_name,
        run_name=run_name,
        max_steps=max_steps,
        save_interval=save_interval,
    )

    _log("info", "train.trainer.start", config=str(config), max_steps=max_steps)
    result = run_training(VOXCPM_REPO, config, log=lambda m: _log("info", "trainer", detail=m))
    _log("info", "train.trainer.done", returncode=result["returncode"])

    if result["returncode"] != 0:
        return {
            "voice_id": voice_id,
            "error": "trainer failed",
            "trainer_returncode": result["returncode"],
            "stdout_tail": result["stdout_tail"],
            "stderr_tail": result["stderr_tail"],
        }

    # Upload LoRA
    latest_lora = lora_runs / run_name / "latest" / "lora_weights.safetensors"
    if not latest_lora.exists():
        # fallback: pega o maior step_*
        steps = sorted((lora_runs / run_name).glob("step_*/lora_weights.safetensors"))
        if not steps:
            return {"voice_id": voice_id, "error": "no safetensors produced"}
        latest_lora = steps[-1]

    _log("info", "train.upload.start", file=str(latest_lora))
    upload_file_to_presigned_url(
        latest_lora,
        lora_upload_url,
        content_type="application/octet-stream",
    )
    _log("info", "train.upload.done")

    elapsed = time.monotonic() - t0
    return {
        "voice_id": voice_id,
        "lora_uploaded": True,
        "elapsed_seconds": round(elapsed, 2),
        "steps": max_steps,
        "trainer_returncode": 0,
        "dataset_chunks": next_idx,
    }


def _run_ffmpeg_stereo_44k(src: Path, dst: Path) -> None:
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


# ───────────────────────────────────────────────────────────────
# INFERENCE
# ───────────────────────────────────────────────────────────────

_LORA_CACHE_DIR = Path(os.environ.get("LORA_CACHE_DIR", "/workspace/loras"))


def _ensure_local_from_url(url: str, target_dir: Path, label: str) -> Path:
    """Baixa URL pra target_dir/<basename>. Cacheia: se já existe, reusa."""
    from voice_pipeline import download_to_dir
    target_dir.mkdir(parents=True, exist_ok=True)
    # Hash da URL pra evitar colisão de basename
    import hashlib
    h = hashlib.sha256(url.split("?", 1)[0].encode()).hexdigest()[:16]
    base = url.split("?", 1)[0].rsplit("/", 1)[-1] or "file.bin"
    base = "".join(c if c.isalnum() or c in "._-" else "_" for c in base)
    target = target_dir / f"{h}_{base}"
    if target.exists() and target.stat().st_size > 0:
        _log("info", "cache.hit", label=label, path=str(target))
        return target
    paths = download_to_dir([url], target_dir)
    # download_to_dir nomeia como 000_<basename>; rename pra ter cache estável
    paths[0].rename(target)
    return target


def _handle_inference(inp: dict) -> dict:
    text = inp.get("text")
    if not text:
        return {"error": "missing 'text'"}

    prompt_wav_url = inp.get("prompt_wav_url")
    prompt_text = inp.get("prompt_text")
    lora_url = inp.get("lora_url")
    output_upload_url = inp.get("output_upload_url")
    cfg_value = float(inp.get("cfg_value", 2.0))
    inference_timesteps = int(inp.get("inference_timesteps", 10))
    normalize = bool(inp.get("normalize", False))

    if prompt_text and not prompt_wav_url:
        return {"error": "prompt_text provided without prompt_wav_url"}

    from voice_pipeline import transcribe_file, upload_file_to_presigned_url

    # 1. Baixa LoRA (cache local) + carrega modelo
    lora_path: Path | None = None
    if lora_url:
        lora_path = _ensure_local_from_url(lora_url, _LORA_CACHE_DIR, "lora")

    # 2. Baixa referência (sempre novo)
    prompt_wav_local: str | None = None
    if prompt_wav_url:
        ref_dir = WORKSPACE / "refs"
        ref_path = _ensure_local_from_url(prompt_wav_url, ref_dir, "ref")
        prompt_wav_local = str(ref_path)

    # 2b. Se houver referência mas NÃO veio transcrição, transcreve via Whisper.
    if prompt_wav_local and not prompt_text:
        whisper_model = inp.get("whisper_model", "large-v3")
        language = inp.get("language", "pt")
        _log("info", "inference.transcribe.start", model=whisper_model)
        prompt_text = transcribe_file(
            prompt_wav_local,
            model_name=whisper_model,
            language=language,
            log=lambda m: _log("info", "whisper", detail=m),
        )
        _log("info", "inference.transcribe.done", text_len=len(prompt_text or ""))

    # 3. Carrega modelo (com ou sem LoRA)
    # Por simplicidade, NÃO usamos cache do modelo VoxCPM com LoRA (cada call carrega).
    # Em produção: cachear por lora_url.
    from voxcpm import VoxCPM
    _ensure_model_downloaded()
    _log("info", "model.load.start", lora=bool(lora_path))
    model = VoxCPM.from_pretrained(
        str(MODEL_DIR),
        load_denoiser=False,
        lora_weights_path=str(lora_path) if lora_path else None,
    )
    sample_rate = model.tts_model.sample_rate

    _log("info", "inference.start", text_len=len(text), has_clone=bool(prompt_wav_local), has_lora=bool(lora_path))
    t0 = time.monotonic()
    wav = model.generate(
        text=text,
        prompt_wav_path=prompt_wav_local,
        prompt_text=prompt_text,
        cfg_value=cfg_value,
        inference_timesteps=inference_timesteps,
        normalize=normalize,
    )
    elapsed = time.monotonic() - t0
    _log("info", "inference.done", elapsed_s=round(elapsed, 2), samples=len(wav))

    # 4. Upload ou base64
    if output_upload_url:
        out_path = WORKSPACE / f"gen_{int(time.time() * 1000)}.wav"
        out_path.parent.mkdir(parents=True, exist_ok=True)
        sf.write(str(out_path), wav, sample_rate)
        upload_file_to_presigned_url(out_path, output_upload_url, content_type="audio/wav")
        return {
            "uploaded": True,
            "sample_rate": sample_rate,
            "duration_s": round(len(wav) / sample_rate, 3),
            "elapsed_s": round(elapsed, 2),
        }

    return {
        "audio_base64": _wav_to_base64(wav, sample_rate),
        "sample_rate": sample_rate,
        "duration_s": round(len(wav) / sample_rate, 3),
        "elapsed_s": round(elapsed, 2),
    }


# ───────────────────────────────────────────────────────────────
# DISPATCH
# ───────────────────────────────────────────────────────────────

def handler(event: dict) -> dict:
    inp = event.get("input") or {}
    job_type = inp.get("type", "inference")
    _log("info", "job.start", type=job_type)
    try:
        if job_type == "train":
            return _handle_train(inp)
        if job_type == "inference":
            return _handle_inference(inp)
        if job_type == "health":
            return {"ok": True, "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
        return {"error": f"unknown type '{job_type}' (use train/inference/health)"}
    except Exception as exc:
        _log("error", "job.failed", error=str(exc), type=job_type, tb=traceback.format_exc()[:2000])
        return {"error": str(exc), "type": job_type, "traceback": traceback.format_exc()[:2000]}


if __name__ == "__main__":
    runpod.serverless.start({"handler": handler})
