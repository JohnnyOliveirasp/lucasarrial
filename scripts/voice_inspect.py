#!/usr/bin/env python3
"""Inspeciona uma voz: referência + áudios de treino no R2 (tamanho/headers).

Roda NO SERVIDOR (lê .env.local). Usa boto3 se disponível; senão só imprime os paths.

Uso:
  python3 voice_inspect.py --voice-id 864b1bf3-e240-4797-9a64-634adb1d1243
"""
from __future__ import annotations

import argparse
import json
import sys
import urllib.request
from pathlib import Path

DEFAULT_ENV = "/mnt/volume/aiverse/frontend/.env.local"


def load_env(path: str) -> dict[str, str]:
    env: dict[str, str] = {}
    for raw in Path(path).read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def query_rest(env: dict[str, str], table: str, params: str) -> list[dict]:
    base = env["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/")
    srk = env["SUPABASE_SERVICE_ROLE_KEY"]
    req = urllib.request.Request(
        f"{base}/rest/v1/{table}?{params}",
        headers={"apikey": srk, "Authorization": f"Bearer {srk}"},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    return data if isinstance(data, list) else [data]


def human(n: int | None) -> str:
    if n is None:
        return "?"
    for unit in ("B", "KB", "MB", "GB"):
        if n < 1024:
            return f"{n:.1f}{unit}"
        n /= 1024
    return f"{n:.1f}TB"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--voice-id", required=True)
    ap.add_argument("--env-file", default=DEFAULT_ENV)
    args = ap.parse_args()

    env = load_env(args.env_file)
    rows = query_rest(
        env, "voices",
        f"id=eq.{args.voice_id}&select=id,name,status,reference_audio_path,raw_audio_paths,lora_path",
    )
    if not rows:
        print("voz não encontrada")
        return 1
    v = rows[0]
    print(f"🎙️  voz '{v.get('name')}' ({v['id']})  status={v.get('status')}")
    ref = v.get("reference_audio_path")
    raw = v.get("raw_audio_paths") or []
    print(f"   reference_audio_path: {ref}")
    print(f"   raw_audio_paths: {len(raw)} arquivos")

    try:
        import boto3  # type: ignore
        from botocore.config import Config  # type: ignore
    except Exception:
        print("\n(boto3 indisponível — só os paths acima)")
        for p in raw[:5]:
            print(f"     - {p}")
        return 0

    s3 = boto3.client(
        "s3",
        endpoint_url=env["R2_ENDPOINT"],
        aws_access_key_id=env["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=env["R2_SECRET_ACCESS_KEY"],
        config=Config(signature_version="s3v4"),
        region_name="auto",
    )
    bucket = env["R2_BUCKET_VOICES"]

    def head(key: str) -> None:
        try:
            h = s3.head_object(Bucket=bucket, Key=key)
            print(f"     ✓ {human(h.get('ContentLength'))}  {h.get('ContentType')}  {key}")
        except Exception as e:  # noqa: BLE001
            print(f"     ✗ ERРО {key}: {e}")

    if ref:
        print("\n📌 REFERÊNCIA (usada na geração):")
        head(ref)
    print(f"\n📂 ÁUDIOS DE TREINO ({len(raw)}):")
    total = 0
    for p in raw:
        try:
            h = s3.head_object(Bucket=bucket, Key=p)
            total += h.get("ContentLength", 0)
            print(f"     ✓ {human(h.get('ContentLength'))}  {p}")
        except Exception as e:  # noqa: BLE001
            print(f"     ✗ {p}: {e}")
    print(f"   total treino: {human(total)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
