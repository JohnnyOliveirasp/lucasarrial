#!/usr/bin/env bash
# VoxBR TREINO TAGARELA 1500h — roda NO POD (A100/H100 80GB), 13/08.
# Lançar com: setsid nohup bash /data/rodar_tagarela.sh > /data/rodar.log 2>&1 &
# Status: /data/status.txt · treino: /data/treino.log · vigia: /data/vigia.log
# Retomável: se o pod morrer, recriar e relançar ESTE script — ele baixa o
# último checkpoint do R2 e o train_voxcpm_finetune.py retoma sozinho (latest).
# Auto-destrói SÓ no sucesso (padrão da casa), depois do checkpoint final no R2.
set -uo pipefail
set -a; . /data/.r2env; set +a
echo "PREPARANDO" > /data/status.txt

# 1. Código do VoxCPM
cd /workspace
git clone --depth 1 https://github.com/OpenBMB/VoxCPM.git || true
cd /workspace/VoxCPM
pip install -e . 2>&1 | tail -2
pip install datasets soundfile boto3 2>&1 | tail -1

# 2. ⚠️ ARMADILHA: pip install -e . sobe o torch pra cu130, driver é cu128 →
#    GPU some → treino cai pra CPU e morre com erro de dtype. Reinstalar cu128.
#    ⚠️ 13/08: torch 2.11.0+cu128 VAZA ~9MB de VRAM por passo no treino
#    (OOM reprodutível a cada ~2.990 passos de processo; o v1 rodou 23k na
#    versão de 09/08). PINAR uma versão anterior — tenta na ordem.
for TV in 2.10.1 2.10.0 2.9.1; do
  # torchaudio PINADO junto — solto, o pip deixa o build do torch novo e o
  # import morre com "undefined symbol" (pego 13/08, 2 relanços de 3s).
  pip install --force-reinstall "torch==$TV" "torchaudio==$TV" --index-url https://download.pytorch.org/whl/cu128 2>&1 | tail -1 && break
done
python - <<'EOF'
import torch, sys
ok = torch.cuda.is_available()
print("CUDA disponível:", ok, "| torch", torch.__version__)
sys.exit(0 if ok else 1)
EOF
if [ $? -ne 0 ]; then echo "GPU_FALHOU" > /data/status.txt; exit 1; fi

# 3. Modelo base ORIGINAL
python - <<'EOF'
from huggingface_hub import snapshot_download
snapshot_download("openbmb/VoxCPM2", local_dir="/workspace/VoxCPM2")
print("modelo base baixado")
EOF

# 4. Dataset (idempotente: pula se o manifesto final já existe)
if [ ! -f /data/train_final.jsonl ]; then
  echo "BAIXANDO_DATASET" > /data/status.txt
  python /data/preparar_tagarela.py || { echo "PREPARAR_FALHOU" > /data/status.txt; exit 1; }
fi

