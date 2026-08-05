# Worker LongCat Avatar 1.5 — imagem LEVE de propósito: o peso todo (repo com
# script patcheado, venv py3.10, weights 148GB, Real-ESRGAN) mora no network
# volume US-CA-2 (8t4xooig2w), montado em /runpod-volume. O handler cria o
# symlink /workspace -> /runpod-volume no boot (o venv tem paths /workspace).
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY handler.py .
COPY upscale.py .

CMD ["python", "-u", "handler.py"]
