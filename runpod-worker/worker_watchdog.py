"""Watchdog de heartbeat CONGELADO — processo filho (#15, d3d8d1b2, 22/09).

O defeito que este arquivo mata: a geracao 342e54a1 morreu no teto de 640s com
2,0x o MAXIMO da faixa dela (7-10 chunks: p95=244s, max=324s) — worker
degradado/pendurado, nao regua curta. E o trace ao vivo da 9555c0d0 (22/09 14h)
mostrou o formato exato da pane: `visto_em` e `running_s` param de avancar
JUNTOS enquanto o job segue "pending". Os dois pararem juntos significa que a
PROPRIA THREAD do heartbeat congelou — hang em codigo nativo segurando o GIL
congela todas as threads Python do processo de uma vez.

Consequencia de projeto que nao da pra contornar: uma thread Python de
watchdog congelaria JUNTO com o heartbeat. Por isso o vigia e um PROCESSO
FILHO (spawnado por `worker_log.start_heartbeat()`), imune ao GIL do pai:

  1. o heartbeat do pai escreve um PULSO (arquivo JSON, write atomico) a cada
     tick de ~30s — ativo ou idle, o pulso e a prova de vida do processo;
  2. este filho poe o olho no arquivo a cada TTS_WATCHDOG_POLL_S: pulso ATIVO
     mais velho que `stale_s` (= TTS_WATCHDOG_TICKS ticks + margem, ~105s)
     significa "nenhuma thread Python executou por >1,5min" — worker travado;
  3. ai ele (a) loga o erro NOMEADO no stdout ("worker travado em <fase>
     chunk <n>"), (b) POSTa a mesma informacao pro webhook de fase — que grava
     em generations.qa.fase_corrente ANTES do processo morrer, ja que o log do
     RunPod expira e o /status some minutos apos o fim — e (c) SIGKILLa o pai.

O SIGKILL e de proposito o MESMO efeito do executionTimeout do RunPod (que e
quem mata esses jobs hoje): o job morre, a RunPod re-enfileira e a tentativa
seguinte roda em setup limpo — na 9555c0d0 a 2a tentativa entregou 13 chunks em
~160s. A diferenca e QUANDO (~105s de congelamento em vez de ate 640s de teto)
e o RASTRO (erro nomeado no banco em vez de silencio). Nenhum teto foi tocado:
este arquivo nao alarga nem substitui a regua de frontend/src/lib/generations/
execucao.ts — ele so abrevia a espera quando o worker JA esta morto por dentro.

LIMITE HONESTO: o gatilho e AUSENCIA de pulso, que e exatamente o modo de pane
medido (congelamento total do processo). Um hang hipotetico so da thread
principal, com o heartbeat vivo postando `running_s` crescente, NAO dispara
este vigia — cobri-lo exigiria uma regua de duracao maxima por fase, que e
outra decisao (e outra distribuicao a medir). Se esse modo aparecer, ele
continua caindo no teto como hoje.

Seguranca contra falso positivo: um job LENTO mas saudavel nunca dispara — o
heartbeat e uma thread independente do trabalho e escreve pulso a cada 30s
enquanto QUALQUER bytecode Python rodar. Pulso IDLE velho nao mata (worker
parado entre jobs nao tem aluno pra salvar). Arquivo ausente/corrompido nao
mata (vigia sem prova nao age). Pai ja morto: o filho sai em silencio.

Roda como: python worker_watchdog.py <pulse_path> <parent_pid> <stale_s> [poll_s]
Testes (sem GPU, sem rede): test_watchdog_travado.py
"""
from __future__ import annotations

import os
import signal
import sys
import time

# Reuso de proposito (licao das "6 copias divergentes"): o formato de log e o
# POST de fase — com o User-Agent proprio SEM o qual a Cloudflare responde 403
# e o POST morre calado (#15, 28/08) — ja existem em worker_log. Importar o
# modulo aqui NAO sobe thread nenhuma (start_heartbeat e chamado só pelo
# handler) e nao tem efeito colateral alem de ler env.
import worker_log

# Veredictos de decidir() — só "travado" mata.
TRAVADO = "travado"
OK = "ok"
IDLE_VELHO = "idle_velho"
SEM_PULSO = "sem_pulso"


def ler_pulso(path: str) -> dict | None:
    """Pulso corrente, ou None (ausente/corrompido/tipo errado). Nunca lanca."""
    try:
        import json
        with open(path, "r", encoding="utf-8") as f:
            pulso = json.load(f)
        return pulso if isinstance(pulso, dict) else None
    except Exception:
        return None


