#!/usr/bin/env bash
# Baixa os modelos do InfiniteTalk/Wan2.1 pro Network Volume.
# Rodar 1x num pod temporario com o volume montado em /workspace (ou /runpod-volume).
# Uso: VOLUME=/workspace bash download_models.sh
set -euo pipefail

VOLUME="${VOLUME:-/runpod-volume}"
M="$VOLUME/models"
mkdir -p "$M/diffusion_models/InfiniteTalk" "$M/text_encoders" "$M/vae" "$M/clip_vision" "$M/loras"

dl() { # dl <url> <destino>
  local url="$1" dest="$2"
  if [ -s "$dest" ]; then echo "ja existe: $dest"; return 0; fi
  echo ">> $dest"
  wget -q --show-progress -c -O "$dest.part" "$url"
  mv "$dest.part" "$dest"
}

# Wan 2.1 I2V 14B GGUF (Q5_K_M) — 480p e 720p (~11.9GB cada) [city96]
dl "https://huggingface.co/city96/Wan2.1-I2V-14B-480P-gguf/resolve/main/wan2.1-i2v-14b-480p-Q5_K_M.gguf" \
   "$M/diffusion_models/wan2.1-i2v-14b-480p-Q5_K_M.gguf"
dl "https://huggingface.co/city96/Wan2.1-I2V-14B-720P-gguf/resolve/main/wan2.1-i2v-14b-720p-Q5_K_M.gguf" \
   "$M/diffusion_models/wan2.1-i2v-14b-720p-Q5_K_M.gguf"

# InfiniteTalk single Q8 (~2.5GB) [Kijai]
dl "https://huggingface.co/Kijai/WanVideo_comfy_GGUF/resolve/main/InfiniteTalk/Wan2_1-InfiniteTalk_Single_Q8.gguf" \
   "$M/diffusion_models/InfiniteTalk/Wan2_1-InfiniteTalk_Single_Q8.gguf"

# Text encoder umt5-xxl bf16 (~10.6GB) + VAE (~242MB) [Kijai]
dl "https://huggingface.co/Kijai/WanVideo_comfy/resolve/main/umt5-xxl-enc-bf16.safetensors" \
   "$M/text_encoders/umt5-xxl-enc-bf16.safetensors"
dl "https://huggingface.co/Kijai/WanVideo_comfy/resolve/main/Wan2_1_VAE_bf16.safetensors" \
   "$M/vae/Wan2_1_VAE_bf16.safetensors"

# CLIP Vision H (~1.2GB) [Comfy-Org — NAO existe no repo do Kijai]
dl "https://huggingface.co/Comfy-Org/Wan_2.1_ComfyUI_repackaged/resolve/main/split_files/clip_vision/clip_vision_h.safetensors" \
   "$M/clip_vision/clip_vision_h.safetensors"

# LoRAs lightx2v distill rank64 — 480p [Kijai] e 720p [repo oficial lightx2v]
# ATENCAO: o arquivo 720p nao tem "720p" no nome; renomeamos ao salvar.
dl "https://huggingface.co/Kijai/WanVideo_comfy/resolve/main/Lightx2v/lightx2v_I2V_14B_480p_cfg_step_distill_rank64_bf16.safetensors" \
   "$M/loras/lightx2v_I2V_14B_480p_cfg_step_distill_rank64_bf16.safetensors"
dl "https://huggingface.co/lightx2v/Wan2.1-I2V-14B-720P-StepDistill-CfgDistill-Lightx2v/resolve/main/loras/Wan21_I2V_14B_lightx2v_cfg_step_distill_lora_rank64.safetensors" \
   "$M/loras/lightx2v_I2V_14B_720p_cfg_step_distill_rank64.safetensors"

# Cache HF do wav2vec (o node baixa sozinho; pre-aquecer evita cold start)
export HF_HOME="$VOLUME/hf"
python3 -c "
from huggingface_hub import snapshot_download
snapshot_download('TencentGameMate/chinese-wav2vec2-base')
print('wav2vec cacheado')
" || echo 'AVISO: pre-cache do wav2vec falhou (o node baixa em runtime)'

echo '=== TAMANHOS ==='
du -sh "$M"/* "$VOLUME/hf" 2>/dev/null
echo '=== OK ==='
