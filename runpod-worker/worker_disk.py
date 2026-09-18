"""Faxina do disco efemero do worker (incidente 10/08 e #32).

O container tem 50GB e o worker fica QUENTE por horas: sem isto o disco enchia
e todo aluno que caisse naquele worker falhava com "No space left on device".

Duas camadas, na MESMA regua (DISK_ALERT_PERCENT) e na mesma chamada:

  1. `purge_dir` dos TEMPORARIOS e do CACHE DE COMPILACAO (10/08). Recupera
     espaco que se refaz sozinho — barato e sem consequencia.
  2. `despejar()` dos ACUMULADORES (#32, 18/09). O que a camada 1 NUNCA
     recuperou, porque ninguem apagava: ver o bloco de comentario do despejo.
"""
from __future__ import annotations

import contextlib
import shutil
import threading
import time
from pathlib import Path

from worker_config import (
    DISK_ALERT_PERCENT,
    INDUCTOR_CACHE,
    JOB_TMP,
    LORA_CACHE_DIR,
    MODEL_DIR,
    WORKSPACE,
)
from worker_log import log as _log


def disk_percent(path: str = "/") -> float:
    """Quanto do disco já foi usado (%)."""
    try:
        total, used, _free = shutil.disk_usage(path)
        return (used / total) * 100 if total else 0.0
    except Exception:
        return 0.0


def purge_dir(path: Path, keep_dir: bool = True) -> int:
    """Esvazia um diretório e devolve quantos bytes liberou (best-effort)."""
    liberado = 0
    try:
        if not path.exists():
            return 0
        for item in path.iterdir():
            try:
                if item.is_dir():
                    liberado += sum(f.stat().st_size for f in item.rglob("*") if f.is_file())
                    shutil.rmtree(item, ignore_errors=True)
                else:
                    liberado += item.stat().st_size
                    item.unlink(missing_ok=True)
            except Exception:
                continue
        if not keep_dir:
            shutil.rmtree(path, ignore_errors=True)
    except Exception:
        pass
    return liberado


# ───────── Despejo dos acumuladores (#32, 18/09) ─────────────────────────────
# A faxina de 10/08 recupera TEMPORARIO e CACHE. O disco continuou enchendo
# porque existem tres coisas que ninguem nunca apagou (grep de rmtree/unlink no
# runpod-worker/ em 18/09: as unicas delecoes sao as de purge_dir e a de
# jobs/train.py:121):
#
#   (a) WORKSPACE/<voice_id>/         a area de UM treino (raw + vocals + norm +
#       dataset + lora_runs). O unico rmtree dela vive em `_limpar_area`
#       (jobs/train.py:119-122), que roda ANTES do treino e SO pra propria
#       voice_id — `run()` nao tem finally e todo return sai direto. Logo a area
#       fica no disco depois do job, tenha ele dado certo ou errado, e acumula
#       UMA por voz DISTINTA treinada naquele worker quente.
#   (b) LORA_CACHE_DIR/<hash>_<arquivo>   a LoRA que a inferencia baixa
#       (jobs/inference_setup.py:22 -> downloads.py:20). Cache por hash de URL,
#       com "se ja existe, reusa" DE PROPOSITO e sem nenhum despejo.
#   (c) WORKSPACE/refs/<hash>_<arquivo> e o ..._tail<N>.wav ao lado: a
#       referencia baixada (jobs/inference_setup.py:66) e a copia acolchoada
#       (`_acolchoar_cauda`, jobs/inference_setup.py:36). Mesmo cache, mesma
#       ausencia de despejo.
#       (Correcao do mapa do cartao: (c) mora em WORKSPACE/refs, NAO em
#       LORA_CACHE_DIR — `_acolchoar_cauda` grava ao lado da ref, e a ref vem de
#       `ensure_local_from_url(..., WORKSPACE / "refs", ...)`.)
#
# Medindo o codigo achei mais dois do mesmo tipo, que entram junto porque a
# regua e a mesma: WORKSPACE/transcribe/ (jobs/transcribe.py:18) e os
# WORKSPACE/gen_<ms>.wav da entrega da inferencia (jobs/inference.py:749).
#
# Sao acumuladores MONOTONICOS num disco de 50GB sem volume de rede
# (containerDiskInGb: 50, volumeInGb: 0 — .github/workflows/runpod-worker.yml).
# O piso sobe ate o primeiro job nao caber: bate com a forma observada no #32
# (13 dias limpos, depois 5 falhas em 18h).
#
# O despejo NAO toca WORKSPACE/models nem /opt/models: o modelo base e caro de
# rebaixar e o Dockerfile aponta VOXCPM_MODEL_DIR pra la.

# Nada tocado nos ultimos N segundos e despejado. E rede de seguranca, nao
# regua de disco: um caminho que ninguem registrou em `area_em_uso` (call site
# novo, job de outro dono) ainda ganha esta folga. Constante de modulo de
# proposito — o cartao pede pra NAO criar env nova de limite.
DESPEJO_IDADE_MINIMA_S = 600.0

