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


def _stream_duration(path: Path, kind: str) -> float:
    """Duração do stream v:0 ou a:0 (QA de sync — regra 5 da máquina)."""
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", kind,
                        "-show_entries", "stream=duration",
                        "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
                       capture_output=True, text=True)
    out = r.stdout.strip()
    return float(out) if out else 0.0


_IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp"}


def _is_image(path: Path) -> bool:
    return path.suffix.lower() in _IMAGE_EXTS


def _snap(t: float) -> float:
    """Corte na GRADE DE FRAMES (regra 2): múltiplo de 1/FPS — senão cada
    corte deriva ~33ms e acumula ~0,5s em 15 cortes (bug real do estúdio)."""
    return round(round(t * FPS) / FPS, 4)


def _assert_duration(label: str, got: float, want: float, tol: float = 0.1) -> None:
    """Regras 5/6: pós-passe NUNCA muda a duração; >0,1s = bug, aborta o job."""
    if abs(got - want) > tol:
        raise RuntimeError(
            f"QA duração ({label}): {got:.3f}s vs esperado {want:.3f}s "
            f"(delta {abs(got - want):.3f}s > {tol}s)")


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
               sentence_scene: list[int] | None = None,
               face_sentences: list[dict] | None = None) -> list[dict]:
    """Uma cena por frase (mapa frase→cena do planejador F3, ou ciclando o
    banco de teste) → janelas encadeadas sem gap → fatiadas em sub-planos
    ≤2,5s com offset/zoom alternados.
    F4: frases-âncora usam o clipe de ROSTO (lip-sync): janela começa EXATO na
    frase (sem pre-roll de J-cut) e os sub-planos tocam o clipe CONTÍNUO —
    só o zoom varia (jump-cut de vlog, C1-rosto).
    Retorna [{scene, t0, t1, src_offset, zoom, face?}]."""
    sents = sentences_from_words(words)
    if not sents:
        sents = [{"start": 0.0, "end": total, "text": ""}]

    faces = {int(f["sentence"]): f for f in (face_sentences or [])}

    def scene_for(i: int) -> int:
        if i in faces:
            return max(0, min(int(faces[i]["scene"]), n_scenes - 1))
        if sentence_scene and i < len(sentence_scene):
            return max(0, min(int(sentence_scene[i]), n_scenes - 1))
        return i % n_scenes

    # 1. Janela de cada cena: J-cut na frase, encadeada até a próxima (B4)
    windows = []
    for i, s in enumerate(sents):
        anchor = s["start"]
        if i in faces:
            # rosto entra no início exato da frase (áudio do clipe = a frase)
            t0 = 0.0 if i == 0 else round(anchor, 2)
            windows.append({"scene": scene_for(i), "t0": t0,
                            "face_start": round(anchor, 2)})
            continue
        # B1+B2: entra 0,3s antes, mas nunca dentro de silêncio morto
        t0 = 0.0 if i == 0 else max(anchor - JCUT_S,
                                    _voice_end_before(words, anchor) + 0.02)
        windows.append({"scene": scene_for(i), "t0": round(t0, 2)})
    for i, win in enumerate(windows):
        win["t1"] = windows[i + 1]["t0"] if i + 1 < len(windows) else round(total, 2)
    windows = [w for w in windows if w["t1"] - w["t0"] >= 0.05]
    # janelas muito curtas grudam na anterior (rosto nunca é engolido)
    merged = []
    for win in windows:
        if merged and win["t1"] - win["t0"] < MIN_SEG_S and "face_start" not in win:
            merged[-1]["t1"] = win["t1"]
        else:
            merged.append(win)

    # 2. C1: fatia janelas longas em sub-planos (mesma cena, offset+zoom novos)
    plan, zi = [], 0
    for win in merged:
        length = win["t1"] - win["t0"]
        n_sub = max(1, round(length / SUB_PLAN_S + 0.25))
        step = length / n_sub
        is_face = "face_start" in win
        for k in range(n_sub):
            a = win["t0"] + k * step
            b = win["t1"] if k == n_sub - 1 else a + step
            if is_face:
                # playback contínuo do lip-sync; só o zoom troca entre cortes
                src_offset = round(a - win["face_start"], 2)
            else:
                # offset avança no clipe-fonte a cada sub-plano ("2º ângulo")
                src_offset = round(k * (step + 0.8), 2)
            plan.append({
                "scene": win["scene"],
                # regra 2 da máquina: todo corte snapado na grade de frames
                "t0": _snap(a),
                "t1": _snap(b),
                "src_offset": max(0.0, src_offset),
                "zoom": ZOOMS[zi % len(ZOOMS)],
                "face": is_face,
            })
            zi += 1
    return [p for p in plan if p["t1"] - p["t0"] >= 1.0 / FPS]


