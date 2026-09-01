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
#
# A MESMA receita serve dois modelos (blue/green da migração VoxBR):
#   default            → VoxCPM2 do HuggingFace (imagem de produção atual)
#   MODEL_SOURCE=r2    → VoxBR v1 (BF16) baixado do NOSSO R2 por URLs
#                        pré-assinadas que o workflow gera e passa como
#                        build secrets (runpod-worker-voxbr.yml)
ARG MODEL_SOURCE=hf
ARG MODEL_NAME=VoxCPM2
ENV VOXCPM_MODEL_DIR=/opt/models/${MODEL_NAME}
RUN --mount=type=secret,id=url_model \
    --mount=type=secret,id=url_audiovae \
    --mount=type=secret,id=url_config \
    --mount=type=secret,id=url_tokenizer \
    --mount=type=secret,id=url_tokenizer_config \
    --mount=type=secret,id=url_special_tokens \
    set -e; \
    if [ "$MODEL_SOURCE" = "r2" ]; then \
      mkdir -p "$VOXCPM_MODEL_DIR"; cd "$VOXCPM_MODEL_DIR"; \
      curl -fSL --retry 3 -o model.safetensors        "$(cat /run/secrets/url_model)"; \
      curl -fSL --retry 3 -o audiovae.pth             "$(cat /run/secrets/url_audiovae)"; \
      curl -fSL --retry 3 -o config.json              "$(cat /run/secrets/url_config)"; \
      curl -fSL --retry 3 -o tokenizer.json           "$(cat /run/secrets/url_tokenizer)"; \
      curl -fSL --retry 3 -o tokenizer_config.json    "$(cat /run/secrets/url_tokenizer_config)"; \
      curl -fSL --retry 3 -o special_tokens_map.json  "$(cat /run/secrets/url_special_tokens)"; \
    else \
      python -c "from huggingface_hub import snapshot_download; \
        snapshot_download('openbmb/VoxCPM2', local_dir='$VOXCPM_MODEL_DIR')"; \
    fi; \
    du -sh "$VOXCPM_MODEL_DIR"

# Handler + pipeline
COPY handler.py .
COPY worker_log.py .
COPY worker_config.py .
COPY worker_disk.py .
COPY model_loader.py .
COPY audio_ops.py .
COPY tts_text.py .
COPY whisper_qa.py .
COPY downloads.py .
COPY sample_gen.py .
COPY audio_edit.py .
COPY video_edit.py .
COPY montage.py .
COPY finish.py .
COPY tts_prepare.py .
COPY variants.py .
COPY voice_pipeline ./voice_pipeline
COPY tts_qa ./tts_qa
COPY jobs ./jobs

# ─────────────────────────────────────────────────────────────────────────
# IDENTIDADE DO BUILD — pra saber, olhando um treino no banco, QUE imagem o
# produziu. O CI passa --build-arg WORKER_IMAGE="<branch>@<sha>"; build local
# sem o arg fica "desconhecida" (a verdade, não um palpite).
# ⚠️ Fica no FIM de propósito: `ENV` invalida as camadas SEGUINTES, e depois
# dele só resta o CMD — a camada de 5GB do modelo não é tocada.
# ⚠️ Vai no Dockerfile, NUNCA no env do template do RunPod: o workflow manda
# `env: []` no saveTemplate e apaga o template a cada deploy.
ARG WORKER_IMAGE=desconhecida
ENV WORKER_IMAGE=${WORKER_IMAGE}

# RunPod Serverless ENTRYPOINT
CMD ["python", "-u", "handler.py"]
