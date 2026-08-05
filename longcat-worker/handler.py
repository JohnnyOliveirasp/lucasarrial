"""RunPod Serverless handler — LongCat Avatar 1.5 (vídeo avatar premium).

A imagem do container é LEVE: todo o peso (repo LongCat-Video com script
patcheado, venv py3.10, weights 148GB, Real-ESRGAN) mora no NETWORK VOLUME
US-CA-2 (8t4xooig2w), montado pelo serverless em /runpod-volume. O venv foi
criado com prefixo /workspace, então o handler cria o symlink
/workspace -> /runpod-volume no boot e tudo funciona com os paths originais.

Receita validada na POC (T7/T8 + Q1 05/08, "fórmula do Lucas"):
  bf16 (sem distill/int8) · 30 steps · audio_guidance 2.5 · ref_img_index 5 ·
  negative prompt patcheado anti-olhar-baixo (já no script do volume) ·
  áudio SEMPRE WAV mono 44.1k (MP3 trunca em 17,99s no separador vocal) ·
  foto upscalada 4x Real-ESRGAN antes de condicionar.

Rotas (event['input']['type']):
  - "avatar": gera o vídeo completo a partir de foto + áudio
  - "health": ping (warmup, debug)

Payload de `avatar`:
  {
    "type": "avatar",
    "image_url": "https://r2.../foto.jpg?sig=...",       (GET presigned)
    "audio_url": "https://r2.../audio.mp3?sig=...",      (GET presigned)
    "output_upload_url": "https://r2.../out.mp4?sig=PUT...",
    "prompt": "<descrição EN da pessoa>",                (opcional; app gera via
               Haiku vision — sem ela usa comportamento genérico calm3)
    "steps": 30,               (opcional)
    "audio_guidance": 2.5,     (opcional)
    "ref_img_index": 5,        (opcional)
    "max_seconds": 120         (opcional, teto de duração do áudio)
  }

Resposta: { video_uploaded, duration_seconds, num_segments, gpu_count,
            elapsed_seconds, load_seconds, stdout_tail }
"""

from __future__ import annotations

import json
import math
import os
import re
import shutil
import subprocess
import time
import traceback
from pathlib import Path

import requests
import runpod

VOLUME = Path("/runpod-volume")
WORKSPACE = Path("/workspace")
REPO = WORKSPACE / "LongCat-Video"
VENV_BIN = WORKSPACE / "longcat-venv" / "bin"
JOBS = Path("/tmp/jobs")

# Comportamento calm3 validado (T7): contato visual constante, boca contida.
# A descrição FÍSICA da pessoa vem do app (Haiku vision); este sufixo garante
# o comportamento mesmo se o prompt do app vier só com a aparência.
BEHAVIOR_PROMPT = (
    "He or she speaks softly and calmly with subtle restrained mouth movements, "
    "small gentle mouth openings and relaxed articulation, maintaining constant "
    "direct eye contact with the camera lens, eyes wide open and alert at all "
    "times, never looking down or away, with minimal head movement and "
    "occasional natural blinks. Detailed natural skin texture with visible "
    "pores, natural realistic teeth. The camera stays static, keeping the exact "
    "framing of the input image."
)

# v1.5: segmento 1 = 3,72s, cada continuação soma 3,2s (93 frames/25fps, 13 cond).
SEG1_SECONDS = 3.72
SEG_NEXT_SECONDS = 3.2


def _log(level: str, msg: str, **meta) -> None:
    entry = {"ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "level": level, "msg": msg}
    if meta:
        entry["meta"] = meta
    print(json.dumps(entry, ensure_ascii=False), flush=True)


def _ensure_workspace_link() -> None:
    """O venv do volume tem paths absolutos /workspace/... — recria o link."""
    if WORKSPACE.exists() and not WORKSPACE.is_symlink():
        # imagem base pode trazer /workspace vazio; só substitui se for descartável
        try:
            WORKSPACE.rmdir()
        except OSError:
            return  # já é um /workspace real com conteúdo (pod normal) — não mexe
    if not WORKSPACE.exists():
        WORKSPACE.symlink_to(VOLUME)


def _gpu_count() -> int:
    env_n = os.environ.get("RUNPOD_GPU_COUNT")
    if env_n and env_n.isdigit() and int(env_n) >= 1:
        return int(env_n)
    try:
        out = subprocess.run(["nvidia-smi", "-L"], capture_output=True, text=True, timeout=30)
        return max(1, len([l for l in out.stdout.splitlines() if l.strip().startswith("GPU")]))
    except Exception:
        return 1


def _download(url: str, dest: Path) -> None:
    with requests.get(url, stream=True, timeout=300) as r:
        r.raise_for_status()
        with open(dest, "wb") as f:
            for chunk in r.iter_content(1024 * 1024):
                f.write(chunk)


def _upload(path: Path, url: str, content_type: str) -> None:
    with open(path, "rb") as f:
        r = requests.put(url, data=f, headers={"Content-Type": content_type}, timeout=900)
    r.raise_for_status()


def _ffprobe_duration(path: Path) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
        capture_output=True, text=True, timeout=60,
    )
    return float(out.stdout.strip())


def _num_segments(audio_seconds: float) -> int:
    if audio_seconds <= SEG1_SECONDS:
        return 1
    return 1 + math.ceil((audio_seconds - SEG1_SECONDS) / SEG_NEXT_SECONDS)


