"""Testa conexão Postgres do Supabase.

- Resolve placeholder [YOUR-PASSWORD] na CONNECTION_STRING usando PASSWORD_DATA_BASE.
- Faz URL-encode da senha (J@Mosp2904@ tem chars especiais).
- Roda SELECT version() pra confirmar conexão.
- Lista schemas existentes.
- Cria e dropa uma tabela teste (valida write permission).
"""

from __future__ import annotations

import os
import sys
from pathlib import Path
from urllib.parse import quote

import psycopg
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env.local")


def build_dsn() -> str:
    """Usa a CONNECTION_STRING do .env (copiada do dashboard Supabase).
    Substitui [YOUR-PASSWORD] pela senha real com URL-encoding.
    """
    raw = os.environ["CONNECTION_STRING"]
    password = quote(os.environ["PASSWORD_DATA_BASE"], safe="")
    return raw.replace("[YOUR-PASSWORD]", password)


def main() -> int:
    print("=" * 60)
    print("Supabase Postgres smoke test")
    print("=" * 60)
    dsn = build_dsn()
    safe_dsn = dsn.replace(quote(os.environ["PASSWORD_DATA_BASE"], safe=""), "***")
    print(f"DSN: {safe_dsn}")
    print()

    try:
        conn = psycopg.connect(dsn, connect_timeout=15, autocommit=True)
    except Exception as exc:
        print(f"ERRO ao conectar: {exc}")
        return 2

    cur = conn.cursor()

    cur.execute("SELECT version();")
    version = cur.fetchone()[0]
    print(f"[version] {version}")

    cur.execute("SELECT current_database(), current_user;")
    db, user = cur.fetchone()
    print(f"[identity] db={db} user={user}")

    cur.execute("""
        SELECT schema_name FROM information_schema.schemata
        WHERE schema_name NOT IN ('pg_catalog','information_schema','pg_toast')
        ORDER BY schema_name;
    """)
    schemas = [r[0] for r in cur.fetchall()]
    print(f"[schemas] {schemas}")

    cur.execute("""
        SELECT table_schema, table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY table_name;
    """)
    public_tables = cur.fetchall()
    print(f"[public.tables] {public_tables if public_tables else 'vazio (banco novo OK)'}")

    print("\n--- Testando write permission ---")
    cur.execute("CREATE TABLE IF NOT EXISTS __smoke_test__ (id int);")
    cur.execute("INSERT INTO __smoke_test__ (id) VALUES (1);")
    cur.execute("SELECT count(*) FROM __smoke_test__;")
    cnt = cur.fetchone()[0]
    print(f"[write_test] inseriu, count={cnt}")
    cur.execute("DROP TABLE __smoke_test__;")
    print("[write_test] dropou tabela teste")

    cur.close()
    conn.close()

    print("\n" + "=" * 60)
    print("TUDO OK — Supabase Postgres conectado, banco vazio e escrevível")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    sys.exit(main())