# Caminhos INTOCAVEIS enquanto um job os usa. Contador, nao set: dois jobs
# concorrentes no mesmo processo (concurrency > 1 do RunPod serverless) podem
# registrar a MESMA LoRA, e o primeiro a sair nao pode desproteger o outro.
_EM_USO: dict[Path, int] = {}
_EM_USO_LOCK = threading.Lock()


def _resolver(p) -> Path | None:
    """Caminho absoluto e sem symlink. None = nem isso deu pra fazer."""
    try:
        return Path(p).resolve()
    except Exception:
        return None


@contextlib.contextmanager
def area_em_uso(*paths):
    """Protege caminhos do despejo enquanto o bloco roda.

    E a garantia de que a faxina NUNCA apaga a area do job EM EXECUCAO — a
    falha mais grave possivel aqui, porque derruba o aluno que esta treinando
    agora. Registro global do processo: protege mesmo quando a faxina e
    disparada por OUTRO job (worker com concurrency > 1) ou por um call site
    que nao conhece este job (a faxina de entrada do #338, por exemplo).
    """
    registrados = []
    for p in paths:
        alvo = _resolver(p)
        if alvo is None:
            continue
        with _EM_USO_LOCK:
            _EM_USO[alvo] = _EM_USO.get(alvo, 0) + 1
        registrados.append(alvo)
    try:
        yield
    finally:
        with _EM_USO_LOCK:
            for alvo in registrados:
                restante = _EM_USO.get(alvo, 0) - 1
                if restante > 0:
                    _EM_USO[alvo] = restante
                else:
                    _EM_USO.pop(alvo, None)


def em_uso() -> set[Path]:
    """Copia dos caminhos protegidos agora."""
    with _EM_USO_LOCK:
        return set(_EM_USO)


def _protegido(alvo: Path, protegidos: set[Path]) -> bool:
    """True se `alvo` E, CONTEM ou ESTA DENTRO de algo em uso.

    Os tres sentidos importam: apagar a area (`alvo` == protegido), apagar o pai
    dela (`alvo` contem o protegido) e apagar um pedaco dela (`alvo` dentro do
    protegido) derrubam o job do mesmo jeito.
    """
    for p in protegidos:
        try:
            if alvo == p or alvo.is_relative_to(p) or p.is_relative_to(alvo):
                return True
        except Exception:
            return True  # na duvida, NAO apaga
    return False


def _intocaveis() -> set[Path]:
    """O modelo base, NUNCA.

    Hoje ele já está fora por endereço (MODEL_DIR fica em /workspace/models e o
    Dockerfile aponta VOXCPM_MODEL_DIR pra /opt/models, nenhum dos dois dentro
    das raízes do despejo). Isto aqui transforma "está fora por sorte do
    caminho" em "está fora por regra": basta alguém apontar WORKSPACE_DIR pra
    /workspace pra que o modelo vire filho de uma raiz. Rebaixar o modelo é
    caro e o job seguinte pagaria o download inteiro.
    """
    intocaveis = set()
    for bruto in (MODEL_DIR, MODEL_DIR.parent, Path("/opt/models")):
        alvo = _resolver(bruto)
        if alvo is not None:
            intocaveis.add(alvo)
    return intocaveis


def _raizes_despejo() -> list[Path]:
    """Diretorios cujo CONTEUDO e descartavel (cache e sobra de job).

    WORKSPACE/refs e WORKSPACE/transcribe aparecem como raiz PROPRIA (e nao
    como filhos de WORKSPACE) de proposito: assim o despejo e por ARQUIVO
    dentro delas, e a referencia do job corrente pode ser protegida sem
    blindar o cache inteiro.
    """
    brutas = (WORKSPACE, WORKSPACE / "refs", WORKSPACE / "transcribe", LORA_CACHE_DIR)
    raizes = []
    for bruta in brutas:
        alvo = _resolver(bruta)
        if alvo is not None and alvo not in raizes:
            raizes.append(alvo)
    return raizes


def _candidatos(raizes: list[Path]) -> list[tuple[float, Path]]:
    """(mtime, caminho) de cada filho direto das raizes, do mais VELHO ao mais novo.

    mtime do proprio item, nao da arvore: pra um diretorio ele marca a ultima
    vez que um filho entrou ou saiu, que e aproximacao boa o bastante de LRU e
    nao custa um walk inteiro do disco a cada faxina.
    """
    fora = set(raizes)
    achados: list[tuple[float, Path]] = []
    vistos: set[Path] = set()
    for raiz in raizes:
        try:
            if not raiz.is_dir():
                continue
            for item in raiz.iterdir():
                try:
                    alvo = item.resolve()
                    if alvo in fora or alvo in vistos:
                        continue  # raiz com entrada propria: despejada por dentro
                    achados.append((item.stat().st_mtime, alvo))
                    vistos.add(alvo)
                except Exception:
                    continue
        except Exception:
            continue
    achados.sort(key=lambda par: par[0])
    return achados