def _render_segment(scene: Path, seg: dict, out: Path) -> None:
    """Um sub-plano: trim (loop se a cena for curta) + 9:16 + zoompan (G1).
    Rosto (F4): offset é EXATO (lip-sync) — nunca aplica módulo/realinha.
    Slide/estático: PROIBIDO zoom (regra do Lucas) — só scale, quadro parado.
    fps={FPS} é SEMPRE o primeiro filtro (regra 1: fonte 24fps entregaria
    menos frames e o vídeo encurtaria/atrasaria em relação ao áudio)."""
    dur = seg["t1"] - seg["t0"]
    force, cap = seg["zoom"]
    # Slide em PNG/JPG (§2.9): imagem vira plano ESTÁTICO (-loop 1, sem zoom).
    if _is_image(scene):
        vf = (f"fps={FPS},scale={W}:{H}:force_original_aspect_ratio=increase,"
              f"crop={W}:{H},setsar=1")
        _run(["ffmpeg", "-y", "-loglevel", "error", "-loop", "1",
              "-t", f"{dur:.3f}", "-i", str(scene), "-vf", vf, "-an",
              "-c:v", "libx264", "-preset", "veryfast", "-crf", "18",
              "-pix_fmt", "yuv420p", str(out)])
        return
    scene_dur = _duration(scene)
    if seg.get("face"):
        offset = min(seg["src_offset"], max(0.0, scene_dur - 0.1))
    else:
        offset = seg["src_offset"] % max(scene_dur - 0.5, 0.5)
        if offset + dur > scene_dur:
            offset = max(0.0, scene_dur - dur - 0.1)
    if seg.get("static"):
        vf = (f"fps={FPS},scale={W}:{H}:force_original_aspect_ratio=increase,"
              f"crop={W}:{H},setsar=1")
    else:
        vf = (f"fps={FPS},scale={W}:{H}:force_original_aspect_ratio=increase,"
              f"crop={W}:{H},zoompan=z='min(1+{force}*on,{cap})'"
              f":x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s={W}x{H}:fps={FPS},"
              f"setsar=1")
    _run(["ffmpeg", "-y", "-loglevel", "error",
          "-stream_loop", "-1", "-ss", f"{offset:.2f}", "-t", f"{dur:.3f}",
          "-i", str(scene), "-vf", vf, "-an",
          "-c:v", "libx264", "-preset", "veryfast", "-crf", "18",
          "-pix_fmt", "yuv420p", str(out)])


