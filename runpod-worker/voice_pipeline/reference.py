"""Selecao de referencia automatica p/ inferencia (anti-filler).

O VoxCPM em modo continuation ECOA o conteudo/final da referencia no inicio de
cada chunk gerado. Se a referencia tiver tiques de fala ("entao", "nao", "ta",
"ne") nas bordas ou em excesso, o modelo "vaza" esse bordao na fala — foi a
causa do bug "entao nao" da voz Pri (a ref antiga, 120s aleatoria, terminava em
"...apertando o botao nao"). Em vez de cortar um trecho ALEATORIO longo, geramos
varios candidatos curtos em offsets diferentes, transcrevemos cada um e
escolhemos o de MENOR risco de bordao. Heuristica calibrada p/ pt-BR.

Ref: VoxCPM issues #272/#288 (palavra/artefato extra no inicio com ref no mesmo
idioma); usage_guide oficial ("Check prompt_text accuracy first").
Heuristica portada do A/B validado em frontend/_ab_pri_reference_test.cjs.
"""
from __future__ import annotations

import re
import subprocess
from pathlib import Path
from typing import Callable, NamedTuple

import soundfile as sf

# Bordoes de fala pt-BR que o VoxCPM tende a ecoar quando aparecem na borda da
# referencia. Penalizados com peso maior na ULTIMA palavra (eco mais forte).
_BAD_EDGE = {"entao", "então", "nao", "não", "ta", "tá", "ne", "né"}

# ── ENCERRAMENTO / meta-gravacao (incidente cfa488b5, 24/09) ────────────────
# Duas vozes de producao sairam clonadas do trecho em que o aluno esta
# ENCERRANDO a gravacao — falando SOBRE o arquivo, nao falando:
#   Aline (42fe4302/b265951f/d43ba768, score 12,5): "...vou finalizar, que ja
#     esta dando ate um pouquinho de enjoo. Acho que ja esta bom. Entao eu
#     fecho aqui, agradeco."
#   CHRIS 03 (8225f199, score 9,0): "...vou encerrar essa gravacao ja se
#     foram 28 minutos..."
# O VoxCPM clona o ESTILO da referencia: o modelo vira a pessoa querendo parar
# de gravar. Retreinar o mesmo audio cai no mesmo trecho (Aline treinou 5x,
# 50.000 creditos, 4 vozes iguais). A penalidade e ADITIVA e sozinha ja passa
# do corte de candidata ruim (70 > 25): a janela de encerramento perde para
# QUALQUER outra janela do mesmo audio — nao descarta a voz, so prefere outro
# trecho do mesmo material. So pt-BR, como o resto do vocabulario de bordao.
#
# Vocabulario auditado em 24/09 contra 1405 vozes de producao (portado de
# _frank/ferramentas/2026-09-23_referencia_de_despedida.cjs, versao corrigida
# da ronda de 24/09 — 4 casos reais confirmados, 6 falsos positivos nomeados
# como controle negativo). Duas exclusoes deliberadas, medidas la:
#   - "cansado/cansada" NAO entra: marcou 5 vozes e acertou ZERO (era palavra
#     de CONTEUDO: "voltou para casa menos cansado", "voce ja acordou
#     cansado"). Infla o numero e nao pega nada.
#   - "vou finalizar/encerrar" SOMENTE com a gravacao por perto (<=30 chars:
#     grava*/audio/leitura/video/aqui). Sem essa exigencia a marca pega "vou
#     finalizar semana que vem com voces" — assunto do aluno, nao
#     encerramento. Essa exigencia e o que separa os 4 reais dos 6 falsos.
# Nota de porte: o cjs roda regex ASCII do JS, onde `\bgrava\b` casa dentro de
# "gravação" (ç nao e word char la). Em Python \w e Unicode, entao o radical e
# explicito: grava\w* com guarda (?!ta) p/ nao casar "gravata".
_PERTO_DA_GRAVACAO = r"(?=.{0,30}\b(grava(?!ta)\w*|[aá]udio|leitura|v[ií]deo|aqui)\b)"
_DESPEDIDA_RES = [
    re.compile(p, re.IGNORECASE)
    for p in (
        r"\bvou finaliz\w*\b" + _PERTO_DA_GRAVACAO,
        r"\bvou encerr\w*\b" + _PERTO_DA_GRAVACAO,
        r"\bfecho aqui\b",
        r"\bj[aá] est[aá] bom\b",
        r"\be isso (ai|a[ií])?\b.{0,40}\b(acabou|fim|final)\b",
        r"\bpor hoje [eé] s[oó]\b",
        r"\bdando.{0,12}enjoo\b",
        r"\b[uú]ltima (grava[cç][aã]o|gravacao|leitura)\b",
        r"\bacho que j[aá] (est[aá]|deu)\b",
        r"\bterminando aqui\b",
        r"\bfinalizo\b",
    )
]
# Sozinha ja fica acima do corte de candidata ruim (25): encerramento perde de
# qualquer janela "normal" do mesmo audio.
_DESPEDIDA_PENALTY = 70.0