def decidir(pulso: dict | None, agora: float, stale_s: float) -> str:
    """PURA e sem I/O (é ela que os testes cravam): o que fazer com este pulso.

    Só `TRAVADO` autoriza matar: pulso ATIVO com idade > stale_s. Todo caso
    ambíguo (sem pulso, ts inválido, relógio andando pra trás, idle) resolve
    para NÃO matar — falso negativo aqui custa esperar o teto como hoje;
    falso positivo custaria derrubar a geração viva de um aluno.
    """
    if not isinstance(pulso, dict):
        return SEM_PULSO
    ts = pulso.get("ts")
    if isinstance(ts, bool) or not isinstance(ts, (int, float)):
        return SEM_PULSO
    idade = agora - float(ts)
    if idade <= stale_s:
        return OK
    return TRAVADO if pulso.get("ativo") is True else IDLE_VELHO


def montar_erro(pulso: dict | None) -> str:
    """O erro NOMEADO pedido no cartao: "worker travado em <fase> chunk <n>".

    Truncado a 64 chars porque ele viaja no `meta` do POST de fase e o
    sanitizador da rota (metaDaFaseSanitizado) DESCARTA string >64 — estourar
    o teto apagaria justamente a mensagem.
    """
    pulso = pulso if isinstance(pulso, dict) else {}
    fase = pulso.get("fase")
    if not isinstance(fase, str) or not fase:
        fase = "(sem fase instrumentada)"
    erro = f"worker travado em {fase}"
    meta = pulso.get("meta")
    chunk = meta.get("chunk") if isinstance(meta, dict) else None
    if isinstance(chunk, (int, float)) and not isinstance(chunk, bool):
        erro += f" chunk {int(chunk)}"
    return erro[:64]


def _pai_vivo(pid: int) -> bool:
    try:
        os.kill(pid, 0)  # signal 0 = só checa existência
        return True
    except OSError:
        return False


def _postar_travado(pulso: dict, stale_s: float) -> None:
    """Deixa o rastro no NOSSO banco ANTES do SIGKILL, via o mesmo webhook de
    fase que o heartbeat usa (rota aceita qualquer nome de fase; a row só é
    tocada enquanto o job está pending/generating — que é o estado da pane).
    Best-effort: sem cfg no pulso (job sem telemetria de fase), não posta.
    Nunca lança."""
    try:
        cfg = pulso.get("fase_cfg")
        if not (isinstance(cfg, dict) and cfg.get("url") and cfg.get("token") and cfg.get("ref")):
            return
        # _fase_post lê o global do MEU processo (cópia do módulo no filho —
        # o pai congelado não é tocado); setá-lo aqui reusa UA + timeout +
        # serialização em vez de duplicá-los.
        worker_log._FASE_CFG = {"url": cfg["url"], "token": cfg["token"], "ref": cfg["ref"]}
        meta_pulso = pulso.get("meta") if isinstance(pulso.get("meta"), dict) else {}
        running = pulso.get("running_s")
        worker_log._fase_post(
            "watchdog.travado",
            running if isinstance(running, (int, float)) and not isinstance(running, bool) else None,
            pulso.get("job_type") if isinstance(pulso.get("job_type"), str) else None,
            {
                # O erro nomeado + onde congelou: é o que a investigação lê.
                "erro": montar_erro(pulso),
                "fase_congelada": str(pulso.get("fase") or "")[:64],
                "parado_s": int(stale_s),
                **{k: v for k, v in meta_pulso.items() if k in ("chunk", "attempt")},
            },
        )
    except Exception:
        pass


def _matar(parent_pid: int, pulso: dict | None, stale_s: float) -> None:
    """Erro nomeado no stdout + rastro no banco + SIGKILL no pai, NESTA ordem
    (depois do kill não há mais quem conte a história)."""
    pulso = pulso if isinstance(pulso, dict) else {}
    try:
        worker_log.log(
            "error", "phase.watchdog.travado",
            erro=montar_erro(pulso),
            fase=pulso.get("fase"), running_s=pulso.get("running_s"),
            job_type=pulso.get("job_type"), stale_s=stale_s,
        )
    except Exception:
        pass
    _postar_travado(pulso, stale_s)
    if parent_pid > 1:  # jamais SIGKILL em init/grupo por pid lixo
        try:
            os.kill(parent_pid, signal.SIGKILL)
        except OSError:
            pass


def vigiar(pulse_path: str, parent_pid: int, stale_s: float, poll_s: float) -> int:
    """Laço do vigia. Retorna 0 (pai morreu sozinho) ou 1 (matou por travado)."""
    while True:
        time.sleep(poll_s)  # ANTES da 1ª checagem: dá tempo do 1º pulso nascer
        if not _pai_vivo(parent_pid):
            return 0
        pulso = ler_pulso(pulse_path)
        if decidir(pulso, time.time(), stale_s) == TRAVADO:
            _matar(parent_pid, pulso, stale_s)
            return 1


if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("uso: worker_watchdog.py <pulse_path> <parent_pid> <stale_s> [poll_s]")
        sys.exit(2)
    sys.exit(vigiar(
        sys.argv[1],
        int(sys.argv[2]),
        float(sys.argv[3]),
        float(sys.argv[4]) if len(sys.argv) > 4 else 10.0,
    ))
