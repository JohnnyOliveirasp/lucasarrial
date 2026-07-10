"""Vídeo Estúdio F2 — acabamento: legenda karaokê + música com ducking.

Porte de EXPORT_PLATAFORMA/codigo_fonte/core/legenda.py e video.py
(musica_com_ducking), regras D e E do 01_EDICAO_REGRAS.md:
  D1 grupos curtos (1-2 palavras), branca bold com contorno fino
  D2 legenda acaba QUANDO a fala acaba (hold mínimo +0,08s)
  D3 legenda NUNCA atravessa uma troca de cena (clamp na lista de cortes)
  D4 supressão em janelas com texto na cena (F3 — via suppress_windows)
  E1 música em t=0 · E2 ducking moderado (nunca some) · E3 boom de abertura
  QA limiter de segurança no master

Legenda = PNG por grupo (PIL) + overlay ffmpeg em lotes (sem libass/drawtext —
gotcha registrado no estúdio do Lucas).
"""

from __future__ import annotations

import os
import re
import subprocess
import tempfile
from pathlib import Path

W, H = 1080, 1920
FONT_PATH = os.environ.get(
    "STUDIO_CAPTION_FONT", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
)
CAPTION_SIZE = 72
Y_FRAC = 0.68          # centro-baixo
MAX_WORDS = 2
MAX_GROUP_DUR = 1.1


def _run(cmd: list[str]) -> None:
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(f"ffmpeg: {r.stderr.strip()[-400:]}")


def _groups(words: list[dict]) -> list[list[dict]]:
    """Agrupa palavras em blocos curtos respeitando pausas e pontuação (D1)."""
    gs: list[list[dict]] = []
    cur: list[dict] = []
    for w in words:
        if not w["word"].strip():
            continue
        if cur:
            gap = w["start"] - cur[-1]["end"]
            dur = w["end"] - cur[0]["start"]
            closes = re.search(r"[.!?…]$", cur[-1]["word"].strip())
            if gap > 0.55 or dur > MAX_GROUP_DUR or len(cur) >= MAX_WORDS or closes:
                gs.append(cur)
                cur = []
        cur.append(w)
    if cur:
        gs.append(cur)
    return gs


def _group_png(palavras: list[dict], out_png: Path) -> Path:
    """PNG transparente 1080x1920 com o grupo centralizado no centro-baixo."""
    from PIL import Image, ImageDraw, ImageFont

    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    font = ImageFont.truetype(FONT_PATH, CAPTION_SIZE)
    toks = [w["word"].strip() for w in palavras]

    max_w = int(W * 0.86)
    lines: list[list[str]] = []
    cur: list[str] = []
    for t in toks:
        wpx = d.textlength(t + " ", font=font)
        curw = sum(d.textlength(x + " ", font=font) for x in cur)
        if cur and curw + wpx > max_w:
            lines.append(cur)
            cur = []
        cur.append(t)
    if cur:
        lines.append(cur)

    lh = int(CAPTION_SIZE * 1.25)
    y0 = int(H * Y_FRAC - lh * len(lines) / 2)
    stroke = max(2, int(CAPTION_SIZE * 0.06))
    for i, ln in enumerate(lines):
        lw = sum(d.textlength(t + " ", font=font) for t in ln) - d.textlength(" ", font=font)
        x = (W - lw) / 2
        for t in ln:
            d.text((x, y0 + i * lh), t, font=font,
                   fill=(255, 255, 255, 255), stroke_width=stroke,
                   stroke_fill=(0, 0, 0, 220))
            x += d.textlength(t + " ", font=font)
    img.save(out_png)
    return out_png


def burn_karaoke(
    video_in: Path,
    words: list[dict],
    video_out: Path,
    cuts: list[float],
    suppress_windows: list[tuple[float, float]] | None = None,
    batch: int = 30,
) -> Path:
    """Queima a legenda karaokê em lotes de overlays (filtergraph pequeno).
    `cuts` = timestamps de troca de cena (D3). `suppress_windows` = janelas
    onde a cena já tem texto (D4) — nenhum grupo aparece dentro delas."""
    cuts = sorted(cuts or [])
    sup = suppress_windows or []
    groups = _groups(words)
    tmp = Path(tempfile.mkdtemp(prefix="karaoke_"))

    items: list[tuple[Path, float, float]] = []
    for i, g in enumerate(groups):
        mid = (g[0]["start"] + g[-1]["end"]) / 2
        if any(lo <= mid <= hi for lo, hi in sup):
            continue  # D4
        ini = g[0]["start"]
        fim = g[-1]["end"] + 0.08                     # D2: acaba com a fala
        if i + 1 < len(groups):                        # nunca invade o próximo
            fim = min(fim, groups[i + 1][0]["start"] - 0.06)
        for c in cuts:                                 # D3: clamp no corte
            if ini < c < fim:
                fim = c - 0.02
                break
        fim = max(fim, g[-1]["end"] - 0.02)
        png = _group_png(g, tmp / f"g{i:03d}.png")
        items.append((png, round(ini, 2), round(fim, 2)))

    src = video_in
    for base in range(0, len(items), batch):
        chunk = items[base:base + batch]
        dst = video_out if base + batch >= len(items) else tmp / f"pass{base}.mp4"
        cmd = ["ffmpeg", "-y", "-loglevel", "error", "-i", str(src)]
        for png, _, _ in chunk:
            cmd += ["-i", str(png)]
        fc, last = [], "0:v"
        for j, (_, a, b) in enumerate(chunk):
            out = f"v{j}"
            fc.append(f"[{last}][{j + 1}:v]overlay=0:0:enable='between(t,{a},{b})'[{out}]")
            last = out
        cmd += ["-filter_complex", ";".join(fc), "-map", f"[{last}]", "-map", "0:a?",
                "-c:v", "libx264", "-preset", "veryfast", "-crf", "18",
                "-pix_fmt", "yuv420p", "-c:a", "copy", str(dst)]
        _run(cmd)
        src = dst
    return video_out


def mix_music(video_in: Path, music: Path, out: Path,
              music_db: int = -18, ratio: int = 4, boom: bool = True) -> Path:
    """E1-E3 + QA: trilha em loop desde t=0, sidechain ducking moderado (a
    música NUNCA some), boom ~2x decaindo até 1,2s, limiter no master."""
    pos_duck = ("volume='if(lt(t,1.2),2.0-0.8333*t,1)':eval=frame," if boom else "")
    fc = (f"[1:a]volume={music_db}dB,aloop=loop=-1:size=2e9[m];"
          f"[m][0:a]sidechaincompress=threshold=0.1:ratio={ratio}:attack=50:release=400"
          f":makeup=1[d0];[d0]{pos_duck}anull[duck];"
          f"[0:a][duck]amix=inputs=2:duration=first:dropout_transition=2,"
          f"alimiter=limit=0.95[a]")
    _run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(video_in), "-i", str(music),
          "-filter_complex", fc, "-map", "0:v", "-map", "[a]",
          "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", str(out)])
    return out