def _transcript_encerra_gravacao(text: str) -> bool:
    """True se o transcript e fala de ENCERRAMENTO/meta-gravacao (pt-BR)."""
    return any(r.search(text or "") for r in _DESPEDIDA_RES)


def score_reference_transcript(transcript: str, language: str = "pt") -> float:
    """Score de RISCO da referencia: quanto MENOR, melhor (menos bordao).

    Pune bordao na 1a/ultima palavra e excesso de "entao/nao/ta/ne", e o desvio
    do tamanho-alvo (~85 palavras p/ ~30s de fala). Bordoes so contam p/ pt-BR;
    em outros idiomas o score considera so o tamanho.
    """
    text = (transcript or "").strip()
    lower = text.lower()
    words = [w for w in re.split(r"\s+", lower) if w]
    if not words:
        return 9999.0
    score = 0.0
    # FRONTEIRA DE FRASE (caso "hoje" engolido 2026-07-17): ref que termina no
    # meio de frase faz o continuation emendar o texto novo como se fosse a
    # mesma fala — a 1a palavra da geracao sai atropelada/engolida (VoxCPM
    # issue #272: a cauda da ref vaza no inicio da saida). Pune forte a janela
    # sem pontuacao terminal no fim; leve a que comeca no meio de frase.
    if not re.search(r"[.!?…]\s*$", text):
        score += 30
    if text and text[0].islower():
        score += 8
    if language.startswith("pt"):
        first = words[0]
        last = re.sub(r"[.,!?;:]+$", "", words[-1])
        if first in _BAD_EDGE:
            score += 25
        if last in _BAD_EDGE:
            score += 40
        score += len(re.findall(r"\b(entao|então)\b", lower)) * 8
        score += len(re.findall(r"\b(nao|não)\b", lower)) * 10
        score += len(re.findall(r"\b(ta|tá|ne|né)\b", lower)) * 6
        # ENCERRAMENTO (cfa488b5): trecho em que o aluno administra a
        # gravacao em vez de falar. Termo ADITIVO — nao mexe nos pesos acima.
        if _transcript_encerra_gravacao(lower):
            score += _DESPEDIDA_PENALTY
    # FRASE-TEMA repetida (caso "me levantar" 2026-07-16): se o bi/trigrama
    # FINAL da referencia aparece de novo no corpo, o continuation ecoa essa
    # frase nas emendas da geracao. Vale pra qualquer idioma.
    tokens = [re.sub(r"[.,!?;:…]+$", "", w) for w in words]
    for n in (3, 2):
        if len(tokens) >= n * 2 + 2:
            tail = " ".join(tokens[-n:])
            body = " ".join(tokens[:-n])
            if tail and tail in body:
                score += 60
                break
    score += abs(len(words) - 85) * 0.1
    return round(score * 10) / 10


