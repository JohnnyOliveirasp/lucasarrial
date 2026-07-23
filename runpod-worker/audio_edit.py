"""Estúdio de Vídeo F1 — editor "Cérebro 2" (job type: audio_edit).

Spec aprovada pelo Lucas (PDF 22/07 + CLAUDE.md da fábrica Ralph/FCI, números
medidos em 10 aulas de produção). As 2 leis: AGRESSIVO no ritmo, CONSERVADOR
no conteúdo; diff sempre antes de entregar. Zero LLM no caminho base.

1. PERFIS de silêncio (a queixa real é irregularidade -> sobra assimétrica):
     dinamico (default): piso 0,15s · sobra 0,07s pós-fala + 0,02s pré
     natural:            piso 0,20s · sobra 0,09s pós-fala + 0,03s pré
   Sobra pós-fala nunca <0,06s: timestamps de FIM do whisper subestimam
   (bug 18/jul do FCI — clipava finais de palavra).
2. CORTE DE ALTA-CONFIANÇA (só o que é inequívoco; retórica NUNCA):
     a) marcação de take falada ("corta", "de novo", ...)
     b) duplicata adjacente EXATA (texto normalizado igual)
     c) reinício abortado com prefixo idêntico (aborto é prefixo do take bom)
     d) palavra ESTICADA (dur>=0,55s E dur/sílaba>=0,33) = takes colados que o
        whisper alisou -> re-transcreve janela curta sem contexto; só corta se
        revelar duplicata exata com fronteira clara (teto 4s por corte)
3. DIFF DE CONTEÚDO OBRIGATÓRIO: transcreve o resultado e compara palavra a
   palavra com o esperado; sumiu bloco >=5 palavras -> re-renderiza versão
   conservadora (sem encolher pausas). Único método que pegou os estragos
   reais (A02 19/jul).

Input:  { audio_url, output_upload_url, language?, whisper_model?,
          edit_profile? ("dinamico"|"natural") }
Output: { edited, uploaded, duration_raw, duration_clean, kept_takes,
          removed_takes, words: [{start,end,word}], report, profile,
          diff_status ("passed"|"fallback_passed"|"warn") }
"""

from __future__ import annotations

import os
import re
import subprocess
import tempfile
from pathlib import Path

from voice_pipeline.r2 import download_to_dir, upload_file_to_presigned_url

MAX_AUDIO_SECONDS = float(os.environ.get("STUDIO_MAX_AUDIO_SECONDS", "600"))
NOISE_DB = -35          # threshold do silencedetect
TAKE_PAUSE_S = 0.45     # pausa que separa dois TAKES (unidade de transcrição)
MIN_SPEECH_S = 0.35     # fala menor que isso é ruído
MIN_TAIL_PAD_S = 0.06   # sobra pós-fala mínima (fim de palavra subestimado)

PROFILES = {
    "dinamico": {"piso": 0.15, "pad_out": 0.07, "pad_in": 0.02},
    "natural": {"piso": 0.20, "pad_out": 0.09, "pad_in": 0.03},
}

# Marcação de take falada: o take É só a marcação (<=4 palavras).
TAKE_MARKERS = {
    "corta", "corta essa", "corta ai", "de novo", "denovo", "vou de novo",
    "vou repetir", "repete", "repetindo", "apaga", "apaga essa", "essa nao",
    "perai", "pera", "errei", "errei de novo", "comecar de novo",
    "otra vez", "de nuevo", "again", "cut", "one more time",
}

STRETCH_DUR_S = 0.55    # palavra esticada: duração mínima…
STRETCH_PER_SYL = 0.33  # …e s/sílaba mínimo (assinatura de takes colados)
MAX_STRETCH_CUT_S = 4.0 # teto por corte (lição FCI: sem teto cortou 249s)
DIFF_BLOCK_WORDS = 5    # bloco sumido >= isso -> conteúdo perdido


def _run(cmd: list[str]) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, capture_output=True, text=True)


def _duration(path: Path) -> float:
    r = _run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
              "-of", "default=noprint_wrappers=1:nokey=1", str(path)])
    return float(r.stdout.strip())


