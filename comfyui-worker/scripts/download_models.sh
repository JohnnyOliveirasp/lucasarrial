#!/usr/bin/env bash
# Baixa os modelos do InfiniteTalk/Wan2.1 pro Network Volume.
# Rodar 1x num pod temporario com o volume montado em /workspace (ou /runpod-volume).
# Uso: VOLUME=/workspace bash download_models.sh
#
# REGRA DESTE SCRIPT (incidente 85c9a45a, 05/09/2026 — Video Clone 100% fora do ar):
# pre-cache que falha NAO pode passar verde. A versao anterior terminava o passo do
# wav2vec em "|| echo AVISO", entao provisionamento quebrado saia com exit 0.
# Aqui todo arquivo e conferido por TAMANHO contra o Content-Length do servidor e
# qualquer divergencia derruba o script.
#
# E arquivo PARCIAL e pior que arquivo AUSENTE: os dois consumidores que baixam
# sozinhos (o node DownloadAndLoadWav2VecModel e o torchaudio) so testam se o
# caminho EXISTE e pulam o download quando existe — sem conferir conteudo. Um
# diretorio incompleto envenena o worker de forma permanente. Por isso nada e
# publicado no caminho final antes de passar na verificacao.
set -euo pipefail

VOLUME="${VOLUME:-/runpod-volume}"
M="$VOLUME/models"
mkdir -p "$M/diffusion_models/InfiniteTalk" "$M/text_encoders" "$M/vae" \
         "$M/clip_vision" "$M/loras" "$M/transformers"

die() { echo "ERRO: $*" >&2; exit 1; }

bytes_of() { stat -c %s "$1" 2>/dev/null || echo 0; }

# Tamanho anunciado pelo servidor. Segue redirect: no Hugging Face o arquivo LFS
# responde 302 e o tamanho real vem no 200 final, por isso pegamos o ULTIMO
# content-length da cadeia.
remote_size() {
  local url="$1" sz
  sz=$(curl -sIL --retry 3 --retry-delay 2 "$url" \
       | tr -d '\r' | grep -i '^content-length:' | tail -1 | awk '{print $2}') || true
  [ -n "${sz:-}" ] || die "nao consegui obter o tamanho remoto de $url"
  echo "$sz"
}

dl() { # dl <url> <destino>
  local url="$1" dest="$2" want got
  # remote_size roda em subshell: o die() de la nao derruba o script, entao o
  # resultado tem que ser validado aqui antes de qualquer outra coisa.
  want=$(remote_size "$url") || true
  case "${want:-}" in
    ''|*[!0-9]*) die "tamanho remoto invalido ('${want:-vazio}') para $url" ;;
  esac
  if [ -f "$dest" ]; then
    got=$(bytes_of "$dest")
    if [ "$got" = "$want" ]; then
      echo "ok (ja existe, $want bytes): $dest"
      return 0
    fi
    echo "AVISO: $dest tem $got bytes, esperado $want — refazendo" >&2
    rm -f "$dest"
  fi
  echo ">> $dest ($want bytes)"
  rm -f "$dest.part"
  wget -q --show-progress -O "$dest.part" "$url" || { rm -f "$dest.part"; die "download falhou: $url"; }
  got=$(bytes_of "$dest.part")
  [ "$got" = "$want" ] || { rm -f "$dest.part"; die "tamanho errado em $dest: baixou $got, esperado $want"; }
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

# ---------------------------------------------------------------------------
# wav2vec — O CAMINHO IMPORTA (causa raiz do incidente 85c9a45a)
#
# O node DownloadAndLoadWav2VecModel (custom_nodes/ComfyUI-WanVideoWrapper,
# fantasytalking/nodes.py:52 no pin 088128b22424) resolve o modelo assim:
#     model_path = os.path.join(folder_paths.models_dir, "transformers", model)
# folder_paths.models_dir e /comfyui/models, porque o start.sh da imagem base
# (runpod/worker-comfyui 5.8.6) sobe o ComfyUI sem --base-directory e sem
# --models-directory. Logo o node LE em:
#     /comfyui/models/transformers/TencentGameMate/chinese-wav2vec2-base
#
# Isso NAO passa pelo extra_model_paths.yaml. O node usa models_dir direto, e nao
# folder_paths.get_folder_paths("..."), entao acrescentar uma chave "transformers:"
# no yaml NAO resolveria — o yaml so alimenta as categorias registradas.
# A ponte e o symlink criado no Dockerfile:
#     /comfyui/models/transformers -> /runpod-volume/models/transformers
# Por isso baixamos aqui, no volume, no caminho equivalente.
#
# A versao anterior pre-aquecia com HF_HOME=$VOLUME/hf, que e outro lugar: nunca
# protegeu este node. Funcionou ate 05/09 apenas porque worker quente ja tinha
# baixado em runtime; na reciclagem, caiu.
WAV2VEC_REPO="TencentGameMate/chinese-wav2vec2-base"
WAV2VEC_DIR="$M/transformers/$WAV2VEC_REPO"
WAV2VEC_BIN_BYTES=380261837

wav2vec_ok() {
  [ -f "$WAV2VEC_DIR/pytorch_model.bin" ] \
    && [ -s "$WAV2VEC_DIR/config.json" ] \
    && [ -s "$WAV2VEC_DIR/preprocessor_config.json" ] \
    && [ "$(bytes_of "$WAV2VEC_DIR/pytorch_model.bin")" = "$WAV2VEC_BIN_BYTES" ]
}

