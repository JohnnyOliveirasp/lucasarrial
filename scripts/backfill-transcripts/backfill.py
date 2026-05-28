"""
Backfill LOCAL de voices.reference_transcript.

Pra cada voz no Supabase com `reference_audio_path` setado e
`reference_transcript` null:
  1. Baixa o áudio do R2 (S3-compatível) via boto3.
  2. Transcreve localmente com faster-whisper.
  3. Faz PATCH no Supabase (REST) gravando reference_transcript.

Idempotente: rode quantas vezes quiser; só toca em quem está sem transcrição.

Setup (no diretório `scripts/backfill-transcripts/`):
    python -m venv .venv
    .venv\\Scripts\\activate     # Windows
    # source .venv/bin/activate  # Linux/macOS
    pip install -r requirements.txt

Rodar:
    python backfill.py

Lê as envs de `frontend/.env.local` automaticamente (sobe 2 diretórios).
Pode sobrescrever via env:
    WHISPER_MODEL=medium     # default: large-v3 (mais fiel, mais lento na CPU)
    WHISPER_DEVICE=cuda      # default: cpu
    WHISPER_COMPUTE=int8     # default: int8 (cpu) ou float16 (cuda)
    WHISPER_LANGUAGE=pt      # default: pt
"""
from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path

# Windows console default = cp1252 → quebra em emoji/seta. Força UTF-8.
try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

import boto3
import requests
from dotenv import load_dotenv
from faster_whisper import WhisperModel

# .env.local do frontend (scripts/backfill-transcripts/.. /.. /frontend/.env.local)
ENV_FILE = Path(__file__).resolve().parents[2] / "frontend" / ".env.local"
if not ENV_FILE.exists():
    print(f"[ERRO] não encontrei {ENV_FILE}", file=sys.stderr)
    sys.exit(2)
load_dotenv(ENV_FILE)


def _need(name: str) -> str:
    v = os.environ.get(name)
    if not v:
        print(f"[ERRO] env faltando: {name}", file=sys.stderr)
        sys.exit(2)
    return v


SUPABASE_URL = _need("NEXT_PUBLIC_SUPABASE_URL").rstrip("/")
SERVICE_KEY = _need("SUPABASE_SERVICE_ROLE_KEY")
R2_ENDPOINT = _need("R2_ENDPOINT")
R2_KEY_ID = _need("R2_ACCESS_KEY_ID")
R2_SECRET = _need("R2_SECRET_ACCESS_KEY")
R2_BUCKET = _need("R2_BUCKET_VOICES")

WHISPER_MODEL = os.environ.get("WHISPER_MODEL", "large-v3")
WHISPER_DEVICE = os.environ.get("WHISPER_DEVICE", "cpu")
WHISPER_COMPUTE = os.environ.get(
    "WHISPER_COMPUTE", "float16" if WHISPER_DEVICE == "cuda" else "int8"
)
LANGUAGE = os.environ.get("WHISPER_LANGUAGE", "pt")


def _sb_headers() -> dict[str, str]:
    return {
        "apikey": SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


def list_voices_needing_transcript() -> list[dict]:
    url = (
        f"{SUPABASE_URL}/rest/v1/voices"
        "?select=id,name,reference_audio_path"
        "&reference_audio_path=not.is.null"
        "&reference_transcript=is.null"
    )
    r = requests.get(url, headers=_sb_headers(), timeout=30)
    r.raise_for_status()
    return r.json()


def update_transcript(voice_id: str, transcript: str) -> None:
    url = f"{SUPABASE_URL}/rest/v1/voices?id=eq.{voice_id}"
    r = requests.patch(
        url,
        headers=_sb_headers(),
        json={"reference_transcript": transcript},
        timeout=30,
    )
    r.raise_for_status()


def download_from_r2(key: str, dst: Path) -> None:
    s3 = boto3.client(
        "s3",
        endpoint_url=R2_ENDPOINT,
        aws_access_key_id=R2_KEY_ID,
        aws_secret_access_key=R2_SECRET,
        region_name="auto",
    )
    s3.download_file(R2_BUCKET, key, str(dst))


_MODEL: WhisperModel | None = None


def transcribe(path: Path) -> str:
    global _MODEL
    if _MODEL is None:
        print(
            f"  carregando faster-whisper {WHISPER_MODEL} "
            f"({WHISPER_DEVICE}/{WHISPER_COMPUTE})… (download na 1ª vez)"
        )
        _MODEL = WhisperModel(
            WHISPER_MODEL, device=WHISPER_DEVICE, compute_type=WHISPER_COMPUTE
        )
    segments, _info = _MODEL.transcribe(str(path), language=LANGUAGE, vad_filter=True)
    parts = [seg.text for seg in segments]
    return " ".join(p.strip() for p in parts).strip()


def main() -> int:
    voices = list_voices_needing_transcript()
    if not voices:
        print("✅ Nenhuma voz com áudio sem transcrição. Nada a fazer.")
        return 0

    print(f"Encontradas {len(voices)} voz(es) sem transcrição:\n")
    ok = fail = 0
    for v in voices:
        print(f"→ {v['name']} ({v['id']})")
        try:
            with tempfile.TemporaryDirectory() as td:
                wav = Path(td) / "ref.wav"
                print(f"  baixando do R2: {v['reference_audio_path']}")
                download_from_r2(v["reference_audio_path"], wav)
                print("  transcrevendo…")
                text = transcribe(wav)
                if not text:
                    raise RuntimeError("transcrição vazia")
                preview = text[:80] + ("…" if len(text) > 80 else "")
                print(f'  ok ({len(text)} chars): "{preview}"')
                update_transcript(v["id"], text)
                print("  gravado no banco ✅\n")
                ok += 1
        except Exception as e:  # noqa: BLE001
            print(f"  ❌ falhou: {e}\n")
            fail += 1

    print(f"Fim: {ok} corrigida(s), {fail} falha(s).")
    return 1 if fail else 0


if __name__ == "__main__":
    sys.exit(main())
