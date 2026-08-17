# -*- coding: utf-8 -*-
"""VoxBR dataset_v1 -> dataset_v2: corta cauda (e cabeca) de silencio dos clipes.

POR QUE: a doc oficial do VoxCPM diz que silencio final >0,5s e a causa MAIS
COMUM de "geracao nao para" apos fine-tune — exatamente o sintoma do nosso v1
(fala de 9s virando 25-51s, pausa longa no meio, ultima palavra cortada).
O fabrica.py cortava os clipes pelo timestamp da LEGENDA (audio[ini:fim]) sem
olhar onde a fala termina de verdade; legenda humana fica na tela depois da
fala. Este passo conserta O DADO, nao o codigo da fabrica (o bruto ja esta no
R2 em tars; nao precisa rebaixar nada do YouTube).

MEDE ANTES DE CONSERTAR: para cada clipe registra a cauda original em ms.
O stats.json final e a PROVA (ou refutacao) da tese — % de clipes com cauda
>0,5s — antes de gastar 1 centavo de GPU no retreino.

Roda NO POD (CPU): baixa tars do R2, processa em paralelo, reempacota,
sobe pra voxbr/dataset_v2/ (+ _en) com train.jsonl de duracoes atualizadas.

Uso:  python3 limpar_caudas.py [--prefixo dataset_v1] [--dry N_TARS]
"""
import argparse
import io
import json
import multiprocessing as mp
import os
import subprocess
import sys
import tarfile
import time
from pathlib import Path

import numpy as np
import soundfile as sf

SR = 16_000
LIMIAR = 0.005          # -46 dB, mesmo limiar do trim de inferencia do worker
JANELA_MS = 10          # suavizacao: pico por janela de 10ms
FOLGA_S = 0.4           # cauda/cabeca mantidas apos a ultima/antes da 1a fala
DOC_TETO_S = 0.5        # teto da doc oficial (metrica do stats)

TRAB = Path("/data/limpeza")
R2 = "r2:voices-clone-ai-verse/voxbr"


def run(cmd: list[str]) -> None:
    subprocess.run(cmd, check=True)


def aparar(x: np.ndarray) -> tuple[np.ndarray, float, float, float]:
    """Devolve (audio aparado, cauda_s, cabeca_s, maior_pausa_interna_s).

    A pausa interna e a 2a hipotese (a 1a, cauda, deu so ~1%% no dry-run):
    o `juntar_falas` da fabrica emenda legendas INCLUINDO o vao entre elas —
    se os clipes de treino tem pausas grandes no meio, o modelo aprende a
    pausar no meio. E exatamente o sintoma que o Johnny ouviu na voz dele.
    """
    if x.ndim > 1:
        x = x.mean(axis=1)
    n = len(x)
    if n == 0:
        return x, 0.0, 0.0, 0.0
    jan = max(1, int(SR * JANELA_MS / 1000))
    npad = (-n) % jan
    picos = np.abs(np.pad(x, (0, npad))).reshape(-1, jan).max(axis=1)
    ativos = np.where(picos > LIMIAR)[0]
    if ativos.size == 0:
        return x, n / SR, 0.0, 0.0  # clipe mudo: nao mexe
    ini_amostra = ativos[0] * jan
    fim_amostra = min(n, (ativos[-1] + 1) * jan)
    cabeca_s = ini_amostra / SR
    cauda_s = (n - fim_amostra) / SR
    # maior sequencia de janelas mudas ENTRE a 1a e a ultima ativa
    interna = picos[ativos[0]: ativos[-1] + 1] <= LIMIAR
    maior = 0
    atual = 0
    for m in interna:
        atual = atual + 1 if m else 0
        if atual > maior:
            maior = atual
    pausa_interna_s = maior * jan / SR
    folga = int(SR * FOLGA_S)
    a = max(0, ini_amostra - folga)
    b = min(n, fim_amostra + folga)
    y = x[a:b]

    # A CORREÇÃO PRINCIPAL (medido no dry-run: 23,3%% dos clipes com pausa
    # interna >0,5s — 1 em cada 4 ensinava o modelo a travar no meio da fala).
    # Comprime qualquer silêncio interno maior que TETO_PAUSA_S para esse teto:
    # pausa de vírgula/respiro fica intacta; o vão de legenda emendada morre.
    TETO_PAUSA_S = 0.45
    if pausa_interna_s > TETO_PAUSA_S:
        jan2 = jan
        n2 = len(y)
        npad2 = (-n2) % jan2
        p2 = np.abs(np.pad(y, (0, npad2))).reshape(-1, jan2).max(axis=1)
        mudo = p2 <= LIMIAR
        teto_j = int(TETO_PAUSA_S * SR / jan2)
        manter = np.ones(len(p2), dtype=bool)
        i = 0
        while i < len(p2):
            if mudo[i]:
                j = i
                while j < len(p2) and mudo[j]:
                    j += 1
                if j - i > teto_j:
                    manter[i + teto_j: j] = False  # corta o excedente da pausa
                i = j
            else:
                i += 1
        mask = np.repeat(manter, jan2)[:n2]
        y = y[mask]

    return y, cauda_s, cabeca_s, pausa_interna_s


