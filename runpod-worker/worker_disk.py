"""Faxina do disco efemero do worker (incidente 10/08).

O container tem 50GB e o worker fica QUENTE por horas: sem isto o disco enchia
e todo aluno que caisse naquele worker falhava com "No space left on device".
"""
from __future__ import annotations

import shutil
from pathlib import Path

from worker_config import DISK_ALERT_PERCENT, INDUCTOR_CACHE, JOB_TMP
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


def faxina(job_type: str) -> None:
    """
    Roda no FIM de todo job, dê certo ou errado. Sempre apaga os temporários do
    job; quando o disco passa do limite, apaga também o cache de compilação
    (que se refaz sozinho, custando alguns segundos no próximo job — muito
    melhor que derrubar o aluno seguinte).
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