def _audio_duration_seconds(path: Path) -> float:
    try:
        info = sf.info(str(path))
        return float(info.frames) / float(info.samplerate or 1)
    except Exception:
        return 0.0


def _slice_window(src: Path, dst: Path, offset: float, seconds: float) -> bool:
    """Corta [offset, offset+seconds] de src -> dst (mono 16k). True se ok."""
    dst.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-ss", str(offset), "-i", str(src), "-t", str(seconds),
        "-ac", "1", "-ar", "16000", str(dst),
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    return r.returncode == 0 and dst.exists() and dst.stat().st_size > 0


# ── Corte em FRONTEIRA DE PALAVRA (caso Katia 2026-08) ─────────────────────
# O corte por tempo arbitrario acima decapita palavras nas DUAS pontas da
# referencia (~1 em 3 vozes novas nasce com farelo de palavra na borda) e o
# VoxCPM ecoa esse farelo nas geracoes. A cura provada manualmente: recortar em
# palavra completa. Aqui automatizamos com word_timestamps do faster_whisper —
# NUNCA heuristica de energia/silencio (testada e reprovada 2x).

# Folga do recorte alem da janela desejada, p/ a 1a/ultima palavra da regiao
# nao ser decapitada pelo proprio corte da janela folgada.
_WINDOW_SLACK_SECONDS = 1.5
# Respiro antes do ataque da 1a consoante / depois da ultima (nao come fonema).
_EDGE_PAD_SECONDS = 0.06
# Clipe ajustado menor que isso (fracao de ref_seconds) nao serve de referencia:
# descarta a candidata e segue pra proxima do ranking.
_MIN_SNAPPED_FRACTION = 0.6


def _word_field(w, name: str):
    """Le start/end/word de um objeto Word do faster_whisper OU de um dict."""
    if isinstance(w, dict):
        return w.get(name)
    return getattr(w, name, None)


def _snap_bounds_to_words(
    words: list,
    region_start: float,
    region_end: float,
    pad: float = _EDGE_PAD_SECONDS,
) -> "tuple[float, float, str] | None":
    """Ajusta [region_start, region_end] p/ fronteiras de PALAVRA COMPLETA.

    `words`: lista de palavras com .start/.end/.word (ou dicts), tempos no
    MESMO relogio de region_start/region_end. Escolhe a 1a palavra que COMECA
    dentro da regiao e a ultima que TERMINA dentro dela — palavra atravessando
    qualquer borda fica de fora. Devolve (start, end, transcript) ou None se
    nenhuma palavra inteira couber.
    """
    eps = 1e-6
    inside = []
    for w in sorted(words or [], key=lambda w: _word_field(w, "start") or 0.0):
        ws, we = _word_field(w, "start"), _word_field(w, "end")
        if ws is None or we is None:
            continue
        if ws >= region_start - eps and we <= region_end + eps:
            inside.append(w)
    if not inside:
        return None
    # FRONTEIRA DE FRASE (28/08, analise das 6 vozes reclamadas): 5 de 8
    # referencias comecavam no MEIO de uma frase ("me portar como alguem
    # que...", "que ela ja tinha derrubado...") e 3 terminavam sem ponto. O
    # score so punia isso com +8/+30, mas quando TODAS as candidatas sao
    # cortadas por palavra, todas pagam a multa e a escolhida continua torta.
    # O VoxCPM copia a prosodia do trecho: referencia que entra no meio de
    # frase da geracao que "comeca ruim" (Vinicius #162, Katia #47).
    # Aqui a janela e' encolhida ate a 1a palavra que ABRE frase e a ultima
    # que FECHA frase — so' se o que sobrar ainda tiver tamanho de referencia
    # (>= _MIN_SENTENCE_FRACTION da regiao); senao fica o corte por palavra.
    frase = _trim_to_sentence_bounds(inside, region_end - region_start)
    if frase is not None:
        inside = frase
    transcript = " ".join(
        (_word_field(w, "word") or "").strip() for w in inside
    ).strip()
    transcript = re.sub(r"\s+", " ", transcript)
    if not transcript:
        return None
    start = max(0.0, float(_word_field(inside[0], "start")) - pad)
    end = float(_word_field(inside[-1], "end")) + pad
    return (start, end, transcript)


