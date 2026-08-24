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


# ───────── Instrumentação de fase + heartbeat (incidente d3d8d1b2) ─────────
# Jobs estouram o executionTimeout do RunPod SEM correlação com o tamanho do
# texto (hang, não régua). Quando o teto dispara o processo é SIGKILLado: o
# `except` do handler nunca roda — sobra só o que foi impresso ANTES. Este
# bloco rastreia a fase corrente numa pilha e um heartbeat em thread daemon
# imprime `phase.alive` periodicamente: a ÚLTIMA linha de heartbeat no log do
# RunPod nomeia a fase que estava rodando quando o processo morreu.
# NADA aqui muda comportamento funcional: só log, e todo caminho tem
# try/except pra jamais derrubar um job de aluno.
import contextlib
import os
import threading

TTS_HEARTBEAT_SECONDS = float(os.environ.get("TTS_HEARTBEAT_SECONDS", "30"))
_PHASE_LOCK = threading.Lock()
_PHASE_STACK: list[dict] = []  # topo = fase corrente (aninhamento: qa > regen)
_CURRENT_JOB_TYPE: str | None = None  # setado pelo handler(); None = idle
_HEARTBEAT_STARTED = False


@contextlib.contextmanager
def phase(name: str, **meta: Any):
    """Marca uma fase: loga `phase.start`/`phase.done` (com elapsed_s) e mantém
    a fase corrente na pilha global pro heartbeat. Exceções passam intactas."""
    entry = {"name": name, "start": time.monotonic(), "meta": meta}
    try:
        log("info", "phase.start", phase=name, **meta)
    except Exception:
        pass
    try:
        with _PHASE_LOCK:
            _PHASE_STACK.append(entry)
    except Exception:
        pass
    try:
        yield
    finally:
        try:
            with _PHASE_LOCK:
                if entry in _PHASE_STACK:
                    _PHASE_STACK.remove(entry)
        except Exception:
            pass
        try:
            log("info", "phase.done", phase=name,
                elapsed_s=round(time.monotonic() - entry["start"], 2), **meta)
        except Exception:
            pass


def _heartbeat_loop() -> None:
    while True:
        try:
            time.sleep(TTS_HEARTBEAT_SECONDS)
            if _CURRENT_JOB_TYPE is None:
                continue  # idle entre jobs — não polui o log
            with _PHASE_LOCK:
                top = _PHASE_STACK[-1] if _PHASE_STACK else None
                name = top["name"] if top else "(sem fase instrumentada)"
                running_s = round(time.monotonic() - top["start"], 1) if top else None
                meta = dict(top["meta"]) if top else {}
            log("info", "phase.alive", phase=name, running_s=running_s,
                job_type=_CURRENT_JOB_TYPE, **meta)
        except Exception:
            pass  # heartbeat JAMAIS derruba nada


def start_heartbeat() -> None:
    """Sobe a thread daemon uma única vez. Desligável com TTS_HEARTBEAT_SECONDS<=0."""
    global _HEARTBEAT_STARTED
    if _HEARTBEAT_STARTED or TTS_HEARTBEAT_SECONDS <= 0:
        return
    try:
        threading.Thread(target=_heartbeat_loop, name="phase-heartbeat", daemon=True).start()
        _HEARTBEAT_STARTED = True
    except Exception as exc:
        try:
            log("warn", "phase.heartbeat_start_failed", error=str(exc))
        except Exception:
            pass


def set_current_job(job_type) -> None:
    """Quem está rodando (pro heartbeat); None silencia entre jobs."""
    global _CURRENT_JOB_TYPE
    _CURRENT_JOB_TYPE = job_type
