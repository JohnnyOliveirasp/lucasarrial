# -*- coding: utf-8 -*-
"""TAGARELA completo (HF, 1.764 shards, 8.972h) -> 1.500h LIMPAS no R2.

Roda NO POD, numa passada só por clipe:
  download shard -> decode -> filtro (pt, 3-30s) -> aparar() [corta cabeça/
  cauda de silêncio + comprime pausa interna >0,45s — a MESMA faca do
  limpar_caudas que gerou o dataset_v2] -> FLAC 16k mono -> tar -> R2 (boto3;
  rclone dá 403 no multipart do R2, lição 11/08).

Shards ESPALHADOS (stride) em vez de sequenciais: os shards seguem ordem de
episódio/falante — espalhar maximiza a diversidade dos 13.368 falantes.

Para quando o total LIMPO passa de ALVO_H (1.500h). Estado em
/data/estado.json (retomável). Destino: voxbr/dataset_tagarela_1500h/.

Uso (no pod): python3 tagarela_1500h_pod.py   (creds R2 no env)
"""
from __future__ import annotations  # Python 3.8 do pod: tuple[...] em anotação

import io
import json
import multiprocessing as mp
import os
import subprocess
import tarfile
import time
from pathlib import Path

import boto3
import numpy as np
import pyarrow.parquet as pq
import soundfile as sf

SR = 16_000
ALVO_H = float(os.environ.get("ALVO_H", "1500"))
TOTAL_SHARDS = 1764
STRIDE = 5  # 1764/5 ≈ 352 shards ≈ ~1.500-1.600h líquidas — espalhado no corpus
BUCKET = "voices-clone-ai-verse"
PREFIXO = "voxbr/dataset_tagarela_1500h"
CLIPES_POR_TAR = 1200
BASE_URL = "https://huggingface.co/datasets/freds0/TAGARELA/resolve/main/data"
TRAB = Path("/data/tag1500")
ESTADO = Path("/data/estado.json")

# ── faca do limpar_caudas (idêntica à que gerou o dataset_v2) ──
LIMIAR = 0.005
JANELA_MS = 10
FOLGA_S = 0.4
TETO_PAUSA_S = 0.45


def aparar(x: np.ndarray) -> tuple[np.ndarray, float]:
    """Corta silêncio de cabeça/cauda (folga 0,4s) e comprime pausas internas
    >0,45s pro teto. Devolve (audio, maior_pausa_interna_original_s)."""
    if x.ndim > 1:
        x = x.mean(axis=1)
    n = len(x)
    if n == 0:
        return x, 0.0
    jan = max(1, int(SR * JANELA_MS / 1000))
    npad = (-n) % jan
    picos = np.abs(np.pad(x, (0, npad))).reshape(-1, jan).max(axis=1)
    ativos = np.where(picos > LIMIAR)[0]
    if ativos.size == 0:
        return x, 0.0  # mudo: filtrado pela duração depois
    ini = ativos[0] * jan
    fim = min(n, (ativos[-1] + 1) * jan)
    interna = picos[ativos[0]: ativos[-1] + 1] <= LIMIAR
    maior = atual = 0
    for m in interna:
        atual = atual + 1 if m else 0
        maior = max(maior, atual)
    pausa_s = maior * jan / SR
    folga = int(SR * FOLGA_S)
    y = x[max(0, ini - folga): min(n, fim + folga)]
    if pausa_s > TETO_PAUSA_S:
        n2 = len(y)
        npad2 = (-n2) % jan
        p2 = np.abs(np.pad(y, (0, npad2))).reshape(-1, jan).max(axis=1)
        mudo = p2 <= LIMIAR
        teto_j = int(TETO_PAUSA_S * SR / jan)
        manter = np.ones(len(p2), dtype=bool)
        i = 0
        while i < len(p2):
            if mudo[i]:
                j = i
                while j < len(p2) and mudo[j]:
                    j += 1
                if j - i > teto_j:
                    manter[i + teto_j: j] = False
                i = j
            else:
                i += 1
        y = y[np.repeat(manter, jan)[:n2]]
    return y.astype(np.float32), pausa_s


def para_16k_mono(x: np.ndarray, sr: int) -> np.ndarray:
    if x.ndim > 1:
        x = x.mean(axis=1)
    if sr != SR:
        n_alvo = int(round(len(x) * SR / sr))
        x = np.interp(np.linspace(0, len(x) - 1, n_alvo), np.arange(len(x)), x)
    return x.astype(np.float32)


