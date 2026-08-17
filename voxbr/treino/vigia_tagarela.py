#!/usr/bin/env python3
"""
VoxBR TREINO TAGARELA — vigia do pod (13/08). Roda em setsid, loop de 5min.

Missões (ordem do Johnny: "não deixar a máquina cair"):
1. FAXINA: mantém só os 2 step_* mais recentes em /data/ckpt (nunca toca no
   latest) — lição do disco cheio que matou o treino v1 em 10/08.
2. BACKUP: sobe cada checkpoint completo pro R2 (voxbr/ckpt_tagarela/) via
   boto3 (rclone dá 403 no multipart) e mantém só os 2 mais novos lá.
   Queda de máquina = retoma do último checkpoint, perde no máx ~2k passos.
3. HEARTBEAT: escreve _status.json no R2 (passo, loss, GPU, disco) — dá pra
   acompanhar de fora sem SSH.
4. AMOSTRA: SÓ a partir do passo em vigia_cfg.json (~700h vistas, regra do
   Johnny 13/08). Gera 1 frase-teste zero-shot por checkpoint, mede duração,
   loga em /data/amostras.log e sobe o wav pro R2. Falha de amostra NUNCA
   derruba o vigia (subprocess com timeout).
"""
import json
import os
import re
import shutil
import subprocess
import time
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
PREFIXO = "voxbr/ckpt_tagarela"
CKPT = Path("/data/ckpt")
LOG_TREINO = Path("/data/treino.log")
CFG = json.loads(Path("/data/vigia_cfg.json").read_text()) if Path("/data/vigia_cfg.json").exists() else {}
PASSO_AMOSTRA = int(CFG.get("passo_amostra", 16000))
SUBIDOS = Path("/data/vigia_subidos.json")


def log(m):
    print(f"[{time.strftime('%H:%M:%S')}] {m}", flush=True)


def steps_locais():
    if not CKPT.exists():
        return []
    return sorted(
        [d for d in CKPT.iterdir() if d.is_dir() and d.name.startswith("step_")],
        key=lambda d: int(d.name.split("_")[1]),
    )


def dir_estavel(d: Path) -> bool:
    """Checkpoint em escrita muda de tamanho — só mexer quando estabilizar."""
    def tam():
        return sum(f.stat().st_size for f in d.rglob("*") if f.is_file())
    a = tam()
    time.sleep(20)
    return tam() == a


def faxina():
    steps = steps_locais()
    for velho in steps[:-2]:
        shutil.rmtree(velho, ignore_errors=True)
        log(f"faxina: apagado {velho.name}")


def subir_checkpoint(d: Path):
    arquivos = [f for f in d.rglob("*") if f.is_file()]
    total = sum(f.stat().st_size for f in arquivos)
    log(f"subindo {d.name} pro R2 ({total / 1e9:.1f}GB)...")
    for f in arquivos:
        chave = f"{PREFIXO}/{d.name}/{f.relative_to(d)}"
        R2.upload_file(str(f), BUCKET, chave)
    log(f"subiu {d.name} ({len(arquivos)} arquivos)")


def podar_r2():
    """Mantém só os 2 step_* mais novos no R2."""
    r = R2.list_objects_v2(Bucket=BUCKET, Prefix=PREFIXO + "/step_", Delimiter="/")
    pastas = sorted(
        [p["Prefix"] for p in r.get("CommonPrefixes", [])],
        key=lambda p: int(p.rstrip("/").split("_")[-1]),
    )
    for velha in pastas[:-2]:
        tk = {}
        while True:
            rr = R2.list_objects_v2(Bucket=BUCKET, Prefix=velha, **tk)
            objs = [{"Key": o["Key"]} for o in rr.get("Contents", [])]
            if objs:
                R2.delete_objects(Bucket=BUCKET, Delete={"Objects": objs})
            if rr.get("IsTruncated"):
                tk = {"ContinuationToken": rr["NextContinuationToken"]}
            else:
                break
        log(f"R2: podado {velha}")


def ultimo_loss():
    try:
        out = subprocess.run(
            ["tail", "-c", "20000", str(LOG_TREINO)], capture_output=True, text=True, timeout=15
        ).stdout
        m = re.findall(r"step (\d+).*?loss/diff: ([0-9.]+)", out)
        return {"passo": int(m[-1][0]), "loss_diff": float(m[-1][1])} if m else {}
    except Exception:
        return {}


def gpu_util():
    try:
        out = subprocess.run(
            ["nvidia-smi", "--query-gpu=utilization.gpu,memory.used", "--format=csv,noheader,nounits"],
            capture_output=True, text=True, timeout=15,
        ).stdout.strip().split(",")
        return {"gpu_pct": int(out[0]), "vram_mb": int(out[1])}
    except Exception:
        return {}


def heartbeat(extra):
    disco = shutil.disk_usage("/data")
    st = {
        "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "disco_livre_gb": round(disco.free / 1e9, 1),
        **ultimo_loss(),
        **gpu_util(),
        **extra,
    }
    try:
        R2.put_object(Bucket=BUCKET, Key=f"{PREFIXO}/_status.json", Body=json.dumps(st).encode())
    except Exception as e:
        log(f"heartbeat falhou: {e}")
    return st


def amostrar(d: Path):
    """Frase-teste zero-shot no checkpoint. Timeout duro; erro só loga."""
    wav = f"/data/amostras/{d.name}.wav"
    Path("/data/amostras").mkdir(exist_ok=True)
    try:
        # OOM 14/08: o treino ocupa ~76GB dos 80 — amostra roda em CPU
        # (lenta, ~10-30min, mas não briga com o treino pela VRAM).
        r = subprocess.run(
            ["python", "/data/amostra_tagarela.py", str(d), wav],
            capture_output=True, text=True, timeout=3600,
            env={**os.environ, "CUDA_VISIBLE_DEVICES": ""},
        )
        dur = re.search(r"DURACAO_S=([0-9.]+)", r.stdout)
        linha = f"{d.name}: {dur.group(1) + 's' if dur else 'FALHOU'} ({r.returncode})"
        with open("/data/amostras.log", "a") as f:
            f.write(linha + "\n")
        log(f"amostra {linha}")
        if Path(wav).exists():
            R2.upload_file(wav, BUCKET, f"{PREFIXO}/amostras/{d.name}.wav")
    except Exception as e:
        log(f"amostra {d.name} falhou: {e}")


def main():
    subidos = set(json.loads(SUBIDOS.read_text())) if SUBIDOS.exists() else set()
    while True:
        try:
            steps = steps_locais()
            candidatos = [d for d in steps if d.name not in subidos]
            # não mexe no mais novo se ainda estiver sendo escrito
            for d in candidatos:
                if d != steps[-1] or dir_estavel(d):
                    subir_checkpoint(d)
                    subidos.add(d.name)
                    SUBIDOS.write_text(json.dumps(sorted(subidos)))
                    podar_r2()
                    passo = int(d.name.split("_")[1])
                    if passo >= PASSO_AMOSTRA:
                        amostrar(d)
            faxina()
            st = heartbeat({"subidos": len(subidos)})
            log(f"ok passo={st.get('passo')} loss={st.get('loss_diff')} gpu={st.get('gpu_pct')}% livre={st['disco_livre_gb']}GB")
        except Exception as e:
            log(f"loop falhou (segue): {e}")
        time.sleep(300)


if __name__ == "__main__":
    main()
