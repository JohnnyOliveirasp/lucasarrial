FROM runpod/pytorch:1.0.3-cu1290-torch280-ubuntu2204

WORKDIR /app

# System deps (ffmpeg + git + fonte da legenda karaokê do Vídeo Estúdio)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg git git-lfs fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

# Clone VoxCPM repo (necessário para scripts/train_voxcpm_finetune.py)
RUN git clone --depth 1 https://github.com/OpenBMB/VoxCPM.git /app/VoxCPM

# Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ─────────────────────────────────────────────────────────────────────────
# MODELO BASE ASSADO NA IMAGEM (4,96 GB) — não baixar em runtime.
#
# MEDIDO EM PROD (11/08, 1.585 gerações em 30 dias): o handler baixava o
# VoxCPM2 do HuggingFace toda vez que subia um worker novo, e o RunPod já
# conta o worker como "executando" nesse momento — ou seja, PAGÁVAMOS GPU
# pra baixar modelo, e o aluno esperava junto:
#   worker quente → ~10s de overhead   ·   worker FRIO → ~53s
#   intervalo mediano entre gerações: 12,3 min, com idleTimeout de 5s
#   → 68,5% das gerações pegavam worker frio (1.085 de 1.585)
# Assado na imagem, o custo migra do tempo de execução (cobrado) para o
# pull da imagem, que o RunPod cacheia por tag na máquina.
#
# ⚠️ O caminho vai em ENV do DOCKERFILE, nunca no env do template do RunPod:
# o workflow manda `env: []` no saveTemplate e apaga o template a cada deploy.
# ⚠️ Fica ANTES do COPY do código de propósito: assim editar o handler não
# invalida esta camada de 5GB no cache de build.
# ⚠️ Não usar /workspace — é ponto de montagem e some/é sombreado em runtime.
ENV VOXCPM_MODEL_DIR=/opt/models/VoxCPM2
RUN python -c "from huggingface_hub import snapshot_download; \
    snapshot_download('openbmb/VoxCPM2', local_dir='/opt/models/VoxCPM2')" \
    && du -sh /opt/models/VoxCPM2

# Handler + pipeline
COPY handler.py .
COPY sample_gen.py .
COPY audio_edit.py .
COPY video_edit.py .
COPY montage.py .
COPY finish.py .
COPY tts_prepare.py .
COPY variants.py .
COPY voice_pipeline ./voice_pipeline

# RunPod Serverless ENTRYPOINT
CMD ["python", "-u", "handler.py"]
