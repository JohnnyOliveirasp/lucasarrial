"""Máquina de Edição — E4 (jobs: caption_variants e slides).

caption_variants (§2.8 da MAQUINA_EDICAO_AUTOMATICA.md): 1 vídeo pronto vira
N variações trocando SÓ a legenda estática de hook queimada — custo ~zero por
variação (só ffmpeg). Padrão validado: hook no topo (yfrac ≈ 0.14), branco
bold com contorno preto grosso; variações podem testar o meio (0.50).

slides (§2.9): artes de slide no design da marca renderizadas por PIL (preto
puro, título forte, barra laranja, bullets) — estados progressivos: 1 design
com N bullets vira N PNGs (bullets entrando um a um). SEMPRE estáticos.

Inputs:
  caption_variants: { video_url, variants: [{text, yfrac?}],
                      output_upload_urls: [PUT...] }   (mesma ordem)
  slides:           { slides: [{title, bullets: [..]}], width?, height?,
                      progressive?: bool, output_upload_urls: [PUT...] }
"""

from __future__ import annotations

import subprocess
import tempfile
from pathlib import Path

from voice_pipeline.r2 import download_to_dir, upload_file_to_presigned_url
from finish import video_size, FONT_PATH

ACCENT = (255, 106, 0, 255)   # laranja FastCloner
INK = (244, 244, 242, 255)
BG = (10, 10, 10, 255)


def _run(cmd: list[str]) -> None:
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(f"ffmpeg: {r.stderr.strip()[-400:]}")


def _duration(path: Path) -> float:
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                        "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
                       capture_output=True, text=True)
    return float(r.stdout.strip())


def _wrap(d, text: str, font, max_w: int) -> list[str]:
    lines, cur = [], ""
    for tok in text.split():
        cand = f"{cur} {tok}".strip()
        if cur and d.textlength(cand, font=font) > max_w:
            lines.append(cur)
            cur = tok
        else:
            cur = cand
    if cur:
        lines.append(cur)
    return lines


def hook_png(text: str, size: tuple[int, int], yfrac: float, out: Path) -> Path:
    """Legenda estática de hook: bold, branca, contorno preto grosso (~7)."""
    from PIL import Image, ImageDraw, ImageFont

    W, H = size
    px = max(28, int(H * 0.042))
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    font = ImageFont.truetype(FONT_PATH, px)
    lines = _wrap(d, text, font, int(W * 0.86))
    lh = int(px * 1.22)
    y0 = int(H * yfrac - lh * len(lines) / 2)
    stroke = max(4, int(px * 0.10))
    for i, ln in enumerate(lines):
        lw = d.textlength(ln, font=font)
        d.text(((W - lw) / 2, y0 + i * lh), ln, font=font, fill=(255, 255, 255, 255),
               stroke_width=stroke, stroke_fill=(0, 0, 0, 235))
    img.save(out)
    return out


def handle_caption_variants(inp: dict, log) -> dict:
    video_url = inp.get("video_url")
    variants = inp.get("variants") or []
    put_urls = inp.get("output_upload_urls") or []
    if not video_url or not variants or len(put_urls) != len(variants):
        return {"error": "missing/mismatched 'video_url'/'variants'/'output_upload_urls'"}

    job_dir = Path(tempfile.mkdtemp(prefix="variants_"))
    video = download_to_dir([video_url], job_dir / "in")[0]
    size = video_size(video)
    base_dur = _duration(video)

    done = []
    for i, v in enumerate(variants):
        text = str(v.get("text") or "").strip()
        yfrac = float(v.get("yfrac", 0.14))
        out = job_dir / f"variant_{i:02d}.mp4"
        if text:
            png = hook_png(text, size, yfrac, job_dir / f"hook_{i:02d}.png")
            _run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(video),
                  "-i", str(png), "-filter_complex", "[0:v][1:v]overlay=0:0[v]",
                  "-map", "[v]", "-map", "0:a?",
                  "-c:v", "libx264", "-preset", "veryfast", "-crf", "18",
                  "-pix_fmt", "yuv420p", "-c:a", "copy", str(out)])
        else:  # variação "sem hook" = cópia re-encodada (limpa metadata)
            _run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(video),
                  "-c:v", "libx264", "-preset", "veryfast", "-crf", "18",
                  "-pix_fmt", "yuv420p", "-c:a", "copy", str(out)])
        if abs(_duration(out) - base_dur) > 0.1:
            return {"error": f"variant {i}: duração mudou no pós-passe (>0,1s)"}
        upload_file_to_presigned_url(out, put_urls[i], content_type="video/mp4")
        done.append({"index": i, "text": text[:80], "yfrac": yfrac})
        log("info", "variants.done", index=i, total=len(variants))

    return {"caption_variants": True, "count": len(done), "variants": done}


def slide_png(title: str, bullets: list[str], size: tuple[int, int], out: Path) -> Path:
    from PIL import Image, ImageDraw, ImageFont

    W, H = size
    img = Image.new("RGBA", (W, H), BG)
    d = ImageDraw.Draw(img)
    tfont = ImageFont.truetype(FONT_PATH, max(36, int(H * 0.055)))
    bfont = ImageFont.truetype(FONT_PATH, max(26, int(H * 0.034)))
    x = int(W * 0.09)
    y = int(H * 0.16)
    d.rectangle([x, y, x + int(W * 0.10), y + max(6, int(H * 0.006))], fill=ACCENT)
    y += int(H * 0.03)
    for ln in _wrap(d, title, tfont, int(W * 0.82)):
        d.text((x, y), ln, font=tfont, fill=INK)
        y += int(tfont.size * 1.2)
    y += int(H * 0.04)
    for b in bullets:
        d.ellipse([x, y + bfont.size * 0.35, x + bfont.size * 0.3,
                   y + bfont.size * 0.65], fill=ACCENT)
        bx = x + int(bfont.size * 0.8)
        for ln in _wrap(d, b, bfont, int(W * 0.78)):
            d.text((bx, y), ln, font=bfont, fill=(157, 157, 151, 255))
            y += int(bfont.size * 1.35)
        y += int(bfont.size * 0.4)
    img.save(out)
    return out


def handle_slides(inp: dict, log) -> dict:
    slides = inp.get("slides") or []
    put_urls = inp.get("output_upload_urls") or []
    W = int(inp.get("width", 1080))
    H = int(inp.get("height", 1920))
    progressive = bool(inp.get("progressive", True))

    # Progressivo (§2.9): 1 slide com N bullets vira N artes (bullets entrando
    # um a um). A lista de uploads tem que bater com o total expandido.
    expanded: list[tuple[str, list[str]]] = []
    for s in slides:
        title = str(s.get("title") or "").strip()
        bullets = [str(b).strip() for b in (s.get("bullets") or []) if str(b).strip()]
        if progressive and bullets:
            for n in range(1, len(bullets) + 1):
                expanded.append((title, bullets[:n]))
        else:
            expanded.append((title, bullets))
    if not expanded or len(put_urls) != len(expanded):
        return {"error": f"'output_upload_urls' ({len(put_urls)}) != slides expandidos ({len(expanded)})"}

    job_dir = Path(tempfile.mkdtemp(prefix="slides_"))
    for i, (title, bullets) in enumerate(expanded):
        png = slide_png(title, bullets, (W, H), job_dir / f"slide_{i:02d}.png")
        upload_file_to_presigned_url(png, put_urls[i], content_type="image/png")
        log("info", "slides.done", index=i, total=len(expanded))
    return {"slides": True, "count": len(expanded)}
