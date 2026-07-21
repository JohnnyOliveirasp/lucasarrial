"""Download/upload de arquivos via presigned URLs do Cloudflare R2.

Usa apenas `urllib`/`requests` — não depende de boto3 no worker.
"""

from __future__ import annotations

import time
from pathlib import Path
from typing import Iterable

import requests


def download_to_dir(
    urls: Iterable[str],
    dest_dir: Path,
    chunk_size: int = 1024 * 1024,
    timeout: int = 60,
) -> list[Path]:
    """Baixa URLs presigned para `dest_dir`, mantendo a ordem.

    Nomes locais ficam `001_<basename>`, `002_<basename>`... baseados no path
    da URL (sem query string).
    """
    dest_dir.mkdir(parents=True, exist_ok=True)
    paths: list[Path] = []
    for i, url in enumerate(urls):
        clean = url.split("?", 1)[0]
        base = clean.rsplit("/", 1)[-1] or f"audio_{i}.bin"
        # Sanitize basename
        base = "".join(c if c.isalnum() or c in "._-" else "_" for c in base)
        target = dest_dir / f"{i:03d}_{base}"
        _stream_to(url, target, chunk_size=chunk_size, timeout=timeout)
        paths.append(target)
    return paths


def _stream_to(url: str, target: Path, chunk_size: int, timeout: int) -> None:
    last_err: Exception | None = None
    for attempt in range(3):
        try:
            with requests.get(url, stream=True, timeout=timeout) as r:
                r.raise_for_status()
                with target.open("wb") as f:
                    for chunk in r.iter_content(chunk_size=chunk_size):
                        if chunk:
                            f.write(chunk)
            return
        except Exception as exc:  # noqa: BLE001
            last_err = exc
            time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"Failed to download {url}: {last_err}")


def upload_file_to_presigned_url(
    file_path: Path,
    presigned_url: str,
    content_type: str = "application/octet-stream",
    timeout: int = 120,
    attempts: int = 3,
) -> None:
    """PUT em URL presigned. Stream do arquivo direto da disk.

    Retry com backoff em 5xx/timeout (janela de instabilidade da Cloudflare
    21/07 derrubou treino/gerações com 502 e read timeout transitórios)."""
    file_path = Path(file_path)
    if not file_path.exists():
        raise FileNotFoundError(file_path)
    last_error: str = ""
    for i in range(attempts):
        try:
            with file_path.open("rb") as f:
                resp = requests.put(
                    presigned_url,
                    data=f,
                    headers={"Content-Type": content_type},
                    timeout=timeout,
                )
            if resp.status_code < 300:
                return
            last_error = f"R2 upload failed ({resp.status_code}): {resp.text[:200]}"
            if resp.status_code < 500:
                raise RuntimeError(last_error)  # 4xx não é transitório
        except requests.RequestException as exc:
            last_error = f"R2 upload request error: {exc}"
        if i < attempts - 1:
            time.sleep(2 * (i + 1))
    raise RuntimeError(f"{last_error} (after {attempts} attempts)")