def _detect_speeches(path: Path, min_pause: float) -> list[tuple[float, float]]:
    """Trechos com voz, usando silêncios >= min_pause como fronteira."""
    r = _run(["ffmpeg", "-i", str(path), "-af",
              f"silencedetect=noise={NOISE_DB}dB:d={min_pause}", "-f", "null", "-"])
    txt = r.stderr
    starts = [float(x) for x in re.findall(r"silence_start: (-?[\d.]+)", txt)]
    ends = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", txt)]
    total = _duration(path)
    speeches: list[tuple[float, float]] = []
    cursor = 0.0
    for i, s in enumerate(starts):
        s = max(0.0, s)
        if s - cursor > 0.01:
            speeches.append((round(cursor, 3), round(s, 3)))
        cursor = ends[i] if i < len(ends) else total
    if total - cursor > 0.01:
        speeches.append((round(cursor, 3), round(total, 3)))
    return speeches


def _group_takes(fine: list[tuple[float, float]]) -> list[dict]:
    """Agrupa falas finas (piso do perfil) em TAKES (pausa >= TAKE_PAUSE_S).
    Falas finas curtinhas ficam: o filtro MIN_SPEECH_S vale pro TAKE inteiro."""
    takes: list[dict] = []
    cur: list[tuple[float, float]] = []
    for seg in fine:
        if cur and seg[0] - cur[-1][1] >= TAKE_PAUSE_S:
            takes.append({"ini": cur[0][0], "fim": cur[-1][1], "fine": cur})
            cur = []
        cur.append(seg)
    if cur:
        takes.append({"ini": cur[0][0], "fim": cur[-1][1], "fine": cur})
    return [t for t in takes if t["fim"] - t["ini"] >= MIN_SPEECH_S]


def _load_model(model_name: str, log):
    from voice_pipeline.training import _get_whisper
    try:
        return _get_whisper(model_name, "cuda", "float16")
    except Exception as exc:  # noqa: BLE001 — sem GPU (teste local): CPU
        log("warn", "audio_edit.whisper.cpu_fallback", error=str(exc)[:200])
        return _get_whisper(model_name, "cpu", "int8")


def _transcribe_span(model, wav: Path, a: float, b: float, language: str,
                     fresh_context: bool = False) -> list[dict]:
    """Words (timestamps GLOBAIS) do trecho [a,b]. fresh_context=True usa
    condition_on_previous_text=False — revela o que a passada longa alisa."""
    piece = Path(tempfile.mktemp(suffix=".wav"))
    r = _run(["ffmpeg", "-y", "-loglevel", "error", "-ss", str(a), "-to", str(b),
              "-i", str(wav), "-ac", "1", "-ar", "16000", str(piece)])
    if r.returncode != 0:
        raise RuntimeError(f"ffmpeg span: {r.stderr.strip()[:200]}")
    kwargs = {"language": language, "word_timestamps": True}
    if fresh_context:
        kwargs["condition_on_previous_text"] = False
    segments, _info = model.transcribe(str(piece), **kwargs)
    words = []
    for seg in segments:
        for w in (seg.words or []):
            words.append({"start": round(a + w.start, 3),
                          "end": round(a + w.end, 3), "word": w.word})
    piece.unlink(missing_ok=True)
    return words


def _norm(txt: str) -> str:
    t = re.sub(r"[^\wáéíóúâêôãõçñü ]", "", txt.lower())
    return re.sub(r"\s+", " ", t).strip()


def _norm_words(words: list[dict]) -> list[str]:
    out = []
    for w in words:
        n = _norm(w["word"])
        if n:
            out.extend(n.split())
    return out


def _syllables(word: str) -> int:
    """Aproximação por grupos de vogais — suficiente pra assinatura."""
    groups = re.findall(r"[aeiouáéíóúâêôãõy]+", word.lower())
    return max(1, len(groups))