def _remover(alvo: Path) -> tuple[int, bool]:
    """Apaga arquivo ou arvore. Devolve (bytes liberados, deu certo). Nunca lanca.

    Ao contrario de `purge_dir`, que engole a excecao e segue (`except
    Exception: continue`), aqui a falha e CONTADA — "faxina rodou" nunca pode
    voltar a significar "liberou espaco".
    """
    bytes_ = 0
    try:
        if alvo.is_dir() and not alvo.is_symlink():
            bytes_ = sum(f.stat().st_size for f in alvo.rglob("*") if f.is_file())
            shutil.rmtree(alvo)
        else:
            bytes_ = alvo.stat().st_size
            alvo.unlink()
        return bytes_, True
    except Exception:
        return 0, False


def despejar(limite_pct: float, agora: float | None = None) -> dict:
    """Apaga acumulador do mais VELHO pro mais novo ate o disco voltar abaixo do limite.

    Para assim que `disk_percent()` cai abaixo de `limite_pct`: disco que ja
    voltou nao paga re-download do que sobrou. Nunca lanca — devolve o que fez.
    """
    agora = time.time() if agora is None else agora
    protegidos = em_uso() | _intocaveis()
    conta = {"removidos": 0, "liberado": 0, "protegidos": 0, "novos": 0, "falhas": 0}
    try:
        for mtime, alvo in _candidatos(_raizes_despejo()):
            if disk_percent() < limite_pct:
                break
            if _protegido(alvo, protegidos):
                conta["protegidos"] += 1
                continue
            if (agora - mtime) < DESPEJO_IDADE_MINIMA_S:
                conta["novos"] += 1
                continue
            bytes_, ok = _remover(alvo)
            if ok:
                conta["removidos"] += 1
                conta["liberado"] += bytes_
            else:
                conta["falhas"] += 1
    except Exception as exc:  # despejo NUNCA pode derrubar o job
        conta["erro"] = str(exc)[:200]
    return conta


def faxina(job_type: str) -> None:
    """
    Roda no FIM de todo job, dê certo ou errado. Sempre apaga os temporários do
    job; quando o disco passa do limite, apaga também o cache de compilação
    (que se refaz sozinho, custando alguns segundos no próximo job — muito
    melhor que derrubar o aluno seguinte) e, se AINDA assim não resolveu,
    despeja os acumuladores (#32).

    A ordem é de propósito: primeiro o que se refaz sozinho, depois o que custa
    re-download. E o despejo só entra se o temporário + cache não bastaram —
    abaixo do limite nada disto acontece e nada disto custa.
    """
    try:
        antes = disk_percent()
        liberado = purge_dir(JOB_TMP)
        # /tmp é onde caem os temporários de bibliotecas que ignoram TMPDIR.
        for legado in (Path("/tmp/torchinductor_root"), Path("/tmp/gradio")):
            if legado.exists() and antes >= DISK_ALERT_PERCENT:
                liberado += purge_dir(legado, keep_dir=False)
        if antes >= DISK_ALERT_PERCENT:
            liberado += purge_dir(INDUCTOR_CACHE)
            # Mesma régua, nunca uma segunda: só despeja quem ainda está acima.
            if disk_percent() >= DISK_ALERT_PERCENT:
                conta = despejar(DISK_ALERT_PERCENT)
                liberado += conta["liberado"]
                pos_despejo = disk_percent()
                resolvido = pos_despejo < DISK_ALERT_PERCENT
                # Declarar que NÃO resolveu importa tanto quanto limpar: disco
                # que segue cheio vai derrubar o próximo aluno e o log tem de
                # dizer que a casa sabia. (`purge_dir` engole exceção, então
                # "faxina rodou" nunca significou "liberou espaço".)
                _log(
                    "info" if resolvido else "warn",
                    "disk.despejo",
                    type=job_type,
                    removidos=conta["removidos"],
                    protegidos=conta["protegidos"],
                    novos_demais=conta["novos"],
                    falhas=conta["falhas"],
                    freed_mb=round(conta["liberado"] / 1_000_000, 1),
                    after_pct=round(pos_despejo, 1),
                    resolvido=resolvido,
                )
        depois = disk_percent()
        if liberado > 0 or antes >= DISK_ALERT_PERCENT:
            _log(
                "info",
                "disk.cleanup",
                type=job_type,
                freed_mb=round(liberado / 1_000_000, 1),
                before_pct=round(antes, 1),
                after_pct=round(depois, 1),
            )
    except Exception as exc:  # faxina NUNCA pode derrubar o job
        try:
            _log("warn", "disk.cleanup_failed", error=str(exc))
        except Exception:
            pass
