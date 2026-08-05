# Upscale 4x da foto de referência (Real-ESRGAN x4plus via spandrel).
# Roda DENTRO do venv do volume (spandrel/torch instalados lá).
# Uso: python upscale.py <src> <dst>
# Regras: foto já grande (lado menor >= 1500px) passa direto; saída limitada a
# ~6000px no lado maior (o modelo condiciona em 480x832 — mais que isso é peso morto).
import sys

import cv2
import torch
from spandrel import ModelLoader

SRC, DST = sys.argv[1], sys.argv[2]
CKPT = "/workspace/esrgan/RealESRGAN_x4plus.pth"
MAX_SIDE = 6000

img = cv2.imread(SRC)
if img is None:
    raise SystemExit(f"imagem ilegível: {SRC}")
h, w = img.shape[:2]

if min(h, w) >= 1500:
    cv2.imwrite(DST, img)
    print(f"skip (já grande): {w}x{h}")
    raise SystemExit(0)

model = ModelLoader().load_from_file(CKPT).cuda().eval()
t = torch.from_numpy(img[..., ::-1].copy()).permute(2, 0, 1).float().div(255).unsqueeze(0).cuda()
with torch.no_grad():
    out = model(t)
out = (out.squeeze(0).permute(1, 2, 0).clamp(0, 1).cpu().numpy()[..., ::-1] * 255).round().astype("uint8")

oh, ow = out.shape[:2]
if max(oh, ow) > MAX_SIDE:
    scale = MAX_SIDE / max(oh, ow)
    out = cv2.resize(out, (int(ow * scale), int(oh * scale)), interpolation=cv2.INTER_AREA)

cv2.imwrite(DST, out)
print(f"upscale: {w}x{h} -> {out.shape[1]}x{out.shape[0]}")