# Fracao minima da regiao que o recorte por FRASE precisa preservar. Abaixo
# disso a referencia ficaria curta demais (menos material de timbre) e o corte
# por palavra e' o menor mal.
_MIN_SENTENCE_FRACTION = 0.6
_TERMINAL_RE = re.compile(r"[.!?…]+[\"'”’)]*$")


def _fecha_frase(w) -> bool:
    return bool(_TERMINAL_RE.search((_word_field(w, "word") or "").strip()))


def _trim_to_sentence_bounds(inside: list, region_seconds: float) -> "list | None":
    """Encolhe `inside` (palavras inteiras, ordenadas) ate comecar em INICIO de
    frase e terminar em FIM de frase. Devolve None se nao da (sem fronteira
    dentro da janela, ou sobra curta demais)."""
    if not inside:
        return None
    # inicio: a 1a palavra ja abre frase se a anterior (fora da janela) fechou —
    # nao sabemos; entao o inicio valido e' a palavra logo DEPOIS de uma que
    # fecha frase, ou a 1a se ela comeca com maiuscula (whisper capitaliza
    # inicio de frase).
    ini = None
    primeira = (_word_field(inside[0], "word") or "").strip()
    if primeira[:1].isupper():
        ini = 0
    else:
        for i in range(len(inside) - 1):
            if _fecha_frase(inside[i]):
                ini = i + 1
                break
    if ini is None:
        return None
    fim = None
    for j in range(len(inside) - 1, ini, -1):
        if _fecha_frase(inside[j]):
            fim = j
            break
    if fim is None:
        return None
    s0 = _word_field(inside[ini], "start")
    e1 = _word_field(inside[fim], "end")
    if s0 is None or e1 is None or region_seconds <= 0:
        return None
    if (float(e1) - float(s0)) < region_seconds * _MIN_SENTENCE_FRACTION:
        return None
    return inside[ini:fim + 1]


# Status do recorte por palavra: decide o que o laco de candidatas faz.
_SNAP_OK = "ok"                    # clipe recortado em palavra + transcript exato
_SNAP_DISCARD = "discard"          # ficou curto demais / sem palavra inteira -> proxima candidata
_SNAP_UNAVAILABLE = "unavailable"  # sem words (erro/modelo antigo) -> corte por tempo de hoje


# Pausa entre palavras que NAO conta como fala — o MESMO limiar do
# measure_speech_rate_wps (pacing.py, #165), senao regua e candidata ficam em
# unidades diferentes.
_RATE_PAUSE_SECONDS = 0.15


def _words_per_second(
    transcript: str, start: float, end: float, pad: float, words: "list | None" = None,
) -> "float | None":
    """ARTICULACAO do clipe: palavras / segundos FALANDO (sem pad, sem pausas).

    28/08, teste da Ellen em dev: a regua (#165) e' articulacao — desconta as
    pausas >=150ms — mas aqui a candidata era medida em palavras / duracao do
    clipe, COM as pausas. Quem fala pausado (Ellen: 1,5 pal/s de ritmo bruto,
    2,6 de articulacao) parecia "lenta demais" contra a regua de 2,93 e a
    penalidade EMPURRAVA a escolha pro trecho acelerado: o worker escolheu a
    janela de 3,28 (bruto) e o clone saiu em 32s onde ela leva 60. Medido na
    simulacao offline com as 6 candidatas reais. Com `words` (timestamps do
    whisper), as pausas internas saem da conta e as duas medidas batem.
    """
    n = len([w for w in re.split(r"\s+", transcript.strip()) if w])
    dur = (end - start) - 2 * pad
    if n < 5 or dur <= 1.0:
        return None
    falando = dur
    if words:
        lo, hi = start + pad, end - pad
        dentro = []
        for w in words:
            ws, we = _word_field(w, "start"), _word_field(w, "end")
            if ws is None or we is None or we < lo or ws > hi:
                continue
            dentro.append((float(ws), float(we)))
        dentro.sort()
        pausas = sum(
            max(0.0, b[0] - a[1]) for a, b in zip(dentro, dentro[1:])
            if b[0] - a[1] >= _RATE_PAUSE_SECONDS
        )
        falando = max(1.0, dur - pausas)
    return round(n / falando, 2)


