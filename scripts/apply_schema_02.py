"""Aplica scripts/02_api_keys.sql no Supabase."""

from __future__ import annotations

import os
import sys
from pathlib import Path
from urllib.parse import quote

import psycopg
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env.local")

SCHEMA_FILE = Path(__file__).parent / "02_api_keys.sql"


def build_dsn() -> str:
    raw = os.environ["CONNECTION_STRING"]
    password = quote(os.environ["PASSWORD_DATA_BASE"], safe="")
    return raw.replace("[YOUR-PASSWORD]", password)


def main() -> int:
    sql = SCHEMA_FILE.read_text(encoding="utf-8")
    print(f"Aplicando {SCHEMA_FILE.name} ({len(sql)} bytes)…")

    with psycopg.connect(build_dsn(), autocommit=True) as conn, conn.cursor() as cur:
        cur.execute(sql)
        cur.execute(
            "select table_name from information_schema.tables where table_schema='public' order by table_name;"
        )
        print("[tables]", [r[0] for r in cur.fetchall()])
        cur.execute(
            "select tablename from pg_tables where schemaname='public' and rowsecurity=true and tablename='api_keys';"
        )
        rls = [r[0] for r in cur.fetchall()]
        print("[RLS api_keys]", rls)
    print("OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
