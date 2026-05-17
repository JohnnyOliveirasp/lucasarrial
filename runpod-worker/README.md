# RunPod Worker — VoxCPM2

Worker container para RunPod Serverless que serve **inference** e **training** do VoxCPM2.

## Estrutura

- `Dockerfile` — image base PyTorch 2.8 + CUDA 12.8 + Ubuntu 24, clona VoxCPM repo
- `handler.py` — handler RunPod Serverless (rota por `input.type`)
- `requirements.txt` — deps Python pinadas

## Routes

### `inference`
```json
{
  "input": {
    "type": "inference",
    "text": "Olá mundo",
    "prompt_wav_path": "/workspace/voice_0000.wav",
    "prompt_text": "transcrição do prompt",
    "cfg_value": 2.0,
    "inference_timesteps": 10
  }
}
```

Retorna `{ audio_base64, sample_rate, duration_s, elapsed_s }`.

### `train`
```json
{
  "input": {
    "type": "train",
    "config_path": "/workspace/lora_runs/usuarioX/config.yaml"
  }
}
```

Retorna `{ returncode, elapsed_s, stdout_tail, stderr_tail }`.

## Build local (teste)

```bash
docker build -t lucasarrial-runpod:dev .
docker run --gpus all -p 8000:8000 lucasarrial-runpod:dev
```

## Deploy

Push da image pra GitHub Container Registry → criar Serverless Endpoint na RunPod apontando pra ela.

## Model

VoxCPM2 (~5GB) é baixado do HuggingFace no primeiro start, salvo em `/workspace/models/VoxCPM2`. Recomendado anexar Network Volume montado em `/workspace` pra persistir entre cold starts.
