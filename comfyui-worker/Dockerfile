# Worker ComfyUI (InfiniteTalk / Wan2.1 I2V) — RunPod Serverless
# Base oficial: handler pronto (workflow API JSON -> /run). CUDA 12.8 p/ sageattention.
FROM runpod/worker-comfyui:5.8.6-base-cuda12.8.1

# --- Custom nodes do fluxo (via Comfy Registry) ---
RUN comfy-node-install \
    ComfyUI-WanVideoWrapper \
    comfyui-kjnodes \
    comfyui-videohelpersuite \
    audio-separation-nodes-comfyui

# --- SageAttention (v1 = triton puro, sem nvcc; o fluxo usa attention_mode=sageattn) ---
RUN pip install --no-cache-dir sageattention==1.0.6 boto3==1.34.162

# --- Nodes de I/O da plataforma (entrada via URL R2, saida MP4 -> R2) ---
COPY custom_nodes/aiverse_io /comfyui/custom_nodes/aiverse_io

# --- Modelos ficam no Network Volume (/runpod-volume/models/...) ---
COPY extra_model_paths.yaml /comfyui/extra_model_paths.yaml

# Cache HF (wav2vec) persistido no volume
ENV HF_HOME=/runpod-volume/hf
