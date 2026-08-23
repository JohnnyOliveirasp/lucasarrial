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
import re
import shutil
import subprocess
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


def _disk_percent(path: str = "/") -> float:
    """Quanto do disco já foi usado (%)."""
    try:
        total, used, _free = shutil.disk_usage(path)
        return (used / total) * 100 if total else 0.0
    except Exception:
        return 0.0


def _purge_dir(path: Path, keep_dir: bool = True) -> int:
    """Esvazia um diretório e devolve quantos bytes liberou (best-effort)."""
    liberado = 0
    try:
        if not path.exists():
            return 0
        for item in path.iterdir():
            try:
                if item.is_dir():
                    liberado += sum(f.stat().st_size for f in item.rglob("*") if f.is_file())
                    shutil.rmtree(item, ignore_errors=True)
                else:
                    liberado += item.stat().st_size
                    item.unlink(missing_ok=True)
            except Exception:
                continue
        if not keep_dir:
            shutil.rmtree(path, ignore_errors=True)
    except Exception:
        pass
    return liberado


def _faxina(job_type: str) -> None:
    """
    Roda no FIM de todo job, dê certo ou errado. Sempre apaga os temporários do
    job; quando o disco passa do limite, apaga também o cache de compilação
    (que se refaz sozinho, custando alguns segundos no próximo job — muito
    melhor que derrubar o aluno seguinte).
    """
    try:
        antes = _disk_percent()
        liberado = _purge_dir(JOB_TMP)
        # /tmp é onde caem os temporários de bibliotecas que ignoram TMPDIR.
        for legado in (Path("/tmp/torchinductor_root"), Path("/tmp/gradio")):
            if legado.exists() and antes >= DISK_ALERT_PERCENT:
                liberado += _purge_dir(legado, keep_dir=False)
        if antes >= DISK_ALERT_PERCENT:
            liberado += _purge_dir(INDUCTOR_CACHE)
        depois = _disk_percent()
        if liberado > 0 or antes >= DISK_ALERT_PERCENT:
            _log(
                "info",
                "disk.cleanup",
                type=job_type,
                freed_mb=round(liberado / 1_000_000, 1),
                before_pct=round(antes, 1),
                after_pct=round(depois, 1),
            )
    except Exception as exc:  # faxina NUNCA pode derrubar o job
        try:
            _log("warn", "disk.cleanup_failed", error=str(exc))
        except Exception:
            pass

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


def _sample_qa_similarity(sample_path, whisper_model: str, language: str, expected: str):
    """Similaridade (0..1) entre a transcrição da amostra e o texto esperado.
    None = Whisper falhou (não bloqueia — QA é rede de segurança, não gate)."""
    import difflib
    import re as _re
    import unicodedata

    try:
        got = _transcribe_with_retry(sample_path, whisper_model, language, attempts=2) or ""
    except Exception:
        return None

    def norm(s: str) -> list[str]:
        s = unicodedata.normalize("NFD", (s or "").lower())
        s = "".join(c for c in s if unicodedata.category(c) != "Mn")
        return [w for w in _re.sub(r"[^a-z0-9\s]", " ", s).split() if w]

    a, b = norm(expected), norm(got)
    if not b:
        return 0.0
    return round(difflib.SequenceMatcher(None, a, b).ratio(), 3)

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


