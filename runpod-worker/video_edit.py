"""Estúdio de Vídeo F2 — entrada de vídeo / "CapCut automático" (job: video_edit).

A gravação crua da pessoa entra; o Cérebro 2 (audio_edit.edit_pipeline) decide
os cortes sobre o ÁUDIO extraído — abortos, retakes, marcações, pausas — e a
MESMA EDL é aplicada nos dois streams: cada segmento é cortado do vídeo-fonte
com re-encode (A/V juntos, sync inerente), concat com re-encode (regra 3 da
máquina: nunca -c copy) e legenda karaokê opcional na RESOLUÇÃO REAL
(finish.burn_karaoke, words já remapeadas pro timeline novo).

Teto: STUDIO_MAX_VIDEO_SECONDS (default 900s — clipe social; aula longa é
decisão pendente do Lucas). Fonte VFR (celular) é normalizada pra CFR.

Input:  { video_url, output_upload_url, language?, whisper_model?,
          edit_profile?, captions?: bool=True }
Output: { video_edited, uploaded, duration_raw, duration_clean, kept_takes,
          removed_takes, words, report, profile, diff_status, width, height }
"""

from __future__ import annotations

import os
import subprocess
import tempfile
from pathlib import Path

from voice_pipeline.r2 import download_to_dir, upload_file_to_presigned_url
from audio_edit import edit_pipeline, _run, _duration

MAX_VIDEO_SECONDS = float(os.environ.get("STUDIO_MAX_VIDEO_SECONDS", "900"))


def _probe_video(path: Path) -> dict:
    r = _run(["ffprobe", "-v", "error", "-select_streams", "v:0",
              "-show_entries", "stream=width,height,avg_frame_rate",
              "-of", "csv=p=0", str(path)])
    out = r.stdout.strip()
    if not out:
        raise RuntimeError("sem stream de vídeo")
    w, h, rate = out.split(",")[:3]
    num, _, den = rate.partition("/")
    fps = float(num) / float(den or 1)
    if not (10 <= fps <= 121):
        fps = 30.0
    return {"w": int(w), "h": int(h), "fps": round(fps)}


def _stream_duration(path: Path, kind: str) -> float:
    r = _run(["ffprobe", "-v", "error", "-select_streams", kind,
              "-show_entries", "stream=duration",
              "-of", "default=noprint_wrappers=1:nokey=1", str(path)])
    out = r.stdout.strip()
    return float(out) if out else 0.0


def _cut_segment(src: Path, a: float, b: float, fps: int, out: Path) -> None:
    """Corta [a,b] do vídeo-fonte com re-encode A/V (corte exato, pts limpos).
    Seek combinado: -ss rápido pra ~2s antes + corte fino no output (senão
    vídeo longo decodifica tudo a cada segmento)."""
    base = max(0.0, a - 2.0)
    _runc(["ffmpeg", "-y", "-loglevel", "error",
           "-ss", f"{base:.3f}", "-i", str(src),
           "-ss", f"{a - base:.3f}", "-to", f"{b - base:.3f}",
           "-vf", f"fps={fps},setsar=1",
           "-c:v", "libx264", "-preset", "veryfast", "-crf", "18",
           "-pix_fmt", "yuv420p",
           "-c:a", "aac", "-b:a", "192k", "-ar", "44100", "-ac", "1",
           str(out)])


def _runc(cmd: list[str]) -> None:
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(f"ffmpeg: {r.stderr.strip()[-400:]}")


def handle_video_edit(inp: dict, log) -> dict:
    video_url = inp.get("video_url")
    output_upload_url = inp.get("output_upload_url")
    if not video_url or not output_upload_url:
        return {"error": "missing 'video_url' or 'output_upload_url'"}
    language = inp.get("language", "pt")
    model_name = inp.get("whisper_model", "large-v3-turbo")
    profile_name = inp.get("edit_profile", "dinamico")
    captions = bool(inp.get("captions", True))

    job_dir = Path(tempfile.mkdtemp(prefix="video_edit_"))
    src = download_to_dir([video_url], job_dir / "raw")[0]

    try:
        meta = _probe_video(src)
    except Exception as exc:  # noqa: BLE001
        return {"error": f"vídeo inválido: {str(exc)[:200]}"}
    log("info", "video_edit.probe", **meta)

    # Áudio de trabalho (o Cérebro 2 decide os cortes SOBRE o áudio)
    wav = job_dir / "source.wav"
    r = _run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(src),
              "-vn", "-ac", "1", "-ar", "44100", "-c:a", "pcm_s16le", str(wav)])
    if r.returncode != 0:
        return {"error": "video_sem_audio"}

    res = edit_pipeline(wav, job_dir, language, model_name, profile_name, log,
                        max_seconds=MAX_VIDEO_SECONDS)
    if res.get("error"):
        if res["error"] == "audio_too_long":
            res["error"] = "video_too_long"
        return res
    segs, takes = res["segs"], res["takes"]

    # ── Aplica a MESMA EDL no vídeo: corta A/V juntos + concat re-encode ────
    seg_dir = job_dir / "segs"
    seg_dir.mkdir()
    files = []
    for i, (a, b) in enumerate(segs):
        out = seg_dir / f"{i:03d}.mp4"
        _cut_segment(src, a, b, meta["fps"], out)
        files.append(out)
        log("info", "video_edit.segment", index=i, total=len(segs))

    lst = job_dir / "list.txt"
    lst.write_text("\n".join(f"file '{f.as_posix()}'" for f in files),
                   encoding="utf-8")
    edited = job_dir / "edited.mp4"
    _runc(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0",
           "-i", str(lst), "-vf", f"fps={meta['fps']},setsar=1",
           "-c:v", "libx264", "-preset", "veryfast", "-crf", "18",
           "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", str(edited)])

    # QA: duração do vídeo ≈ soma da EDL; streams A/V iguais (regra 5)
    want = sum(b - a for a, b in segs)
    got = _duration(edited)
    if abs(got - want) > 0.35:
        return {"error": f"QA duração: {got:.2f}s vs EDL {want:.2f}s"}
    va = _stream_duration(edited, "v:0")
    aa = _stream_duration(edited, "a:0")
    if va and aa and abs(va - aa) > 0.25:
        return {"error": f"QA sync: video {va:.2f}s x audio {aa:.2f}s"}

    final = edited
    if captions and res["words"]:
        from finish import burn_karaoke
        captioned = job_dir / "captioned.mp4"
        burn_karaoke(edited, res["words"], captioned, cuts=[])
        if abs(_duration(captioned) - got) > 0.15:
            return {"error": "QA legenda mudou a duração"}
        final = captioned
        log("info", "video_edit.captions.done")

    upload_file_to_presigned_url(final, output_upload_url,
                                 content_type="video/mp4")
    log("info", "video_edit.done", duration_raw=round(res["total"], 2),
        duration_clean=round(got, 2), diff=res["diff_status"])

    return {
        "video_edited": True,
        "uploaded": True,
        "duration_raw": round(res["total"], 2),
        "duration_clean": round(got, 2),
        "kept_takes": sum(1 for t in takes if t["manter"]),
        "removed_takes": sum(1 for t in takes if not t["manter"]),
        "words": res["words"],
        "report": "\n".join(res["report_lines"]),
        "profile": res["profile"],
        "diff_status": res["diff_status"],
        "width": meta["w"],
        "height": meta["h"],
    }
