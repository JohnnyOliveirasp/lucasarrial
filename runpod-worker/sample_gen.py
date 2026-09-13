# -*- coding: utf-8 -*-
"""
Amostra automática pós-treino: gera ~10s de fala com a LoRA recém-treinada
(modelo já na máquina, referência já selecionada) e sobe pro R2 via presigned
URL. Custa centavos e deixa o usuário OUVIR a voz antes de gastar créditos —
anti-churn. Falha aqui NUNCA derruba o treino (best-effort, erro registrado).
"""
from pathlib import Path

# ⚠️ ESTE TEXTO TEM DE SER NEUTRO ENTRE PT-BR E PT-PT — incidente #380.
# O modelo pronuncia o que lê: texto escrito em brasileiro sai com FONÉTICA
# brasileira, mesmo quando a LoRA foi treinada com um locutor português. A
# versão anterior era brasileira marcada ("Oi", "você está me ouvindo",
# "o treinamento") e, como esta amostra é a PRIMEIRA coisa que o aluno ouve
# da própria voz, um cliente de Portugal concluía que o clone dele tinha
# saído com sotaque do Brasil e que o treino estava estragado.
#
# Medido em 13/09 no caso Ricardo (voz fe59f698, ricardo@inventivebox.pt):
# a referência dele e a geração com texto dele saíram em português EUROPEU;
# só a amostra da casa saiu brasileira. O clone estava certo o tempo todo —
# quem estava errado era o nosso guião.
#
# Regra ao mexer aqui: nada de "Oi"/"você"/"tu", nada de gerúndio progressivo
# ("está ouvindo" × "está a ouvir") e nada de "treinamento"/"treino". 3ª pessoa
# resolve os três de uma vez. O teste `test_amostra_pt_e_neutra` prende isto.
DEFAULT_SAMPLE_TEXT = (
    "Olá. Esta é a minha voz clonada. Se o som está claro e natural, "
    "o resultado final vai soar assim."
)

# Amostra no IDIOMA da voz (caso Joana 2026-07-21: voz espanhola recebia a
# amostra falada em português). Fallback = inglês pra idiomas sem tradução.
# ⚠️ A chave é só o IDIOMA (`split("-")[0]`), nunca a variante: o whisper do
# treino devolve "pt", jamais "pt-PT", então uma entrada "pt-PT" aqui seria
# código morto com cara de conserto. A variante resolve-se mantendo o texto
# de "pt" neutro (acima), não inventando uma chave que nunca é consultada.
SAMPLE_TEXTS = {
    "pt": DEFAULT_SAMPLE_TEXT,
    "es": (
        "¡Hola! Esta es mi voz clonada. Si me escuchas con claridad, "
        "el entrenamiento funcionó muy bien."
    ),
    "en": (
        "Hi! This is my cloned voice. If you can hear me clearly, "
        "the training worked very well."
    ),
}


def sample_text_for(language: str | None) -> str:
    key = (language or "pt").lower().split("-")[0]
    return SAMPLE_TEXTS.get(key, SAMPLE_TEXTS["en"])


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
    finally:
        # Solta a VRAM do modelo da amostra: o worker é quente e serve treino
        # e inferência — modelo esquecido na GPU = OOM pro próximo job.
        import gc
        try:
            del model
        except NameError:
            pass
        gc.collect()
        try:
            import torch
            torch.cuda.empty_cache()
        except Exception:
            pass
