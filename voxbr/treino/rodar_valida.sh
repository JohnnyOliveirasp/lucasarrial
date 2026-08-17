#!/usr/bin/env bash
# VoxBR VALIDAÇÃO DE PACING — roda NO POD A100.
# Retreina do ZERO da base VoxCPM2 (não do v1 viciado) com o dataset_v2 LIMPO,
# 1.000 passos, pra ver se o "geração não para" sumiu antes do treino cheio.
# Status: /data/valida_status.txt · Log: /data/train_valida.log
set -uo pipefail
cd /workspace
echo "PREPARANDO" > /data/valida_status.txt

# 1. Código do VoxCPM
git clone --depth 1 https://github.com/OpenBMB/VoxCPM.git || true
cd /workspace/VoxCPM
pip install -e . 2>&1 | tail -2
pip install datasets soundfile boto3 2>&1 | tail -1

# 2. ⚠️ ARMADILHA CONHECIDA: `pip install -e .` sobe o torch pra cu130 e o
#    driver do pod é cu128 → GPU some → treina na CPU e morre com erro de dtype.
#    Reinstalar torch cu128 e CONFERIR is_available ANTES de treinar.
pip install --force-reinstall torch torchaudio --index-url https://download.pytorch.org/whl/cu128 2>&1 | tail -2
python - <<'EOF'
import torch, sys
ok = torch.cuda.is_available()
print("CUDA disponível:", ok, "| torch", torch.__version__)
if not ok:
    print("ABORTA: sem GPU — não treinar na CPU")
    sys.exit(1)
EOF
if [ $? -ne 0 ]; then echo "GPU_FALHOU" > /data/valida_status.txt; exit 1; fi

# 3. Modelo base ORIGINAL (público) — é dele que partimos, não do nosso v1
python - <<'EOF'
from huggingface_hub import snapshot_download
snapshot_download("openbmb/VoxCPM2", local_dir="/workspace/VoxCPM2")
print("modelo base baixado")
EOF

# 4. Dataset v2 (LIMPO) + config de validação — preparar.py aponta pro v2 por
#    default e escreve /workspace/valida.yaml com VOXBR_VALIDA_PASSOS passos
echo "BAIXANDO_DATASET" > /data/valida_status.txt
cd /workspace
python /data/preparar.py || { echo "PREPARAR_FALHOU" > /data/valida_status.txt; exit 1; }

# 5. Treino de validação
echo "TREINANDO" > /data/valida_status.txt
cd /workspace/VoxCPM
python scripts/train_voxcpm_finetune.py --config_path /workspace/valida.yaml \
  > /data/train_valida.log 2>&1 \
  && echo "VALIDA_OK" > /data/valida_status.txt \
  || echo "VALIDA_FALHOU" > /data/valida_status.txt
echo "fim: $(cat /data/valida_status.txt)"