def _run_avatar(inp: dict) -> dict:
    t0 = time.time()
    _ensure_workspace_link()

    image_url = inp.get("image_url")
    audio_url = inp.get("audio_url")
    output_upload_url = inp.get("output_upload_url")
    if not image_url or not audio_url or not output_upload_url:
        return {"error": "missing image_url/audio_url/output_upload_url"}

    steps = int(inp.get("steps", 30))
    audio_guidance = float(inp.get("audio_guidance", 2.5))
    ref_img_index = int(inp.get("ref_img_index", 5))
    max_seconds = float(inp.get("max_seconds", 120))
    prompt = (inp.get("prompt") or "").strip()
    if BEHAVIOR_PROMPT[:40] not in prompt:
        prompt = (prompt + " " + BEHAVIOR_PROMPT).strip()

    job_dir = JOBS / str(int(t0))
    job_dir.mkdir(parents=True, exist_ok=True)
    raw_img = job_dir / "input_image"
    raw_audio = job_dir / "input_audio"
    wav = job_dir / "audio.wav"
    up_img = job_dir / "image_upscaled.png"
    out_dir = job_dir / "out"

    try:
        _download(image_url, raw_img)
        _download(audio_url, raw_audio)

        # ÁUDIO: SEMPRE WAV mono 44.1k (regra dura da POC — MP3 trunca no separador)
        subprocess.run(
            ["ffmpeg", "-y", "-i", str(raw_audio), "-ar", "44100", "-ac", "1",
             "-c:a", "pcm_s16le", str(wav)],
            check=True, capture_output=True, timeout=300,
        )
        audio_seconds = _ffprobe_duration(wav)
        if audio_seconds > max_seconds:
            return {"error": f"audio too long: {audio_seconds:.1f}s > {max_seconds:.0f}s"}
        segments = _num_segments(audio_seconds)

        # FOTO: upscale 4x Real-ESRGAN (spandrel, dentro do venv do volume)
        r = subprocess.run(
            [str(VENV_BIN / "python"), "/app/upscale.py", str(raw_img), str(up_img)],
            capture_output=True, text=True, timeout=600,
        )
        if r.returncode != 0:
            _log("warn", "upscale.failed_using_original", stderr=r.stderr[-500:])
            shutil.copy(raw_img, up_img)

        input_json = job_dir / "input.json"
        input_json.write_text(json.dumps({
            "prompt": prompt,
            "cond_image": str(up_img),
            "cond_audio": {"person1": str(wav)},
        }), encoding="utf-8")

        gpus = _gpu_count()
        _log("info", "generate.start", segments=segments, gpus=gpus,
             audio_seconds=round(audio_seconds, 2), steps=steps)
        t_load = time.time()
        env = dict(os.environ)
        env["NCCL_NVLS_ENABLE"] = "0"  # H100 em container: NVLS quebra o NCCL (Q1 05/08)
        gen = subprocess.run(
            [str(VENV_BIN / "torchrun"), f"--nproc_per_node={gpus}",
             "run_demo_avatar_single_audio_to_video.py",
             f"--context_parallel_size={gpus}",
             "--checkpoint_dir=./weights/LongCat-Video-Avatar-1.5",
             "--stage_1=ai2v",
             f"--input_json={input_json}",
             f"--num_segments={segments}",
             f"--num_inference_steps={steps}",
             f"--ref_img_index={ref_img_index}",
             "--audio_guidance_scale", str(audio_guidance),
             "--model_type", "avatar-v1.5",
             f"--output_dir={out_dir}"],
            cwd=str(REPO), env=env, capture_output=True, text=True,
            timeout=int(inp.get("timeout_seconds", 5400)),
        )
        if gen.returncode != 0:
            return {
                "error": f"generation failed rc={gen.returncode}",
                "stdout_tail": gen.stdout[-1200:],
                "stderr_tail": gen.stderr[-1200:],
            }

        # último video_continue_N (acumulado com áudio) = vídeo completo
        mp4s = sorted(
            out_dir.glob("*.mp4"),
            key=lambda p: int(re.search(r"(\d+)", p.stem).group(1)) if re.search(r"(\d+)", p.stem) else 0,
        )
        if not mp4s:
            return {"error": "no output mp4", "stdout_tail": gen.stdout[-1200:]}
        final_raw = mp4s[-1]

        # apara a cauda muda (vídeo = segments*3.2+0.52 > áudio)
        final = job_dir / "final.mp4"
        subprocess.run(
            ["ffmpeg", "-y", "-i", str(final_raw), "-t", f"{audio_seconds + 0.1:.2f}",
             "-c", "copy", str(final)],
            check=True, capture_output=True, timeout=300,
        )

        _upload(final, output_upload_url, "video/mp4")
        return {
            "video_uploaded": True,
            "duration_seconds": round(audio_seconds, 2),
            "num_segments": segments,
            "gpu_count": gpus,
            "steps": steps,
            "load_seconds": round(t_load - t0, 1),
            "elapsed_seconds": round(time.time() - t0, 1),
            "stdout_tail": gen.stdout[-400:],
        }
    finally:
        shutil.rmtree(job_dir, ignore_errors=True)


def handler(event):
    inp = (event or {}).get("input") or {}
    kind = inp.get("type", "avatar")
    try:
        if kind == "health":
            _ensure_workspace_link()
            return {
                "ok": True,
                "gpu_count": _gpu_count(),
                "volume_mounted": VOLUME.exists(),
                "weights": (REPO / "weights" / "LongCat-Video-Avatar-1.5").exists(),
                "venv": (VENV_BIN / "torchrun").exists(),
            }
        if kind == "avatar":
            return _run_avatar(inp)
        return {"error": f"unknown type '{kind}'"}
    except Exception as e:  # noqa: BLE001 — serverless: erro vira resposta, não crash
        _log("error", "handler.exception", err=str(e))
        return {"error": str(e), "traceback": traceback.format_exc()[-1500:]}


runpod.serverless.start({"handler": handler})
