#!/usr/bin/env bash
# VoxBR SMOKE — roda NO POD. Prepara ambiente + dado + lança o treino curto.
# Log: /workspace/smoke.log · Status: /workspace/smoke_status.txt
set -uo pipefail
cd /workspace
echo "PREPARANDO" > /workspace/smoke_status.txt

# 1. Código
git clone --depth 1 https://github.com/OpenBMB/VoxCPM.git || true
cd /workspace/VoxCPM
pip install -e . 2>&1 | tail -2
pip install datasets soundfile 2>&1 | tail -1

# 2. Modelo base (público, sem token)
python - <<'EOF'
from huggingface_hub import snapshot_download
snapshot_download("openbmb/VoxCPM2", local_dir="/workspace/VoxCPM2")
print("modelo baixado")
EOF

# 3. Dado: ~15h de pt do CML-TTS (streaming, corta quando atingir a meta)
mkdir -p /workspace/data/wav
python - <<'EOF'
import json, soundfile as sf
from datasets import load_dataset
TARGET_S = 15 * 3600
ds = load_dataset("ylacombe/cml-tts", "portuguese", split="train", streaming=True)
total, n = 0.0, 0
with open("/workspace/data/train.jsonl", "w", encoding="utf-8") as f:
    for ex in ds:
        audio = ex["audio"]; text = (ex.get("text") or "").strip()
        dur = len(audio["array"]) / audio["sampling_rate"]
        # faixa saudável pro treino (doc oficial: 3-30s)
        if not text or dur < 3 or dur > 30:
            continue
        path = f"/workspace/data/wav/{n:06d}.wav"
        sf.write(path, audio["array"], audio["sampling_rate"])
        f.write(json.dumps({"audio": path, "text": text, "duration": round(dur, 2)}, ensure_ascii=False) + "\n")
        total += dur; n += 1
        if n % 500 == 0:
            print(f"{n} clipes · {total/3600:.1f}h", flush=True)
        if total >= TARGET_S:
            break
print(f"PRONTO: {n} clipes · {total/3600:.2f}h")
EOF

# 4. Config do smoke (a partir da oficial v2)
python - <<'EOF'
import re
src = open("/workspace/VoxCPM/conf/voxcpm_v2/voxcpm_finetune_all.yaml").read()
src = src.replace("/path/to/VoxCPM2/", "/workspace/VoxCPM2")
src = src.replace("/path/to/train.jsonl", "/workspace/data/train.jsonl")
src = src.replace("/path/to/checkpoints/finetune_all", "/workspace/ckpt")
src = src.replace("/path/to/logs/finetune_all", "/workspace/tb")
# smoke: 2000 steps, salvar no fim e na metade
src = re.sub(r"num_iters: \d+", "num_iters: 2000", src)
src = re.sub(r"max_steps: \d+", "max_steps: 2000", src)
src = re.sub(r"save_interval: \d+", "save_interval: 1000", src)
open("/workspace/smoke.yaml", "w").write(src)
print(open("/workspace/smoke.yaml").read())
EOF

# 5. Treino em background
echo "TREINANDO" > /workspace/smoke_status.txt
cd /workspace/VoxCPM
nohup python scripts/train_voxcpm_finetune.py --config_path /workspace/smoke.yaml \
  > /workspace/train.log 2>&1 &&
  echo "TREINO_OK" > /workspace/smoke_status.txt ||
  echo "TREINO_FALHOU" > /workspace/smoke_status.txt &
echo "bootstrap concluído; treino rodando (tail -f /workspace/train.log)"
