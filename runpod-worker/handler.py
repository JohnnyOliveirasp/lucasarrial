"""RunPod Serverless handler — despachante dos jobs do worker.

Cada `type` do payload cai num modulo de jobs/. O que este arquivo faz e' so:
escolher o job, nao deixar excecao subir crua pro RunPod, soltar a VRAM se
algo estourar e mandar a faxina de disco rodar no fim de TODO job.

Rotas principais (event['input']['type']):
  - "train"       jobs/train.py       audio bruto -> LoRA da voz
  - "inference"   jobs/inference.py   texto -> audio
  - "transcribe"  jobs/transcribe.py  backfill da transcricao da referencia
  (video/audio/legenda: audio_edit, video_edit, montage, tts_prepare, variants)

O historico de cada decisao mora junto do codigo que a implementa:
  jobs/       o passo a passo de cada job
  tts_qa/     o QA por chunk da geracao
  worker_*.py log, constantes de env e faxina de disco
"""

from __future__ import annotations

import time
import traceback

import runpod

from jobs import handle_inference, handle_train, handle_transcribe
from model_loader import free_cuda
from worker_disk import disk_percent, faxina
from worker_log import log as _log, set_current_job, start_heartbeat


def handler(event: dict) -> dict:
    inp = event.get("input") or {}
    job_type = inp.get("type", "inference")
    _log("info", "job.start", type=job_type, disk_pct=round(disk_percent(), 1))
    # Instrumentação d3d8d1b2: heartbeat nomeia a fase corrente no log — num
    # hang SIGKILLado pelo executionTimeout, é o único rastro que sobra.
    # Parte 2 do d3d8d1b2 (b9bc646): se o app mandou fase_url/token/ref no
    # input, o heartbeat também POSTa a fase corrente pro nosso banco.
    set_current_job(job_type, inp)
    start_heartbeat()
    try:
        if job_type == "train":
            return handle_train(inp)
        if job_type == "inference":
            return handle_inference(inp)
        if job_type == "transcribe":
            return handle_transcribe(inp)
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
        free_cuda()  # não deixa VRAM presa pro próximo job após crash
        return {"error": str(exc), "type": job_type, "traceback": traceback.format_exc()[:2000]}
    finally:
        # Disco: o worker quente atende jobs por horas e o lixo se acumula até
        # derrubar o próximo aluno. Faxina no fim de TODO job, inclusive os que
        # falharam (job que estourou é justamente o que mais deixa sujeira).
        faxina(job_type)
        set_current_job(None)  # silencia o heartbeat entre jobs





if __name__ == "__main__":
    runpod.serverless.start({"handler": handler})
