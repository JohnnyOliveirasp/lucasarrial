#!/usr/bin/env python3
"""
VoxBR TREINO TAGARELA (13/08) — prepara o pod de treino.

Decisão do Johnny 11/08: treino do ZERO da base, SÓ com o TAGARELA 1.500h
(419 tars · 103GB · train.jsonl JÁ RECONCILIADO no R2 em 13/08).
Baixa os tars do R2 (8 paralelos), extrai em /data/dataset/wav, valida o
manifesto contra os arquivos reais, embaralha e escreve a config:
  - checkpoint a cada 2.000 passos (pedido do Johnny: quebrou → retoma)
  - ~1,5 época (num_iters calculado do nº real de clipes)
Também escreve /data/vigia_cfg.json com o passo a partir do qual o vigia
gera AMOSTRA (regra do Johnny 13/08: só depois de ~700h de áudio vistas).
"""
import json
import os
import random
import sys
import tarfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import boto3

R2 = boto3.client(
    "s3",
    endpoint_url=os.environ["R2_ENDPOINT"],
    aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
    aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
    region_name="auto",
)
BUCKET = os.environ.get("R2_BUCKET", "voices-clone-ai-verse")
DATASET = "voxbr/dataset_tagarela_1500h"
DESTINO = Path("/data/dataset")


def log(m):
    print(m, flush=True)


def listar_tars():
    chaves, tk = [], {}
    while True:
        r = R2.list_objects_v2(Bucket=BUCKET, Prefix=DATASET + "/", **tk)
        chaves += [o["Key"] for o in r.get("Contents", []) if o["Key"].endswith(".tar")]
        if r.get("IsTruncated"):
            tk = {"ContinuationToken": r["NextContinuationToken"]}
        else:
            return sorted(chaves)


def baixar_extrair(chave):
    local = Path("/data/tars") / Path(chave).name
    if not local.exists():
        R2.download_file(BUCKET, chave, str(local))
    with tarfile.open(local) as t:
        t.extractall(DESTINO / "wav")
    local.unlink(missing_ok=True)
    return chave


def main():
    Path("/data/tars").mkdir(parents=True, exist_ok=True)
    (DESTINO / "wav").mkdir(parents=True, exist_ok=True)

    chaves = listar_tars()
    log(f"{DATASET}: {len(chaves)} pacotes")
    with ThreadPoolExecutor(max_workers=8) as ex:
        for i, _ in enumerate(ex.map(baixar_extrair, chaves), 1):
            if i % 25 == 0:
                log(f"  {i}/{len(chaves)} pacotes extraídos")

    # Manifesto RECONCILIADO (13/08) — não usar o train_raw_backup.jsonl
    R2.download_file(BUCKET, f"{DATASET}/train.jsonl", str(DESTINO / "train.jsonl"))
    linhas, n_falta, seg_total = [], 0, 0.0
    for l in open(DESTINO / "train.jsonl", encoding="utf-8"):
        d = json.loads(l)
        # a fábrica gravou /workspace/...; o disco grande deste pod é /data
        d["audio"] = d["audio"].replace("/workspace/", "/data/")
        if Path(d["audio"]).exists():
            linhas.append(json.dumps(d, ensure_ascii=False) + "\n")
            seg_total += float(d.get("duration", 0))
        else:
            n_falta += 1
    log(f"manifesto: {len(linhas)} clipes ok, {n_falta} sem arquivo (descartados)")

    random.seed(42)
    random.shuffle(linhas)
    saida = Path("/data/train_final.jsonl")
    saida.write_text("".join(linhas), encoding="utf-8")
    media_dur = seg_total / max(1, len(linhas))
    log(f"MANIFESTO FINAL: {len(linhas)} clipes · {seg_total / 3600:.1f}h · média {media_dur:.1f}s")

    # ── config do treino a partir da oficial ─────────────────────────────
    import re
    src = open("/workspace/VoxCPM/conf/voxcpm_v2/voxcpm_finetune_all.yaml").read()
    src = src.replace("/path/to/VoxCPM2/", "/workspace/VoxCPM2")
    src = src.replace("/path/to/train.jsonl", str(saida))
    src = src.replace("/path/to/checkpoints/finetune_all", "/data/ckpt")
    src = src.replace("/path/to/logs/finetune_all", "/data/tb")
    passos = int(len(linhas) / 16 * 1.5)  # 1,5 época, batch 16
    src = re.sub(r"num_iters: \d+", f"num_iters: {passos}", src)
    src = re.sub(r"max_steps: \d+", f"max_steps: {passos}", src)
    # 2.000 passos por checkpoint (Johnny 13/08). ~26GB cada — o vigia faz a
    # faxina local (mantém 2) e sobe pro R2 (lição do disco cheio de 10/08).
    src = re.sub(r"save_interval: \d+", "save_interval: 2000", src)
    src = re.sub(r"valid_interval: \d+", "valid_interval: 2000", src)
    open("/workspace/treino.yaml", "w").write(src)
    log(f"config escrita: {passos} passos (~1,5 época)")

    # ── config do vigia: amostra SÓ depois de ~700h vistas ───────────────
    passo_700h = int(700 * 3600 / (16 * media_dur))
    passo_amostra = ((passo_700h // 2000) + 1) * 2000  # 1º checkpoint após 700h
    cfg = {
        "passos_total": passos,
        "media_dur_s": round(media_dur, 2),
        "passo_amostra": passo_amostra,
    }
    Path("/data/vigia_cfg.json").write_text(json.dumps(cfg))
    log(f"vigia: amostra a partir do passo {passo_amostra} (~700h vistas)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