def processa_clipe(r: dict):
    """Roda no POOL (CPU-bound): decode -> filtro -> aparar -> FLAC.
    Devolve (flac_bytes, dur, txt, pausa_grande) ou None se pulado."""
    txt = (r.get("sentence") or "").strip()
    accent = (r.get("accent") or "pt-br").lower()
    if not txt or "pt" not in accent:
        return None
    try:
        with sf.SoundFile(io.BytesIO(r["audio"]["bytes"])) as f:
            sr = f.samplerate
            x = f.read(dtype="float32")
    except Exception:
        return None
    x = para_16k_mono(x, sr)
    y, pausa = aparar(x)
    dur = len(y) / SR
    if dur < 3 or dur > 30:
        return None
    buf = io.BytesIO()
    sf.write(buf, y, SR, format="FLAC")
    return (buf.getvalue(), dur, txt, pausa > TETO_PAUSA_S)


# 11/08 noite: o CDN xet do HF passou a assinar a URL presa a byte-range —
# multi-conexão (aria2 -x8) toma 403 a partir do shard ~00080. Voltamos a
# conexão ÚNICA por arquivo (curl, sem depender de aria2 na imagem); o
# paralelismo vem de baixar PREFETCH_N shards simultâneos, cada um com a
# própria conexão — escapa do 403 e compensa o throttle de ~1MB/s/conexão.
PREFETCH_N = 4


def cmd_download(idx: int, dest: Path) -> list:
    url = f"{BASE_URL}/train-{idx:05d}-of-{TOTAL_SHARDS:05d}.parquet"
    # Estratégia 12/08 v2 (ideia do Johnny): conexão lenta (<300KB/s por 30s)
    # é MORTA, mas o -C - RETOMA do byte onde parou na conexão nova — nada é
    # jogado fora. Testado no CDN xet: resume de conexão única = HTTP 206
    # (o 403 de 11/08 era range MULTI-conexão do aria2). A v1 do speed-limit
    # sem resume descartou 9 shards quando o HF estrangulou TODAS as conexões.
    return ["curl", "-sfL", "-C", "-", "--retry", "3", "--speed-limit", "300000",
            "--speed-time", "30", "-o", str(dest), url]


def baixar_shard(idx: int, dest: Path) -> bool:
    # 12/08 tarde: 3 tentativas eram POUCAS quando o HF estrangula tudo —
    # 17 shards pulados por "FALHOU". Com -C - cada tentativa ACUMULA bytes
    # (mesmo morta pelo speed-limit), então com 30 tentativas o shard sempre
    # fecha; a conexão rápida que aparecer no meio acelera o resto.
    for tent in range(30):
        r = subprocess.run(cmd_download(idx, dest))
        if r.returncode == 0 and dest.exists() and dest.stat().st_size > 1_000_000:
            return True
        time.sleep(5)
    return False


