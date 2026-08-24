"""Job de TREINO: audio bruto do aluno -> LoRA da voz.

O passo a passo esta dividido em tres arquivos:

  train_dataset.py    Demucs/VAD/chunk, audio util, idioma real
  train_reference.py  referencia da voz e amostra pos-treino com QA
  train.py            a maquina que orquestra e roda o trainer (este)

Custa 10k creditos por rodada e leva dezenas de minutos de GPU: cada `return`
de erro aqui e' uma decisao de PARAR CEDO em vez de gastar e entregar ruim.
Testes: test_train_smoke.py.
"""
from __future__ import annotations

import shutil
import time
from pathlib import Path

from model_loader import ensure_model_downloaded, free_cuda
from worker_config import LORA_RANK, MODEL_DIR, TRAIN_LORA_ALPHA, VOXCPM_REPO, WORKSPACE
from worker_log import log as _log

from .train_dataset import (
    TrainDirs,
    idioma_do_audio,
    minimo_util_exigido,
    preparar_dataset,
    segundos_uteis,
)
from .train_reference import escolher_e_subir, gerar_amostra_com_qa


def handle_train(inp: dict) -> dict:
    audio_urls = inp.get("audio_urls") or []
    if not audio_urls:
        return {"error": "missing 'audio_urls'"}
    if not inp.get("lora_upload_url"):
        return {"error": "missing 'lora_upload_url'"}
    return TrainJob(inp).run()


