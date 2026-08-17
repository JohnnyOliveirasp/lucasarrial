#!/usr/bin/env python3
"""
VoxBR TREINO TAGARELA — amostra de 1 checkpoint (chamado pelo vigia).
Uso: python amostra_tagarela.py <ckpt_dir> <saida.wav>
Frase FIXA (a mesma em todos os checkpoints — o que importa é a TENDÊNCIA da
duração; alvo ~9-11s, o v1 doente fazia 16-50s). Zero-shot, sem denoiser.
Roda na MESMA GPU do treino (sobra ~35GB na placa de 80) — se der OOM, o
vigia só loga FALHOU e o treino nem percebe.
"""
import sys
import soundfile as sf
from voxcpm.core import VoxCPM

FRASE = (
    "Você sabia que uma única diária em um hospital pode custar mais de três "
    "mil reais? Proteger a sua família é mais barato do que você imagina."
)

ckpt, saida = sys.argv[1], sys.argv[2]
model = VoxCPM(voxcpm_model_path=ckpt, enable_denoiser=False)
wav = model.generate(text=FRASE)
sf.write(saida, wav, model.tts_model.sample_rate)
print(f"DURACAO_S={len(wav) / model.tts_model.sample_rate:.2f}", flush=True)
