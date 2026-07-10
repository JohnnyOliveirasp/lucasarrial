"""Vídeo Estúdio F1 — motor de montagem (job type: montage).

Porte do montador de referência do Lucas (EXPORT_PLATAFORMA/codigo_fonte/
modos_organico/montar_n5_v3.py), regras B/C/G/H do 01_EDICAO_REGRAS.md:
  B1  J-cut: a cena entra ~0,30s ANTES da palavra-âncora
  B2  o corte nunca revela silêncio: entrada ancorada no fim da última palavra
  B4  zero gaps entre cortes (na F1 as cenas cobrem o áudio inteiro)
  C1  nenhum plano parado >2,5s: fatia em sub-planos (offset+zoom diferentes)
  G1  zoom leve e contínuo em todo plano (rampa 1.00x→~1.08x)
  H1  capa: 0,08s de cena de contexto no primeiro frame

F2 (no mesmo job): legenda karaokê queimada (regras D, módulo finish.py) e
música opcional com ducking+boom (regras E) — o usuário ESCOLHE a trilha ou
"sem música". O áudio limpo da F0 manda no tempo total.

Input:  { audio_url, words: [{start,end,word}], scene_urls: [..],
          output_upload_url, captions?: bool=True, music_url?: str|None }
Output: { montage: True, uploaded, duration, segments, plan_report }
"""

from __future__ import annotations

import os
import subprocess
import tempfile
from pathlib import Path

from voice_pipeline.r2 import download_to_dir, upload_file_to_presigned_url

W, H, FPS = 1080, 1920, 30
JCUT_S = 0.30          # B1
MAX_PLAN_S = 2.5       # C1: teto de plano sem troca visível
SUB_PLAN_S = 2.2       # tamanho alvo dos sub-planos ao fatiar
COVER_S = 0.08         # H1
MIN_SEG_S = 0.60
# Variantes de zoom (G1/C1): força/teto alternam entre sub-planos vizinhos
ZOOMS = [(0.0010, 1.08), (0.0016, 1.11), (0.0007, 1.06)]


def _run(cmd: list[str]) -> None:
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(f"ffmpeg: {r.stderr.strip()[-400:]}")


def _duration(path: Path) -> float:
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                        "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
                       capture_output=True, text=True)
    return float(r.stdout.strip())


def sentences_from_words(words: list[dict]) -> list[dict]:
    """Agrupa words em frases (fronteira = pontuação forte no fim do token)."""
    sents, cur = [], []
    for w in words:
        cur.append(w)
        if w["word"].strip()[-1:] in ".!?…":
            sents.append(cur)
            cur = []
    if cur:
        sents.append(cur)
    return [{"start": s[0]["start"], "end": s[-1]["end"],
             "text": " ".join(x["word"].strip() for x in s)} for s in sents if s]


def _voice_end_before(words: list[dict], t: float) -> float:
    ends = [w["end"] for w in words if w["end"] < t - 0.01]
    return max(ends) if ends else 0.0


def build_plan(words: list[dict], n_scenes: int, total: float,
               sentence_scene: list[int] | None = None) -> list[dict]:
    """Uma cena por frase (mapa frase→cena do planejador F3, ou ciclando o
    banco de teste) → janelas encadeadas sem gap → fatiadas em sub-planos
    ≤2,5s com offset/zoom alternados. Retorna [{scene, t0, t1, src_offset, zoom}]."""
    sents = sentences_from_words(words)
    if not sents:
        sents = [{"start": 0.0, "end": total, "text": ""}]

    def scene_for(i: int) -> int:
        if sentence_scene and i < len(sentence_scene):
            return max(0, min(int(sentence_scene[i]), n_scenes - 1))
        return i % n_scenes

    # 1. Janela de cada cena: J-cut na frase, encadeada até a próxima (B4)
    windows = []
    for i, s in enumerate(sents):
        anchor = s["start"]
        # B1+B2: entra 0,3s antes, mas nunca dentro de silêncio morto
        t0 = 0.0 if i == 0 else max(anchor - JCUT_S,
                                    _voice_end_before(words, anchor) + 0.02)
        windows.append({"scene": scene_for(i), "t0": round(t0, 2)})
    for i, win in enumerate(windows):
        win["t1"] = windows[i + 1]["t0"] if i + 1 < len(windows) else round(total, 2)
    windows = [w for w in windows if w["t1"] - w["t0"] >= 0.05]
    # janelas muito curtas grudam na anterior
    merged = []
    for win in windows:
        if merged and win["t1"] - win["t0"] < MIN_SEG_S:
            merged[-1]["t1"] = win["t1"]
        else:
            merged.append(win)

    # 2. C1: fatia janelas longas em sub-planos (mesma cena, offset+zoom novos)
    plan, zi = [], 0
    for win in merged:
        length = win["t1"] - win["t0"]
        n_sub = max(1, round(length / SUB_PLAN_S + 0.25))
        step = length / n_sub
        for k in range(n_sub):
            a = win["t0"] + k * step
            b = win["t1"] if k == n_sub - 1 else a + step
            plan.append({
                "scene": win["scene"],
                "t0": round(a, 2),
                "t1": round(b, 2),
                # offset avança no clipe-fonte a cada sub-plano ("2º ângulo")
                "src_offset": round(k * (step + 0.8), 2),
                "zoom": ZOOMS[zi % len(ZOOMS)],
            })
            zi += 1
    return plan


