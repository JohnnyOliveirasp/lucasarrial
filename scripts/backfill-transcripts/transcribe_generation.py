"""Transcreve um áudio do bucket de generations pra debug.
Uso: python transcribe_generation.py <audio_path-no-R2>
"""
from __future__ import annotations
import os
import sys
import tempfile
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

import boto3
from dotenv import load_dotenv
from faster_whisper import WhisperModel

ENV_FILE = Path(__file__).resolve().parents[2] / "frontend" / ".env.local"
load_dotenv(ENV_FILE)

audio_paths = sys.argv[1:]
if not audio_paths:
    print("uso: python transcribe_generation.py <audio_path> [<audio_path> ...]")
    sys.exit(2)

bucket = os.environ["R2_BUCKET_GENERATIONS"]
s3 = boto3.client(
    "s3",
    endpoint_url=os.environ["R2_ENDPOINT"],
    aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
    aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
    region_name="auto",
)

model_name = os.environ.get("WHISPER_MODEL", "large-v3")
use_vad = os.environ.get("WHISPER_VAD", "0") == "1"
print(f"carregando faster-whisper {model_name} (cpu/int8, vad={use_vad})...")
model = WhisperModel(model_name, device="cpu", compute_type="int8")
print("modelo pronto\n")

for audio_path in audio_paths:
    with tempfile.TemporaryDirectory() as td:
        suffix = ".mp3" if audio_path.lower().endswith(".mp3") else ".wav"
        local = Path(td) / f"gen{suffix}"
        print(f"=== {audio_path}")
        print(f"baixando {bucket}/{audio_path} ...")
        s3.download_file(bucket, audio_path, str(local))
        size_mb = local.stat().st_size / 1024 / 1024
        print(f"  {size_mb:.2f} MB")
        print("transcrevendo...")
        segments, info = model.transcribe(
            str(local), language="pt", vad_filter=use_vad, beam_size=5,
            condition_on_previous_text=False,
        )
        print(f"  duração detectada: {info.duration:.2f}s\n")
        prev_end = 0.0
        full = []
        for seg in segments:
            gap = seg.start - prev_end
            gap_mark = f"  [gap {gap:.2f}s]" if gap >= 0.30 else ""
            line = f"[{seg.start:6.2f}s -> {seg.end:6.2f}s] {seg.text.strip()}{gap_mark}"
            print(line)
            full.append(seg.text.strip())
            prev_end = seg.end
        print(f"\nTOTAL chars: {len(' '.join(full))}\n")
