"""Constantes e ambiente do worker (tudo que vem de env var).

Saiu do handler.py em 20/08. Importar este modulo TEM efeito colateral de
proposito: cria os diretorios de trabalho e desliga o NNPACK — era assim no
handler e continua sendo, so que num lugar so.
"""
from __future__ import annotations

import os
from pathlib import Path

# NNPACK não é suportado no hardware dos workers e polui o log com milhares de
# warnings "Could not initialize NNPACK". Desligar elimina o spam (cosmético).
try:
    import torch

    torch.backends.nnpack.enabled = False
except Exception:
    pass

MODEL_ID = "openbmb/VoxCPM2"
MODEL_DIR = Path(os.environ.get("VOXCPM_MODEL_DIR", "/workspace/models/VoxCPM2"))
VOXCPM_REPO = Path(os.environ.get("VOXCPM_REPO", "/app/VoxCPM"))
WORKSPACE = Path(os.environ.get("WORKSPACE_DIR", "/workspace/jobs"))

# ───────── Disco do worker (incidente 10/08) ─────────
# O container tem 50GB efêmeros e volumeInGb=0: tudo que sobra vive aqui. Um
# worker QUENTE atende jobs por horas sem reiniciar, e o cache do
# torch.compile (/tmp/torchinductor_root) cresce a cada variação de job. Somado
# aos áudios temporários, o disco enchia e TODO aluno que caísse naquele worker
# falhava com "[Errno 28] No space left on device" — 3 alunos em 1h15 no dia
# 10/08, no meio da geração E do treino.
#
# Duas medidas: cache do inductor em diretório NOSSO (pra podermos apagar) e
# faxina automática no fim de cada job.
INDUCTOR_CACHE = Path(os.environ.get("TORCHINDUCTOR_CACHE_DIR", "/workspace/tmp/inductor"))
JOB_TMP = Path(os.environ.get("JOB_TMP_DIR", "/workspace/tmp/jobs"))
# Acima disso a faxina é agressiva (limpa até o cache de compilação, que só
# custa alguns segundos a mais no próximo job).
DISK_ALERT_PERCENT = float(os.environ.get("DISK_ALERT_PERCENT", "75"))

for _d in (INDUCTOR_CACHE, JOB_TMP):
    try:
        _d.mkdir(parents=True, exist_ok=True)
    except Exception:
        pass
os.environ.setdefault("TORCHINDUCTOR_CACHE_DIR", str(INDUCTOR_CACHE))
os.environ.setdefault("TMPDIR", str(JOB_TMP))


# Duração da referência AUTO-extraída no treino. 30s (era 120): referência curta
# captura MENOS tique/bordão da fala e reduz o risco de o VoxCPM ecoar "filler"
# no início (bug "então não" da voz Pri). 30s sobra p/ timbre e fica longe do
# limite de contexto (~8192 tokens). A janela é ESCOLHIDA por score (anti-bordão),
# não cortada do início — ver voice_pipeline.reference.select_reference_clip.
REFERENCE_SECONDS = int(os.environ.get("REFERENCE_SECONDS", "30"))
# QA da amostra pós-treino (caso "me levantar" 2026-07-16): transcreve a
# amostra e compara com o texto esperado; abaixo disso = referência vazando
# conteúdo → re-tenta com a próxima candidata do ranking.
SAMPLE_QA_MIN_SIMILARITY = float(os.environ.get("SAMPLE_QA_MIN_SIMILARITY", "0.82"))
SAMPLE_QA_MAX_ATTEMPTS = int(os.environ.get("SAMPLE_QA_MAX_ATTEMPTS", "3"))


# Alpha/rank do LoRA. O alpha é GRAVADO por voz no treino e devolvido na
# inferência (cada LoRA infere com o alpha que treinou). Vozes novas usam 16,
# igual ao desktop; vozes já treinadas continuam usando o alpha salvo no banco.
# Rank é 32 em todas (matching do desktop).
TRAIN_LORA_ALPHA = int(os.environ.get("LORA_ALPHA", "16"))
LORA_RANK = int(os.environ.get("LORA_RANK", "32"))
LEGACY_LORA_ALPHA = 16  # default da inferência p/ LoRAs sem alpha gravado


# Cache local de LoRA baixada (inferencia).
LORA_CACHE_DIR = Path(os.environ.get("LORA_CACHE_DIR", "/workspace/loras"))


# ───────── Identidade do BUILD (observabilidade) ─────────
# Dado um treino no banco, saber QUE build o produziu. Antes disso nao dava:
# training_jobs nao guardava nada da imagem, entao "isso ja foi corrigido no
# worker?" so se respondia por data, no olho.
#
# WORKER_IMAGE vem do Dockerfile (ARG->ENV preenchido pelo CI com
# "<branch>@<sha>"). O ARG fica no FIM do Dockerfile de proposito: ENV invalida
# as camadas seguintes, e depois do COPY do codigo nao ha nada caro pra
# invalidar. Build local sem --build-arg = "desconhecida", que e' a verdade e
# nao um palpite. RUNPOD_* sao best-effort: se o RunPod expuser, entram junto;
# se nao existirem, nao aparecem (nunca inventar identificador).
def worker_build_id() -> str:
    """Identificador do build que esta rodando este job.

    Formato: "<WORKER_IMAGE>" + sufixos best-effort do ambiente RunPod.
    Ex.: "main@a1b2c3d pod=abc123" · "desconhecida" (build local/dev).

    Le o env na CHAMADA, nao no import: o valor e' carimbado na imagem e nunca
    muda em runtime, mas ler na hora deixa a funcao testavel sem reload de
    modulo (reload aqui tem efeito colateral — este modulo cria diretorios).
    """
    partes = [os.environ.get("WORKER_IMAGE") or "desconhecida"]
    for chave, rotulo in (("RUNPOD_POD_ID", "pod"), ("RUNPOD_ENDPOINT_ID", "endpoint")):
        valor = os.environ.get(chave)
        if valor:
            partes.append(f"{rotulo}={valor}")
    return " ".join(partes)


# build 25/08: re-disparo apos falha transitoria no Build and push (951ec22)
