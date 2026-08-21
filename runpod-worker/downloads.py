"""Download com cache local por URL (LoRA, referencia, audio avulso)."""
from __future__ import annotations

import hashlib
from pathlib import Path

from worker_log import log as _log


def ensure_local_from_url(url: str, target_dir: Path, label: str) -> Path:
    """Baixa URL pra target_dir/<basename>. Cacheia: se já existe, reusa."""
    from voice_pipeline import download_to_dir
    target_dir.mkdir(parents=True, exist_ok=True)
    # Hash da URL pra evitar colisão de basename
    import hashlib
    h = hashlib.sha256(url.split("?", 1)[0].encode()).hexdigest()[:16]
    base = url.split("?", 1)[0].rsplit("/", 1)[-1] or "file.bin"
    base = "".join(c if c.isalnum() or c in "._-" else "_" for c in base)
    target = target_dir / f"{h}_{base}"
    if target.exists() and target.stat().st_size > 0:
        _log("info", "cache.hit", label=label, path=str(target))
        return target
    paths = download_to_dir([url], target_dir)
    # download_to_dir nomeia como 000_<basename>; rename pra ter cache estável
    paths[0].rename(target)
    return target
