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


# ───────── Contadores acumulados do job no heartbeat (#15, 17/09) ─────────
# `qa_stats["regens"]` (tts_qa/loop.py:588) já conta cada regeneração do job e
# já chega ao banco em generations.qa->>'regens' — MAS só no FIM do job. Nos 19
# executionTimeout medidos no #15 esse campo veio NULO, 19 de 19: o SIGKILL do
# teto de 480s chega antes de qualquer escrita. E a medição de 17/09 aponta o
# regen como o MULTIPLICADOR do relógio (0 de 48 gerações com <=10 regens
# encostou no teto; 12 de 21 com 31+ encostaram) — ou seja, o número que
# EXPLICA o estouro é exatamente o que nunca sobrevive ao estouro.
#
# O `attempt` que já viaja no meta da fase NÃO substitui isto: ele é POR CHUNK
# e zera a cada chunk novo, enquanto quem prevê estouro de orçamento é o
# ACUMULADO do job.
#
# Aqui o job registra um PROVEDOR (callable sem argumentos que devolve o
# qa_stats) e o heartbeat o consulta A CADA TICK — leitura AO VIVO, e não o
# valor congelado na entrada da fase. Isso importa: `inference.chunk.qa` é
# entrada UMA vez por chunk e os regens sobem DENTRO dela (loop.py incrementa
# e só então chama `regen_fn`), então um valor capturado na entrada da fase
# mostraria o acumulado do INÍCIO do chunk e calaria justamente a tempestade
# em curso.
#
# REGRA DURA deste arquivo: telemetria JAMAIS derruba job. O provedor é
# chamado dentro do seu próprio try/except — provedor quebrado devolve `{}` e
# o heartbeat segue postando a fase, só sem os contadores.
_JOB_STATS_PROVIDER = None  # Callable[[], dict] | None — setado por job


def set_job_stats_provider(fn) -> None:
    """Registra a fonte dos contadores acumulados do job; `None` limpa.

    Chamado pelo job (jobs/inference.py) no começo da execução. Quem LIMPA é
    `set_current_job(None)`, que o handler já roda no `finally` de todo job:
    assim o provedor de um job nunca vaza pro próximo, mesma garantia do
    `_FASE_CFG`.
    """
    global _JOB_STATS_PROVIDER
    _JOB_STATS_PROVIDER = fn


# Chaves do qa_stats que podem viajar no heartbeat. Lista BRANCA de propósito:
# o qa_stats tem ~40 chaves, alguma delas lista (`exhausted_scores`), e o
# payload da fase é recortado a escalares pequenos. Só entra aqui o que
# responde "quantas tentativas este job já queimou" — e, desde o card
# feat/heartbeat-setup-s (#15, 22/09), TAMBÉM o que responde "quanto do teto o
# SETUP comeu": `qa.setup_s` só era persistido no SUCESSO, então num job morto
# por SIGKILL o único número de que a régua depende não existia. Com
# `setup_s` + `since_t0_s` pegando carona aqui, a próxima morte por timeout
# separa (A) pico de setup comendo a base do teto de (B) worker degradado
# rodando lento — as duas explicações que hoje sobrevivem a cada morte.
#   - setup_s: duração do setup, publicada no dict vivo assim que medida
#     (chave AUSENTE = ainda no setup);
#   - since_t0_s: segundos desde o fim do setup, recalculado A CADA LEITURA
#     pelo provedor (chave AUSENTE = t0 ainda não existe).
#
# É também o que torna a leitura SEGURA entre threads: iteramos esta tupla
# constante e fazemos `stats.get(k)` — nunca iteramos o dict que a thread
# principal está mutando (que é o que levantaria "dict changed size during
# iteration").
_STATS_NO_HEARTBEAT = ("regens", "setup_s", "since_t0_s")


def _stats_do_job() -> dict:
    """Contadores acumulados do job AGORA. `{}` = sem provedor, ou provedor
    quebrado/devolvendo coisa inesperada. Nunca lança."""
    try:
        fn = _JOB_STATS_PROVIDER
        if fn is None:
            return {}
        stats = fn() or {}
        out: dict = {}
        for k in _STATS_NO_HEARTBEAT:
            v = stats.get(k)
            # `bool` é subclasse de int e não é contador; None/str/lista ficam
            # fora (a chave ausente já significa "não veio", sem ambiguidade).
            if isinstance(v, bool) or not isinstance(v, (int, float)):
                continue
            out[k] = v
        return out
    except Exception:
        return {}


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
            # Contadores ACUMULADOS do job (regens) primeiro, meta da FASE por
            # cima. Nesta ordem de propósito, por dois motivos:
            #   1. o meta da fase é chunk-escopado (chunk/attempt/chars/cfg) e
            #      deve MANDAR numa colisão de nome — ele descreve o que está
            #      rodando agora;
            #   2. o recorte do payload (`_meta_serializavel`) tem teto de 12
            #      itens contando na ordem do dict, então vir primeiro garante
            #      que `regens` sobreviva se um dia alguma fase carregar um
            #      meta grande.
            meta = {**_stats_do_job(), **meta}
            log("info", "phase.alive", phase=name, running_s=running_s,
                job_type=_CURRENT_JOB_TYPE, **meta)
            # Leva a fase até o NOSSO banco (o log daqui expira ~30min e o
            # status do job some minutos após o fim — sem isso, um hang morto
            # por executionTimeout perde a fase antes de alguém olhar).
            # O `meta` vai JUNTO desde 07/09: sem ele o banco dizia
            # "inference.chunk.generate" e calava CHUNK e ATTEMPT, que são
            # justamente o que separa "pendurou num chunk" de "regenerou
            # demais" — medido no #15 (ver _fase_post).
            _fase_post(name, running_s, _CURRENT_JOB_TYPE, meta)
        except Exception:
            pass  # heartbeat JAMAIS derruba nada