# ── POR QUAL CAMINHO A REFERENCIA FOI CORTADA (incidente 89473013) ──────────
# Tres caminhos deste arquivo cortam por TEMPO seco em vez de fronteira de
# palavra, e ate aqui nenhum deixava rastro: depois do treino nao dava pra
# dizer qual deles a voz tinha tomado, e cada ronda re-investigava do zero.
# Estes quatro valores sao a resposta.
#
# ⚠️ ISTO E TELEMETRIA CAUSAL, NAO E DETECTOR DE VOZ QUEBRADA. Medido em
# 12/09 numa amostra de 50 vozes: corte seco -> diverge 18 / ok 18. METADE das
# vozes cortadas a seco esta BOA, entao o campo NAO prediz defeito. Ele nao
# deve virar alerta, bloqueio, marca de "voz suspeita" nem gatilho de cura —
# serve so pra responder "por qual caminho essa voz passou".
CUT_SNAP_OK = "snap_ok"                    # recortado em FRONTEIRA DE PALAVRA (o caminho bom)
CUT_SNAP_UNAVAILABLE = "snap_unavailable"  # nivel 1: whisper de palavras falhou/veio vazio
                                           # NESTA candidata -> corte por tempo.
                                           # Tambem cobre o chamador que nao passa
                                           # transcribe_words_fn (words indisponiveis
                                           # por ausencia, que e o mesmo fato).
CUT_TIME_RETRY = "time_retry"              # nivel 2: TODAS as candidatas morreram no snap
                                           # -> o laco inteiro refez por tempo
CUT_FALLBACK = "fallback"                  # nivel 3: ref_fallback.wav, primeiros
                                           # ref_seconds do 1o arquivo a partir de 0.0


class RefCandidate(NamedTuple):
    """Candidata a referencia + COMO ela foi cortada + em QUE RITMO ela fala.

    Era `tuple[Path, str]`. Continua indexavel ([0]=clip, [1]=transcript,
    [2]=cut_mode), mas desempacotar em DOIS nomes levanta ValueError — os
    consumidores usam os campos por nome (`.clip`, `.transcript`, `.cut_mode`,
    `.wps`).

    `wps` (caso Ellen 25/08: o VoxCPM copia o RITMO da referencia) e' a
    articulacao do clipe em palavras/segundo FALANDO — ver _words_per_second.
    None quando nao deu pra medir (corte por tempo nao tem timestamps de
    palavra), por isso o default: os construtores de 3 argumentos dos
    caminhos por tempo continuam validos.
    """
    clip: Path
    transcript: str
    cut_mode: str
    wps: "float | None" = None