def main() -> None:
    TRAB.mkdir(parents=True, exist_ok=True)
    s3 = boto3.client(
        "s3",
        endpoint_url=os.environ["R2_ENDPOINT"],
        aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
    )
    est = {"prox_pos": 0, "tar_idx": 0, "total_n": 0, "total_h": 0.0, "pulados": 0, "pausas_comprimidas": 0}
    if ESTADO.exists():
        est.update(json.loads(ESTADO.read_text()))
        print(f"retomando: {est}", flush=True)
    ordem = list(range(0, TOTAL_SHARDS, STRIDE))  # espalhado
    manifesto = TRAB / "train.jsonl"
    man = open(manifesto, "a", encoding="utf-8")

    tar = None
    clipes_no_tar = 0

    def fecha_e_sobe():
        nonlocal tar, clipes_no_tar
        if tar is None:
            return
        tar.close()
        local = TRAB / f"tagarela_{est['tar_idx']:05d}.tar"
        s3.upload_file(str(local), BUCKET, f"{PREFIXO}/tagarela_{est['tar_idx']:05d}.tar")
        local.unlink()
        print(f"  tar {est['tar_idx']:05d} subiu ({clipes_no_tar} clipes) · {est['total_h']:.1f}h", flush=True)
        est["tar_idx"] += 1
        tar = None
        clipes_no_tar = 0
        ESTADO.write_text(json.dumps(est))
        # Checkpoint CONTÍNUO no R2 (lição 12/08: pod morto de surpresa perdeu
        # o manifesto de 194h→528h — áudio sem texto não treina). A cada tar,
        # estado + manifesto sobem; morte súbita agora custa 1 tar, não 1 dia.
        try:
            man.flush()
            s3.upload_file(str(ESTADO), BUCKET, f"{PREFIXO}/_estado_retomada.json")
            s3.upload_file(str(manifesto), BUCKET, f"{PREFIXO}/_train_parcial.jsonl")
        except Exception as e:  # noqa: BLE001 — checkpoint é best-effort
            print(f"  aviso: checkpoint R2 falhou ({e}) — segue", flush=True)

    # PARALELO (11/08 noite): a v1 usava 1 núcleo e faria 1.500h em ~2 dias.
    # Pool pro trabalho de CPU (decode/aparar/FLAC) + prefetch do próximo
    # shard via curl em background enquanto o atual processa.
    NPROC = max(4, (os.cpu_count() or 8) - 2)
    pool = mp.Pool(NPROC)
    print(f"pool de {NPROC} processos", flush=True)

    def caminho_shard(pos):
        return TRAB / f"shard_{ordem[pos]:05d}.parquet"

    downloads = {}  # pos -> Popen dos downloads em voo (janela de PREFETCH_N)

    def garantir_prefetch(inicio):
        for p in range(inicio, min(inicio + PREFETCH_N, len(ordem))):
            alvo = caminho_shard(p)
            if p not in downloads and not (alvo.exists() and alvo.stat().st_size > 1_000_000):
                downloads[p] = subprocess.Popen(cmd_download(ordem[p], alvo))

    for pos in range(est["prox_pos"], len(ordem)):
        if est["total_h"] >= ALVO_H:
            break
        shard = ordem[pos]
        pq_path = caminho_shard(pos)
        garantir_prefetch(pos)  # este + próximos já baixando em paralelo
        proc = downloads.pop(pos, None)
        # returncode != 0 = curl morto pelo speed-limit no meio → o arquivo
        # parcial passa no check de tamanho mas está truncado; o -C - do
        # baixar_shard retoma do byte onde parou.
        prefetch_ok = proc.wait() == 0 if proc is not None else True
        if not prefetch_ok or not (pq_path.exists() and pq_path.stat().st_size > 1_000_000):
            print(f"[shard {shard:05d}] ({pos + 1}/{len(ordem)}) baixando/retomando…", flush=True)
            if not baixar_shard(shard, pq_path):
                print(f"[shard {shard:05d}] FALHOU download — pulando", flush=True)
                est["prox_pos"] = pos + 1
                ESTADO.write_text(json.dumps(est))
                continue
        garantir_prefetch(pos + 1)

        # Shard corrompido (snappy quebrado etc.) derrubou o processo 11/08:
        # agora re-baixa 1x; persistindo, PULA o shard (poucos clipes podem
        # duplicar no retry parcial — ruído desprezível em 1.500h).
        ok_shard = False
        for tentativa in range(2):
            try:
                pf = pq.ParquetFile(pq_path)
                for batch in pf.iter_batches(batch_size=512, columns=["audio", "sentence", "accent"]):
                    rows = batch.to_pylist()
                    for res in pool.imap_unordered(processa_clipe, rows, chunksize=8):
                        if res is None:
                            est["pulados"] += 1
                            continue
                        data, dur, txt, pausa_grande = res
                        if pausa_grande:
                            est["pausas_comprimidas"] += 1
                        if tar is None:
                            tar = tarfile.open(TRAB / f"tagarela_{est['tar_idx']:05d}.tar", "w")
                        nome = f"tag_{est['total_n']:07d}.flac"
                        ti = tarfile.TarInfo(nome)
                        ti.size = len(data)
                        tar.addfile(ti, io.BytesIO(data))
                        man.write(json.dumps(
                            {"audio": f"/workspace/dataset/wav/{nome}", "text": txt, "duration": round(dur, 2)},
                            ensure_ascii=False) + "\n")
                        est["total_h"] += dur / 3600
                        est["total_n"] += 1
                        clipes_no_tar += 1
                        if clipes_no_tar >= CLIPES_POR_TAR:
                            fecha_e_sobe()
                ok_shard = True
                break
            except Exception as e:  # noqa: BLE001 — qualquer podridão de shard
                print(f"[shard {shard:05d}] corrompido ({type(e).__name__}: {e}) — "
                      f"{'re-baixando' if tentativa == 0 else 'PULANDO'}", flush=True)
                pq_path.unlink(missing_ok=True)
                if tentativa == 0 and not baixar_shard(shard, pq_path):
                    break
        pq_path.unlink(missing_ok=True)
        est["prox_pos"] = pos + 1
        ESTADO.write_text(json.dumps(est))
        rotulo = "ok" if ok_shard else "DESCARTADO"
        print(f"[shard {shard:05d}] {rotulo} · acumulado {est['total_h']:.1f}h / {ALVO_H:.0f}h", flush=True)

    for proc in downloads.values():  # alvo atingido: derruba downloads que sobraram
        proc.terminate()
    pool.close()

    fecha_e_sobe()
    man.close()
    s3.upload_file(str(manifesto), BUCKET, f"{PREFIXO}/train.jsonl")
    resumo = {
        "clipes": est["total_n"], "horas": round(est["total_h"], 1), "tars": est["tar_idx"],
        "pulados": est["pulados"], "pausas_comprimidas": est["pausas_comprimidas"],
    }
    (TRAB / "stats.json").write_text(json.dumps(resumo, ensure_ascii=False, indent=2))
    s3.upload_file(str(TRAB / "stats.json"), BUCKET, f"{PREFIXO}/stats.json")
    print("RESUMO " + json.dumps(resumo, ensure_ascii=False), flush=True)
    print("TUDO_PRONTO", flush=True)


if __name__ == "__main__":
    main()
