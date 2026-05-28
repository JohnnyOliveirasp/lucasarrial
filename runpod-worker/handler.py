"""RunPod Serverless handler — VoxCPM2 voice cloning.

Rotas (event['input']['type']):
  - "train":      pipeline completo Demucs+VAD+Whisper+train+upload LoRA
  - "inference":  gera áudio a partir de texto + LoRA opcional
  - "health":     ping (warmup, debug)

Payload de `train`:
  {
    "type": "train",
    "voice_id": "<uuid>",
    "audio_urls": ["https://r2.../audio_001.mp3?sig=...", ...],
    "lora_upload_url": "https://r2.../lora.safetensors?sig=PUT...",
    "max_steps": 500,            (opcional)
    "language": "pt"             (opcional, default "pt")
  }

Resposta:
  {
    "voice_id": "...",
    "lora_uploaded": true,
    "elapsed_seconds": 847.3,
    "steps": 1000,
    "trainer_returncode": 0,
    "stdout_tail": "...",
    "stderr_tail": "..."
  }
"""

from __future__ import annotations

import base64
import io
import json
import os
import random
import re
import shutil
import time
import traceback
from pathlib import Path
from typing import Any

import numpy as np
import runpod
import soundfile as sf
from huggingface_hub import snapshot_download

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

# Duração da referência AUTO-extraída no treino (1 áudio aleatório → N segundos
# da voz limpa). VoxCPM tem limite de contexto ~8192 tokens; 2 min (~1.5k) cabe
# com folga. NÃO subir isso sem refazer a conta do contexto.
REFERENCE_SECONDS = int(os.environ.get("REFERENCE_SECONDS", "120"))

# Alpha/rank do LoRA. O alpha é GRAVADO por voz no treino e devolvido na
# inferência (cada LoRA infere com o alpha que treinou). Vozes novas usam 16,
# igual ao desktop; vozes já treinadas continuam usando o alpha salvo no banco.
# Rank é 32 em todas (matching do desktop).
TRAIN_LORA_ALPHA = int(os.environ.get("LORA_ALPHA", "16"))
LORA_RANK = int(os.environ.get("LORA_RANK", "32"))
LEGACY_LORA_ALPHA = 16  # default da inferência p/ LoRAs sem alpha gravado

_MODEL = None  # voxcpm.core.VoxCPM, carregado lazy para inferência