def processa_tar(args: tuple[str, str]) -> dict:
    nome_tar, prefixo = args
    t0 = time.time()
    local = TRAB / nome_tar
    out = TRAB / f"v2_{nome_tar}"
    stats = {"tar": nome_tar, "clipes": 0, "caudas_ms": [], "cabecas_ms": [], "pausas_ms": [], "dur": {}}
    try:
        run(["rclone", "copyto", f"{R2}/{prefixo}/{nome_tar}", str(local), "--quiet"])
        with tarfile.open(local, "r") as tin, tarfile.open(out, "w") as tout:
            for m in tin:
                if not m.isfile():
                    continue
                raw = tin.extractfile(m).read()
                if not m.name.endswith(".flac"):
                    ti = tarfile.TarInfo(m.name); ti.size = len(raw)
                    tout.addfile(ti, io.BytesIO(raw))
                    continue
                x, sr_lida = sf.read(io.BytesIO(raw), dtype="float32")
                y, cauda, cabeca, pausa = aparar(x)
                buf = io.BytesIO()
                sf.write(buf, y, sr_lida, format="FLAC")
                data = buf.getvalue()
                ti = tarfile.TarInfo(m.name); ti.size = len(data)
                tout.addfile(ti, io.BytesIO(data))
                stats["clipes"] += 1
                stats["caudas_ms"].append(round(cauda * 1000))
                stats["cabecas_ms"].append(round(cabeca * 1000))
                stats["pausas_ms"].append(round(pausa * 1000))
                stats["dur"][Path(m.name).name] = round(len(y) / sr_lida, 2)
        run(["rclone", "copyto", str(out), f"{R2}/{prefixo.replace('_v1', '_v2')}/{nome_tar}", "--quiet"])
        stats["ok"] = True
    except Exception as e:  # 1 tar ruim nao derruba a passada
        stats["ok"] = False
        stats["erro"] = str(e)[:300]
    finally:
        local.unlink(missing_ok=True)
        out.unlink(missing_ok=True)
    stats["s"] = round(time.time() - t0, 1)
    return stats