def _free_cuda() -> None:
    """Solta a VRAM de modelos carregados por chamada (inferência/amostra).

    O worker é QUENTE e serve treino + inferência no mesmo processo: sem esta
    limpeza, os modelos acumulam na GPU e o treino que cair num worker saturado
    morre de OOM (visto em prod 21/07: GPU de 95GB com 18MiB livres)."""
    import gc
    gc.collect()
    try:
        import torch
        torch.cuda.empty_cache()
        torch.cuda.ipc_collect()
    except Exception:
        pass


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
        select_reference_candidates,
    )
    from voice_pipeline.pacing import measure_natural_pause_ms

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
    _free_cuda()  # worker quente pode ter VRAM presa de inferências anteriores
    _ensure_model_downloaded()

    _log("info", "train.download.start", count=len(audio_urls))
    downloaded = download_to_dir(audio_urls, raw_dir)
    _log("info", "train.download.done", count=len(downloaded))

    # Pipeline por arquivo. Guardamos stats por arquivo (duração decodificada,
    # fala achada pelo VAD, chunks aproveitados): quando o treino zera, o output
    # diz EXATAMENTE onde o áudio morreu (decode? silêncio? clipes curtos?) —
    # no caso VOZ MAE 2 (21/07) os arquivos já tinham sido apagados e ficamos
    # sem como diagnosticar.
    next_idx = 0
    preprocess_stats = []
    for src in downloaded:
        _log("info", "train.preprocess", file=src.name)
        # Demucs precisa de WAV stereo 44.1k; nosso extract gera mono 16k.
        # Estratégia: passa direto pro Demucs (que aceita qualquer formato via soundfile).
        # Mas Demucs lê via soundfile e isso falha em MP3 — então extract pra WAV intermediário stereo.
        # Solução simples: ffmpeg → WAV stereo 44.1k temp; Demucs lê; depois normaliza pra mono 16k.
        stereo_wav = vocals_dir / f"{src.stem}_in.wav"
        stereo_wav.parent.mkdir(parents=True, exist_ok=True)
        # Arquivo SEM faixa de áudio (foto da pasta do Drive que entrou na
        # lista — incidente 910ea757) não pode derrubar o treino inteiro: PULA
        # e segue com os que prestam. Só falha o job se NENHUM arquivo servir
        # (aí a mensagem ao aluno é verdadeira). O fix de raiz está no import
        # do onboarding; esta é a rede de baixo.
        try:
            _run_ffmpeg_stereo_44k(src, stereo_wav)
        except RuntimeError as exc:
            _log("error", "train.preprocess.skipped", file=src.name, error=str(exc)[:200])
            preprocess_stats.append({"file": src.name, "skipped": "sem faixa de audio"})
            continue

        vocals_wav = separate_vocals_demucs(stereo_wav, vocals_dir, log=lambda m: _log("info", "demucs", detail=m))
        normalized = norm_dir / f"{src.stem}_mono16k.wav"
        extract_to_wav(vocals_wav, normalized, sample_rate=16000)

        vad = vad_segments_silero(normalized)
        # Calibração 08/08 (ver docstring de chunk_vad_segments): gap 0.6→1.5s
        # e mínimo 5→3s. O gap curto picotava a fala pausada e o descarte por
        # <5s comia ~80% do áudio de quem fala bem (caso prof.pinheirofilho:
        # 17,6min de fala viravam 3,2min úteis → "áudio insuficiente" injusto).
        chunks = chunk_vad_segments(
            vad, min_seconds=3.0, max_seconds=30.0, merge_gap_seconds=1.5
        )
        cut = cut_audio_by_segments(normalized, chunks, dataset_dir, start_index=next_idx)
        next_idx += len(cut)
        import soundfile as _sf_stat
        try:
            _ninfo = _sf_stat.info(str(normalized))
            decoded_s = round(float(_ninfo.frames) / float(_ninfo.samplerate or 1), 1)
        except Exception:
            decoded_s = None
        stat = {
            "file": src.name,
            "decoded_s": decoded_s,
            "vad_speech_s": round(sum(e - s for s, e in vad), 1),
            "chunks": len(cut),
        }
        preprocess_stats.append(stat)
        _log("info", "train.preprocess.done", **stat)

    if next_idx == 0:
        return {
            "error": "no usable speech segments after VAD/chunk",
            "preprocess_stats": preprocess_stats,
        }

    # ── Áudio ÚTIL pós-limpeza (anti-churn) ────────────────────────────────
    # O usuário manda 20min BRUTOS; Demucs+VAD podem descartar quase tudo
    # (ruído, música, silêncio). Medimos o que SOBROU e abortamos ANTES do
    # treino se for pouco — barato (~1min de GPU) e o backend estorna os
    # créditos com a mensagem certa, em vez de entregar uma voz ruim.
    import soundfile as _sf
    useful_seconds = 0.0
    for _chunk in sorted(dataset_dir.glob("*.wav")):
        try:
            _info = _sf.info(str(_chunk))
            useful_seconds += float(_info.frames) / float(_info.samplerate or 1)
        except Exception:
            pass
    useful_seconds = round(useful_seconds, 1)
    min_useful = float(os.environ.get("TRAIN_MIN_USEFUL_SECONDS", "600"))
    _log("info", "train.useful_audio", useful_seconds=useful_seconds, min_required=min_useful)
    if useful_seconds < min_useful:
        return {
            "voice_id": voice_id,
            "error": "insufficient_audio",
            "useful_seconds": useful_seconds,
            "min_required_seconds": min_useful,
            "dataset_chunks": next_idx,
        }

    # ── Idioma REAL do áudio ───────────────────────────────────────────────
    # Caso Joana 2026-07-21: voz em ESPANHOL era transcrita como pt no pipeline
    # inteiro (ref em portunhol c/ palavra inventada, textos de treino errados,
    # QA no idioma errado). Detecta no 1º chunk limpo do dataset; confiança
    # baixa cai no idioma do request (default pt). Vozes pt seguem idênticas.
    if os.environ.get("TRAIN_LANG_AUTODETECT", "1") not in ("0", "false", "False", ""):
        first_chunk = next(iter(sorted(dataset_dir.glob("*.wav"))), None)
        if first_chunk is not None:
            try:
                from voice_pipeline import detect_language
                detected, lang_prob = detect_language(first_chunk, model_name=whisper_model)
                _log(
                    "info", "train.language.detected",
                    language=detected, probability=round(lang_prob, 3),
                    request_language=language,
                )
                if detected and lang_prob >= float(os.environ.get("TRAIN_LANG_MIN_PROB", "0.6")):
                    language = detected
            except Exception as exc:
                _log("error", "train.language.detect_failed", error=str(exc))

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
    reference_clip_path: Path | None = None
    ref_candidates: "list[tuple[Path, str]]" = []  # ranking p/ o QA da amostra
    if reference_upload_url:
        norm_files = sorted(norm_dir.glob("*_mono16k.wav"))
        if norm_files:
            # Seleção ANTI-BORDÃO: em vez de cortar um trecho aleatório de 120s,
            # testa várias janelas de REFERENCE_SECONDS em offsets diferentes,
            # transcreve cada uma e escolhe a de menor risco de "filler"
            # ("então/não/tá/né" na borda). Conserta a raiz do bug "então não"
            # (a ref aleatória da Pri terminava em "...apertando o botão não").
            ref_candidates = select_reference_candidates(
                norm_files,
                work_dir=job_dir / "ref_candidates",
                ref_seconds=REFERENCE_SECONDS,
                transcribe_fn=lambda p: _transcribe_with_retry(
                    p, whisper_model, language, attempts=2
                ),
                # Corte em FRONTEIRA DE PALAVRA (caso Katia): timestamps de
                # palavra do whisper. Se falhar/vier vazio, o seletor cai
                # sozinho no corte por tempo de sempre — nunca quebra o treino.
                transcribe_words_fn=lambda p: _transcribe_words_safe(
                    p, whisper_model, language
                ),
                language=language,
                log=lambda **k: _log(
                    k.pop("level", "info"), k.pop("event", "train.reference"), **k
                ),
            )
            selected = ref_candidates[0] if ref_candidates else None
            if selected:
                ref_clip, transcript = selected
                upload_file_to_presigned_url(
                    ref_clip, reference_upload_url, content_type="audio/wav"
                )
                reference_uploaded = True
                reference_transcript = transcript
                reference_clip_path = ref_clip  # reusada na amostra pós-treino
                _log(
                    "info", "train.reference.done",
                    seconds=REFERENCE_SECONDS, transcript_len=len(transcript),
                )
            else:
                reference_error = "reference selection/transcription returned empty"
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

    # ── Amostra automática (anti-churn) + QA anti-eco ───────────────────────
    # Gera a amostra, TRANSCREVE e compara com o texto esperado. Similaridade
    # baixa = referência vazando conteúdo na geração (caso "me levantar"
    # 2026-07-16) → troca a referência pela PRÓXIMA candidata do ranking e
    # tenta de novo (até SAMPLE_QA_MAX_ATTEMPTS). Best-effort: falha de QA
    # nunca derruba o treino; se nada passar, sample_qa="failed" avisa o
    # backend (que alerta o suporte).
    sample_info: dict = {"sample_uploaded": False, "sample_seconds": None, "sample_error": None}
    sample_upload_url = inp.get("sample_upload_url")
    if sample_upload_url:
        try:
            from sample_gen import generate_training_sample, sample_text_for
            sample_text = str(inp.get("sample_text") or sample_text_for(language))
            candidates = (
                ref_candidates[:SAMPLE_QA_MAX_ATTEMPTS]
                if ref_candidates
                else [(reference_clip_path, reference_transcript)]
            )
            for attempt, (cand_clip, cand_text) in enumerate(candidates):
                if attempt > 0 and reference_upload_url and cand_clip is not None:
                    # promove a candidata: substitui a referência OFICIAL (mesma
                    # chave R2) e o transcript que vai pro banco via webhook.
                    upload_file_to_presigned_url(cand_clip, reference_upload_url, content_type="audio/wav")
                    reference_clip_path, reference_transcript = cand_clip, cand_text
                    _log("info", "train.sample.qa.ref_swapped", attempt=attempt)
                sample_info = generate_training_sample(
                    model_dir=MODEL_DIR,
                    lora_path=latest_lora,
                    lora_rank=LORA_RANK,
                    lora_alpha=TRAIN_LORA_ALPHA,
                    ref_wav=cand_clip,
                    ref_text=cand_text,
                    sample_text=sample_text,
                    upload_url=sample_upload_url,
                    work_dir=job_dir / "sample",
                    log=lambda **k: _log(k.pop("level", "info"), k.pop("event", "train.sample"), **k),
                )
                if not sample_info.get("sample_uploaded"):
                    break  # falha técnica de geração/upload — sem QA a fazer
                sim = _sample_qa_similarity(
                    job_dir / "sample" / "training_sample.wav",
                    whisper_model, language, sample_text,
                )
                sample_info["sample_qa_similarity"] = sim
                _log("info", "train.sample.qa", attempt=attempt, similarity=sim)
                if sim is None or sim >= SAMPLE_QA_MIN_SIMILARITY:
                    sample_info["sample_qa"] = "passed" if attempt == 0 else "retried_passed"
                    break
                sample_info["sample_qa"] = "failed"  # segue pro próximo candidato
            sample_info["sample_text"] = sample_text  # backend grava a linha do histórico com o texto REAL
        except Exception as exc:  # amostra é mimo: NUNCA pode derrubar um treino que já deu certo
            _log("error", "train.sample.crashed", error=str(exc))
            sample_info["sample_error"] = str(exc)[:300]

    # ── Pausa natural da pessoa → vira o `tts_silence_ms` DESTA voz ─────────
    # O default do worker é silence_ms=0: nenhuma pausa entre os pedaços de
    # texto, ou seja fala emendada. Era a queixa "áudio muito corrido", e ela
    # atingia 749 das 750 vozes prontas (todas com o campo NULO). Medir aqui
    # faz a voz NASCER com o ritmo de quem gravou, em vez de depender de
    # alguém notar e ajustar na mão. Um valor fixo pra todos estaria errado:
    # a pausa natural do acervo varia ~9x de pessoa pra pessoa.
    # None = não deu pra medir com confiança → o backend não grava nada e a voz
    # se comporta exatamente como se comportaria hoje.
    reference_pause_ms = measure_natural_pause_ms(
        sorted(norm_dir.glob("*_mono16k.wav")),
        log=lambda **k: _log(k.pop("level", "info"), k.pop("event", "train.pacing"), **k),
    )

    elapsed = time.monotonic() - t0
    return {
        "voice_id": voice_id,
        "lora_uploaded": True,
        "reference_pause_ms": reference_pause_ms,
        "elapsed_seconds": round(elapsed, 2),
        "steps": max_steps,
        "trainer_returncode": 0,
        "dataset_chunks": next_idx,
        "useful_seconds": useful_seconds,
        "reference_uploaded": reference_uploaded,
        "reference_transcript": reference_transcript,
        "reference_error": reference_error,
        "language": language,
        "lora_alpha": TRAIN_LORA_ALPHA,
        "lora_rank": LORA_RANK,
        **sample_info,
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


def _transcribe_words_safe(
    wav_path: Path, whisper_model: str, language: str
) -> "list | None":
    """Palavras com timestamp (.start/.end/.word) p/ o corte de referência em
    fronteira de palavra. NUNCA levanta: qualquer erro vira None e o seletor
    cai no corte por tempo de hoje (a melhoria não pode quebrar o treino)."""
    from voice_pipeline import transcribe_words

    try:
        words = transcribe_words(
            str(wav_path),
            model_name=whisper_model,
            language=language,
            log=lambda m: _log("info", "ref.whisper.words", detail=m),
        )
        return words or None
    except Exception as exc:
        _log("error", "ref.words.error", error=str(exc))
        return None


# Aspas (retas + tipograficas + guillemets) que aparecem no FIM de um trecho e
# confundem o "stop predictor" do VoxCPM — ele tenta "fechar" a fala inventando
# filler ("entao", "nao", "ne"). Removidas na borda (nao tem som proprio).
_QUOTES = "\"'`" + "“”‘’«»"


def _ensure_terminal(s: str) -> str:
    """Garante que o TRECHO termine com pontuacao FORTE (. ! ? …).

    O VoxCPM alucina filler quando o chunk termina sem sinal claro de parada —
    tipico de linhas que terminam em ':' (ex.: 'Ela falou:'), ',' ou fechando
    aspas de dialogo. Aqui limpamos a borda: tira aspas/pontuacao fraca do fim e
    forca um ponto final. So afeta o FIM do chunk (a pontuacao interna fica).
    """
    s = s.strip().rstrip(_QUOTES).strip()
    if not s:
        return s
    if s[-1] in ".!?…":
        return s
    s = s.rstrip(",:;–—- ").strip()
    if not s:
        return s
    return s + "."


def _split_text_for_tts(text: str, max_chars: int = 160) -> "list[tuple[str, bool]]":
    """Quebra texto em chunks <= max_chars respeitando fim de frase.

    VoxCPM gera 1 utterance por chamada e drifta/acelera em texto longo (issue
    #302). Quebrar em frases e gerar cada uma re-ancora a referencia + reinicia
    o estado interno do modelo a cada chunk — a doc oficial confirma que isso
    previne 'gradual speed-up' e drift de timbre.
    https://voxcpm.readthedocs.io/en/latest/usage_guide.html

    Cada chunk passa por _ensure_terminal: termina sempre com . ! ? — sem isso o
    modelo inventa filler ("entao nao") pra "completar" a fala.

    Retorna (chunk, fim_de_paragrafo): quebras de paragrafo (\n\n) do texto do
    usuario viram pausa REAL na montagem (caso Joana 21/07: roteiro com
    paragrafos dramaticos saiu emendado sem respiro, 16%% mais rapido que o
    mesmo texto no concorrente).
    """
    text = (text or "").strip()
    if not text:
        return []
    out: "list[tuple[str, bool]]" = []
    paragraphs = [p for p in re.split(r"\n\s*\n", text) if p.strip()]
    for para in paragraphs:
        # Separa em frases por fim de pontuacao. Inclui ':' e ';' como
        # fronteira (linhas 'Ela falou:' viram seu proprio trecho, depois
        # normalizadas pra terminar em '.'). \n simples tambem corta.
        sentences = re.split(r"(?<=[.!?…:;])\s+|\n+", para)
        chunks: list[str] = []
        cur = ""
        for s in sentences:
            s = s.strip()
            if not s:
                continue
            # Se grudar a proxima frase passa do limite, fecha o chunk atual.
            # Se a frase sozinha estoura, deixa estourar (nao corta meio-palavra).
            if cur and len(cur) + 1 + len(s) > max_chars:
                chunks.append(cur)
                cur = s
            else:
                cur = (cur + " " + s) if cur else s
        if cur:
            chunks.append(cur)
        # Borda limpa em todo trecho (anti-filler). Remove vazios resultantes.
        cleaned = [c for c in (_ensure_terminal(c) for c in chunks) if c]
        for i, c in enumerate(cleaned):
            out.append((c, i == len(cleaned) - 1))
    return out


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


def _start_word_ok(
    seg: np.ndarray, sample_rate: int, expected_text: str,
    whisper_model: str, language: str,
) -> "bool | None":
    """QA do INÍCIO da geração (caso "hoje" engolido 2026-07-17): transcreve os
    primeiros ~4s do chunk e confere se a 1a palavra esperada está lá. O modo
    continuation do VoxCPM engole/atropela a 1a palavra quando a cauda da ref
    vaza (issue #272). True = ok; False = 1a palavra sumiu (regerar);
    None = Whisper inconclusivo (não bloqueia — QA é rede de segurança).
    """
    import difflib

    expected = _qa_norm_words(expected_text, language)
    if not expected:
        return True
    head = seg[: int(sample_rate * 4)]
    if head.size < int(sample_rate * 0.2):
        return None
    got = _qa_transcribe_seg(head, sample_rate, whisper_model, language, "start_qa")
    if not got:
        return None
    first = expected[0]
    return any(
        difflib.SequenceMatcher(None, first, w).ratio() >= 0.8 for w in got[:3]
    )


def _num_pt(n: int) -> list[str]:
    """36 -> ["trinta","e","seis"] (sem acento — casa com o _qa_norm_words)."""
    U = ["zero", "um", "dois", "tres", "quatro", "cinco", "seis", "sete",
         "oito", "nove", "dez", "onze", "doze", "treze", "quatorze", "quinze",
         "dezesseis", "dezessete", "dezoito", "dezenove"]
    T = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta",
         "setenta", "oitenta", "noventa"]
    C = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos",
         "seiscentos", "setecentos", "oitocentos", "novecentos"]
    if n < 20:
        return [U[n]]
    if n < 100:
        t, r = divmod(n, 10)
        return [T[t]] + (["e", U[r]] if r else [])
    if n == 100:
        return ["cem"]
    if n < 1000:
        c, r = divmod(n, 100)
        return [C[c]] + (["e"] + _num_pt(r) if r else [])
    if n < 1_000_000:
        m, r = divmod(n, 1000)
        head = ["mil"] if m == 1 else _num_pt(m) + ["mil"]
        return head + (["e"] + _num_pt(r) if r else [])
    m, r = divmod(n, 1_000_000)
    head = ["um", "milhao"] if m == 1 else _num_pt(m) + ["milhoes"]
    return head + (["e"] + _num_pt(r) if r else [])