class TrainJob:
    """Um treino de voz, do download do audio ao upload da LoRA."""

    def __init__(self, inp: dict):
        self.inp = inp
        self.voice_id = inp.get("voice_id") or "anonymous"
        self.audio_urls = inp.get("audio_urls") or []
        self.lora_upload_url = inp.get("lora_upload_url")
        self.max_steps = int(inp.get("max_steps", 500))
        self.save_interval = int(inp.get("save_interval", max(50, self.max_steps // 4)))
        self.language = inp.get("language", "pt")
        self.whisper_model = inp.get("whisper_model", "large-v3")
        self.run_name = f"voice_{self.voice_id[:8]}"
        self.dirs = TrainDirs.para(WORKSPACE, self.voice_id)
        self.t0 = 0.0
        self.dataset_chunks = 0
        self.useful_seconds = 0.0
        self.reference_pause_ms = None

    # ── Orquestracao ───────────────────────────────────────────────────────
    def run(self) -> dict:
        self._limpar_area()
        self.t0 = time.monotonic()
        free_cuda()   # worker quente pode ter VRAM presa de inferencias anteriores
        ensure_model_downloaded()

        arquivos = self._baixar()
        self.dataset_chunks, stats = preparar_dataset(arquivos, self.dirs)
        if self.dataset_chunks == 0:
            return {"error": "no usable speech segments after VAD/chunk",
                    "preprocess_stats": stats}

        falta = self._conferir_audio_util()
        if falta is not None:
            return falta

        self.language = idioma_do_audio(self.dirs.dataset, self.whisper_model, self.language)
        # Pausa natural da pessoa -> vira o `tts_silence_ms` DESTA voz (080dd74).
        # Default do worker e silence_ms=0 (fala emendada) e 749/750 vozes
        # tinham o campo NULO. Medir aqui faz a voz NASCER com o ritmo de quem
        # gravou; None = nao deu pra medir -> o backend nao grava nada.
        self.reference_pause_ms = self._medir_pausa_natural()
        ref = escolher_e_subir(self.inp, self.dirs, self.dirs.norm,
                               self.whisper_model, self.language)

        self._transcrever_dataset()
        resultado = self._treinar()
        if resultado["returncode"] != 0:
            return {"voice_id": self.voice_id, "error": "trainer failed",
                    "trainer_returncode": resultado["returncode"],
                    "stdout_tail": resultado["stdout_tail"],
                    "stderr_tail": resultado["stderr_tail"]}

        lora = self._achar_lora()
        if lora is None:
            return {"voice_id": self.voice_id, "error": "no safetensors produced"}
        self._subir_lora(lora)

        amostra = gerar_amostra_com_qa(
            self.inp, self.dirs, ref, lora, LORA_RANK, TRAIN_LORA_ALPHA,
            MODEL_DIR, self.whisper_model, self.language,
        )
        return self._resultado(ref, amostra)

    # ── Passos ─────────────────────────────────────────────────────────────
    def _limpar_area(self) -> None:
        if self.dirs.job.exists():
            shutil.rmtree(self.dirs.job, ignore_errors=True)
        self.dirs.job.mkdir(parents=True, exist_ok=True)

    def _baixar(self) -> list[Path]:
        from voice_pipeline import download_to_dir

        _log("info", "train.download.start", count=len(self.audio_urls))
        baixados = download_to_dir(self.audio_urls, self.dirs.raw)
        _log("info", "train.download.done", count=len(baixados))
        return baixados

    def _conferir_audio_util(self) -> dict | None:
        """Pouco audio depois da limpeza -> aborta ANTES de gastar GPU."""
        self.useful_seconds = segundos_uteis(self.dirs.dataset)
        minimo = minimo_util_exigido()
        _log("info", "train.useful_audio", useful_seconds=self.useful_seconds,
             min_required=minimo)
        if self.useful_seconds >= minimo:
            return None
        return {
            "voice_id": self.voice_id,
            "error": "insufficient_audio",
            "useful_seconds": self.useful_seconds,
            "min_required_seconds": minimo,
            "dataset_chunks": self.dataset_chunks,
        }

    def _medir_pausa_natural(self):
        from voice_pipeline.pacing import measure_natural_pause_ms

        return measure_natural_pause_ms(
            sorted(self.dirs.norm.glob("*_mono16k.wav")),
            log=lambda **k: _log(k.pop("level", "info"), k.pop("event", "train.pacing"), **k),
        )

    def _transcrever_dataset(self) -> None:
        from voice_pipeline import transcribe_audio_folder

        _log("info", "train.whisper.start", model=self.whisper_model)
        transcribe_audio_folder(
            self.dirs.dataset,
            model_name=self.whisper_model,
            language=self.language,
            log=lambda m: _log("info", "whisper", detail=m),
        )
        _log("info", "train.whisper.done")

    def _treinar(self) -> dict:
        from voice_pipeline import build_train_manifest, create_training_config, run_training

        manifest = build_train_manifest(self.dirs.dataset)
        config = create_training_config(
            VOXCPM_REPO,
            manifest,
            MODEL_DIR,
            save_path=self.dirs.lora_runs / self.run_name,
            run_name=self.run_name,
            max_steps=self.max_steps,
            save_interval=self.save_interval,
            lora_rank=LORA_RANK,
            lora_alpha=TRAIN_LORA_ALPHA,
        )
        _log("info", "train.trainer.start", config=str(config), max_steps=self.max_steps,
             lora_rank=LORA_RANK, lora_alpha=TRAIN_LORA_ALPHA)
        resultado = run_training(VOXCPM_REPO, config,
                                 log=lambda m: _log("info", "trainer", detail=m))
        _log("info", "train.trainer.done", returncode=resultado["returncode"])
        return resultado

    def _achar_lora(self) -> Path | None:
        destino = self.dirs.lora_runs / self.run_name
        latest = destino / "latest" / "lora_weights.safetensors"
        if latest.exists():
            return latest
        # fallback: pega o maior step_*
        steps = sorted(destino.glob("step_*/lora_weights.safetensors"))
        return steps[-1] if steps else None

    def _subir_lora(self, lora: Path) -> None:
        from voice_pipeline import upload_file_to_presigned_url

        _log("info", "train.upload.start", file=str(lora))
        upload_file_to_presigned_url(lora, self.lora_upload_url,
                                     content_type="application/octet-stream")
        _log("info", "train.upload.done")

    def _resultado(self, ref, amostra: dict) -> dict:
        return {
            "voice_id": self.voice_id,
            "lora_uploaded": True,
            "elapsed_seconds": round(time.monotonic() - self.t0, 2),
            "steps": self.max_steps,
            "trainer_returncode": 0,
            "dataset_chunks": self.dataset_chunks,
            "useful_seconds": self.useful_seconds,
            "reference_uploaded": ref.uploaded,
            "reference_transcript": ref.transcript,
            "reference_error": ref.error,
            "reference_pause_ms": self.reference_pause_ms,
            "language": self.language,
            "lora_alpha": TRAIN_LORA_ALPHA,
            "lora_rank": LORA_RANK,
            **amostra,
        }