def principal(prefixo: str, dry: int | None) -> None:
    TRAB.mkdir(parents=True, exist_ok=True)
    ls = subprocess.run(["rclone", "lsf", f"{R2}/{prefixo}/"], capture_output=True, text=True, check=True)
    tars = sorted(f for f in ls.stdout.splitlines() if f.endswith(".tar"))
    if dry:
        tars = tars[:dry]
    print(f"[{prefixo}] {len(tars)} tars", flush=True)

    todas_caudas: list[int] = []
    todas_cabecas: list[int] = []
    todas_pausas: list[int] = []
    duracoes: dict[str, float] = {}
    falhas: list[str] = []
    with mp.Pool(min(12, os.cpu_count() or 4)) as pool:
        for i, st in enumerate(pool.imap_unordered(processa_tar, [(t, prefixo) for t in tars]), 1):
            if st["ok"]:
                todas_caudas.extend(st["caudas_ms"])
                todas_cabecas.extend(st["cabecas_ms"])
                todas_pausas.extend(st["pausas_ms"])
                duracoes.update(st["dur"])
            else:
                falhas.append(f"{st['tar']}: {st['erro']}")
            print(f"[{i}/{len(tars)}] {st['tar']} clipes={st['clipes']} {st['s']}s ok={st['ok']}", flush=True)

    # train.jsonl com duracoes novas (mesmos caminhos/textos)
    man_local = TRAB / "train_v1.jsonl"
    run(["rclone", "copyto", f"{R2}/{prefixo}/train.jsonl", str(man_local), "--quiet"])
    man_out = TRAB / "train_v2.jsonl"
    atualizadas = 0
    cps_lista: list[float] = []  # 3a hipotese: dataset FALA DEVAGAR (cps baixo)
    with open(man_local, encoding="utf-8") as fin, open(man_out, "w", encoding="utf-8") as fout:
        for linha in fin:
            try:
                d = json.loads(linha)
                base = Path(d.get("audio", "")).name
                if base in duracoes:
                    d["duration"] = duracoes[base]
                    atualizadas += 1
                    txt = d.get("text") or ""
                    if txt and duracoes[base] > 0:
                        cps_lista.append(len(txt) / duracoes[base])
                fout.write(json.dumps(d, ensure_ascii=False) + "\n")
            except Exception:
                fout.write(linha)
    run(["rclone", "copyto", str(man_out), f"{R2}/{prefixo.replace('_v1', '_v2')}/train.jsonl", "--quiet"])

    c = np.array(todas_caudas)
    h = np.array(todas_cabecas)
    pz = np.array(todas_pausas)
    cps = np.array(cps_lista)
    pct = lambda a, q: float(np.percentile(a, q)) if a.size else 0.0
    resumo = {
        "prefixo": prefixo,
        "clipes": int(c.size),
        "manifesto_atualizado": atualizadas,
        "cauda_ms": {"p50": pct(c, 50), "p90": pct(c, 90), "p99": pct(c, 99), "max": float(c.max()) if c.size else 0},
        "pct_cauda_acima_500ms": float((c > DOC_TETO_S * 1000).mean() * 100) if c.size else 0,
        "pct_cabeca_acima_500ms": float((h > DOC_TETO_S * 1000).mean() * 100) if h.size else 0,
        # hipotese 2: pausa INTERNA (o que o Johnny ouviu no meio do audio)
        "pausa_interna_ms": {"p50": pct(pz, 50), "p90": pct(pz, 90), "p99": pct(pz, 99), "max": float(pz.max()) if pz.size else 0},
        "pct_pausa_interna_acima_500ms": float((pz > 500).mean() * 100) if pz.size else 0,
        "pct_pausa_interna_acima_1s": float((pz > 1000).mean() * 100) if pz.size else 0,
        # hipotese 3: ritmo do dataset (chars/segundo; fala pt normal ~13-16)
        "cps": {"p10": pct(cps, 10), "p50": pct(cps, 50), "p90": pct(cps, 90)},
        "falhas": falhas,
    }
    print("RESUMO " + json.dumps(resumo, ensure_ascii=False), flush=True)
    with open(TRAB / f"stats_{prefixo}.json", "w") as f:
        json.dump(resumo, f, ensure_ascii=False, indent=2)
    subprocess.run(["rclone", "copyto", str(TRAB / f"stats_{prefixo}.json"),
                    f"{R2}/{prefixo.replace('_v1', '_v2')}/stats.json"], check=False)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--prefixo", default="dataset_v1")
    ap.add_argument("--dry", type=int, default=None, help="processar so N tars (teste)")
    a = ap.parse_args()
    principal(a.prefixo, a.dry)
