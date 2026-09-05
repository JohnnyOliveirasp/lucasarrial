# Worker ComfyUI (InfiniteTalk / Wan2.1 I2V) — RunPod Serverless
# Base oficial: handler pronto (workflow API JSON -> /run). CUDA 12.8 p/ sageattention.
FROM runpod/worker-comfyui:5.8.6-base-cuda12.8.1

# --- Custom nodes do fluxo (git pinado; o pacote do Comfy Registry veio sem os
#     nodes MultiTalk/InfiniteTalk — smoke test 2026-07-08 falhou MultiTalkModelLoader) ---
RUN set -e; cd /comfyui/custom_nodes; \
    git clone https://github.com/kijai/ComfyUI-WanVideoWrapper.git && \
      git -C ComfyUI-WanVideoWrapper checkout 088128b22424 && \
      pip install --no-cache-dir -r ComfyUI-WanVideoWrapper/requirements.txt; \
    git clone https://github.com/kijai/ComfyUI-KJNodes.git && \
      git -C ComfyUI-KJNodes checkout bc8e4ce4254b && \
      pip install --no-cache-dir -r ComfyUI-KJNodes/requirements.txt; \
    git clone https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite.git && \
      git -C ComfyUI-VideoHelperSuite checkout 4ee72c065db2 && \
      pip install --no-cache-dir -r ComfyUI-VideoHelperSuite/requirements.txt; \
    git clone https://github.com/christian-byrne/audio-separation-nodes-comfyui.git && \
      git -C audio-separation-nodes-comfyui checkout ac339561973f && \
      pip install --no-cache-dir -r audio-separation-nodes-comfyui/requirements.txt

# --- Compilador C + headers Python (triton JIT do sageattention exige cc e Python.h) ---
RUN apt-get update && apt-get install -y --no-install-recommends gcc g++ libc6-dev python3-dev \
    && rm -rf /var/lib/apt/lists/*

# --- SageAttention (v1 = triton puro, sem nvcc; o fluxo usa attention_mode=sageattn) ---
RUN pip install --no-cache-dir sageattention==1.0.6 boto3==1.34.162

# --- Nodes de I/O da plataforma (entrada via URL R2, saida MP4 -> R2) ---
COPY custom_nodes/aiverse_io /comfyui/custom_nodes/aiverse_io

# --- Modelos ficam no Network Volume (/runpod-volume/models/...) ---
# O yaml cobre SO as categorias registradas do ComfyUI (checkpoints, loras, vae...).
COPY extra_model_paths.yaml /comfyui/extra_model_paths.yaml

# --- Ponte para os modelos que NAO passam pelo extra_model_paths.yaml ---
# Incidente 85c9a45a (05/09/2026): o node DownloadAndLoadWav2VecModel resolve o
# caminho com os.path.join(folder_paths.models_dir, "transformers", model)
# (ComfyUI-WanVideoWrapper@088128b22424, fantasytalking/nodes.py:52). Como o
# start.sh da imagem base sobe o ComfyUI sem --base-directory / --models-directory,
# folder_paths.models_dir e /comfyui/models — diretorio EFEMERO do container. O node
# nao consulta folder_paths.get_folder_paths(), entao por definicao o yaml acima nao
# tem como redirecionar isso: a unica ponte possivel e este symlink.
# Sem ele o modelo era baixado em runtime e sumia em toda reciclagem do worker.
RUN rm -rf /comfyui/models/transformers \
    && mkdir -p /comfyui/models \
    && ln -s /runpod-volume/models/transformers /comfyui/models/transformers

# Cache HF persistido no volume (nao cobre o node acima: ele usa local_dir proprio)
ENV HF_HOME=/runpod-volume/hf

# Cache do torch.hub no volume. O node AudioSeparation carrega o Demucs via
# torchaudio.utils._download_asset, que grava em torch.hub.get_dir()/torchaudio/...
# e pula o download se o caminho existir. Sem isto o destino e /root/.cache/torch
# (efemero) e o Demucs cai na primeira reciclagem, igual ao wav2vec.
ENV TORCH_HOME=/runpod-volume/torch