if wav2vec_ok; then
  echo "ok (ja existe): $WAV2VEC_DIR"
else
  [ -e "$WAV2VEC_DIR" ] && echo "AVISO: $WAV2VEC_DIR existe mas esta incompleto — refazendo" >&2
  # Monta num temporario e so publica depois de conferir: o caminho final nunca
  # pode existir pela metade, senao o node confia nele e pula o download.
  TMPD="$M/transformers/.tmp-wav2vec.$$"
  rm -rf "$TMPD"; mkdir -p "$TMPD"
  python3 - "$WAV2VEC_REPO" "$TMPD" <<'PY' || { rm -rf "$TMPD"; die "snapshot_download do wav2vec falhou"; }
import os, shutil, sys
from huggingface_hub import snapshot_download

repo, dest = sys.argv[1], sys.argv[2]
# Mesmos argumentos do node, para o conteudo bater exatamente com o que ele espera.
kw = dict(repo_id=repo, ignore_patterns=["*.pt"], local_dir=dest)
try:
    snapshot_download(**kw, local_dir_use_symlinks=False)
except TypeError:
    # huggingface_hub novo removeu local_dir_use_symlinks (ja copia por padrao)
    snapshot_download(**kw)

# Garante arquivos de verdade: symlink apontando pro cache HF deixaria o volume
# dependente de um caminho que pode sumir.
for root, _, files in os.walk(dest):
    for fn in files:
        p = os.path.join(root, fn)
        if os.path.islink(p):
            real = os.path.realpath(p)
            os.remove(p)
            shutil.copy2(real, p)
print("wav2vec baixado em", dest)
PY
  got=$(bytes_of "$TMPD/pytorch_model.bin")
  [ "$got" = "$WAV2VEC_BIN_BYTES" ] \
    || { rm -rf "$TMPD"; die "wav2vec pytorch_model.bin com $got bytes, esperado $WAV2VEC_BIN_BYTES"; }
  for f in config.json preprocessor_config.json; do
    [ -s "$TMPD/$f" ] || { rm -rf "$TMPD"; die "wav2vec baixado sem $f"; }
  done
  rm -rf "$WAV2VEC_DIR"
  mkdir -p "$(dirname "$WAV2VEC_DIR")"
  mv "$TMPD" "$WAV2VEC_DIR"   # rename atomico no mesmo filesystem
  echo "ok: $WAV2VEC_DIR"
fi

# ---------------------------------------------------------------------------
# Demucs (node AudioSeparation, id 170 nos dois templates) — MESMA ARMADILHA
#
# torchaudio resolve HDEMUCS_HIGH_MUSDB_PLUS via torchaudio.utils._download_asset,
# que grava em  torch.hub.get_dir()/torchaudio/<key>  e, como o pipeline chama sem
# hash, PULA o download quando o caminho ja existe (sem validar conteudo).
# Sem TORCH_HOME isso cai em /root/.cache/torch, que e efemero: funciona enquanto o
# worker esta quente e morre na primeira reciclagem — exatamente o que aconteceu com
# o wav2vec. O Dockerfile fixa TORCH_HOME=/runpod-volume/torch e aqui pre-enchemos.
DEMUCS="$VOLUME/torch/hub/torchaudio/models/hdemucs_high_trained.pt"
mkdir -p "$(dirname "$DEMUCS")"
dl "https://download.pytorch.org/torchaudio/models/hdemucs_high_trained.pt" "$DEMUCS"

# ---------------------------------------------------------------------------
echo '=== VERIFICACAO FINAL ==='
faltando=0
must_exist() { # must_exist <arquivo> [bytes esperados]
  local f="$1" want="${2:-}" got
  if [ ! -f "$f" ]; then
    echo "  FALTANDO: $f"; faltando=1; return
  fi
  got=$(bytes_of "$f")
  if [ -n "$want" ] && [ "$got" != "$want" ]; then
    echo "  TAMANHO ERRADO: $f ($got, esperado $want)"; faltando=1; return
  fi
  echo "  ok $f ($got bytes)"
}

must_exist "$M/diffusion_models/wan2.1-i2v-14b-480p-Q5_K_M.gguf"
must_exist "$M/diffusion_models/wan2.1-i2v-14b-720p-Q5_K_M.gguf"
must_exist "$M/diffusion_models/InfiniteTalk/Wan2_1-InfiniteTalk_Single_Q8.gguf"
must_exist "$M/text_encoders/umt5-xxl-enc-bf16.safetensors"
must_exist "$M/vae/Wan2_1_VAE_bf16.safetensors"
must_exist "$M/clip_vision/clip_vision_h.safetensors"
must_exist "$M/loras/lightx2v_I2V_14B_480p_cfg_step_distill_rank64_bf16.safetensors"
must_exist "$M/loras/lightx2v_I2V_14B_720p_cfg_step_distill_rank64.safetensors"
must_exist "$WAV2VEC_DIR/pytorch_model.bin" "$WAV2VEC_BIN_BYTES"
must_exist "$WAV2VEC_DIR/config.json"
must_exist "$WAV2VEC_DIR/preprocessor_config.json"
must_exist "$DEMUCS"

[ "$faltando" = "0" ] || die "provisionamento INCOMPLETO — veja a lista acima"

echo '=== TAMANHOS ==='
du -sh "$M"/* "$VOLUME/torch" 2>/dev/null || true
echo '=== OK ==='