def _num_en(n: int) -> list[str]:
    U = ["zero", "one", "two", "three", "four", "five", "six", "seven",
         "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen",
         "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"]
    T = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy",
         "eighty", "ninety"]
    if n < 20:
        return [U[n]]
    if n < 100:
        t, r = divmod(n, 10)
        return [T[t]] + ([U[r]] if r else [])
    if n < 1000:
        h, r = divmod(n, 100)
        return [U[h], "hundred"] + (_num_en(r) if r else [])
    if n < 1_000_000:
        m, r = divmod(n, 1000)
        return _num_en(m) + ["thousand"] + (_num_en(r) if r else [])
    m, r = divmod(n, 1_000_000)
    return _num_en(m) + ["million"] + (_num_en(r) if r else [])


def _num_es(n: int) -> list[str]:
    U = ["cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete",
         "ocho", "nueve", "diez", "once", "doce", "trece", "catorce",
         "quince", "dieciseis", "diecisiete", "dieciocho", "diecinueve",
         "veinte", "veintiuno", "veintidos", "veintitres", "veinticuatro",
         "veinticinco", "veintiseis", "veintisiete", "veintiocho",
         "veintinueve"]
    T = ["", "", "veinte", "treinta", "cuarenta", "cincuenta", "sesenta",
         "setenta", "ochenta", "noventa"]
    C = ["", "ciento", "doscientos", "trescientos", "cuatrocientos",
         "quinientos", "seiscientos", "setecientos", "ochocientos",
         "novecientos"]
    if n < 30:
        return [U[n]]
    if n < 100:
        t, r = divmod(n, 10)
        return [T[t]] + (["y", U[r]] if r else [])
    if n == 100:
        return ["cien"]
    if n < 1000:
        c, r = divmod(n, 100)
        return [C[c]] + (_num_es(r) if r else [])
    if n < 1_000_000:
        m, r = divmod(n, 1000)
        head = ["mil"] if m == 1 else _num_es(m) + ["mil"]
        return head + (_num_es(r) if r else [])
    m, r = divmod(n, 1_000_000)
    head = ["un", "millon"] if m == 1 else _num_es(m) + ["millones"]
    return head + (_num_es(r) if r else [])