def _cut_snapped_candidate(
    primary: Path,
    clip: Path,
    offset: float,
    ref_seconds: int,
    duration: float,
    transcribe_words_fn: "Callable[[Path], list | None]",
    log: Callable[..., None],
) -> "tuple[str, str | None, float | None]":
    """Corta a candidata em FRONTEIRA DE PALAVRA. Devolve (status, transcript, wps).

    `wps` = palavras por segundo do clipe (caso Ellen 25/08: o VoxCPM copia o
    RITMO da referencia; uma ref cortada num trecho acelerado da pessoa faz o
    clone falar 2x mais rapido que ela). None quando nao deu pra medir.

    Passos: corta uma janela FOLGADA (offset±slack), transcreve com timestamps
    de palavra, acha a 1a/ultima palavra inteiramente dentro da regiao desejada
    e re-corta nesses limites. O transcript devolvido e EXATAMENTE as palavras
    do clipe (sem 2a passada de whisper).
    """
    win_start = max(0.0, offset - _WINDOW_SLACK_SECONDS)
    win_end = offset + ref_seconds + _WINDOW_SLACK_SECONDS
    if duration > 0:
        win_end = min(duration, win_end)
    padded = clip.with_name(clip.stem + "_padded.wav")
    try:
        if not _slice_window(primary, padded, win_start, win_end - win_start):
            log(level="error", event="reference.snap.pad_slice_failed", offset=offset)
            return (_SNAP_UNAVAILABLE, None, None)
        try:
            words = transcribe_words_fn(padded)
        except Exception as exc:  # whisper nunca derruba o treino por isso
            log(level="error", event="reference.snap.words_error",
                offset=offset, error=str(exc))
            words = None
        if not words:
            log(level="info", event="reference.snap.no_words", offset=offset)
            return (_SNAP_UNAVAILABLE, None, None)
        # Tempos do whisper sao relativos ao clipe folgado; a regiao desejada
        # [offset, offset+ref_seconds] vira [offset-win_start, ...] nesse relogio.
        rel_start = offset - win_start
        snapped = _snap_bounds_to_words(words, rel_start, rel_start + ref_seconds)
        if snapped is None:
            log(level="info", event="reference.snap.no_full_word", offset=offset)
            return (_SNAP_DISCARD, None, None)
        start, end, transcript = snapped
        if end - start < ref_seconds * _MIN_SNAPPED_FRACTION:
            log(level="info", event="reference.snap.too_short",
                offset=offset, snapped_seconds=round(end - start, 2))
            return (_SNAP_DISCARD, None, None)
        if not _slice_window(padded, clip, start, end - start):
            log(level="error", event="reference.snap.cut_failed", offset=offset)
            return (_SNAP_UNAVAILABLE, None, None)
        wps = _words_per_second(transcript, start, end, _EDGE_PAD_SECONDS, words)
        log(level="info", event="reference.snap.ok", offset=offset,
            snapped_seconds=round(end - start, 2), words=len(transcript.split()), wps=wps)
        return (_SNAP_OK, transcript, wps)
    finally:
        try:
            padded.unlink(missing_ok=True)
        except OSError:
            pass


