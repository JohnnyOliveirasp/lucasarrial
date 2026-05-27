#!/usr/bin/env python3
"""Forense de geração de voz no AIVerse — roda NO SERVIDOR (lê .env.local).

Stdlib-only (urllib/json), sem dependências. Consulta:
  - Supabase Auth (admin) p/ mapear email -> user_id
  - Supabase REST p/ listar voices + generations do usuário
  - RunPod /status/<job_id> p/ ver o resultado real do job (se ainda não expirou)

Uso:
  python3 aiverse_forensics.py --email lauratatsch04@gmail.com
  python3 aiverse_forensics.py --email <e> --check-runpod
  python3 aiverse_forensics.py --email <e> --json > /tmp/laura.json
"""
from __future__ import annotations

import argparse
import json
import sys
import urllib.error
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


def _get(url: str, headers: dict[str, str]) -> object:
    req = urllib.request.Request(url, headers=headers, method="GET")
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


def find_user(env: dict[str, str], email: str) -> dict | None:
    base = env["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/")
    srk = env["SUPABASE_SERVICE_ROLE_KEY"]
    headers = {"apikey": srk, "Authorization": f"Bearer {srk}"}
    page = 1
    while True:
        data = _get(f"{base}/auth/v1/admin/users?per_page=200&page={page}", headers)
        users = data.get("users", []) if isinstance(data, dict) else data
        if not users:
            return None
        for u in users:
            if str(u.get("email", "")).lower() == email.lower():
                return u
        page += 1
        if page > 25:  # guarda
            return None


def query_rest(env: dict[str, str], table: str, params: str) -> list[dict]:
    base = env["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/")
    srk = env["SUPABASE_SERVICE_ROLE_KEY"]
    headers = {"apikey": srk, "Authorization": f"Bearer {srk}"}
    data = _get(f"{base}/rest/v1/{table}?{params}", headers)
    return data if isinstance(data, list) else [data]


def runpod_status(env: dict[str, str], job_id: str) -> dict:
    ep = env.get("RUNPOD_ENDPOINT_INFERENCE_ID") or env["RUNPOD_ENDPOINT_TRAIN_ID"]
    key = env["RUNPOD_API_KEY"]
    url = f"https://api.runpod.ai/v2/{ep}/status/{job_id}"
    try:
        return _get(url, {"Authorization": f"Bearer {key}"})  # type: ignore[return-value]
    except urllib.error.HTTPError as e:
        return {"_http_error": e.code, "_body": e.read().decode("utf-8", "ignore")[:300]}
    except Exception as e:  # noqa: BLE001
        return {"_error": str(e)}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--email", required=True)
    ap.add_argument("--env-file", default=DEFAULT_ENV)
    ap.add_argument("--check-runpod", action="store_true")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    env = load_env(args.env_file)
    user = find_user(env, args.email)
    if not user:
        print(f"❌ usuário não encontrado: {args.email}")
        return 1
    uid = user["id"]

    voices = query_rest(
        env, "voices",
        f"user_id=eq.{uid}&select=id,name,status,lora_path,reference_audio_path,created_at&order=created_at.desc",
    )
    gens = query_rest(
        env, "generations",
        f"user_id=eq.{uid}&select=id,voice_id,status,error_message,audio_path,"
        f"sample_rate,duration_seconds,elapsed_seconds,runpod_job_id,text_raw,created_at"
        f"&order=created_at.desc",
    )

    if args.check_runpod:
        for g in gens:
            if g.get("runpod_job_id"):
                g["_runpod_now"] = runpod_status(env, g["runpod_job_id"])

    report = {
        "email": args.email,
        "user_id": uid,
        "created_at": user.get("created_at"),
        "last_sign_in_at": user.get("last_sign_in_at"),
        "voices": voices,
        "generations": gens,
    }

    if args.json:
        print(json.dumps(report, ensure_ascii=False, indent=2, default=str))
        return 0

    print(f"👤 {args.email}  uid={uid}")
    print(f"   criado: {user.get('created_at')}  último login: {user.get('last_sign_in_at')}")
    print(f"\n🎙️  VOICES ({len(voices)}):")
    for v in voices:
        print(f"   - {v['id']}  '{v.get('name')}'  status={v.get('status')}  "
              f"lora={'sim' if v.get('lora_path') else 'NÃO'}  "
              f"ref={'sim' if v.get('reference_audio_path') else 'não'}")
    print(f"\n🔊 GENERATIONS ({len(gens)}):")
    for g in gens:
        print(f"   - {g['id']}  status={g.get('status')}  job={g.get('runpod_job_id')}")
        print(f"       audio_path={g.get('audio_path')}")
        print(f"       dur={g.get('duration_seconds')}s  sr={g.get('sample_rate')}  "
              f"elapsed={g.get('elapsed_seconds')}s  criado={g.get('created_at')}")
        if g.get("error_message"):
            print(f"       ❌ error_message: {g['error_message']}")
        if g.get("text_raw"):
            print(f"       texto: {str(g['text_raw'])[:120]}")
        if "_runpod_now" in g:
            print(f"       RunPod agora: {json.dumps(g['_runpod_now'], ensure_ascii=False)[:400]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