def _mark_high_confidence(takes: list[dict]) -> None:
    """Corte de alta-confiança sobre os takes transcritos (retórica NUNCA):
    vazio/ruído · marcação falada · duplicata adjacente exata · reinício
    abortado com prefixo idêntico. Compara com os 2 takes SEGUINTES (fica o
    último take, que é a leitura boa)."""
    n = len(takes)
    for t in takes:
        t["manter"], t["motivo"] = True, ""
    for i in range(n):
        norm = _norm(takes[i]["texto"])
        if not norm:
            takes[i]["manter"], takes[i]["motivo"] = False, "vazio/ruído"
            continue
        words = norm.split()
        if norm in TAKE_MARKERS and len(words) <= 4:
            takes[i]["manter"], takes[i]["motivo"] = False, "marcação de take"
            continue
        for j in (i + 1, i + 2):
            if j >= n:
                break
            other = _norm(takes[j]["texto"])
            if not other:
                continue
            ow = other.split()
            if norm == other:
                takes[i]["manter"] = False
                takes[i]["motivo"] = f"duplicata exata do take {j}"
                break
            # Reinício abortado: o take INTEIRO é prefixo do take bom. A
            # ÚLTIMA palavra pode ser fragmento ("...como a plata" ->
            # "...como a plataforma...") — aborto real para no meio da palavra.
            if 2 <= len(words) < len(ow) and \
                    ow[:len(words) - 1] == words[:-1] and \
                    ow[len(words) - 1].startswith(words[-1]):
                takes[i]["manter"] = False
                takes[i]["motivo"] = f"reinício abortado (prefixo do take {j})"
                break


def _stretched_word_cuts(model, wav: Path, takes: list[dict], language: str,
                         log) -> list[tuple[float, float]]:
    """Palavra esticada = 2 tomadas coladas que o whisper colapsou. Só corta
    com prova: a re-transcrição da janela (sem contexto) precisa revelar uma
    sequência >=2 palavras duplicada ADJACENTE; corta a 1ª ocorrência, nas
    fronteiras de palavra, teto MAX_STRETCH_CUT_S. Sem prova -> só relata."""
    cuts: list[tuple[float, float]] = []
    for t in takes:
        if not t["manter"]:
            continue
        for w in t["words"]:
            dur = w["end"] - w["start"]
            word = _norm(w["word"])
            if not word or dur < STRETCH_DUR_S:
                continue
            if dur / _syllables(word) < STRETCH_PER_SYL:
                continue
            a = max(t["ini"], w["start"] - 2.0)
            b = min(t["fim"], w["end"] + 2.0)
            fresh = _transcribe_span(model, wav, a, b, language, fresh_context=True)
            # pares (token, word) 1:1 — só o 1º token de cada word, pra manter
            # o índice do bloco duplicado alinhado com os timestamps
            flat = [x for x in fresh if _norm(x["word"])]
            toks = [_norm(x["word"]).split()[0] for x in flat]
            # procura bloco duplicado adjacente: toks[i:i+k] == toks[i+k:i+2k]
            found = None
            for k in range(min(8, len(toks) // 2), 1, -1):
                for i in range(0, len(toks) - 2 * k + 1):
                    if toks[i:i + k] == toks[i + k:i + 2 * k]:
                        found = (i, k)
                        break
                if found:
                    break
            if not found:
                t.setdefault("avisos", []).append(
                    f"palavra esticada '{word.strip()}' ({dur:.2f}s) sem prova de duplicata — mantida")
                continue
            i, k = found
            if i + 2 * k > len(flat):
                continue
            c0 = flat[i]["start"] - 0.02
            c1 = flat[i + k]["start"] - 0.02
            if 0 < c1 - c0 <= MAX_STRETCH_CUT_S:
                cuts.append((round(max(a, c0), 3), round(c1, 3)))
                t.setdefault("avisos", []).append(
                    f"take colado em '{word.strip()}': cortada 1ª ocorrência "
                    f"[{c0:.2f}-{c1:.2f}]")
                log("info", "audio_edit.stretch_cut", word=word.strip(),
                    start=round(c0, 2), end=round(c1, 2))
    return cuts


def _build_edl(takes: list[dict], total: float, prof: dict,
               removed_zones: list[tuple[float, float]],
               shrink_pauses: bool):
    """Segmentos finais: falas finas dos takes mantidos (pausa interna >= piso
    encolhe pra pad_out+pad_in), menos as zonas removidas (palavra esticada).
    Words remapeadas pro timeline novo. Cabeça/cauda: zero ar (pads mínimos)."""
    segs: list[tuple[float, float]] = []
    for t in takes:
        if not t["manter"]:
            continue
        fine = t["fine"] if shrink_pauses else [(t["ini"], t["fim"])]
        for a, b in fine:
            for z0, z1 in removed_zones:
                if z0 <= a and b <= z1:      # fala inteira dentro da zona
                    a = b = z1
                elif a < z0 < b <= z1:        # zona corta o fim
                    b = z0
                elif z0 <= a < z1 < b:        # zona corta o começo
                    a = z1
                elif a < z0 and z1 < b:       # zona no meio: fica só a frente
                    b = z0
            if b - a > 0.02:
                segs.append((a, b))

    pad_in, pad_out = prof["pad_in"], max(prof["pad_out"], MIN_TAIL_PAD_S)
    padded: list[tuple[float, float]] = []
    for a, b in segs:
        a2, b2 = max(0.0, a - pad_in), min(total, b + pad_out)
        if padded and a2 <= padded[-1][1]:   # encosta no anterior: emenda
            padded[-1] = (padded[-1][0], max(padded[-1][1], b2))
        else:
            padded.append((a2, b2))
    return [(round(a, 3), round(b, 3)) for a, b in padded]


def _remap_words(takes: list[dict], segs: list[tuple[float, float]]):
    """Palavra entra no timeline novo se o MEIO dela cai num segmento."""
    words = []
    t_new = 0.0
    for a, b in segs:
        for t in takes:
            if not t["manter"]:
                continue
            for w in t["words"]:
                mid = (w["start"] + w["end"]) / 2
                if a <= mid <= b:
                    words.append({
                        "start": round(max(0.0, w["start"] - a + t_new), 3),
                        "end": round(max(0.0, w["end"] - a + t_new), 3),
                        "word": w["word"]})
        t_new += b - a
    return words


def _render(src: Path, segs: list[tuple[float, float]], out_wav: Path) -> None:
    parts = []
    for i, (a, b) in enumerate(segs):
        parts.append(f"[0:a]atrim=start={a}:end={b},asetpts=PTS-STARTPTS[a{i}]")
    chain = "".join(f"[a{i}]" for i in range(len(segs)))
    fc = ";".join(parts) + f";{chain}concat=n={len(segs)}:v=0:a=1[a]"
    r = _run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(src),
              "-filter_complex", fc, "-map", "[a]",
              "-ac", "1", "-ar", "44100", "-c:a", "pcm_s16le", str(out_wav)])
    if r.returncode != 0:
        raise RuntimeError(f"ffmpeg render: {r.stderr.strip()[:300]}")


