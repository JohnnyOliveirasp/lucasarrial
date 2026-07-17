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

# Handler + pipeline
COPY handler.py .
COPY sample_gen.py .
COPY audio_edit.py .
COPY montage.py .
COPY finish.py .
COPY tts_prepare.py .
COPY variants.py .
COPY voice_pipeline ./voice_pipeline

# RunPod Serverless ENTRYPOINT
CMD ["python", "-u", "handler.py"]
