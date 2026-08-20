"""Preparo ANTES de gerar: LoRA no disco, referencia pronta e modelo carregado.

Sao os tres passos que so acontecem uma vez por job — separados do laco de
geracao, que e' onde mora a complexidade de verdade.
"""
from __future__ import annotations

import subprocess
from pathlib import Path

from downloads import ensure_local_from_url
from model_loader import ensure_model_downloaded, free_cuda
from tts_text import ensure_terminal
from worker_config import LEGACY_LORA_ALPHA, LORA_CACHE_DIR, LORA_RANK, MODEL_DIR, WORKSPACE
from worker_log import log as _log


def baixar_lora(lora_url: str | None) -> Path | None:
    """LoRA da voz no disco local (cacheada por URL)."""
    if not lora_url:
        return None
    return ensure_local_from_url(lora_url, LORA_CACHE_DIR, "lora")


def _acolchoar_cauda(ref_path: Path, pad_ms: int) -> Path:
    """Anexa `pad_ms` de silencio no FIM da referencia.

    Caso "hoje" engolido (2026-07-17): o VoxCPM continua ACUSTICAMENTE a cauda
    da referencia — ref que termina no meio de fala faz a 1a palavra da geracao
    sair fundida/engolida. 0.5-1.0s de silencio no fim foi o unico workaround
    com relato de eliminacao completa no issue #272. Feito na hora, no cache
    local: cura TODAS as vozes existentes sem retreinar nem tocar no R2.

    ffmpeg falhando NAO derruba a geracao — devolve a ref original.
    """
    padded = ref_path.with_name(f"{ref_path.stem}_tail{pad_ms}.wav")
    if padded.exists() and padded.stat().st_size > 0:
        return padded
    r = subprocess.run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
         "-i", str(ref_path), "-af", f"apad=pad_dur={pad_ms / 1000}",
         str(padded)],
        capture_output=True, text=True,
    )
    if r.returncode != 0 or not padded.exists():
        _log("error", "inference.ref_pad.failed", detail=(r.stderr or "")[:300])
        return ref_path
    return padded


def preparar_referencia(inp: dict, prompt_wav_url, prompt_text, ref_tail_silence_ms: int):
    """Baixa a referencia e garante o par (audio, texto) que o clone precisa.

    CONTINUATION mode (prompt_wav_path + prompt_text) — mesma chamada do desktop
    (`VoiceLoraStudio/core.py:841`) que funcionava bem. O transcript vem do banco
    (gravado no treino atomico); o Whisper aqui e' fallback so pra vozes antigas
    que possam estar sem transcript.

    Devolve (caminho_local_ou_None, prompt_text).
    """
    if not prompt_wav_url:
        return None, prompt_text

    from voice_pipeline import transcribe_file

    ref_path = ensure_local_from_url(prompt_wav_url, WORKSPACE / "refs", "ref")
    if ref_tail_silence_ms > 0:
        ref_path = _acolchoar_cauda(ref_path, ref_tail_silence_ms)
    prompt_wav_local = str(ref_path)

    if not prompt_text:
        whisper_model = inp.get("whisper_model", "large-v3")
        language = inp.get("language", "pt")
        _log("info", "inference.transcribe.start", model=whisper_model)
        prompt_text = transcribe_file(
            prompt_wav_local,
            model_name=whisper_model,
            language=language,
            log=lambda m: _log("info", "whisper", detail=m),
        )
        _log("info", "inference.transcribe.done", text_len=len(prompt_text or ""))

    # Pontuacao terminal no prompt_text: a ref auto de 30s costuma terminar no
    # meio de frase e o transcript vem sem ponto final — o modelo entende que a
    # fala continua e atropela a 1a palavra do texto novo. O ponto final avisa
    # "a fala anterior acabou" (par do silencio acolchoado na cauda da ref).
    if prompt_text:
        prompt_text = ensure_terminal(prompt_text)
    return prompt_wav_local, prompt_text


def _config_lora(inp: dict, lora_path: Path | None):
    """LoRAConfig da inferencia.

    IMPORTANTE: TEM que bater com o do treino, senao os adaptadores nascem com
    rank default (8) e dao "size mismatch" ao copiar os pesos rank-32. Valores
    identicos aos de create_training_config (training.py). O backend manda o
    alpha gravado na voz; sem valor, cai no legado/default 16.
    """
    if not lora_path:
        return None
    from voxcpm.model.voxcpm import LoRAConfig

    lora_alpha = int(inp.get("lora_alpha") or LEGACY_LORA_ALPHA)
    lora_rank = int(inp.get("lora_rank") or LORA_RANK)
    _log("info", "inference.lora_cfg", r=lora_rank, alpha=lora_alpha)
    return LoRAConfig(
        enable_lm=True,
        enable_dit=True,
        enable_proj=False,
        r=lora_rank,
        alpha=lora_alpha,
    )


def carregar_modelo(inp: dict, lora_path: Path | None):
    """Carrega o VoxCPM (com ou sem LoRA). Devolve (model, sample_rate).

    NAO cacheamos o modelo com LoRA — cada chamada carrega. Em producao daria
    pra cachear por lora_url.
    """
    from voxcpm import VoxCPM

    lora_cfg = _config_lora(inp, lora_path)
    free_cuda()  # worker quente pode ter VRAM presa de jobs anteriores
    ensure_model_downloaded()
    _log("info", "model.load.start", lora=bool(lora_path))
    model = VoxCPM.from_pretrained(
        str(MODEL_DIR),
        load_denoiser=False,
        optimize=True,
        lora_config=lora_cfg,
        lora_weights_path=str(lora_path) if lora_path else None,
    )
    return model, model.tts_model.sample_rate