# 5. RETOMADA: se há checkpoint no R2 e nada local, baixa o mais novo pra
#    /data/ckpt/{step,latest} — o treino resume sozinho lendo ckpt/latest.
python - <<'EOF'
import boto3, os, shutil
from pathlib import Path
r2 = boto3.client("s3", endpoint_url=os.environ["R2_ENDPOINT"],
    aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
    aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"], region_name="auto")
B = os.environ.get("R2_BUCKET", "voices-clone-ai-verse")
ck = Path("/data/ckpt")
if any(ck.glob("step_*")) or (ck / "latest").exists():
    print("checkpoint local já existe — resume local"); raise SystemExit
r = r2.list_objects_v2(Bucket=B, Prefix="voxbr/ckpt_tagarela/step_", Delimiter="/")
pastas = sorted([p["Prefix"] for p in r.get("CommonPrefixes", [])],
                key=lambda p: int(p.rstrip("/").split("_")[-1]))
if not pastas:
    print("sem checkpoint no R2 — treino começa do zero"); raise SystemExit
alvo = pastas[-1]; nome = alvo.rstrip("/").split("/")[-1]
print(f"retomando do R2: {nome}")
tk = {}
while True:
    rr = r2.list_objects_v2(Bucket=B, Prefix=alvo, **tk)
    for o in rr.get("Contents", []):
        rel = o["Key"][len(alvo):]
        dest = ck / nome / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        r2.download_file(B, o["Key"], str(dest))
    if rr.get("IsTruncated"): tk = {"ContinuationToken": rr["NextContinuationToken"]}
    else: break
shutil.copytree(ck / nome, ck / "latest")
print(f"{nome} baixado e copiado pra latest")
EOF

# 6. Vigia (faxina + backup R2 + heartbeat + amostras pós-700h)
pkill -f "vigia_tagarela" 2>/dev/null || true
setsid nohup python /data/vigia_tagarela.py >> /data/vigia.log 2>&1 &

# 7. Treino — com RELANÇAMENTO AUTOMÁTICO (13/08): torch 2.11 vazava VRAM e
# matava o processo a cada ~2.990 passos. Mesmo se a versão pinada ainda
# vazar, cada ciclo salva o ckpt +2.000 antes de morrer em ~+2.990 → o loop
# retoma sozinho e o treino SEMPRE avança. Morte precoce (<120s) 2× seguidas
# = problema real, aborta pra inspeção.
export PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True
echo "TREINANDO" > /data/status.txt
cd /workspace/VoxCPM
RC=1
CURTAS=0
for i in $(seq 1 40); do
  T0=$(date +%s)
  python scripts/train_voxcpm_finetune.py --config_path /workspace/treino.yaml \
    >> /data/treino.log 2>&1
  RC=$?
  [ $RC -eq 0 ] && break
  VIDA=$(( $(date +%s) - T0 ))
  if [ $VIDA -lt 120 ]; then
    CURTAS=$((CURTAS+1))
    [ $CURTAS -ge 2 ] && break
  else
    CURTAS=0
  fi
  echo "[relanço $i] treino caiu (rc=$RC, viveu ${VIDA}s) — retomando do último checkpoint" >> /data/treino.log
  echo "TREINANDO" > /data/status.txt
  sleep 10
done
if [ $RC -ne 0 ]; then
  echo "TREINO_FALHOU" > /data/status.txt
  # NÃO destrói o pod em falha — deixa de pé pra inspeção/retomada.
  exit 1
fi
echo "TREINO_TERMINOU" > /data/status.txt

# 8. Espera o vigia subir o checkpoint FINAL pro R2 (até 2h), sobe o log e
#    só então se auto-destrói (sucesso = não paga hora ociosa).
FINAL=$(ls -d /data/ckpt/step_* 2>/dev/null | sort -t_ -k2 -n | tail -1 | xargs -n1 basename)
for i in $(seq 1 240); do
  grep -q "\"$FINAL\"" /data/vigia_subidos.json 2>/dev/null && break
  sleep 30
done
python - <<EOF
import boto3, os
r2 = boto3.client("s3", endpoint_url=os.environ["R2_ENDPOINT"],
    aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
    aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"], region_name="auto")
B = os.environ.get("R2_BUCKET", "voices-clone-ai-verse")
r2.upload_file("/data/treino.log", B, "voxbr/ckpt_tagarela/treino_final.log")
r2.put_object(Bucket=B, Key="voxbr/ckpt_tagarela/_TREINO_TERMINOU", Body=b"$FINAL")
print("log final no R2")
EOF
if [ -n "${RUNPOD_API_KEY:-}" ] && [ -n "${RUNPOD_POD_ID:-}" ]; then
  grep -q "\"$FINAL\"" /data/vigia_subidos.json 2>/dev/null && \
    curl -s -X DELETE "https://rest.runpod.io/v1/pods/$RUNPOD_POD_ID" \
      -H "Authorization: Bearer $RUNPOD_API_KEY" && echo "pod auto-destruído"
fi