def _candidate_offsets(duration: float, ref_seconds: int, max_candidates: int) -> list[float]:
    """Offsets espacados dentro de [margem, duration-ref_seconds-margem].

    Evita o comeco/fim do audio (saudacao de abertura e CTA de fechamento sao os
    trechos mais carregados de bordao). Se o audio mal cobre uma janela, devolve
    so o offset 0.
    """
    usable = duration - ref_seconds
    if usable <= 0:
        return [0.0]
    margin = min(ref_seconds, usable * 0.1)
    lo = margin
    hi = max(margin, duration - ref_seconds - margin)
    if hi <= lo:
        return [round(lo, 1)]
    n = max(1, min(max_candidates, int(usable // ref_seconds)))
    if n == 1:
        return [round(lo, 1)]
    step = (hi - lo) / (n - 1)
    return [round(lo + i * step, 1) for i in range(n)]


# Caso Ellen (25/08): mesma frase, ela 60s, o clone 30s. A ref tinha 3,7 pal/s
# num audio onde ela fala a 1,4. Penalidade por desvio da mediana das
# candidatas: 25% fora = +25 (empata com bordao na 1a palavra); 2x = +100.
_RATE_PENALTY_PER_UNIT = 100.0


def _median(xs: "list[float]") -> "float | None":
    xs = sorted(x for x in xs if x is not None)
    if not xs:
        return None
    m = len(xs) // 2
    return xs[m] if len(xs) % 2 else (xs[m - 1] + xs[m]) / 2


def rate_penalty(wps: "float | None", median: "float | None") -> float:
    """Quanto o score sobe por a candidata falar mais rapido/devagar que a pessoa."""
    if not wps or not median or median <= 0:
        return 0.0
    return round(_RATE_PENALTY_PER_UNIT * abs(wps / median - 1.0), 1)


def select_reference_candidates(
    norm_files: list[Path],
    work_dir: Path,
    ref_seconds: int,
    transcribe_fn: Callable[[Path], "str | None"],
    language: str = "pt",
    max_candidates: int = 6,
    log: Callable[..., None] = lambda **k: None,
    transcribe_words_fn: "Callable[[Path], list | None] | None" = None,
    medidas: "dict | None" = None,
    target_wps: "float | None" = None,
) -> "list[RefCandidate]":
    """Como select_reference_clip, mas devolve TODAS as candidatas válidas
    RANQUEADAS (melhor primeiro). Usado pelo QA pós-treino: se a amostra sair
    contaminada com a 1ª referência, o handler tenta a 2ª, a 3ª…

    Com `transcribe_words_fn` (palavras com .start/.end/.word), cada candidata
    é recortada em FRONTEIRA DE PALAVRA em vez de tempo arbitrário — ver
    _cut_snapped_candidate. Sem words disponíveis, cai no corte por tempo.

    Cada candidata volta como `RefCandidate(clip, transcript, cut_mode, wps)`:
    `cut_mode` diz POR QUAL dos quatro caminhos aquele clipe foi cortado —
    telemetria causal, nunca detector de defeito (ver CUT_* acima) — e `wps`
    é a articulação do clipe (pal/s), None quando o corte foi por tempo.

    Ritmo (caso Ellen 25/08): o VoxCPM copia a velocidade da referência. A
    régua é `target_wps` (velocidade da pessoa medida no dataset INTEIRO,
    #165) quando o treino a passa; senão a mediana dos wps das candidatas.
    Candidata que foge da régua paga rate_penalty no score. Com `medidas`
    (dict), o seletor grava ali speech_rate_wps (a régua usada) e
    reference_rate_wps (o wps da escolhida) p/ o resultado do treino.
    """
    files = [f for f in norm_files if f and f.exists()]
    if not files:
        return []
    primary = max(files, key=_audio_duration_seconds)
    duration = _audio_duration_seconds(primary)
    offsets = _candidate_offsets(duration, ref_seconds, max_candidates)
    work_dir.mkdir(parents=True, exist_ok=True)

    def _rank_pass(
        words_fn: "Callable[[Path], list | None] | None",
        name_suffix: str = "",
        modo_tempo: str = CUT_SNAP_UNAVAILABLE,
    ) -> "list[tuple[float, RefCandidate]]":
        """`modo_tempo`: que caminho o corte por TEMPO representa NESTA passada —
        nivel 1 (snap indisponivel nesta candidata) ou nivel 2 (retry global)."""
        ranked: "list[tuple[float, RefCandidate]]" = []
        for i, off in enumerate(offsets):
            clip = work_dir / f"ref_cand_{i}_{int(off)}s{name_suffix}.wav"
            transcript: "str | None" = None
            cut_mode = modo_tempo
            wps: "float | None" = None
            if words_fn is not None:
                status, snapped, wps = _cut_snapped_candidate(
                    primary, clip, off, ref_seconds, duration,
                    words_fn, log,
                )
                if status == _SNAP_DISCARD:
                    continue  # curta demais / sem palavra inteira: proxima candidata
                if status == _SNAP_OK:
                    transcript = snapped
                    cut_mode = CUT_SNAP_OK
                # _SNAP_UNAVAILABLE: cai no corte por tempo abaixo (fallback),
                # o cut_mode fica em `modo_tempo` — o caminho seco — e o wps
                # veio None junto (sem timestamps, sem medida de ritmo).
            if transcript is None:
                if not _slice_window(primary, clip, off, ref_seconds):
                    log(level="error", event="reference.candidate.slice_failed", offset=off)
                    continue
                transcript = (transcribe_fn(clip) or "").strip()
            if not transcript:
                log(level="info", event="reference.candidate.empty", offset=off)
                continue
            score = score_reference_transcript(transcript, language=language)
            log(level="info", event="reference.candidate", offset=off, score=score,
                transcript_len=len(transcript), cut_mode=cut_mode, wps=wps)
            ranked.append((score, RefCandidate(clip, transcript, cut_mode, wps)))
        return ranked

    scored = _rank_pass(transcribe_words_fn)
    if not scored and transcribe_words_fn is not None:
        # TODAS as candidatas morreram no snap por palavra (ex.: audio sem
        # nenhuma palavra inteira nas janelas). A melhoria NUNCA pode quebrar
        # o treino: refaz o laco inteiro com o corte por TEMPO da main.
        log(level="warning", event="reference.snap.all_discarded_time_retry",
            candidates=len(offsets))
        scored = _rank_pass(None, name_suffix="_time", modo_tempo=CUT_TIME_RETRY)

    if scored:
        # Velocidade NATURAL da pessoa: `target_wps` (medida no dataset
        # INTEIRO, #165) quando o treino a passou; senao a mediana das
        # candidatas (espalhadas pelo audio), como em 25/08. Candidata que
        # foge dela sobe no score — o VoxCPM copia o ritmo da referencia.
        median = _median([cand.wps for _, cand in scored])
        regua = target_wps if target_wps and target_wps > 0 else median
        scored = [
            (score + rate_penalty(cand.wps, regua), cand)
            for score, cand in scored
        ]
        scored.sort(key=lambda t: t[0])
        if medidas is not None:
            medidas["speech_rate_wps"] = regua
            medidas["reference_rate_wps"] = scored[0][1].wps
        log(level="info", event="reference.speech_rate", regua_wps=regua,
            regua_origem="dataset" if regua is not None and regua == target_wps else "mediana",
            median_wps=median, chosen_wps=scored[0][1].wps,
            rates=[cand.wps for _, cand in scored])
        log(level="info", event="reference.selected", source=primary.name,
            score=scored[0][0], seconds=ref_seconds, candidates=len(scored),
            cut_mode=scored[0][1].cut_mode)
        return [cand for _, cand in scored]

    # Fallback: primeiros ref_seconds do 1o arquivo (melhor que nada).
    fb = work_dir / "ref_fallback.wav"
    if _slice_window(files[0], fb, 0.0, ref_seconds):
        transcript = (transcribe_fn(fb) or "").strip()
        if transcript:
            log(level="info", event="reference.fallback", source=files[0].name,
                cut_mode=CUT_FALLBACK)
            return [RefCandidate(fb, transcript, CUT_FALLBACK)]
    return []


def select_reference_clip(
    norm_files: list[Path],
    work_dir: Path,
    ref_seconds: int,
    transcribe_fn: Callable[[Path], "str | None"],
    language: str = "pt",
    max_candidates: int = 6,
    log: Callable[..., None] = lambda **k: None,
) -> "RefCandidate | None":
    """Escolhe a melhor janela de `ref_seconds` (compat: 1ª do ranking).

    Sem `transcribe_words_fn` este caminho NUNCA corta em fronteira de palavra,
    então o `cut_mode` da candidata sai sempre `snap_unavailable`.
    """
    ranked = select_reference_candidates(
        norm_files, work_dir, ref_seconds, transcribe_fn,
        language=language, max_candidates=max_candidates, log=log,
    )
    return ranked[0] if ranked else None