def _log(level: str, msg: str, **meta: Any) -> None:
    entry = {"ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "level": level, "msg": msg}
    if meta:
        entry["meta"] = meta
    print(json.dumps(entry, ensure_ascii=False), flush=True)


def _ensure_model_downloaded() -> None:
    if MODEL_DIR.exists() and any(MODEL_DIR.glob("*.safetensors")):
        return
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    _log("info", "model.download.start", model=MODEL_ID, dir=str(MODEL_DIR))
    snapshot_download(repo_id=MODEL_ID, local_dir=str(MODEL_DIR))
    _log("info", "model.download.done", dir=str(MODEL_DIR))


def _load_model():
    global _MODEL
    if _MODEL is not None:
        return _MODEL
    from voxcpm import VoxCPM
    _ensure_model_downloaded()
    _log("info", "model.load.start", dir=str(MODEL_DIR))
    _MODEL = VoxCPM.from_pretrained(str(MODEL_DIR), load_denoiser=False, optimize=True)
    _log("info", "model.load.done", sample_rate=_MODEL.tts_model.sample_rate)
    return _MODEL


def _wav_to_base64(wav, sample_rate: int) -> str:
    buf = io.BytesIO()
    sf.write(buf, wav, sample_rate, format="WAV")
    return base64.b64encode(buf.getvalue()).decode("ascii")


# ───────────────────────────────────────────────────────────────
# TRAIN
# ───────────────────────────────────────────────────────────────

def _handle_train(inp: dict) -> dict:
    from voice_pipeline import (
        download_to_dir,
        upload_file_to_presigned_url,
        extract_to_wav,
        separate_vocals_demucs,
        vad_segments_silero,
        chunk_vad_segments,
        cut_audio_by_segments,
        transcribe_audio_folder,
        transcribe_file,
        build_train_manifest,
        create_training_config,
        run_training,
    )

    voice_id = inp.get("voice_id") or "anonymous"
    audio_urls = inp.get("audio_urls") or []
    lora_upload_url = inp.get("lora_upload_url")
    max_steps = int(inp.get("max_steps", 500))
    save_interval = int(inp.get("save_interval", max(50, max_steps // 4)))
    language = inp.get("language", "pt")
    whisper_model = inp.get("whisper_model", "large-v3")

    if not audio_urls:
        return {"error": "missing 'audio_urls'"}
    if not lora_upload_url:
        return {"error": "missing 'lora_upload_url'"}

    job_dir = WORKSPACE / voice_id
    raw_dir = job_dir / "raw"
    vocals_dir = job_dir / "vocals"
    norm_dir = job_dir / "norm"
    dataset_dir = job_dir / "dataset"
    lora_runs = job_dir / "lora_runs"
    run_name = f"voice_{voice_id[:8]}"

    if job_dir.exists():
        shutil.rmtree(job_dir, ignore_errors=True)
    job_dir.mkdir(parents=True, exist_ok=True)

    t0 = time.monotonic()
    _ensure_model_downloaded()

    _log("info", "train.download.start", count=len(audio_urls))
    downloaded = download_to_dir(audio_urls, raw_dir)
    _log("info", "train.download.done", count=len(downloaded))

    # Pipeline por arquivo
    next_idx = 0
    for src in downloaded:
        _log("info", "train.preprocess", file=src.name)
        # Demucs precisa de WAV stereo 44.1k; nosso extract gera mono 16k.
        # Estratégia: passa direto pro Demucs (que aceita qualquer formato via soundfile).
        # Mas Demucs lê via soundfile e isso falha em MP3 — então extract pra WAV intermediário stereo.
        # Solução simples: ffmpeg → WAV stereo 44.1k temp; Demucs lê; depois normaliza pra mono 16k.
        stereo_wav = vocals_dir / f"{src.stem}_in.wav"
        stereo_wav.parent.mkdir(parents=True, exist_ok=True)
        _run_ffmpeg_stereo_44k(src, stereo_wav)

        vocals_wav = separate_vocals_demucs(stereo_wav, vocals_dir, log=lambda m: _log("info", "demucs", detail=m))
        normalized = norm_dir / f"{src.stem}_mono16k.wav"
        extract_to_wav(vocals_wav, normalized, sample_rate=16000)

        vad = vad_segments_silero(normalized)
        chunks = chunk_vad_segments(vad, min_seconds=5.0, max_seconds=30.0)
        cut = cut_audio_by_segments(normalized, chunks, dataset_dir, start_index=next_idx)
        next_idx += len(cut)
        _log("info", "train.preprocess.done", file=src.name, chunks=len(cut))

    if next_idx == 0:
        return {"error": "no usable speech segments after VAD/chunk"}

    # ── Referência automática ──────────────────────────────────────────────
    # Pega 1 áudio (aleatório) já LIMPO pelo Demucs, corta REFERENCE_SECONDS e
    # sobe como a referência da voz. Substitui o upload manual de referência —
    # garante que a ref é curta (sem estourar o contexto do VoxCPM). Transcreve
    # 1x aqui pra a geração não precisar re-transcrever toda vez.
    # A referência é ATÔMICA: clonagem usa áudio + transcrição JUNTOS (modo
    # continuation do VoxCPM). Transcrevemos a ref AQUI e só subimos o áudio se
    # a transcrição der certo — nunca um meio-estado (áudio sem texto), que faz
    # a geração cortar cedo. Sem try/except que engole: a transcrição é
    # obrigatória pra referência existir. Falhou tudo → sem referência (a voz
    # ainda gera com a LoRA pura), e isso fica REGISTRADO no resultado.
    reference_upload_url = inp.get("reference_upload_url")
    reference_uploaded = False
    reference_transcript: str | None = None
    reference_error: str | None = None
    if reference_upload_url:
        norm_files = sorted(norm_dir.glob("*_mono16k.wav"))
        if norm_files:
            chosen = random.choice(norm_files)
            ref_clip = job_dir / "reference.wav"
            _slice_seconds(chosen, ref_clip, REFERENCE_SECONDS)
            transcript = _transcribe_with_retry(
                ref_clip, whisper_model, language, attempts=3,
            )
            if transcript:
                upload_file_to_presigned_url(
                    ref_clip, reference_upload_url, content_type="audio/wav"
                )
                reference_uploaded = True
                reference_transcript = transcript
                _log(
                    "info", "train.reference.done",
                    source=chosen.name, seconds=REFERENCE_SECONDS,
                    transcript_len=len(transcript),
                )
            else:
                reference_error = "reference transcription returned empty after retries"
                _log("error", "train.reference.transcribe_failed", detail=reference_error)
        else:
            reference_error = "no normalized audio to slice the reference from"
            _log("error", "train.reference.no_norm_files")

    _log("info", "train.whisper.start", model=whisper_model)
    transcribe_audio_folder(
        dataset_dir,
        model_name=whisper_model,
        language=language,
        log=lambda m: _log("info", "whisper", detail=m),
    )
    _log("info", "train.whisper.done")

    manifest = build_train_manifest(dataset_dir)
    config = create_training_config(
        VOXCPM_REPO,
        manifest,
        MODEL_DIR,
        save_path=lora_runs / run_name,
        run_name=run_name,
        max_steps=max_steps,
        save_interval=save_interval,
        lora_rank=LORA_RANK,
        lora_alpha=TRAIN_LORA_ALPHA,
    )

    _log(
        "info", "train.trainer.start", config=str(config), max_steps=max_steps,
        lora_rank=LORA_RANK, lora_alpha=TRAIN_LORA_ALPHA,
        reference_seconds=REFERENCE_SECONDS,
    )
    result = run_training(VOXCPM_REPO, config, log=lambda m: _log("info", "trainer", detail=m))
    _log("info", "train.trainer.done", returncode=result["returncode"])

    if result["returncode"] != 0:
        return {
            "voice_id": voice_id,
            "error": "trainer failed",
            "trainer_returncode": result["returncode"],
            "stdout_tail": result["stdout_tail"],
            "stderr_tail": result["stderr_tail"],
        }

    # Upload LoRA
    latest_lora = lora_runs / run_name / "latest" / "lora_weights.safetensors"
    if not latest_lora.exists():
        # fallback: pega o maior step_*
        steps = sorted((lora_runs / run_name).glob("step_*/lora_weights.safetensors"))
        if not steps:
            return {"voice_id": voice_id, "error": "no safetensors produced"}
        latest_lora = steps[-1]

    _log("info", "train.upload.start", file=str(latest_lora))
    upload_file_to_presigned_url(
        latest_lora,
        lora_upload_url,
        content_type="application/octet-stream",
    )
    _log("info", "train.upload.done")

    elapsed = time.monotonic() - t0
    return {
        "voice_id": voice_id,
        "lora_uploaded": True,
        "elapsed_seconds": round(elapsed, 2),
        "steps": max_steps,
        "trainer_returncode": 0,
        "dataset_chunks": next_idx,
        "reference_uploaded": reference_uploaded,
        "reference_transcript": reference_transcript,
        "reference_error": reference_error,
        "lora_alpha": TRAIN_LORA_ALPHA,
        "lora_rank": LORA_RANK,
    }


def _run_ffmpeg_stereo_44k(src: Path, dst: Path) -> None:
    import subprocess
    dst.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-i", str(src),
        "-vn", "-ac", "2", "-ar", "44100",
        str(dst),
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(f"ffmpeg stereo 44k failed: {r.stderr.strip()}")


def _slice_seconds(src: Path, dst: Path, seconds: int) -> None:
    """Corta os primeiros `seconds` de `src` → `dst` (mono 16k). Se o áudio for
    menor, pega o que tiver."""
    import subprocess
    dst.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-i", str(src),
        "-t", str(seconds),
        "-ac", "1", "-ar", "16000",
        str(dst),
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(f"ffmpeg slice failed: {r.stderr.strip()}")


def _transcribe_with_retry(
    wav_path: Path, whisper_model: str, language: str, attempts: int = 3
) -> str | None:
    """Transcreve `wav_path` e devolve texto NÃO-vazio, ou None se falhar em
    todas as tentativas. Diferente de best-effort silencioso: cada falha é
    logada, e o chamador decide o que fazer com o None (aqui: não registrar a
    referência, em vez de gravar um meio-estado áudio-sem-texto)."""
    from voice_pipeline import transcribe_file

    for i in range(1, attempts + 1):
        try:
            text = transcribe_file(
                str(wav_path),
                model_name=whisper_model,
                language=language,
                log=lambda m: _log("info", "ref.whisper", detail=m),
            )
            text = (text or "").strip()
            if text:
                return text
            _log("error", "ref.transcribe.empty", attempt=i, attempts=attempts)
        except Exception as exc:
            _log("error", "ref.transcribe.error", attempt=i, attempts=attempts, error=str(exc))
    return None


def _split_text_for_tts(text: str, max_chars: int = 200) -> list[str]:
    """Quebra texto em chunks <= max_chars respeitando fim de frase.

    VoxCPM gera 1 utterance por chamada e drifta/acelera em texto longo (issue
    #302). Quebrar em frases e gerar cada uma re-ancora a referencia + reinicia
    o estado interno do modelo a cada chunk — a doc oficial confirma que isso
    previne 'gradual speed-up' e drift de timbre.
    https://voxcpm.readthedocs.io/en/latest/usage_guide.html
    """
    text = (text or "").strip()
    if not text:
        return []
    # Separa em frases por fim de pontuacao (. ? ! e reticencia). O lookbehind
    # mantem o sinal preso na frase anterior. \n+ tambem corta (paragrafos).
    sentences = re.split(r"(?<=[.!?…])\s+|\n+", text)
    chunks: list[str] = []
    cur = ""
    for s in sentences:
        s = s.strip()
        if not s:
            continue
        # Se grudar a proxima frase passa do limite, fecha o chunk atual.
        # Se a frase sozinha ja estoura, deixa estourar (nao corta meio-palavra).
        if cur and len(cur) + 1 + len(s) > max_chars:
            chunks.append(cur)
            cur = s
        else:
            cur = (cur + " " + s) if cur else s
    if cur:
        chunks.append(cur)
    return chunks


def _trim_silence(
    wav: np.ndarray, threshold: float = 0.005, pad_samples: int = 0
) -> np.ndarray:
    """Remove amostras de borda abaixo de `threshold` em amplitude absoluta.

    Default = -46 dB. Mantem `pad_samples` de cada lado quando ha audio ativo
    pra nao cortar consoante final/inicial. Se o sinal e' todo silencio, devolve
    como esta. Usado antes de concatenar chunks no chunking por frase: o VoxCPM
    costuma deixar uma "respiracao" no final de cada chunk + boot-up no comeco,
    e a soma disso vira pausa audivel entre chunks.
    """
    if wav.size == 0:
        return wav
    active = np.where(np.abs(wav) > threshold)[0]
    if active.size == 0:
        return wav
    start = max(0, int(active[0]) - pad_samples)
    end = min(wav.size, int(active[-1]) + 1 + pad_samples)
    return wav[start:end]


def _crossfade_concat(wavs: list[np.ndarray], fade_samples: int) -> np.ndarray:
    """Concatena com fade linear no overlap de `fade_samples` entre wavs.

    Cada wav fica com a cauda decaindo de 1 -> 0 e a proxima entrando 0 -> 1 na
    mesma janela. A soma e' suave e nao tem clique. Se `fade_samples <= 0`,
    so concatena. Se a janela for maior que algum lado, ajusta pro min.
    """
    if not wavs:
        return np.zeros(0, dtype=np.float32)
    if fade_samples <= 0 or len(wavs) == 1:
        return np.concatenate([w.astype(np.float32, copy=False) for w in wavs])

    result = wavs[0].astype(np.float32, copy=True)
    for nxt in wavs[1:]:
        nxt = nxt.astype(np.float32, copy=False)
        f = max(0, min(fade_samples, len(result), len(nxt)))
        if f == 0:
            result = np.concatenate([result, nxt])
            continue
        fade_out = np.linspace(1.0, 0.0, f, dtype=np.float32)
        fade_in = np.linspace(0.0, 1.0, f, dtype=np.float32)
        overlap = result[-f:] * fade_out + nxt[:f] * fade_in
        result = np.concatenate([result[:-f], overlap, nxt[f:]])
    return result


# ───────────────────────────────────────────────────────────────
# INFERENCE
# ───────────────────────────────────────────────────────────────

_LORA_CACHE_DIR = Path(os.environ.get("LORA_CACHE_DIR", "/workspace/loras"))


def _ensure_local_from_url(url: str, target_dir: Path, label: str) -> Path:
    """Baixa URL pra target_dir/<basename>. Cacheia: se já existe, reusa."""
    from voice_pipeline import download_to_dir
    target_dir.mkdir(parents=True, exist_ok=True)
    # Hash da URL pra evitar colisão de basename
    import hashlib
    h = hashlib.sha256(url.split("?", 1)[0].encode()).hexdigest()[:16]
    base = url.split("?", 1)[0].rsplit("/", 1)[-1] or "file.bin"
    base = "".join(c if c.isalnum() or c in "._-" else "_" for c in base)
    target = target_dir / f"{h}_{base}"
    if target.exists() and target.stat().st_size > 0:
        _log("info", "cache.hit", label=label, path=str(target))
        return target
    paths = download_to_dir([url], target_dir)
    # download_to_dir nomeia como 000_<basename>; rename pra ter cache estável
    paths[0].rename(target)
    return target


def _handle_inference(inp: dict) -> dict:
    text = inp.get("text")
    if not text:
        return {"error": "missing 'text'"}

    prompt_wav_url = inp.get("prompt_wav_url")
    prompt_text = inp.get("prompt_text")
    lora_url = inp.get("lora_url")
    output_upload_url = inp.get("output_upload_url")
    cfg_value = float(inp.get("cfg_value", 2.0))
    # 15 = meio termo. Doc oficial diz 5-10 draft, 15-25 quality. Em testes:
    # - 10 = pace correto mas qualidade media, drift evidente em texto longo
    # - 20 = qualidade alta MAS acelerou pace (Aluno2 de 55s -> 45s, mesmo texto)
    # 15 fica no meio. Drift NAO se resolve por timesteps (e estrutural):
    # https://github.com/OpenBMB/VoxCPM/issues/302
    inference_timesteps = int(inp.get("inference_timesteps", 15))
    normalize = bool(inp.get("normalize", False))

    if prompt_text and not prompt_wav_url:
        return {"error": "prompt_text provided without prompt_wav_url"}

    from voice_pipeline import transcribe_file, upload_file_to_presigned_url

    # 1. Baixa LoRA (cache local) + carrega modelo
    lora_path: Path | None = None
    if lora_url:
        lora_path = _ensure_local_from_url(lora_url, _LORA_CACHE_DIR, "lora")

    # 2. Baixa referência. CONTINUATION mode (prompt_wav_path + prompt_text) —
    # mesma chamada do desktop (`VoiceLoraStudio/core.py:841`) que funcionava
    # bem. Transcript vem do banco (gravado no treino atômico). Fallback de
    # Whisper só pra vozes antigas que possam estar sem transcript.
    prompt_wav_local: str | None = None
    if prompt_wav_url:
        ref_dir = WORKSPACE / "refs"
        ref_path = _ensure_local_from_url(prompt_wav_url, ref_dir, "ref")
        prompt_wav_local = str(ref_path)

    if prompt_wav_local and not prompt_text:
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

    # 3. Carrega modelo (com ou sem LoRA)
    # Por simplicidade, NÃO usamos cache do modelo VoxCPM com LoRA (cada call carrega).
    # Em produção: cachear por lora_url.
    from voxcpm import VoxCPM

    # IMPORTANTE: o LoRAConfig da inferência TEM que bater com o do treino, senão
    # os adaptadores nascem com rank default (8) e dão "size mismatch" ao copiar os
    # pesos rank-32. Valores idênticos aos de create_training_config (training.py).
    lora_cfg = None
    if lora_path:
        from voxcpm.model.voxcpm import LoRAConfig

        # r/alpha TÊM que casar com os do treino daquela LoRA. O backend manda
        # o alpha gravado na voz. Sem valor, cai no legado/default 16.
        lora_alpha = int(inp.get("lora_alpha") or LEGACY_LORA_ALPHA)
        lora_rank = int(inp.get("lora_rank") or LORA_RANK)
        lora_cfg = LoRAConfig(
            enable_lm=True,
            enable_dit=True,
            enable_proj=False,
            r=lora_rank,
            alpha=lora_alpha,
        )
        _log("info", "inference.lora_cfg", r=lora_rank, alpha=lora_alpha)

    _ensure_model_downloaded()
    _log("info", "model.load.start", lora=bool(lora_path))
    model = VoxCPM.from_pretrained(
        str(MODEL_DIR),
        load_denoiser=False,
        optimize=True,
        lora_config=lora_cfg,
        lora_weights_path=str(lora_path) if lora_path else None,
    )
    sample_rate = model.tts_model.sample_rate

    # Chunking por frase + trim + crossfade: cada chunk e' UMA chamada de
    # generate independente, com a MESMA referencia (re-ancora -> mata drift +
    # gradual speed-up). Tira silencio das pontas de cada chunk e junta com
    # crossfade pra eliminar costuras audiveis. Recomendado em discussao
    # oficial: https://github.com/OpenBMB/VoxCPM/issues/302
    # Doc base: https://voxcpm.readthedocs.io/en/latest/usage_guide.html
    chunk_max = int(os.environ.get("TTS_CHUNK_MAX_CHARS", "220"))
    silence_ms = int(os.environ.get("TTS_CHUNK_SILENCE_MS", "0"))
    crossfade_ms = int(os.environ.get("TTS_CHUNK_CROSSFADE_MS", "60"))
    trim_enabled = os.environ.get("TTS_CHUNK_TRIM", "1") not in ("0", "false", "False", "")
    trim_threshold = float(os.environ.get("TTS_CHUNK_TRIM_THRESHOLD", "0.005"))
    # `pad_ms` mantem alguns ms de cada lado pra nao cortar consoante final.
    trim_pad_ms = int(os.environ.get("TTS_CHUNK_TRIM_PAD_MS", "20"))

    chunks = _split_text_for_tts(text, max_chars=chunk_max) or [text]
    silence_samples = max(0, int(sample_rate * silence_ms / 1000))
    crossfade_samples = max(0, int(sample_rate * crossfade_ms / 1000))
    trim_pad_samples = max(0, int(sample_rate * trim_pad_ms / 1000))

    _log(
        "info", "inference.start", text_len=len(text), chunks=len(chunks),
        chunk_max=chunk_max, silence_ms=silence_ms, crossfade_ms=crossfade_ms,
        trim=trim_enabled, trim_thresh=trim_threshold,
        has_clone=bool(prompt_wav_local), has_lora=bool(lora_path),
        timesteps=inference_timesteps,
    )
    t0 = time.monotonic()

    pieces: list[np.ndarray] = []
    for idx, chunk in enumerate(chunks):
        ct0 = time.monotonic()
        # Chamada 1:1 com o desktop (VoiceLoraStudio/core.py:841-853).
        seg = model.generate(
            text=chunk,
            prompt_wav_path=prompt_wav_local,
            prompt_text=prompt_text,
            cfg_value=cfg_value,
            inference_timesteps=inference_timesteps,
            max_len=4096,
            normalize=normalize,
            denoise=False,
            retry_badcase=True,
            retry_badcase_max_times=3,
            retry_badcase_ratio_threshold=6.0,
        )
        seg = np.asarray(seg, dtype=np.float32)
        raw_samples = int(seg.size)
        if trim_enabled:
            seg = _trim_silence(seg, threshold=trim_threshold, pad_samples=trim_pad_samples)
        _log(
            "info", "inference.chunk", idx=idx, total=len(chunks),
            chars=len(chunk), samples_raw=raw_samples, samples_trim=int(seg.size),
            elapsed_s=round(time.monotonic() - ct0, 2),
        )
        pieces.append(seg)
        # Silencio entre chunks (default 0). Aplicado SOMENTE quando crossfade
        # esta desligado — senao o silencio dentro do overlap se autodestrui.
        if silence_samples > 0 and crossfade_samples == 0 and idx < len(chunks) - 1:
            pieces.append(np.zeros(silence_samples, dtype=np.float32))

    # Concat: com crossfade quando ativo (default), senao concatena plano.
    if crossfade_samples > 0 and len(pieces) > 1:
        wav = _crossfade_concat(pieces, crossfade_samples)
    else:
        wav = np.concatenate(pieces) if pieces else np.zeros(0, dtype=np.float32)
    elapsed = time.monotonic() - t0
    _log("info", "inference.done", elapsed_s=round(elapsed, 2), samples=len(wav), chunks=len(chunks))

    # 4. Upload ou base64
    if output_upload_url:
        out_path = WORKSPACE / f"gen_{int(time.time() * 1000)}.wav"
        out_path.parent.mkdir(parents=True, exist_ok=True)
        sf.write(str(out_path), wav, sample_rate)
        upload_file_to_presigned_url(out_path, output_upload_url, content_type="audio/wav")
        return {
            "uploaded": True,
            "sample_rate": sample_rate,
            "duration_s": round(len(wav) / sample_rate, 3),
            "elapsed_s": round(elapsed, 2),
        }

    return {
        "audio_base64": _wav_to_base64(wav, sample_rate),
        "sample_rate": sample_rate,
        "duration_s": round(len(wav) / sample_rate, 3),
        "elapsed_s": round(elapsed, 2),
    }


# ───────────────────────────────────────────────────────────────
# TRANSCRIBE (backfill — transcreve uma referência já existente)
# ───────────────────────────────────────────────────────────────

def _handle_transcribe(inp: dict) -> dict:
    """Baixa um áudio (audio_url) e devolve a transcrição. Usado pra preencher
    a `reference_transcript` de vozes antigas que subiram só o áudio."""
    audio_url = inp.get("audio_url")
    if not audio_url:
        return {"error": "missing 'audio_url'"}
    whisper_model = inp.get("whisper_model", "large-v3")
    language = inp.get("language", "pt")

    tmp_dir = WORKSPACE / "transcribe"
    audio_path = _ensure_local_from_url(audio_url, tmp_dir, "transcribe")
    transcript = _transcribe_with_retry(audio_path, whisper_model, language, attempts=3)
    if not transcript:
        return {"error": "transcription returned empty after retries"}
    return {"transcript": transcript, "transcript_len": len(transcript)}


# ───────────────────────────────────────────────────────────────
# DISPATCH
# ───────────────────────────────────────────────────────────────

def handler(event: dict) -> dict:
    inp = event.get("input") or {}
    job_type = inp.get("type", "inference")
    _log("info", "job.start", type=job_type)
    try:
        if job_type == "train":
            return _handle_train(inp)
        if job_type == "inference":
            return _handle_inference(inp)
        if job_type == "transcribe":
            return _handle_transcribe(inp)
        if job_type == "health":
            return {"ok": True, "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
        return {"error": f"unknown type '{job_type}' (use train/inference/transcribe/health)"}
    except Exception as exc:
        _log("error", "job.failed", error=str(exc), type=job_type, tb=traceback.format_exc()[:2000])
        return {"error": str(exc), "type": job_type, "traceback": traceback.format_exc()[:2000]}


if __name__ == "__main__":
    runpod.serverless.start({"handler": handler})
