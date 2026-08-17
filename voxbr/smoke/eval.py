# VoxBR smoke — teste cego: mesmas frases na base ORIGINAL vs base BR.
# Roda no pod. Saída: /root/eval/{frase}_{A|B}.wav + key.json (mapa cego).
import json, random, gc, sys
import soundfile as sf
import torch
from voxcpm.core import VoxCPM

SENTENCES = {
    "vendas": "Você sabia que uma única diária em um hospital pode custar mais de três mil reais? Proteger a sua família é mais barato do que você imagina.",
    "fonetica": "O coração do brasileiro é acolhedor: churrasco no domingo, pão de queijo quentinho e um abraço apertado de quem a gente ama.",
    "numeros": "Em dois mil e vinte e seis, mais de quatrocentos alunos criaram vinte e três mil áudios na nossa plataforma.",
    "hesitacao": "Às vezes o plano mais caro não é o mais adequado, e pagar um pouco mais evita limitações que só aparecem no pior momento.",
}

# Ref pública do próprio CML (1º clipe do manifest) pro modo clonagem.
first = json.loads(open("/workspace/data/train.jsonl", encoding="utf-8").readline())
REF_AUDIO, REF_TEXT = first["audio"], first["text"]

MODELS = {"base": "/workspace/VoxCPM2", "br": sys.argv[1] if len(sys.argv) > 1 else "/root/ckpt/latest"}

import os
os.makedirs("/root/eval", exist_ok=True)
key = {}
# sorteia qual modelo vira A e qual vira B, POR FRASE (cego de verdade)
for name, path in MODELS.items():
    print(f"== carregando {name}: {path}", flush=True)
    model = VoxCPM(voxcpm_model_path=path, enable_denoiser=False)
    for sid, text in SENTENCES.items():
        for mode in ("zero", "clone"):
            kwargs = dict(text=text)
            if mode == "clone":
                kwargs.update(prompt_wav_path=REF_AUDIO, prompt_text=REF_TEXT)
            wav = model.generate(**kwargs)
            sf.write(f"/root/eval/tmp_{sid}_{mode}_{name}.wav", wav, model.tts_model.sample_rate)
            print(f"  {sid}/{mode} ok", flush=True)
    del model
    gc.collect(); torch.cuda.empty_cache()

# renomeia pro cego A/B
for sid in SENTENCES:
    for mode in ("zero", "clone"):
        order = random.sample(["base", "br"], 2)
        for label, name in zip(("A", "B"), order):
            os.rename(f"/root/eval/tmp_{sid}_{mode}_{name}.wav", f"/root/eval/{sid}_{mode}_{label}.wav")
        key[f"{sid}_{mode}"] = {"A": order[0], "B": order[1]}
json.dump(key, open("/root/eval/key.json", "w"), indent=1)
print("EVAL_PRONTO")
