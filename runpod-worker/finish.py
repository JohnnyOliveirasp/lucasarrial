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

FONT_PATH = os.environ.get(
    "STUDIO_CAPTION_FONT", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
)
# Tamanho relativo à ALTURA real do vídeo (72px em 1920 ≈ 3,75%). A resolução
# NUNCA é fixa: era hardcoded 1080x1920 e em vídeo horizontal a legenda caía
# fora do quadro (bug real registrado na MAQUINA_EDICAO_AUTOMATICA.md §3.4).
CAPTION_SIZE_FRAC = 0.0375
Y_FRAC = 0.68          # centro-baixo
MAX_WORDS = 2
MAX_GROUP_DUR = 1.1

# ── Estilos de legenda (13/08) ───────────────────────────────────────────────
# caption_style opcional no job espelha os SUBTITLE_PRESETS do app (fonte via
# URL + cores + posição + tamanho). SEM o campo, o comportamento é IDÊNTICO ao
# de sempre (branca bold, contorno preto, centro-baixo) — mudança aditiva.

_POSITION_Y = {"bottom": 0.80, "center": 0.50, "top": 0.18}


def _hex_rgba(v, fallback):
    """'#RRGGBB' ou [r,g,b,a] → tupla RGBA do PIL."""
    if isinstance(v, (list, tuple)) and len(v) in (3, 4):
        r, g, b = int(v[0]), int(v[1]), int(v[2])
        a = int(v[3]) if len(v) == 4 else 255
        return (r, g, b, a)
    if isinstance(v, str) and re.fullmatch(r"#?[0-9a-fA-F]{6}", v.strip()):
        s = v.strip().lstrip("#")
        return (int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16), 255)
    return fallback


def parse_caption_style(style: dict | None, tmp: Path) -> dict:
    """Normaliza o caption_style do job (baixa a fonte, resolve cores/posição).
    Nunca lança: qualquer campo inválido cai no padrão antigo."""
    st = {
        "font_path": FONT_PATH,
        "color": (255, 255, 255, 255),
        "active": None,          # cor da palavra sendo falada (karaokê real)
        "stroke": (0, 0, 0, 220),
        "box": None,             # RGBA da faixa atrás do texto (estilo boxed)
        "upper": False,
        "y_frac": Y_FRAC,
        "size_mult": 1.0,
        "max_words": MAX_WORDS,
    }
    if not isinstance(style, dict):
        return st
    url = style.get("font_url")
    if isinstance(url, str) and url.startswith("http"):
        try:
            import urllib.request
            from worker_log import WORKER_USER_AGENT
            dst = tmp / "caption_font.ttf"
            # urlretrieve não aceita header: com o UA padrão do urllib a
            # Cloudflare devolve 403 e a legenda caía na fonte padrão em
            # silêncio (mesmo portão do heartbeat de fase — #15, 28/08).
            req = urllib.request.Request(url, headers={"User-Agent": WORKER_USER_AGENT})
            with urllib.request.urlopen(req, timeout=20) as resp:  # noqa: S310 — URL nossa
                dst.write_bytes(resp.read())
            if dst.stat().st_size > 1000:
                st["font_path"] = str(dst)
        except Exception:
            pass  # segue com a fonte padrão
    st["color"] = _hex_rgba(style.get("color"), st["color"])
    if style.get("active_color"):
        st["active"] = _hex_rgba(style.get("active_color"), None)
    st["stroke"] = _hex_rgba(style.get("stroke"), st["stroke"])
    if style.get("box_rgba") is not None:
        st["box"] = _hex_rgba(style.get("box_rgba"), None)
    st["upper"] = style.get("uppercase") is True
    st["y_frac"] = _POSITION_Y.get(style.get("position"), st["y_frac"])
    try:
        m = float(style.get("size_mult") or 1.0)
        if 0.5 <= m <= 2.5:
            st["size_mult"] = m
    except (TypeError, ValueError):
        pass
    try:
        mw = int(style.get("max_words") or MAX_WORDS)
        if 1 <= mw <= 4:
            st["max_words"] = mw
    except (TypeError, ValueError):
        pass
    return st


def _run(cmd: list[str]) -> None:
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(f"ffmpeg: {r.stderr.strip()[-400:]}")


def video_size(path: Path) -> tuple[int, int]:
    """(w, h) reais do stream de vídeo, via ffprobe."""
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0",
                        "-show_entries", "stream=width,height", "-of", "csv=p=0",
                        str(path)], capture_output=True, text=True)
    w, h = r.stdout.strip().split(",")[:2]
    return int(w), int(h)


def _groups(words: list[dict], max_words: int = MAX_WORDS) -> list[list[dict]]:
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
            if gap > 0.55 or dur > MAX_GROUP_DUR or len(cur) >= max_words or closes:
                gs.append(cur)
                cur = []
        cur.append(w)
    if cur:
        gs.append(cur)
    return gs


