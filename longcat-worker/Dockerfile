# Worker LongCat Avatar 1.5 — imagem LEVE de propósito: o peso todo (repo com
# script patcheado, venv py3.10, weights 148GB, Real-ESRGAN) mora no network
# volume US-CA-2 (8t4xooig2w), montado em /runpod-volume. O handler cria o
# symlink /workspace -> /runpod-volume no boot (o venv tem paths /workspace).
#
# Base ubuntu:22.04 OBRIGATÓRIA: o venv do volume foi criado no pod (ubuntu
# 22.04) e o python dele é symlink pra /usr/bin/python3.10 — a imagem precisa
# ter o MESMO interpretador nesse MESMO caminho (lição do smoke 05/08:
# python:3.11-slim quebrava com ENOENT no torchrun).
FROM ubuntu:22.04

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.10 python3-pip ffmpeg libsndfile1 libgomp1 ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip3 install --no-cache-dir -r requirements.txt

COPY handler.py .
COPY upscale.py .

CMD ["python3", "-u", "handler.py"]
