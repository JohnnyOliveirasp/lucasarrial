#!/usr/bin/env python3
"""
Watchdog de desligamento do pod de treino (14/08) — salva TUDO e só então mata.

Por que existe: o passo 8 do `rodar_tagarela.sh` se auto-destrói, mas só quando
`RUNPOD_API_KEY`/`RUNPOD_POD_ID` estão no ambiente DELE. O processo em voo (pid
8400, lançado 13/08) subiu sem as duas — conferido em /proc/8400/environ. Não dá
pra injetar env em processo vivo, então este watchdog roda ao lado.

Ordem de segurança (regra do Johnny: "salvar tudo antes"):
  1. só age com status.txt == TREINO_TERMINOU **e** treino fora do ar
  2. sobe o checkpoint final pro R2 e **confere arquivo a arquivo pelo tamanho**
  3. sobe treino.log / amostras.log / vigia.log e o marcador _TREINO_TERMINOU
  4. só então DELETE no pod
Qualquer divergência na conferência = NÃO desliga. Pagar hora ociosa é barato
perto de perder 26GB de checkpoint.

Lançar no pod:
  set -a; . /data/.r2env; set +a
  setsid nohup python /data/desligar_no_fim.py >> /data/desligar.log 2>&1 &
"""
import json
import os
import subprocess
import time
import urllib.request
from pathlib import Path

import boto3

POD_ID = os.environ.get("RUNPOD_POD_ID", "8uvciw4xtn0791")
BUCKET = os.environ.get("R2_BUCKET", "voices-clone-ai-verse")
PREFIXO = "voxbr/ckpt_tagarela"
CKPT = Path("/data/ckpt")
STATUS = Path("/data/status.txt")
CICLO_S = 120

R2 = boto3.client(
    "s3",
    endpoint_url=os.environ["R2_ENDPOINT"],
    aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
    aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
    region_name="auto",
)


def log(m):
    print(f"[{time.strftime('%H:%M:%S')}] {m}", flush=True)


def treino_vivo() -> bool:
    r = subprocess.run(["pgrep", "-f", "train_voxcpm_finetune"], capture_output=True)
    return r.returncode == 0


def status() -> str:
    try:
        return STATUS.read_text().strip()
    except Exception:
        return ""


def step_final() -> Path | None:
    if not CKPT.exists():
        return None
    steps = sorted(
        [d for d in CKPT.iterdir() if d.is_dir() and d.name.startswith("step_")],
        key=lambda d: int(d.name.split("_")[1]),
    )
    return steps[-1] if steps else None


def tamanho_no_r2(chave: str) -> int | None:
    try:
        return R2.head_object(Bucket=BUCKET, Key=chave)["ContentLength"]
    except Exception:
        return None


def garantir_no_r2(d: Path) -> bool:
    """Sobe o que faltar/divergir e confere. False = não pode desligar."""
    arquivos = [f for f in d.rglob("*") if f.is_file()]
    if not arquivos:
        log(f"ALERTA: {d.name} está vazio — não desligo")
        return False
    for tentativa in (1, 2, 3):
        pendentes = []
        for f in arquivos:
            chave = f"{PREFIXO}/{d.name}/{f.relative_to(d)}"
            if tamanho_no_r2(chave) != f.stat().st_size:
                pendentes.append((f, chave))
        if not pendentes:
            total = sum(f.stat().st_size for f in arquivos)
            log(f"conferido: {d.name} completo no R2 ({len(arquivos)} arquivos, {total / 1e9:.1f}GB)")
            return True
        log(f"tentativa {tentativa}: subindo {len(pendentes)} arquivo(s) de {d.name}")
        for f, chave in pendentes:
            try:
                R2.upload_file(str(f), BUCKET, chave)
            except Exception as e:
                log(f"upload {chave} falhou: {e}")
    log(f"ALERTA: {d.name} NÃO fechou no R2 depois de 3 tentativas — pod fica de pé")
    return False


def subir_logs(nome_final: str) -> None:
    for caminho, chave in [
        ("/data/treino.log", f"{PREFIXO}/treino_final.log"),
        ("/data/amostras.log", f"{PREFIXO}/amostras.log"),
        ("/data/vigia.log", f"{PREFIXO}/vigia.log"),
        ("/data/desligar.log", f"{PREFIXO}/desligar.log"),
    ]:
        if Path(caminho).exists():
            try:
                R2.upload_file(caminho, BUCKET, chave)
                log(f"log no R2: {chave}")
            except Exception as e:
                log(f"log {chave} falhou: {e}")
    try:
        R2.put_object(
            Bucket=BUCKET,
            Key=f"{PREFIXO}/_TREINO_TERMINOU",
            Body=json.dumps(
                {"checkpoint": nome_final, "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
            ).encode(),
        )
    except Exception as e:
        log(f"marcador falhou: {e}")


def desligar() -> None:
    chave = os.environ.get("RUNPOD_API_KEY")
    if not chave:
        log("ALERTA: sem RUNPOD_API_KEY — não consigo desligar; termine na mão")
        return
    req = urllib.request.Request(
        f"https://rest.runpod.io/v1/pods/{POD_ID}",
        method="DELETE",
        headers={"Authorization": f"Bearer {chave}"},
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            log(f"DELETE pod {POD_ID} → {r.status}")
    except Exception as e:
        log(f"DELETE falhou: {e}")


def main():
    log(f"watchdog de pé (pod {POD_ID}) — desliga só depois de tudo salvo no R2")
    while True:
        try:
            st = status()
            if st == "TREINO_FALHOU":
                log("status=TREINO_FALHOU — pod fica de pé pra inspeção")
            elif st == "TREINO_TERMINOU" and not treino_vivo():
                final = step_final()
                if final is None:
                    log("ALERTA: terminou e não achei checkpoint local — não desligo")
                elif garantir_no_r2(final):
                    subir_logs(final.name)
                    # de novo, agora com o desligar.log já escrito até aqui
                    R2.upload_file("/data/desligar.log", BUCKET, f"{PREFIXO}/desligar.log")
                    log("tudo salvo. desligando.")
                    desligar()
                    return
        except Exception as e:
            log(f"loop falhou (segue): {e}")
        time.sleep(CICLO_S)


if __name__ == "__main__":
    main()
