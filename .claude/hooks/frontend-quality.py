#!/usr/bin/env python
"""PostToolUse(Edit|Write) — roda tsc + eslint do frontend após editar .ts/.tsx.

Configurado com async + asyncRewake: roda em background, não bloqueia a edição,
e só acorda o modelo (exit 2) se houver erro. Em sucesso, silêncio.
"""
import json
import os
import subprocess
import sys

try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(0)

ti = data.get("tool_input") or {}
tr = data.get("tool_response") or {}
f = (ti.get("file_path") or tr.get("filePath") or "")
fl = f.lower()

if "frontend" not in fl or not fl.endswith((".ts", ".tsx")):
    sys.exit(0)

root = os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()
fe = os.path.join(root, "frontend")
binp = os.path.join(fe, "node_modules", ".bin")
if not os.path.isdir(binp):
    sys.exit(0)

is_win = os.name == "nt"
tsc = os.path.join(binp, "tsc.cmd" if is_win else "tsc")
eslint = os.path.join(binp, "eslint.cmd" if is_win else "eslint")

try:
    ts = subprocess.run(
        [tsc, "-p", "tsconfig.json", "--noEmit"],
        cwd=fe, capture_output=True, text=True, timeout=180,
    )
    es = subprocess.run(
        [eslint, "--config", "eslint.config.mjs", "src"],
        cwd=fe, capture_output=True, text=True, timeout=180,
    )
except Exception:
    sys.exit(0)

if ts.returncode != 0 or es.returncode != 0:
    parts = [f"Frontend quality check falhou apos editar {os.path.basename(f)}:"]
    if ts.returncode != 0:
        parts.append("--- tsc --noEmit ---")
        parts.append("\n".join((ts.stdout + ts.stderr).splitlines()[:25]))
    if es.returncode != 0:
        parts.append("--- eslint ---")
        parts.append("\n".join((es.stdout + es.stderr).splitlines()[:25]))
    print("\n".join(parts))
    sys.exit(2)

sys.exit(0)
