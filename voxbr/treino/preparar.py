#!/usr/bin/env python3
"""
VoxBR — prepara o pod de TREINO (09/08).

Baixa o dataset do R2 (227 pacotes .tar ≈ 110GB), extrai nos caminhos que os
manifestos já apontam, junta português + âncora de inglês num manifesto único
embaralhado e escreve a config do treino.

Por que embaralhar: o treino lê o manifesto em ordem; com pt e en em blocos
separados o modelo veria 1.400h de português e SÓ DEPOIS o inglês — que é a
receita do esquecimento que a âncora existe pra evitar.
"""
import json
import os
import random
import subprocess
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
BUCKET = os.environ["R2_BUCKET"]
# v2 = dataset LIMPO (pausa interna comprimida; ver debug do "geração não para").
# Trocável por env pra reproduzir o v1 se precisar comparar.
DATASET_PT = os.environ.get("VOXBR_DATASET_PT", "voxbr/dataset_v2")
DATASET_EN = os.environ.get("VOXBR_DATASET_EN", "voxbr/dataset_v2_en")
CONJUNTOS = [
    (DATASET_PT, Path("/data/dataset")),      # português
    (DATASET_EN, Path("/data/dataset_en")),   # âncora
]


def log(m):
    print(m, flush=True)


def listar(prefixo):
    chaves, tk = [], {}
    while True:
        r = R2.list_objects_v2(Bucket=BUCKET, Prefix=prefixo + "/", **tk)
        chaves += [o["Key"] for o in r.get("Contents", []) if o["Key"].endswith(".tar")]
        if r.get("IsTruncated"):
            tk = {"ContinuationToken": r["NextContinuationToken"]}
        else:
            return sorted(chaves)


def baixar_extrair(args):
    chave, destino = args
    local = Path("/data/tars") / Path(chave).name
    if not local.exists():
        R2.download_file(BUCKET, chave, str(local))
    with tarfile.open(local) as t:
        t.extractall(destino / "wav")
    local.unlink(missing_ok=True)
    return chave


def main():
    Path("/data/tars").mkdir(parents=True, exist_ok=True)
    linhas = []
    for prefixo, destino in CONJUNTOS:
        (destino / "wav").mkdir(parents=True, exist_ok=True)
        chaves = listar(prefixo)
        log(f"{prefixo}: {len(chaves)} pacotes")
        # 8 downloads simultâneos: R2 não cobra egress e a rede do pod aguenta
        with ThreadPoolExecutor(max_workers=8) as ex:
            for i, _ in enumerate(ex.map(baixar_extrair, [(c, destino) for c in chaves]), 1):
                if i % 25 == 0:
                    log(f"  {i}/{len(chaves)} pacotes extraídos")
        R2.download_file(BUCKET, f"{prefixo}/train.jsonl", str(destino / "train.jsonl"))
        n_ok = n_falta = 0
        for l in open(destino / "train.jsonl", encoding="utf-8"):
            d = json.loads(l)
            # a fábrica gravou caminhos /workspace/...; aqui o dataset mora em
            # /data (o /workspace deste pod só tem 20GB — o disco grande é a raiz)
            d["audio"] = d["audio"].replace("/workspace/", "/data/")
            if Path(d["audio"]).exists():
                linhas.append(json.dumps(d, ensure_ascii=False) + "\n")
                n_ok += 1
            else:
                n_falta += 1
        log(f"  manifesto: {n_ok} clipes ok, {n_falta} sem arquivo (descartados)")

    random.seed(42)
    random.shuffle(linhas)  # intercala pt e en (anti-esquecimento)
    saida = Path("/data/train_final.jsonl")
    saida.write_text("".join(linhas), encoding="utf-8")
    horas = sum(json.loads(l)["duration"] for l in linhas) / 3600
    log(f"\nMANIFESTO FINAL: {len(linhas)} clipes · {horas:.1f}h · {saida}")

    # ── config a partir da oficial do v2 ──────────────────────────────────
    import re
    src = open("/workspace/VoxCPM/conf/voxcpm_v2/voxcpm_finetune_all.yaml").read()
    src = src.replace("/path/to/VoxCPM2/", "/workspace/VoxCPM2")
    src = src.replace("/path/to/train.jsonl", str(saida))
    # checkpoint pesa ~12GB: vai pro disco de 300GB, nunca pro /workspace (20GB)
    src = src.replace("/path/to/checkpoints/finetune_all", "/data/ckpt")
    src = src.replace("/path/to/logs/finetune_all", "/data/tb")
    # 1,5 época ≈ 23k passos (244k clipes ÷ 16 por passo × 1,5)
    passos = int(len(linhas) / 16 * 1.5)
    src = re.sub(r"num_iters: \d+", f"num_iters: {passos}", src)
    src = re.sub(r"max_steps: \d+", f"max_steps: {passos}", src)
    # a cada 5k passos = ~4 checkpoints (~50GB), cabe com folga
    src = re.sub(r"save_interval: \d+", "save_interval: 5000", src)
    src = re.sub(r"valid_interval: \d+", "valid_interval: 5000", src)
    open("/workspace/treino.yaml", "w").write(src)
    log(f"config escrita: {passos} passos (~1,5 época)")

    # Validação de PACING (11/08): 1.000 passos no dataset LIMPO pra ver se o
    # "geração não para" sumiu ANTES do treino cheio (~US$3 vs ~US$25). 300 era
    # curto demais pro sintoma aparecer; 1.000 já dá um checkpoint testável.
    passos_v = int(os.environ.get("VOXBR_VALIDA_PASSOS", "1000"))
    src_v = re.sub(r"(num_iters|max_steps): \d+", lambda m: f"{m.group(1)}: {passos_v}", src)
    src_v = src_v.replace("/data/ckpt", "/data/ckpt_valida")
    src_v = re.sub(r"save_interval: \d+", f"save_interval: {passos_v}", src_v)
    src_v = re.sub(r"valid_interval: \d+", f"valid_interval: {passos_v}", src_v)
    open("/workspace/valida.yaml", "w").write(src_v)
    log(f"config de validação escrita: {passos_v} passos (dataset {DATASET_PT})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
