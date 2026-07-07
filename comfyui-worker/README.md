# comfyui-worker — InfiniteTalk (lip-sync) no RunPod Serverless

Imagem + áudio → MP4 do personagem falando (InfiniteTalk sobre Wan 2.1 I2V 14B,
nodes WanVideoWrapper). Endpoint **separado** do vox; mesma arquitetura:
app → `/run` → poll `/status` → MP4 no R2.

## Peças

| Arquivo | O quê |
|---|---|
| `Dockerfile` | base `runpod/worker-comfyui:5.8.6-base-cuda12.8.1` + custom nodes + sageattention |
| `custom_nodes/aiverse_io/` | 3 nodes nossos: LoadImage/LoadAudio **por URL** (R2 presignada) e UploadVideoToS3 (MP4 → R2, chave determinística) |
| `extra_model_paths.yaml` | aponta modelos pro Network Volume; adiciona `diffusion_models`/`text_encoders` (a base não mapeia) |
| `scripts/download_models.sh` | baixa ~42GB de modelos pro volume (rodar 1x em pod temporário) |
| `workflows/infinitetalk_api_template.json` | workflow API pronto; app preenche placeholders |
| `tools/convert_ui_to_api.py` + `make_template.py` | regeneram o template a partir do export UI (se o fluxo mudar) |

## Por que nodes próprios de I/O
O handler oficial só aceita **imagens base64** e só devolve **imagens** — descarta
o MP4 do `VHS_VideoCombine`. Em vez de forkar o handler: entrada via URL presignada
e saída direto pro R2 numa chave que o app define (`{{S3_KEY}}`). Handler intocado.

## O que o app injeta por job (node id → input)

| Node | Input | Valor |
|---|---|---|
| `284` | `url` | URL presignada da imagem |
| `125` | `url` | URL presignada do áudio |
| `900` | `s3_key` | chave R2 do MP4 final (determinística por job) |
| `245`/`246` | `value` | width/height (default 640×850 vertical; tier 720p: 960×1280 — múltiplo de 16) |
| `270` | `value` | num_frames = `ceil(segundos_do_audio × 25)` |
| `122` | `model` | `wan2.1-i2v-14b-480p-Q5_K_M.gguf` ou `...720p...` (tier) |
| `138` | `lora` | LoRA lightx2v 480p ou `lightx2v_I2V_14B_720p_cfg_step_distill_rank64.safetensors` (tier) |
| `241` | `positive_prompt` | prompt da cena |
| `128` | `seed` | seed do job |

## Env vars do endpoint
`BUCKET_ENDPOINT_URL`, `BUCKET_NAME`, `BUCKET_ACCESS_KEY_ID`, `BUCKET_SECRET_ACCESS_KEY`
(R2 — mesmos moldes do vox). `HF_HOME=/runpod-volume/hf` já vem da imagem.

## Deploy (ordem)
1. **Volume**: criar/usar Network Volume na MESMA região das GPUs 48/80/96GB (volume trava região!). Pod temporário + `VOLUME=/workspace bash scripts/download_models.sh`.
2. **Build**: `docker build -t <registry>/aiverse-comfyui:vX .` + push (build x64, igual CI do vox).
3. **Endpoint**: criar NOVO via GraphQL (nunca reaproveitar/retaggear — lição RunPod), GPUs 48GB+, volume anexado, envs acima.
4. **Smoke test**: `POST /run` com o template preenchido na mão; conferir MP4 no R2.

## ⚠️ Validar no primeiro build (não confirmado ainda)
- Nomes no Comfy Registry: `comfyui-wanvideowrapper`, `comfyui-kjnodes`,
  `comfyui-videohelpersuite`, `audio-separation-nodes-comfyui` (se algum não existir
  no registry, trocar por `git clone` pinado no Dockerfile).
- `sageattention==1.0.6` (triton, sem nvcc) importando ok na base cu128.
- `torchaudio.load` lendo o formato de áudio que o app enviar (mp3/wav).