def _digits_to_words(tok: str, language: str) -> list[str]:
    """Token só de dígitos vira as palavras faladas no idioma do job."""
    if len(tok) > 9:
        # gigante (telefone, CPF): fala-se dígito a dígito
        return [w for d in tok for w in _digits_to_words(d, language)]
    n = int(tok)
    lang = (language or "pt").lower()
    if lang.startswith("en"):
        return _num_en(n)
    if lang.startswith("es"):
        return _num_es(n)
    return _num_pt(n)


def _qa_norm_words(s: str, language: str = "pt") -> list[str]:
    """Palavras minúsculas sem acento/pontuação (comparação de QA).

    Dígitos viram PALAVRAS no idioma do job (caso pestanatiago 19/08): o texto
    do TTS chega por extenso ("E trinta e seis") e o whisper devolve dígitos
    ("E36") — sem expandir, todo texto com número perdia cobertura em áudio
    PERFEITO e o coverage QA reprovava de graça (0.609 medido, 2 estornos).
    Expande dos DOIS lados (esperado e transcrito), então texto cru com dígito
    (fallback sem normalizador) também casa."""
    import unicodedata
    s = unicodedata.normalize("NFD", (s or "").lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = re.sub(r"[^a-z0-9\s]", " ", s)
    # "e36" / "36kg" -> "e 36" / "36 kg": separa letra de dígito antes de expandir
    s = re.sub(r"(?<=[a-z])(?=[0-9])|(?<=[0-9])(?=[a-z])", " ", s)
    out: list[str] = []
    for w in s.split():
        out.extend(_digits_to_words(w, language) if w.isdigit() else [w])
    return out


def _qa_transcribe_seg(seg, sample_rate, whisper_model, language, label):
    """Transcreve um trecho de áudio pra QA e devolve as palavras normalizadas.

    None = whisper FALHOU (inconclusivo — QA é rede de segurança, não bloqueia).
    Lista VAZIA = whisper rodou e não ouviu fala — isso é informação REAL, não
    falha: o QA de completude usa a diferença (caso Katia 19/08, chunk que saiu
    praticamente mudo tem que reprovar, não passar como "inconclusivo")."""
    import tempfile
    try:
        from voice_pipeline import transcribe_file
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            tmp_path = Path(tmp.name)
        sf.write(str(tmp_path), seg, sample_rate)
        try:
            return _qa_norm_words(transcribe_file(tmp_path, model_name=whisper_model, language=language), language)
        finally:
            tmp_path.unlink(missing_ok=True)
    except Exception as exc:
        _log("error", f"inference.{label}.error", error=str(exc))
        return None


def _echo_leak_count(got, chunk_text, prompt_text, language: str = "pt"):
    """QA anti-eco (caso Carlos "mesma coisa" 2026-07-29): o continuation do
    VoxCPM vaza frases da REF no meio/fim dos chunks — o QA de 1a palavra não
    vê. Recebe a transcrição NORMALIZADA do chunk inteiro (`got` — a MESMA
    transcrição alimenta este QA e o de completude, uma chamada de whisper
    serve as duas análises) e procura bigramas que existem na ref mas NÃO no
    texto pedido (palavras ≥3 letras — filtra "e a"/"de um").
    Retorna o Nº de bigramas vazados (0 = limpo); None = inconclusivo/QA não
    aplicável (não bloqueia — rede de segurança, não gate).
    """
    if not prompt_text:
        return None
    ref_words = _qa_norm_words(prompt_text, language)
    text_words = _qa_norm_words(chunk_text, language)

    def grams(words: list[str]) -> set[tuple[str, str]]:
        return {
            (a, b) for a, b in zip(words, words[1:])
            if len(a) >= 3 and len(b) >= 3
        }

    suspect = grams(ref_words) - grams(text_words)
    if not suspect:
        return None
    if not got:
        return None
    return len(grams(got) & suspect)


def _chunk_coverage(got, chunk_text, language: str = "pt"):
    """QA de COMPLETUDE (caso Katia 19/08, incidente ce6e157d): fração (0..1)
    das palavras do texto do chunk presentes NA ORDEM na transcrição do áudio
    gerado. O echo QA só vê texto SOBRANDO (eco da ref); este vê texto
    FALTANDO — áudio que começa no meio do chunk, ou chunk inteiro mudo,
    passava limpo por todos os QAs e era entregue como [ready] e cobrado.

    `got` é a MESMA transcrição usada pelo echo QA (não paga whisper 2x).
    None = inconclusivo (whisper falhou, ou chunk sem palavras) — não bloqueia;
    transcrição VAZIA de um chunk com texto é cobertura 0.0 (bloqueia).
    """
    import difflib

    expected = _qa_norm_words(chunk_text, language)
    if not expected:
        return None
    if got is None:
        return None
    if not got:
        return 0.0
    sm = difflib.SequenceMatcher(None, expected, got)
    matched = sum(b.size for b in sm.get_matching_blocks())
    return round(matched / len(expected), 3)


def _chunk_intrusions(got, chunk_text, language="pt"):
    """QA de INTRUSÃO (incidente fb8d29b7, 19/08): palavra A MAIS ou TROCADA no
    áudio — o inverso do coverage (que só vê palavra FALTANDO). Caso medido:
    23 de 40 entregas recentes com palavra inventada/trocada, 21 passando no
    portão; o mecanismo dominante é o VoxCPM vazar a CAUDA da referência entre
    frases (a ref da Katia termina em "por menos" → "Menos." brotava nas
    junções de chunk).

    Método: alinha `expected` × `got` (SequenceMatcher) e olha os opcodes de
    insert/replace do lado do `got`. Palavra inserida SÓ conta como intrusão
    quando NÃO é parecida (ratio < 0.7) com nenhuma palavra esperada do
    replace correspondente ou vizinha — senão "quatorze" falado "catorze"
    (variação de Whisper/sotaque) viraria falso positivo. Palavra com menos de
    3 letras não conta (ruído de transcrição: "e", "a", "o").

    Retorna o Nº de intrusões (0 = limpo); None = inconclusivo (não bloqueia —
    rede de segurança, não gate).
    """
    import difflib

    expected = _qa_norm_words(chunk_text, language)
    if not expected or not got:
        return None

    def parecida(w, candidatas):
        for c in candidatas:
            if difflib.SequenceMatcher(None, w, c).ratio() >= 0.7:
                return True
            # Whisper separa/junta palavra composta ("autoconhecimento" →
            # "auto conhecimento"): pedaço-prefixo/sufixo da vizinha não é
            # intrusão. Só vale com pedaço ≥3 (senão tudo casa com tudo).
            if len(w) >= 3 and len(c) >= 3 and (
                c.startswith(w) or c.endswith(w) or w.startswith(c) or w.endswith(c)
            ):
                return True
        return False

    sm = difflib.SequenceMatcher(None, expected, got)
    intrusoes = 0
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag not in ("insert", "replace"):
            continue
        # Vizinhança APERTADA: as palavras do replace + 1 de cada lado. Janela
        # de 2 deixava intrusão real escapar por parentesco acidental — no caso
        # medido, o "menos" vazado da ref casava com "mesmos" duas posições
        # antes (ratio 0.73) e a tomada 1 da Katia passava limpa.
        vizinhas = expected[max(0, i1 - 1) : min(len(expected), i2 + 1)]
        for w in got[j1:j2]:
            if len(w) >= 3 and not parecida(w, vizinhas):
                intrusoes += 1
    return intrusoes


def _maior_lacuna(got, chunk_text, language="pt"):
    """Maior TRECHO CONTÍNUO do texto que sumiu do áudio (em palavras).

    ⚠️ Por que isto existe (20/08): a cobertura sozinha é uma régua RUIM pra
    decidir reprovar. Ela conta palavra faltando sem olhar ONDE — e o texto do
    aluno está cheio de coisa que NINGUÉM FALA em voz alta: número por extenso
    virando dígito na transcrição, **markdown**, emoji, rótulo de locutor
    ("Seres:" num roteiro de diálogo), URL, "[pausa]". Cada uma dessas derruba
    a cobertura alguns pontos e reprovava ÁUDIO PERFEITO — 3 casos medidos em
    24h, cada um custando o áudio de um aluno, e sempre aparece uma variação
    nova. Tapar buraco com lista de exceção é corrida perdida.

    A DIFERENÇA REAL entre os dois mundos é a FORMA do buraco:
      • defeito de verdade (caso Katia): o modelo pula um PEDAÇÃO — chunk mudo,
        ou áudio que começa no meio. Some um trecho CONTÍNUO e longo.
      • falso negativo (markup): somem palavras SOLTAS, espalhadas, de 1 em 1.

    Então medimos o maior buraco contínuo em vez de só contar o que falta.
    Isso não depende de saber QUAIS símbolos não se fala — funciona pra
    variação que ainda nem apareceu.
    """
    import difflib

    expected = _qa_norm_words(chunk_text, language)
    if not expected:
        return None
    if got is None:
        return None
    if not got:
        return len(expected)  # chunk inteiro mudo: buraco = tudo
    sm = difflib.SequenceMatcher(None, expected, got)
    maior = 0
    for tag, i1, i2, _j1, _j2 in sm.get_opcodes():
        if tag in ("delete", "replace"):
            maior = max(maior, i2 - i1)
    return maior


def _run_chunk_qa(
    seg,
    idx: int,
    chunk: str,
    regen_fn,
    sample_rate: int,
    prompt_text,
    qa_language: str,
    start_qa_enabled: bool,
    start_qa_retries: int,
    start_qa_model: str,
    echo_qa_enabled: bool,
    echo_qa_retries: int,
    echo_qa_model: str,
    coverage_qa_enabled: bool,
    coverage_qa_retries: int,
    coverage_qa_min: float,
    intrusion_qa_enabled: bool,
    intrusion_qa_retries: int,
    qa_stats: dict,
):
    """Laço de QA de UM chunk: reprovou → regenera (regen_fn); esgotou as
    tentativas → devolve a MELHOR tentativa (menos eco; 1a palavra errada e
    texto faltando pesam mais), não a última.

    Devolve (melhor_seg, cobertura_da_melhor). O CHAMADOR decide o que fazer
    quando a cobertura da melhor tentativa ficou abaixo do mínimo: falhar o
    job explícito, nunca entregar incompleto em silêncio (caso Katia 19/08 —
    ~30% do texto ausente saiu [ready] e custou 555 créditos).
    """
    attempt = 0
    max_attempts = max(
        start_qa_retries, echo_qa_retries, coverage_qa_retries, intrusion_qa_retries
    )
    best_seg, best_score, best_coverage = seg, None, None
    best_lacuna = None
    while attempt < max_attempts:
        score = 0
        coverage = None
        lacuna_desta = None
        # Caso Katia 19/08: o `idx == 0` que havia aqui limitava o QA de 1a
        # palavra ao PRIMEIRO chunk — do 2o em diante o áudio podia começar no
        # meio do texto sem ninguém conferir (foi exatamente onde quebrou: o
        # chunk 0, único protegido, saiu perfeito). Roda em TODOS os chunks.
        if start_qa_enabled and attempt < start_qa_retries:
            ok = _start_word_ok(seg, sample_rate, chunk, start_qa_model, qa_language)
            _log("info", "inference.start_qa", idx=idx, attempt=attempt, ok=ok)
            if ok is False:
                score += 100
        # UMA transcrição do chunk inteiro alimenta echo QA E coverage QA —
        # não multiplica o número de chamadas de whisper por chunk.
        got = None
        if (echo_qa_enabled and attempt < echo_qa_retries) or (
            coverage_qa_enabled and attempt < coverage_qa_retries
        ) or (intrusion_qa_enabled and attempt < intrusion_qa_retries):
            if seg.size >= int(sample_rate * 0.2):
                got = _qa_transcribe_seg(seg, sample_rate, echo_qa_model, qa_language, "chunk_qa")
            else:
                # Áudio praticamente MUDO: "não ouvi nada" é informação real
                # (chunk 3 da Katia), não falha de whisper — não vira None.
                got = []
        if echo_qa_enabled and attempt < echo_qa_retries:
            leak = _echo_leak_count(got, chunk, prompt_text, qa_language)
            qa_stats["echo_checked"] += 1
            if leak is None:
                qa_stats["echo_none"] += 1
            else:
                _log("info", "inference.echo_qa", idx=idx, attempt=attempt, leak=leak)
                if leak > 0:
                    qa_stats["echo_flagged"] += 1
                score += leak
        if coverage_qa_enabled and attempt < coverage_qa_retries:
            coverage = _chunk_coverage(got, chunk, qa_language)
            lacuna = _maior_lacuna(got, chunk, qa_language)
            qa_stats["coverage_checked"] += 1
            if coverage is None:
                qa_stats["coverage_none"] += 1
            else:
                _log(
                    "info", "inference.coverage_qa", idx=idx, attempt=attempt,
                    coverage=coverage, maior_lacuna=lacuna,
                )
                if coverage < coverage_qa_min:
                    qa_stats["coverage_flagged"] += 1
                    # Penalidade proporcional ao que falta: entre duas
                    # tentativas ruins, best_seg fica com a MAIS completa.
                    score += 100 + int((coverage_qa_min - coverage) * 100)
            lacuna_desta = lacuna
        if intrusion_qa_enabled and attempt < intrusion_qa_retries:
            intrusoes = _chunk_intrusions(got, chunk, qa_language)
            qa_stats["intrusion_checked"] += 1
            if intrusoes is None:
                qa_stats["intrusion_none"] += 1
            else:
                _log("info", "inference.intrusion_qa", idx=idx, attempt=attempt, intrusions=intrusoes)
                if intrusoes > 0:
                    qa_stats["intrusion_flagged"] += 1
                    # GATE MACIO (deliberado): intrusão regenera e escolhe a
                    # tentativa mais limpa, mas NUNCA falha o job no esgotamento
                    # — 23 de 40 entregas recentes têm o defeito (fb8d29b7);
                    # gate duro agora viraria tempestade de falha+estorno como
                    # a de 19/08. Peso 50: acima do eco, abaixo do coverage.
                    score += 50 * intrusoes
        if best_score is None or score < best_score:
            best_seg, best_score, best_coverage = seg, score, coverage
            best_lacuna = lacuna_desta
        if score == 0:
            break
        attempt += 1
        if attempt >= max_attempts:
            _log("error", "inference.qa.exhausted", idx=idx, best_score=best_score)
            qa_stats["exhausted"] += 1
            break
        qa_stats["regens"] += 1
        seg = regen_fn()
    return best_seg, best_coverage, best_lacuna


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
    # 1.6 (era 2.0): doc do VoxCPM recomenda 1.5-1.6 p/ MAIS estabilidade e
    # menos drift/alucinacao. O backend ja manda 1.6; isto e' so o fallback.
    cfg_value = float(inp.get("cfg_value", 1.6))
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
        # CAUDA DE SILÊNCIO na ref (caso "hoje" engolido 2026-07-17): o VoxCPM
        # continua ACUSTICAMENTE a cauda da referência — ref que termina no meio
        # de fala faz a 1a palavra da geração sair fundida/engolida. 0.5-1.0s de
        # silêncio no fim da ref foi o único workaround com relato de eliminação
        # completa no issue #272. Aplicado na hora (cache local) — cura TODAS as
        # vozes existentes sem retreinar nem tocar no R2.
        pad_ms = int(os.environ.get("TTS_REF_TAIL_SILENCE_MS", "600"))
        if pad_ms > 0:
            padded = ref_path.with_name(f"{ref_path.stem}_tail{pad_ms}.wav")
            if not (padded.exists() and padded.stat().st_size > 0):
                r = subprocess.run(
                    ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
                     "-i", str(ref_path), "-af", f"apad=pad_dur={pad_ms / 1000}",
                     str(padded)],
                    capture_output=True, text=True,
                )
                if r.returncode != 0 or not padded.exists():
                    _log("error", "inference.ref_pad.failed", detail=(r.stderr or "")[:300])
                    padded = ref_path
            ref_path = padded
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

    # Pontuacao terminal no prompt_text: a ref auto de 30s costuma terminar no
    # meio de frase e o transcript vem sem ponto final — o modelo entende que a
    # fala continua e atropela a 1a palavra do texto novo. O ponto final avisa
    # "a fala anterior acabou" (par do silencio acolchoado na cauda da ref).
    if prompt_text:
        prompt_text = _ensure_terminal(prompt_text)

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

    _free_cuda()  # worker quente pode ter VRAM presa de jobs anteriores
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
    chunk_max = int(os.environ.get("TTS_CHUNK_MAX_CHARS", "160"))
    # Retry anti-badcase do VoxCPM (env-tunavel p/ ajustar sem rebuild). O retry
    # so pega FALHA GROSSA (audio ~Nx maior que o esperado = loop/repeticao);
    # nao pega "entao nao" curto — pra isso vale o _ensure_terminal + cfg 1.6.
    retry_max = int(os.environ.get("TTS_RETRY_MAX_TIMES", "4"))
    retry_ratio = float(os.environ.get("TTS_RETRY_RATIO", "4.0"))
    # silence/crossfade aceitam override por requisição (`inp`) pra ajuste POR
    # VOZ sem afetar as demais. Sem override → cai no env (default global, mesmo
    # comportamento de antes). 0 é valor válido (ex.: desligar o crossfade).
    _sil = inp.get("chunk_silence_ms")
    silence_ms = int(_sil) if _sil is not None else int(os.environ.get("TTS_CHUNK_SILENCE_MS", "0"))
    _cf = inp.get("chunk_crossfade_ms")
    crossfade_ms = int(_cf) if _cf is not None else int(os.environ.get("TTS_CHUNK_CROSSFADE_MS", "60"))
    trim_enabled = os.environ.get("TTS_CHUNK_TRIM", "1") not in ("0", "false", "False", "")
    trim_threshold = float(os.environ.get("TTS_CHUNK_TRIM_THRESHOLD", "0.005"))
    # `pad_ms` mantem alguns ms de cada lado pra nao cortar consoante final.
    trim_pad_ms = int(os.environ.get("TTS_CHUNK_TRIM_PAD_MS", "20"))

    chunks = _split_text_for_tts(text, max_chars=chunk_max) or [(text, False)]
    silence_samples = max(0, int(sample_rate * silence_ms / 1000))
    crossfade_samples = max(0, int(sample_rate * crossfade_ms / 1000))
    trim_pad_samples = max(0, int(sample_rate * trim_pad_ms / 1000))
    # Pausa REAL entre paragrafos do texto (\n\n) — silencio digital anexado ao
    # fim do chunk que fecha o paragrafo (o crossfade desliza pra dentro do
    # silencio, sem clique). Env-tunavel sem rebuild; 0 desliga.
    par_pause_ms = int(os.environ.get("TTS_PARAGRAPH_PAUSE_MS", "300"))
    par_pause_samples = max(0, int(sample_rate * par_pause_ms / 1000))

    _log(
        "info", "inference.start", text_len=len(text), chunks=len(chunks),
        chunk_max=chunk_max, silence_ms=silence_ms, crossfade_ms=crossfade_ms,
        trim=trim_enabled, trim_thresh=trim_threshold,
        has_clone=bool(prompt_wav_local), has_lora=bool(lora_path),
        timesteps=inference_timesteps,
    )
    t0 = time.monotonic()

    # QA do início: o continuation engole a 1a palavra quando a cauda da ref
    # vaza (issue #272). Transcreve o começo do chunk e regera se a 1a palavra
    # esperada sumiu. Roda em TODOS os chunks (caso Katia 19/08 — antes só o
    # 1o era conferido). Só roda em clonagem (com ref).
    start_qa_enabled = os.environ.get("TTS_START_QA", "1") not in ("0", "false", "False", "")
    start_qa_retries = int(os.environ.get("TTS_START_QA_RETRIES", "2"))
    start_qa_model = os.environ.get("TTS_START_QA_WHISPER", "small")
    qa_language = inp.get("language", "pt")
    # QA anti-eco (caso Carlos 29/07): frases da ref vazando no meio/fim de
    # QUALQUER chunk. Transcreve o chunk inteiro; eco -> regera o chunk.
    # Modelo próprio: o "small" do start_qa NÃO OUVIU 4/7 ecos no E2E (recall
    # baixo) — o turbo já está na imagem (audio_edit) e é rápido em GPU.
    echo_qa_enabled = os.environ.get("TTS_ECHO_QA", "1") not in ("0", "false", "False", "")
    echo_qa_retries = int(os.environ.get("TTS_ECHO_QA_RETRIES", "3"))
    echo_qa_model = os.environ.get("TTS_ECHO_QA_WHISPER", "large-v3-turbo")
    # QA de COMPLETUDE (caso Katia 19/08): chunk cujo áudio fala MENOS que o
    # texto — começa no meio, ou sai praticamente mudo. O echo QA só vê texto
    # SOBRANDO (eco da ref), não FALTANDO. Compara a transcrição do chunk
    # inteiro (a MESMA do echo QA — não paga whisper 2x) com o texto pedido,
    # na ordem. Abaixo do mínimo → regera; esgotou sem atingir → o job FALHA
    # explícito (webhook estorna), nunca entrega incompleto como [ready].
    coverage_qa_enabled = os.environ.get("TTS_COVERAGE_QA", "1") not in ("0", "false", "False", "")
    coverage_qa_min = float(os.environ.get("TTS_COVERAGE_QA_MIN", "0.85"))
    coverage_qa_retries = int(os.environ.get("TTS_COVERAGE_QA_RETRIES", "3"))
    # Tamanho MÍNIMO (em palavras) do buraco contínuo pra derrubar o job.
    # Abaixo disso, cobertura baixa é lida como texto-que-não-se-fala e o
    # áudio é ENTREGUE. Ver o bloco de decisão em _handle_inference.
    coverage_qa_gap_min = int(os.environ.get("TTS_COVERAGE_QA_GAP_MIN", "6"))

    # QA de INTRUSÃO (incidente fb8d29b7, 19/08): palavra a mais/trocada —
    # eco de cauda da ref ("menos" da Katia) e invenção do modelo. GATE MACIO:
    # regenera e escolhe a tentativa mais limpa, mas NUNCA falha o job (23/40
    # entregas recentes têm o defeito; gate duro = tempestade de estorno).
    intrusion_qa_enabled = os.environ.get("TTS_INTRUSION_QA", "1") not in ("0", "false", "False", "")
    intrusion_qa_retries = int(os.environ.get("TTS_INTRUSION_QA_RETRIES", "3"))

    def _gen_chunk(chunk_text: str) -> np.ndarray:
        # Chamada 1:1 com o desktop (VoiceLoraStudio/core.py:841-853).
        seg = model.generate(
            text=chunk_text,
            prompt_wav_path=prompt_wav_local,
            prompt_text=prompt_text,
            cfg_value=cfg_value,
            inference_timesteps=inference_timesteps,
            max_len=4096,
            normalize=normalize,
            denoise=False,
            retry_badcase=True,
            retry_badcase_max_times=retry_max,
            retry_badcase_ratio_threshold=retry_ratio,
        )
        return np.asarray(seg, dtype=np.float32)

    # Observabilidade do QA (29/07): devolvida no output do job — tira a
    # adivinhação por timing na hora de validar se o QA está mesmo agindo.
    # coverage_* (19/08): mede se o remédio do caso Katia está pegando.
    qa_stats = {
        "echo_checked": 0, "echo_flagged": 0, "echo_none": 0,
        "coverage_checked": 0, "coverage_flagged": 0, "coverage_none": 0,
        "coverage_exhausted": 0,
        "intrusion_checked": 0, "intrusion_flagged": 0, "intrusion_none": 0,
        "regens": 0, "exhausted": 0,
    }

    pieces: list[np.ndarray] = []
    coverage_failure: "dict | None" = None
    for idx, (chunk, ends_paragraph) in enumerate(chunks):
        ct0 = time.monotonic()
        seg = _gen_chunk(chunk)
        raw_samples = int(seg.size)

        def _trim(s: np.ndarray, i=idx) -> np.ndarray:
            if not trim_enabled:
                return s
            # 1o chunk ganha pad maior na borda pra não comer consoante fraca
            # de abertura (o "h" de "hoje" fica abaixo do threshold de -46dB).
            pad = max(trim_pad_samples, int(sample_rate * 0.06)) if i == 0 else trim_pad_samples
            return _trim_silence(s, threshold=trim_threshold, pad_samples=pad)

        seg = _trim(seg)
        if prompt_wav_local and (
            start_qa_enabled or echo_qa_enabled or coverage_qa_enabled or intrusion_qa_enabled
        ):
            seg, best_coverage, best_lacuna = _run_chunk_qa(
                seg, idx, chunk,
                regen_fn=lambda c=chunk, t=_trim: t(_gen_chunk(c)),
                sample_rate=sample_rate,
                prompt_text=prompt_text,
                qa_language=qa_language,
                start_qa_enabled=start_qa_enabled,
                start_qa_retries=start_qa_retries,
                start_qa_model=start_qa_model,
                echo_qa_enabled=echo_qa_enabled,
                echo_qa_retries=echo_qa_retries,
                echo_qa_model=echo_qa_model,
                coverage_qa_enabled=coverage_qa_enabled,
                coverage_qa_retries=coverage_qa_retries,
                coverage_qa_min=coverage_qa_min,
                intrusion_qa_enabled=intrusion_qa_enabled,
                intrusion_qa_retries=intrusion_qa_retries,
                qa_stats=qa_stats,
            )
            # DUAS CONDIÇÕES pra derrubar o job (mudança de 20/08):
            #   (1) cobertura abaixo do mínimo, E
            #   (2) o que falta é um TRECHO CONTÍNUO grande.
            #
            # Antes bastava a (1) — e isso reprovava ÁUDIO PERFEITO toda vez
            # que o texto do aluno tinha algo que não se fala (número por
            # extenso, **markdown**, emoji, rótulo de locutor num roteiro de
            # diálogo). Foram 3 variações medidas em 24h, cada uma custando o
            # áudio de um aluno, e sempre nascia uma nova: lista de exceção é
            # corrida perdida.
            #
            # O defeito de VERDADE (caso Katia) tem forma diferente: o modelo
            # pula um pedação — chunk mudo ou áudio começando no meio —, então
            # some um trecho CONTÍNUO. Markup some em palavras SOLTAS. Medir a
            # forma do buraco separa os dois sem precisar saber quais símbolos
            # existem no mundo. Teto: o maior entre COVERAGE_QA_GAP_MIN
            # palavras e 20% do chunk (chunk curto não pode ser derrubado por
            # um buraco de 6 palavras que é metade dele).
            if (
                coverage_qa_enabled
                and best_coverage is not None
                and best_coverage < coverage_qa_min
            ):
                palavras_chunk = len(_qa_norm_words(chunk, qa_language))
                limite_lacuna = max(coverage_qa_gap_min, int(palavras_chunk * 0.20))
                if best_lacuna is not None and best_lacuna < limite_lacuna:
                    # Cobertura baixa MAS espalhada: é texto que não se fala,
                    # não fala que sumiu. ENTREGA — e deixa o rastro no log
                    # pra medir se essa decisão está certa na prática.
                    qa_stats["coverage_espalhada"] = qa_stats.get("coverage_espalhada", 0) + 1
                    _log(
                        "info", "inference.coverage.espalhada", idx=idx,
                        coverage=best_coverage, maior_lacuna=best_lacuna,
                        limite=limite_lacuna, palavras=palavras_chunk,
                    )
                else:
                    # Buraco contínuo grande: o modelo comeu um pedaço mesmo.
                    # Falha EXPLÍCITA (caso Katia 19/08 — ~30% do texto ausente
                    # saiu [ready] e custou 555 créditos): sem upload, o webhook
                    # cai no caminho de falha e estorna (handleTechFailure).
                    qa_stats["coverage_exhausted"] += 1
                    coverage_failure = {
                        "chunk_idx": idx,
                        "coverage": best_coverage,
                        "maior_lacuna": best_lacuna,
                    }
                    break
        _log(
            "info", "inference.chunk", idx=idx, total=len(chunks),
            chars=len(chunk), samples_raw=raw_samples, samples_trim=int(seg.size),
            elapsed_s=round(time.monotonic() - ct0, 2),
        )
        # Pausa de paragrafo: silencio anexado ao proprio segmento (sobrevive
        # ao crossfade — o fade desliza pra dentro do silencio).
        if ends_paragraph and par_pause_samples > 0 and idx < len(chunks) - 1:
            seg = np.concatenate([seg, np.zeros(par_pause_samples, dtype=np.float32)])
        pieces.append(seg)
        # Silencio entre chunks (default 0). Aplicado SOMENTE quando crossfade
        # esta desligado — senao o silencio dentro do overlap se autodestrui.
        if silence_samples > 0 and crossfade_samples == 0 and idx < len(chunks) - 1:
            pieces.append(np.zeros(silence_samples, dtype=np.float32))

    if coverage_failure is not None:
        # Falha explícita (caso Katia 19/08): NÃO sobe áudio, devolve `error`.
        # O webhook (handleGenerationWebhook) só finaliza como ready quando
        # `!out.error && out.uploaded` — com `error` presente ele marca failed
        # e estorna via handleTechFailure. Texto do erro ESTÁVEL, sem número/ID
        # no meio: a assinatura do incidente é derivada do texto do erro
        # (lib/incidents/classify.ts) — os detalhes vão em campos próprios.
        del model
        _free_cuda()
        _log(
            "error", "inference.coverage.failed",
            chunk_idx=coverage_failure["chunk_idx"],
            coverage=coverage_failure["coverage"],
            min_required=coverage_qa_min, qa=qa_stats,
        )
        return {
            "error": "qa_coverage: audio gerado nao contem o texto completo apos esgotar regeneracoes",
            "coverage_failed_chunk": coverage_failure["chunk_idx"],
            "coverage_best": coverage_failure["coverage"],
            "coverage_min": coverage_qa_min,
            "elapsed_s": round(time.monotonic() - t0, 2),
            "qa": qa_stats,
        }

    # Concat: com crossfade quando ativo (default), senao concatena plano.
    if crossfade_samples > 0 and len(pieces) > 1:
        wav = _crossfade_concat(pieces, crossfade_samples)
    else:
        wav = np.concatenate(pieces) if pieces else np.zeros(0, dtype=np.float32)
    # Micro fade-in: mata o chirp/click residual do 1o patch do VoxCPM (issue
    # #272) sem comer fonema — 8ms é inaudível como fade.
    fade_ms = int(os.environ.get("TTS_START_FADE_MS", "8"))
    fade_n = int(sample_rate * fade_ms / 1000)
    if fade_n > 0 and wav.size > fade_n:
        wav = wav.copy()
        wav[:fade_n] *= np.linspace(0.0, 1.0, fade_n, dtype=np.float32)
    elapsed = time.monotonic() - t0
    _log("info", "inference.done", elapsed_s=round(elapsed, 2), samples=len(wav), chunks=len(chunks))

    # Modelo não é mais necessário (wav pronto) — solta a VRAM ANTES do upload
    # pra o próximo job deste worker (inclusive um treino) nascer com GPU limpa.
    del model
    _free_cuda()

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
            "qa": qa_stats,
        }

    return {
        "audio_base64": _wav_to_base64(wav, sample_rate),
        "sample_rate": sample_rate,
        "duration_s": round(len(wav) / sample_rate, 3),
        "elapsed_s": round(elapsed, 2),
        "qa": qa_stats,
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
    _log("info", "job.start", type=job_type, disk_pct=round(_disk_percent(), 1))
    try:
        if job_type == "train":
            return _handle_train(inp)
        if job_type == "inference":
            return _handle_inference(inp)
        if job_type == "transcribe":
            return _handle_transcribe(inp)
        if job_type == "audio_edit":
            # Vídeo Estúdio F0: limpeza de gravação (repetições/pausas) + words
            from audio_edit import handle_audio_edit
            return handle_audio_edit(inp, log=_log)
        if job_type == "video_edit":
            # Estúdio F2: gravação crua -> Cérebro 2 corta A/V + legenda
            from video_edit import handle_video_edit
            return handle_video_edit(inp, log=_log)
        if job_type == "montage":
            # Vídeo Estúdio F1: áudio limpo + cenas -> vídeo 9:16 montado
            from montage import handle_montage
            return handle_montage(inp, log=_log)
        if job_type == "tts_prepare":
            # Máquina E2: TTS único -> encolher pausas + words + QA fidelidade
            from tts_prepare import handle_tts_prepare
            return handle_tts_prepare(inp, log=_log)
        if job_type == "caption_variants":
            # Máquina E4: 1 vídeo -> N variações trocando a legenda de hook
            from variants import handle_caption_variants
            return handle_caption_variants(inp, log=_log)
        if job_type == "caption_burn":
            # Wizard W5: legenda karaokê num MP4 pronto (clone/re-legendar)
            from variants import handle_caption_burn
            return handle_caption_burn(inp, log=_log)
        if job_type == "broll_overlay":
            # Wizard W5: cenas de b-roll por cima de um MP4 pronto (clone)
            from variants import handle_broll_overlay
            return handle_broll_overlay(inp, log=_log)
        if job_type == "slides":
            # Máquina E4: artes de slide (PIL, estáticas, estados progressivos)
            from variants import handle_slides
            return handle_slides(inp, log=_log)
        if job_type == "health":
            return {"ok": True, "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
        return {"error": f"unknown type '{job_type}' (use train/inference/transcribe/audio_edit/video_edit/montage/tts_prepare/caption_variants/caption_burn/slides/health)"}
    except Exception as exc:
        _log("error", "job.failed", error=str(exc), type=job_type, tb=traceback.format_exc()[:2000])
        _free_cuda()  # não deixa VRAM presa pro próximo job após crash
        return {"error": str(exc), "type": job_type, "traceback": traceback.format_exc()[:2000]}
    finally:
        # Disco: o worker quente atende jobs por horas e o lixo se acumula até
        # derrubar o próximo aluno. Faxina no fim de TODO job, inclusive os que
        # falharam (job que estourou é justamente o que mais deixa sujeira).
        _faxina(job_type)


if __name__ == "__main__":
    runpod.serverless.start({"handler": handler})
