#!/usr/bin/env python3
"""Backfill de referência: corta N seg de um áudio local e sobe no R2 como a
referência de uma voz (key determinística <user>/<voice>/ref/auto.wav).

Não toca no banco — o caminho da key é impresso pra você gravar no DB depois.
Lê R2_* do .env.local da raiz.

Uso:
  python backfill_reference.py --audio "<path>" --user <uid> --voice <vid> [--seconds 120]
"""
from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def load_env(path: Path) -> dict[str, str]:
    env: dict[str, str] = {}
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--audio", required=True)
    ap.add_argument("--user", required=True)
    ap.add_argument("--voice", required=True)
    ap.add_argument("--seconds", type=int, default=120)
    ap.add_argument("--env", default=str(ROOT / ".env.local"))
    args = ap.parse_args()

    src = Path(args.audio)
    if not src.exists():
        print(f"áudio não encontrado: {src}")
        return 1

    ffmpeg = shutil.which("ffmpeg") or r"C:\ffmpeg\bin\ffmpeg.exe"
    key = f"{args.user}/{args.voice}/ref/auto.wav"

    with tempfile.TemporaryDirectory() as td:
        out = Path(td) / "auto.wav"
        cmd = [
            ffmpeg, "-hide_banner", "-loglevel", "error", "-y",
            "-i", str(src),
            "-t", str(args.seconds),
            "-ac", "1", "-ar", "16000",
            str(out),
        ]
        r = subprocess.run(cmd, capture_output=True, text=True)
        if r.returncode != 0:
            print(f"ffmpeg falhou: {r.stderr.strip()}")
            return 1
        size = out.stat().st_size

        env = load_env(Path(args.env))
        import boto3
        from botocore.config import Config

        s3 = boto3.client(
            "s3",
            endpoint_url=env["R2_ENDPOINT"],
            aws_access_key_id=env["R2_ACCESS_KEY_ID"],
            aws_secret_access_key=env["R2_SECRET_ACCESS_KEY"],
            config=Config(signature_version="s3v4"),
            region_name="auto",
        )
        bucket = env["R2_BUCKET_VOICES"]
        with open(out, "rb") as fh:
            s3.put_object(Bucket=bucket, Key=key, Body=fh, ContentType="audio/wav")

    print(f"OK upload: bucket={bucket} key={key} bytes={size}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
