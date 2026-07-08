# -*- coding: utf-8 -*-
"""
Amostra automática pós-treino: gera ~10s de fala com a LoRA recém-treinada
(modelo já na máquina, referência já selecionada) e sobe pro R2 via presigned
URL. Custa centavos e deixa o usuário OUVIR a voz antes de gastar créditos —
anti-churn. Falha aqui NUNCA derruba o treino (best-effort, erro registrado).
"""
from pathlib import Path

DEFAULT_SAMPLE_TEXT = (
    "Oi! Esta é a minha voz clonada. Se você está me ouvindo com clareza, "
    "o treinamento funcionou muito bem."
)


def generate_training_sample(
    *,
    model_dir: Path,
    lora_path: Path,
    lora_rank: int,
    lora_alpha: int,
    ref_wav: Path | None,
    ref_text: str | None,
    sample_text: str,
    upload_url: str,
    work_dir: Path,
    log,
) -> dict:
    """Gera a amostra e sobe. Devolve {'sample_uploaded': bool, 'sample_seconds': float|None,
    'sample_error': str|None} — o handler anexa isso no resultado do treino."""
    import numpy as np
    import soundfile as sf
    from voice_pipeline import upload_file_to_presigned_url
    from voxcpm import VoxCPM
    from voxcpm.model.voxcpm import LoRAConfig

    try:
        lora_cfg = LoRAConfig(
            enable_lm=True, enable_dit=True, enable_proj=False,
            r=lora_rank, alpha=lora_alpha,
        )
        log(event="sample.load.start")
        model = VoxCPM.from_pretrained(
            str(model_dir),
            load_denoiser=False,
            optimize=True,
            lora_config=lora_cfg,
            lora_weights_path=str(lora_path),
        )
        sample_rate = model.tts_model.sample_rate

        kwargs = {}
        # Continuation mode (ref + transcript) = mesma receita da inferência.
        if ref_wav is not None and ref_text:
            kwargs["prompt_wav_path"] = str(ref_wav)
            kwargs["prompt_text"] = ref_text

        log(event="sample.generate.start", chars=len(sample_text))
        wav = model.generate(
            text=sample_text,
            cfg_value=1.6,
            inference_timesteps=15,
            normalize=False,
            **kwargs,
        )
        wav = np.asarray(wav, dtype="float32").reshape(-1)
        seconds = round(len(wav) / sample_rate, 2)

        work_dir.mkdir(parents=True, exist_ok=True)
        out = work_dir / "training_sample.wav"
        sf.write(str(out), wav, sample_rate)

        log(event="sample.upload.start", seconds=seconds)
        upload_file_to_presigned_url(out, upload_url, content_type="audio/wav")
        log(event="sample.done", seconds=seconds)
        return {"sample_uploaded": True, "sample_seconds": seconds, "sample_error": None}
    except Exception as exc:  # best-effort: treino já foi um sucesso
        log(level="error", event="sample.failed", error=str(exc))
        return {"sample_uploaded": False, "sample_seconds": None, "sample_error": str(exc)[:300]}