def _render_segment(scene: Path, seg: dict, out: Path) -> None:
    """Um sub-plano: trim (loop se a cena for curta) + 9:16 + zoompan (G1)."""
    dur = seg["t1"] - seg["t0"]
    force, cap = seg["zoom"]
    scene_dur = _duration(scene)
    offset = seg["src_offset"] % max(scene_dur - 0.5, 0.5)
    if offset + dur > scene_dur:
        offset = max(0.0, scene_dur - dur - 0.1)
    vf = (f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},"
          f"fps={FPS},zoompan=z='min(1+{force}*on,{cap})'"
          f":x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s={W}x{H}:fps={FPS},"
          f"setsar=1")
    _run(["ffmpeg", "-y", "-loglevel", "error",
          "-stream_loop", "-1", "-ss", f"{offset:.2f}", "-t", f"{dur:.3f}",
          "-i", str(scene), "-vf", vf, "-an",
          "-c:v", "libx264", "-preset", "veryfast", "-crf", "18",
          "-pix_fmt", "yuv420p", str(out)])


def _render_cover(scene: Path, out: Path) -> None:
    """H1: capa = frame de contexto (2 frames, vira a thumbnail do feed)."""
    frame = out.with_suffix(".png")
    _run(["ffmpeg", "-y", "-loglevel", "error", "-ss", "1.0", "-i", str(scene),
          "-frames:v", "1", str(frame)])
    _run(["ffmpeg", "-y", "-loglevel", "error", "-loop", "1", "-t", f"{COVER_S}",
          "-i", str(frame),
          "-vf", f"scale={W}:{H}:force_original_aspect_ratio=increase,"
                 f"crop={W}:{H},fps={FPS},setsar=1",
          "-c:v", "libx264", "-preset", "veryfast", "-crf", "18",
          "-pix_fmt", "yuv420p", str(out)])


def handle_montage(inp: dict, log) -> dict:
    audio_url = inp.get("audio_url")
    output_upload_url = inp.get("output_upload_url")
    words = inp.get("words") or []
    scene_urls = inp.get("scene_urls") or []
    if not audio_url or not output_upload_url:
        return {"error": "missing 'audio_url' or 'output_upload_url'"}
    if not words:
        return {"error": "missing 'words'"}
    if not scene_urls:
        return {"error": "missing 'scene_urls'"}

    job_dir = Path(tempfile.mkdtemp(prefix="montage_"))
    audio = download_to_dir([audio_url], job_dir / "audio")[0]
    scenes = download_to_dir(scene_urls, job_dir / "scenes")
    total = _duration(audio)

    plan = build_plan(words, len(scenes), total,
                      sentence_scene=inp.get("sentence_scene"))
    # H1 sem deslocar o timeline: a capa SUBSTITUI os primeiros 0,08s do
    # primeiro plano (senão todo J-cut atrasaria 0,08s em relação à fala).
    plan[0]["t0"] = round(plan[0]["t0"] + COVER_S, 3)
    log("info", "montage.plan", segments=len(plan), duration=round(total, 1))

    # Renderiza capa + cada sub-plano e concatena (concat demuxer, sem reencode)
    seg_dir = job_dir / "segs"
    seg_dir.mkdir()
    files = []
    cover = seg_dir / "000_cover.mp4"
    _render_cover(scenes[plan[0]["scene"]], cover)
    files.append(cover)
    report = []
    for i, seg in enumerate(plan):
        out = seg_dir / f"{i + 1:03d}.mp4"
        _render_segment(scenes[seg["scene"]], seg, out)
        files.append(out)
        report.append(f"[{seg['t0']:6.2f}-{seg['t1']:6.2f}] cena {seg['scene'] + 1}"
                      f" (offset {seg['src_offset']}s, zoom {seg['zoom'][1]})")
        log("info", "montage.segment", index=i, total=len(plan))

    lst = job_dir / "list.txt"
    lst.write_text("\n".join(f"file '{f.as_posix()}'" for f in files), encoding="utf-8")
    silent = job_dir / "video_silent.mp4"
    _run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0",
          "-i", str(lst), "-c", "copy", str(silent)])

    # Mux com o áudio limpo (o áudio manda na duração final)
    base = job_dir / "base.mp4"
    _run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(silent), "-i", str(audio),
          "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
          "-t", f"{total:.3f}", str(base)])

    # ── F2: legenda karaokê (D) + música opcional com ducking (E) ────────────
    from finish import burn_karaoke, mix_music

    current = base
    if inp.get("captions", True):
        cuts = sorted({seg["t0"] for seg in plan if seg["t0"] > 0.1})
        captioned = job_dir / "captioned.mp4"
        burn_karaoke(current, words, captioned, cuts=list(cuts),
                     suppress_windows=[tuple(wdw) for wdw in inp.get("suppress_windows") or []])
        current = captioned
        log("info", "montage.captions.done")

    music_url = inp.get("music_url")
    if music_url:
        music = download_to_dir([music_url], job_dir / "music")[0]
        with_music = job_dir / "with_music.mp4"
        mix_music(current, music, with_music)
        current = with_music
        log("info", "montage.music.done")

    final = current
    final_dur = _duration(final)

    upload_file_to_presigned_url(final, output_upload_url, content_type="video/mp4")
    log("info", "montage.done", duration=round(final_dur, 2), segments=len(plan))

    return {
        "montage": True,
        "uploaded": True,
        "duration": round(final_dur, 2),
        "segments": len(plan),
        "plan_report": "\n".join(report),
    }