def _group_png(
    palavras: list[dict],
    out_png: Path,
    size: tuple[int, int],
    style: dict | None = None,
    active_index: int | None = None,
) -> Path:
    """PNG transparente NA RESOLUÇÃO REAL do vídeo. `style` (parse_caption_style)
    controla fonte/cores/posição/tamanho; `active_index` pinta a palavra sendo
    falada com a cor de destaque (karaokê real dos presets Hormozi etc.)."""
    from PIL import Image, ImageDraw, ImageFont

    st = style or parse_caption_style(None, out_png.parent)
    W, H = size
    caption_px = max(24, int(H * CAPTION_SIZE_FRAC * st["size_mult"]))
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    font = ImageFont.truetype(st["font_path"], caption_px)
    toks = [w["word"].strip() for w in palavras]
    if st["upper"]:
        toks = [t.upper() for t in toks]

    max_w = int(W * 0.86)
    lines: list[list[tuple[int, str]]] = []
    cur: list[tuple[int, str]] = []
    for idx, t in enumerate(toks):
        wpx = d.textlength(t + " ", font=font)
        curw = sum(d.textlength(x + " ", font=font) for _, x in cur)
        if cur and curw + wpx > max_w:
            lines.append(cur)
            cur = []
        cur.append((idx, t))
    if cur:
        lines.append(cur)

    lh = int(caption_px * 1.25)
    y0 = int(H * st["y_frac"] - lh * len(lines) / 2)
    stroke = max(2, int(caption_px * 0.06))

    # Faixa atrás do texto (estilo boxed) — cobre o bloco inteiro com folga.
    if st["box"]:
        pad = int(caption_px * 0.35)
        widest = max(
            sum(d.textlength(t + " ", font=font) for _, t in ln) - d.textlength(" ", font=font)
            for ln in lines
        )
        x0 = (W - widest) / 2 - pad
        d.rectangle(
            [x0, y0 - pad, x0 + widest + 2 * pad, y0 + lh * len(lines) + pad],
            fill=tuple(st["box"]),
        )

    for i, ln in enumerate(lines):
        lw = sum(d.textlength(t + " ", font=font) for _, t in ln) - d.textlength(" ", font=font)
        x = (W - lw) / 2
        for idx, t in enumerate([t for _, t in ln]):
            tok_idx = ln[idx][0]
            cor = st["active"] if (st["active"] and tok_idx == active_index) else st["color"]
            d.text((x, y0 + i * lh), t, font=font,
                   fill=tuple(cor), stroke_width=0 if st["box"] else stroke,
                   stroke_fill=tuple(st["stroke"]))
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
    style: dict | None = None,
) -> Path:
    """Queima a legenda karaokê em lotes de overlays (filtergraph pequeno).
    `cuts` = timestamps de troca de cena (D3). `suppress_windows` = janelas
    onde a cena já tem texto (D4) — nenhum grupo aparece dentro delas.
    `style` (caption_style do job) muda fonte/cores/posição — sem ele, o
    visual é o de sempre. Preset com active_color vira karaokê REAL: um
    overlay por palavra, com a palavra falada na cor de destaque."""
    cuts = sorted(cuts or [])
    sup = suppress_windows or []
    tmp = Path(tempfile.mkdtemp(prefix="karaoke_"))
    st = parse_caption_style(style, tmp)
    groups = _groups(words, st["max_words"])
    size = video_size(video_in)  # resolução REAL — nunca assumir 1080x1920

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
        if st["active"] and len(g) > 1:
            # Karaokê real: fatia a janela do grupo nas fronteiras entre
            # palavras (ponto médio fala→fala) — cada fatia com a palavra
            # da vez acesa. Grupos têm ≤4 palavras, o nº de overlays segue
            # pequeno e o batch existente absorve.
            bounds = [ini]
            for j in range(len(g) - 1):
                bounds.append(max(ini, min(fim, (g[j]["end"] + g[j + 1]["start"]) / 2)))
            bounds.append(fim)
            for j in range(len(g)):
                a, b = bounds[j], bounds[j + 1]
                if b - a < 0.05:
                    continue
                png = _group_png(g, tmp / f"g{i:03d}w{j}.png", size, st, active_index=j)
                items.append((png, round(a, 2), round(b, 2)))
        else:
            png = _group_png(g, tmp / f"g{i:03d}.png", size, st,
                             active_index=0 if st["active"] else None)
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
    música NUNCA some), boom ~2x decaindo até 1,2s, limiter no master.
    13/08 (Johnny): fade-out da TRILHA nos últimos 1,5s — só a música decai;
    a voz não é tocada (antes a música cortava seca junto com o -shortest)."""
    dur = float(subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "csv=p=0", str(video_in)],
        capture_output=True, text=True).stdout.strip() or 0)
    fade = f"afade=t=out:st={max(0.0, dur - 1.5):.3f}:d=1.5," if dur > 3 else ""
    pos_duck = ("volume='if(lt(t,1.2),2.0-0.8333*t,1)':eval=frame," if boom else "")
    fc = (f"[1:a]volume={music_db}dB,aloop=loop=-1:size=2e9[m];"
          f"[m][0:a]sidechaincompress=threshold=0.1:ratio={ratio}:attack=50:release=400"
          f":makeup=1[d0];[d0]{pos_duck}{fade}anull[duck];"
          f"[0:a][duck]amix=inputs=2:duration=first:dropout_transition=2,"
          f"alimiter=limit=0.95[a]")
    _run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(video_in), "-i", str(music),
          "-filter_complex", fc, "-map", "0:v", "-map", "[a]",
          "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", str(out)])
    return out
