"""Aplica scripts/01_schema.sql no Supabase via Transaction Pooler."""

from __future__ import annotations

import os
import sys
from pathlib import Path
from urllib.parse import quote

import psycopg
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env.local")

SCHEMA_FILE = Path(__file__).parent / "01_schema.sql"


def build_dsn() -> str:
    raw = os.environ["CONNECTION_STRING"]
    password = quote(os.environ["PASSWORD_DATA_BASE"], safe="")
    return raw.replace("[YOUR-PASSWORD]", password)


def main() -> int:
    sql = SCHEMA_FILE.read_text(encoding="utf-8")
    print(f"Aplicando {SCHEMA_FILE.name} ({len(sql)} bytes)…")

    with psycopg.connect(build_dsn(), autocommit=True) as conn:
        with conn.cursor() as cur:
            cur.execute(sql)

            cur.execute("""
                select table_name from information_schema.tables
                where table_schema='public' order by table_name;
            """)
            tables = [r[0] for r in cur.fetchall()]
            print(f"[tables in public] {tables}")

            cur.execute("""
                select tablename from pg_tables
                where schemaname='public' and rowsecurity=true
                order by tablename;
            """)
            rls = [r[0] for r in cur.fetchall()]
            print(f"[RLS enabled on] {rls}")

            cur.execute("""
                select trigger_name, event_object_table
                from information_schema.triggers
                where trigger_schema in ('public','auth')
                  and trigger_name in ('on_auth_user_created','profiles_updated_at','voices_updated_at')
                order by trigger_name;
            """)
            triggers = cur.fetchall()
            print(f"[triggers] {triggers}")

    print("\nOK — schema aplicado.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
