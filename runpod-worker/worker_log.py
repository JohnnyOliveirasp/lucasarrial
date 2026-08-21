"""Log estruturado (uma linha JSON por evento) do worker.

Saiu do handler.py em 20/08 para que o pacote tts_qa consiga logar sem
importar o handler de volta (import circular). Formato IDÊNTICO ao de antes —
os greps de produção (`inference.coverage.espalhada`, `inference.chunk`, ...)
continuam valendo.
"""
from __future__ import annotations

import json
import time
from typing import Any


def log(level: str, msg: str, **meta: Any) -> None:
    entry = {"ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "level": level, "msg": msg}
    if meta:
        entry["meta"] = meta
    print(json.dumps(entry, ensure_ascii=False), flush=True)