# ───────── Fase corrente → app (incidente d3d8d1b2, parte 2 — b9bc646) ─────────
# O heartbeat acima nomeia a fase no STDOUT, mas esse log morre no console da
# RunPod e expira; num job SIGKILLado por executionTimeout ninguém chega a
# tempo. Este bloco faz a fase chegar ao nosso banco: o APP manda `fase_url`,
# `fase_token` e `fase_ref` no input do job (por-job, mesmo modelo de confiança
# das presigned URLs que já viajam no input) e o heartbeat faz POST best-effort
# pra essa URL. Sem as três chaves no input, a feature está desligada e nada
# acontece. NADA aqui roda no caminho do job — só a thread daemon do heartbeat
# posta, com timeout curto e try/except em volta de tudo.
import urllib.request

# User-Agent NOSSO em todo request do worker pro nosso domínio.
# 28/08, chamado #15: a Cloudflare na frente do app responde 403 a qualquer
# request com o UA padrão do urllib ("Python-urllib/3.x") — medido: urllib=403,
# curl/requests/qualquer outro nome=401 (o app respondendo). Como esta
# telemetria é best-effort e engole exceção, TODO heartbeat de fase desde 24/08
# morreu no portão em silêncio: segredo certo, rota no ar, worker com o código,
# e mesmo assim zero fase_corrente em 1.098 gerações. Sem este header a
# investigação de worker travado continua cega.
WORKER_USER_AGENT = "fastcloner-worker/1"

_FASE_CFG: dict | None = None  # {"url","token","ref"} — setado por job (set_current_job)
FASE_POST_TIMEOUT_S = float(os.environ.get("FASE_POST_TIMEOUT_S", "5"))


def _fase_cfg_from_input(inp: dict) -> dict | None:
    """Extrai a config de telemetria de fase do input do job. None = desligado."""
    try:
        url = inp.get("fase_url")
        token = inp.get("fase_token")
        ref = inp.get("fase_ref")
        if (
            isinstance(url, str) and url.startswith("https://")
            and isinstance(token, str) and token
            and isinstance(ref, str) and ref
        ):
            return {"url": url, "token": token, "ref": ref}
    except Exception:
        pass
    return None


def _meta_serializavel(meta: dict | None) -> dict:
    """Sub-conjunto do meta da fase que pode viajar no POST.

    Recorte DE PROPÓSITO (07/09, #15): o meta do `phase()` é livre e um dia
    pode carregar texto do aluno; aqui só passam ESCALARES pequenos e chaves
    curtas, com teto de 12 itens. Nunca lança — meta ruim vira `{}` e o
    heartbeat segue.
    """
    out: dict = {}
    try:
        for k, v in (meta or {}).items():
            if len(out) >= 12:
                break
            if not isinstance(k, str) or len(k) > 32:
                continue
            if v is None or isinstance(v, (bool, int, float)):
                out[k] = v
            elif isinstance(v, str) and len(v) <= 64:
                out[k] = v
    except Exception:
        return {}
    return out


def _fase_post(fase: str, running_s: float | None, job_type: str | None,
               meta: dict | None = None) -> None:
    """POST da fase corrente pro app. Best-effort: timeout curto, JAMAIS lança.

    O `meta` é o do `phase()` corrente. Em `inference.chunk.generate` ele traz
    `chunk` e `attempt` — e é a diferença entre saber que o job morreu
    "gerando um chunk" e saber que morreu no chunk 7, tentativa 9. Até 07/09
    esse dado era impresso no STDOUT do RunPod (que expira) e jogado fora aqui.
    """
    try:
        cfg = _FASE_CFG
        if not cfg:
            return
        body = json.dumps({
            "generation_id": cfg["ref"],
            "token": cfg["token"],
            "fase": fase,
            "running_s": running_s,
            "job_type": job_type,
            "meta": _meta_serializavel(meta),
        }, ensure_ascii=False).encode("utf-8")
        req = urllib.request.Request(
            cfg["url"],
            data=body,
            headers={
                "Content-Type": "application/json",
                # Sem isto a Cloudflare devolve 403 e o POST morre calado.
                "User-Agent": WORKER_USER_AGENT,
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=FASE_POST_TIMEOUT_S):
            pass
    except Exception:
        pass  # telemetria JAMAIS derruba nem atrasa um job


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


def set_current_job(job_type, inp: dict | None = None) -> None:
    """Quem está rodando (pro heartbeat); None silencia entre jobs.
    Se o app mandou fase_url/token/ref no `inp`, o heartbeat também POSTa a
    fase corrente pro nosso banco. A config é POR JOB: None limpa e nunca vaza
    pro próximo."""
    global _CURRENT_JOB_TYPE, _FASE_CFG
    _CURRENT_JOB_TYPE = job_type
    _FASE_CFG = _fase_cfg_from_input(inp) if (job_type is not None and inp) else None
    if job_type is None:
        # Fim do job: o provedor de contadores morre com ele. O objeto de job
        # vai embora e não pode ficar pendurado num global servindo número
        # velho pro job seguinte. Mesma garantia (e mesmo ponto de limpeza) do
        # `_FASE_CFG` — por isso o handler não precisa de nenhuma mudança.
        set_job_stats_provider(None)
