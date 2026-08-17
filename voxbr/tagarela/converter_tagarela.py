# -*- coding: utf-8 -*-
"""TAGARELA (parquets HF) -> formato da fábrica VoxBR, direto pro R2.

Roda NO POD (datacenter fala com R2 rápido). Cada parquet vira 1 ou mais tars
de FLAC 16kHz mono + acrescenta ao train.jsonl. Depois o MESMO limpar_caudas.py
passa por cima (comprime as pausas internas — TAGARELA tem 42%).

Colunas do parquet: audio{bytes,path?} · sentence · path · accent
Só pt-br (o accent já vem, mas conferimos) e faixa 3-30s (regra da doc VoxCPM).

Uso (no pod):  python3 converter_tagarela.py
Lê os parquets de /data/tagarela_in/, escreve tars em voxbr/dataset_tagarela/.
"""
import io
import json
import os
import tarfile
from pathlib import Path

import boto3
import numpy as np
import pyarrow.parquet as pq
import soundfile as sf

# credenciais R2: env do processo OU arquivo .r2env ao lado (roda local ou pod)
_envfile = Path(__file__).resolve().parent / ".r2env"
if _envfile.exists():
    for _l in _envfile.read_text().splitlines():
        if "=" in _l and not _l.startswith("#"):
            _k, _v = _l.split("=", 1)
            os.environ.setdefault(_k.strip(), _v.strip())

SR = 16_000
# Rodável no POD (/data/...) ou LOCAL (a própria pasta). Sobrescreve por env.
ENTRADA = Path(os.environ.get("TAGARELA_IN", str(Path(__file__).resolve().parent)))
TRAB = Path(os.environ.get("TAGARELA_WORK", str(Path(__file__).resolve().parent / "_work")))
BUCKET = "voices-clone-ai-verse"
PREFIXO = "voxbr/dataset_tagarela"
CLIPES_POR_TAR = 1200  # ~mesma granularidade dos tars do YODAS

s3 = boto3.client(
    "s3",
    endpoint_url=os.environ["R2_ENDPOINT"],
    aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
    aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
)


def para_16k_mono(x: np.ndarray, sr: int) -> np.ndarray:
    if x.ndim > 1:
        x = x.mean(axis=1)
    if sr != SR:
        # reamostragem linear simples (o dado já é 16k no TAGARELA; guard-rail)
        n_alvo = int(round(len(x) * SR / sr))
        x = np.interp(np.linspace(0, len(x) - 1, n_alvo), np.arange(len(x)), x)
    return x.astype(np.float32)


def main() -> None:
    TRAB.mkdir(parents=True, exist_ok=True)
    manifesto = TRAB / "train.jsonl"
    parquets = sorted(ENTRADA.glob("*.parquet"))
    print(f"{len(parquets)} parquets", flush=True)

    tar_idx = 0
    clipes_no_tar = 0
    tar = None
    total_h = 0.0
    total_n = 0
    pulados = 0

    def novo_tar(i):
        return tarfile.open(TRAB / f"tagarela_{i:05d}.tar", "w")

    def fecha_e_sobe(i, t):
        t.close()
        local = TRAB / f"tagarela_{i:05d}.tar"
        s3.upload_file(str(local), BUCKET, f"{PREFIXO}/tagarela_{i:05d}.tar")
        local.unlink()
        print(f"  tar {i:05d} subiu ({clipes_no_tar} clipes)", flush=True)

    with open(manifesto, "w", encoding="utf-8") as man:
        for pq_path in parquets:
            pf = pq.ParquetFile(pq_path)
            for batch in pf.iter_batches(batch_size=256, columns=["audio", "sentence", "accent"]):
                rows = batch.to_pylist()
                for r in rows:
                    txt = (r.get("sentence") or "").strip()
                    accent = (r.get("accent") or "pt-br").lower()
                    if not txt or "pt" not in accent:
                        pulados += 1
                        continue
                    try:
                        with sf.SoundFile(io.BytesIO(r["audio"]["bytes"])) as f:
                            sr = f.samplerate
                            x = f.read(dtype="float32")
                    except Exception:
                        pulados += 1
                        continue
                    x = para_16k_mono(x, sr)
                    dur = len(x) / SR
                    if dur < 3 or dur > 30:
                        pulados += 1
                        continue
                    if tar is None:
                        tar = novo_tar(tar_idx)
                        clipes_no_tar = 0
                    nome = f"tag_{total_n:07d}.flac"
                    buf = io.BytesIO()
                    sf.write(buf, x, SR, format="FLAC")
                    data = buf.getvalue()
                    ti = tarfile.TarInfo(nome)
                    ti.size = len(data)
                    tar.addfile(ti, io.BytesIO(data))
                    man.write(json.dumps(
                        {"audio": f"/workspace/dataset/wav/{nome}", "text": txt, "duration": round(dur, 2)},
                        ensure_ascii=False) + "\n")
                    total_h += dur / 3600
                    total_n += 1
                    clipes_no_tar += 1
                    if clipes_no_tar >= CLIPES_POR_TAR:
                        fecha_e_sobe(tar_idx, tar)
                        tar_idx += 1
                        tar = None
                if total_n % 2000 == 0 and total_n:
                    print(f"  {total_n} clipes · {total_h:.1f}h", flush=True)
        if tar is not None:
            fecha_e_sobe(tar_idx, tar)
            tar_idx += 1

    s3.upload_file(str(manifesto), BUCKET, f"{PREFIXO}/train.jsonl")
    resumo = {"clipes": total_n, "horas": round(total_h, 1), "tars": tar_idx, "pulados": pulados}
    print("RESUMO " + json.dumps(resumo, ensure_ascii=False), flush=True)
    (TRAB / "stats.json").write_text(json.dumps(resumo, ensure_ascii=False, indent=2))
    s3.upload_file(str(TRAB / "stats.json"), BUCKET, f"{PREFIXO}/stats.json")


if __name__ == "__main__":
    main()