def _diff_missing_block(expected: list[str], actual: list[str]) -> str | None:
    """Bloco contíguo >= DIFF_BLOCK_WORDS presente no esperado e ausente no
    resultado -> texto do bloco (senão None). SequenceMatcher palavra a palavra."""
    import difflib
    sm = difflib.SequenceMatcher(None, expected, actual, autojunk=False)
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == "delete" and i2 - i1 >= DIFF_BLOCK_WORDS:
            return " ".join(expected[i1:i2])
        if tag == "replace" and (i2 - i1) >= DIFF_BLOCK_WORDS and \
                (j2 - j1) <= (i2 - i1) // 2:
            return " ".join(expected[i1:i2])
    return None


def handle_audio_edit(inp: dict, log) -> dict:
    audio_url = inp.get("audio_url")
    output_upload_url = inp.get("output_upload_url")
    if not audio_url or not output_upload_url:
        return {"error": "missing 'audio_url' or 'output_upload_url'"}
    language = inp.get("language", "pt")
    model_name = inp.get("whisper_model", "large-v3-turbo")
    profile_name = inp.get("edit_profile", "dinamico")
    prof = PROFILES.get(profile_name, PROFILES["dinamico"])

    job_dir = Path(tempfile.mkdtemp(prefix="audio_edit_"))
    raw = download_to_dir([audio_url], job_dir / "raw")[0]
    wav = job_dir / "source.wav"
    r = _run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(raw),
              "-vn", "-ac", "1", "-ar", "44100", "-c:a", "pcm_s16le", str(wav)])
    if r.returncode != 0:
        return {"error": f"audio inválido: {r.stderr.strip()[:200]}"}

    total = _duration(wav)
    if total > MAX_AUDIO_SECONDS:
        return {"error": "audio_too_long", "duration_raw": round(total, 2),
                "max_seconds": MAX_AUDIO_SECONDS}

    fine = _detect_speeches(wav, prof["piso"])
    takes = _group_takes(fine)
    log("info", "audio_edit.takes", count=len(takes), fine=len(fine),
        duration=round(total, 1), profile=profile_name)
    if not takes:
        return {"error": "no_speech", "duration_raw": round(total, 2)}

    model = _load_model(model_name, log)
    for i, t in enumerate(takes):
        t["words"] = _transcribe_span(model, wav, t["ini"], t["fim"], language)
        t["texto"] = " ".join(w["word"].strip() for w in t["words"])
        log("info", "audio_edit.take", index=i,
            seconds=round(t["fim"] - t["ini"], 1), text=t["texto"][:60])

    _mark_high_confidence(takes)
    stretch_cuts = _stretched_word_cuts(model, wav, takes, language, log)

    def render_variant(shrink: bool, out_name: str):
        segs = _build_edl(takes, total, prof, stretch_cuts, shrink_pauses=shrink)
        if not segs:
            return None, None
        out = job_dir / out_name
        _render(wav, segs, out)
        return segs, out

    segs, clean = render_variant(True, "clean.wav")
    if not segs:
        return {"error": "no_speech", "duration_raw": round(total, 2)}

    # ── Diff de conteúdo OBRIGATÓRIO (lei nº 2 do Lucas) ────────────────────
    expected = []
    for t in takes:
        if t["manter"]:
            expected.extend(_norm_words(t["words"]))
    actual = _norm_words(_transcribe_span(model, wav=clean, a=0.0,
                                          b=_duration(clean), language=language))
    missing = _diff_missing_block(expected, actual)
    diff_status = "passed"
    if missing:
        log("warn", "audio_edit.diff_failed", missing=missing[:120])
        # Conservador no conteúdo: re-renderiza SEM encolher pausas internas.
        segs2, clean2 = render_variant(False, "clean_safe.wav")
        if segs2:
            actual2 = _norm_words(_transcribe_span(
                model, wav=clean2, a=0.0, b=_duration(clean2), language=language))
            missing2 = _diff_missing_block(expected, actual2)
            segs, clean = segs2, clean2
            diff_status = "fallback_passed" if not missing2 else "warn"
            if missing2:
                log("warn", "audio_edit.diff_warn", missing=missing2[:120])

    words = _remap_words(takes, segs)
    clean_dur = _duration(clean)

    report_lines = [f"perfil: {profile_name} · diff: {diff_status}"]
    for t in takes:
        mark = "mantido" if t["manter"] else "REMOVIDO"
        line = f"[{t['ini']:7.2f}-{t['fim']:7.2f}] {mark}: {t['texto'][:90]}"
        if t["motivo"]:
            line += f"  <- {t['motivo']}"
        report_lines.append(line)
        for aviso in t.get("avisos", []):
            report_lines.append(f"    ⚠ {aviso}")
    if missing:
        report_lines.append(f"⚠ diff detectou bloco sumido: \"{missing[:90]}\" "
                            f"-> entregue render conservador ({diff_status})")

    upload_file_to_presigned_url(clean, output_upload_url, content_type="audio/wav")
    log("info", "audio_edit.done", duration_raw=round(total, 2),
        duration_clean=round(clean_dur, 2), diff=diff_status,
        removed=sum(1 for t in takes if not t["manter"]))

    return {
        "edited": True,
        "uploaded": True,
        "duration_raw": round(total, 2),
        "duration_clean": round(clean_dur, 2),
        "kept_takes": sum(1 for t in takes if t["manter"]),
        "removed_takes": sum(1 for t in takes if not t["manter"]),
        "words": words,
        "report": "\n".join(report_lines),
        "profile": profile_name,
        "diff_status": diff_status,
    }