def _render_cover(scene: Path, out: Path, dur: float = COVER_S) -> None:
    """H1: capa = frame de contexto (2 frames, vira a thumbnail do feed)."""
    frame = out.with_suffix(".png")
    if _is_image(scene):
        frame = scene
    else:
        _run(["ffmpeg", "-y", "-loglevel", "error", "-ss", "1.0", "-i", str(scene),
              "-frames:v", "1", str(frame)])
    _run(["ffmpeg", "-y", "-loglevel", "error", "-loop", "1", "-t", f"{dur:.4f}",
          "-i", str(frame),
          "-vf", f"fps={FPS},scale={W}:{H}:force_original_aspect_ratio=increase,"
                 f"crop={W}:{H},setsar=1",
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
                      sentence_scene=inp.get("sentence_scene"),
                      face_sentences=inp.get("face_sentences"))
    # Slides/artes: cenas marcadas como estáticas NUNCA levam zoom (regra do
    # Lucas: "slide é estático e só vai passando").
    static = {int(i) for i in (inp.get("static_scenes") or [])}
    for seg in plan:
        if seg["scene"] in static and not seg["face"]:
            seg["static"] = True
            seg["src_offset"] = 0.0
    # H1 sem deslocar o timeline: a capa SUBSTITUI os primeiros 0,08s do
    # primeiro plano (senão todo J-cut atrasaria 0,08s em relação à fala).
    # Snap na grade de frames pra soma das durações continuar frame-exata.
    plan[0]["t0"] = _snap(plan[0]["t0"] + COVER_S)
    cover_s = plan[0]["t0"]
    log("info", "montage.plan", segments=len(plan), duration=round(total, 1))

    # Renderiza capa + cada sub-plano e concatena (concat demuxer, sem reencode)
    seg_dir = job_dir / "segs"
    seg_dir.mkdir()
    files = []
    cover = seg_dir / "000_cover.mp4"
    _render_cover(scenes[plan[0]["scene"]], cover, dur=cover_s)
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
    # Regra 3 da máquina: concat SEMPRE com RE-ENCODE, nunca `-c copy` — pts
    # sujo nas emendas faz o enable=between() da legenda pular grupos inteiros.
    _run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0",
          "-i", str(lst), "-vf", f"fps={FPS},setsar=1",
          "-c:v", "libx264", "-preset", "veryfast", "-crf", "18",
          "-pix_fmt", "yuv420p", "-an", str(silent)])

    # Mux com o áudio limpo (o áudio manda na duração final)
    base = job_dir / "base.mp4"
    _run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(silent), "-i", str(audio),
          "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
          "-t", f"{total:.3f}", str(base)])
    base_dur = _duration(base)
    _assert_duration("base vs áudio", base_dur, total, tol=0.15)

    # ── F2: legenda karaokê (D) + música opcional com ducking (E) ────────────
    from finish import burn_karaoke, mix_music

    current = base
    if inp.get("captions", True):
        cuts = sorted({seg["t0"] for seg in plan if seg["t0"] > 0.1})
        captioned = job_dir / "captioned.mp4"
        burn_karaoke(current, words, captioned, cuts=list(cuts),
                     suppress_windows=[tuple(wdw) for wdw in inp.get("suppress_windows") or []])
        # Regra 6: pós-passe NUNCA muda a duração (>0,1s = bug, aborta)
        _assert_duration("legenda", _duration(captioned), base_dur)
        current = captioned
        log("info", "montage.captions.done")

    music_url = inp.get("music_url")
    if music_url:
        music = download_to_dir([music_url], job_dir / "music")[0]
        with_music = job_dir / "with_music.mp4"
        mix_music(current, music, with_music)
        _assert_duration("música", _duration(with_music), base_dur)
        current = with_music
        log("info", "montage.music.done")

    final = current
    final_dur = _duration(final)
    # Regra 5: QA final — stream de vídeo ≈ stream de áudio (>0,1s = bug)
    _assert_duration("QA final vídeo×áudio",
                     _stream_duration(final, "v:0"), _stream_duration(final, "a:0"))

    upload_file_to_presigned_url(final, output_upload_url, content_type="video/mp4")
    log("info", "montage.done", duration=round(final_dur, 2), segments=len(plan))

    return {
        "montage": True,
        "uploaded": True,
        "duration": round(final_dur, 2),
        "segments": len(plan),
        "plan_report": "\n".join(report),
    }
