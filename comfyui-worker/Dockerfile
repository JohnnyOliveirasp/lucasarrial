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

# --- SageAttention (v1 = triton puro, sem nvcc; o fluxo usa attention_mode=sageattn) ---
RUN pip install --no-cache-dir sageattention==1.0.6 boto3==1.34.162

# --- Nodes de I/O da plataforma (entrada via URL R2, saida MP4 -> R2) ---
COPY custom_nodes/aiverse_io /comfyui/custom_nodes/aiverse_io

# --- Modelos ficam no Network Volume (/runpod-volume/models/...) ---
COPY extra_model_paths.yaml /comfyui/extra_model_paths.yaml

# Cache HF (wav2vec) persistido no volume
ENV HF_HOME=/runpod-volume/hf
