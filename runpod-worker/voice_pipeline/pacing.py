"""Mede a PAUSA NATURAL de quem gravou e propõe o `tts_silence_ms` da voz.

POR QUÊ EXISTE (caso Katia, 19-21/08/2026). O worker monta o áudio final
inserindo `silence_ms` entre os pedaços de texto, e o default era 0: nenhuma
pausa entre frases. Resultado: fala emendada, a queixa "áudio muito corrido"
que apareceu em suporte. O conserto por voz existia (`tts_silence_ms`), mas
749 das 750 vozes prontas tinham o campo NULO — ou seja, ninguém tinha pausa.

⚠️ UM VALOR FIXO PRA TODOS ESTÁ ERRADO, e a medição é o motivo: a pausa
natural do acervo vai de ~119ms a ~1.051ms, quase 9x de diferença. Dar 220
a todo mundo entrega o dobro da pausa a quem fala emendado e um quinto a quem
fala pausado. Por isso a pausa sai do áudio DA PRÓPRIA PESSOA.

O MÉTODO, e por que o limiar é 0.15: a distribuição de silêncios da fala é
bimodal — intervalo entre PALAVRAS fica perto de ~150ms e a pausa de FRASE
perto de ~450ms. `d=0.15` isola a de frase, que é exatamente a que o worker
insere entre pedaços. Medir com limiar menor misturaria as duas e puxaria a
proposta pra baixo.

Piso e teto existem pra que uma gravação atípica (muito ruído de fundo, ou
alguém que faz pausas dramáticas de 2s) não vire uma voz esquisita pra sempre.
"""
from __future__ import annotations

import re
import subprocess
from pathlib import Path
from typing import Callable

# Faixa aceita. Fora dela é quase sempre artefato de gravação, não ritmo.
#
# ⚠️ O teto é 500, não 450, e o motivo é medido: a única pausa que um OUVIDO
# HUMANO já aprovou foi a da Katia, 466ms (21/08/2026 — mesmo texto e mesma
# voz, comparado contra 220ms). Um teto de 450 cortaria justamente o valor
# validado. A diferença é inaudível, mas um limite que clipa o único ponto
# aprovado está errado por princípio, não por som.
FLOOR_MS = 120
CEIL_MS = 500

# Abaixo disso a amostra é pequena demais pra ter mediana confiável: preferimos
# NÃO calibrar (a voz segue no comportamento de hoje) a calibrar chutando.
MIN_SAMPLES = 4

# Teto de arquivos analisados: o ganho estatístico satura rápido e o treino não
# pode ficar mais lento por causa de uma medida que é um mimo.
MAX_FILES = 8

_SILENCE_RE = re.compile(r"silence_duration: ([0-9.]+)")


def _silences_ms(path: Path, threshold_db: int = -35, min_seconds: float = 0.15) -> list[int]:
    """Durações dos silêncios do arquivo, em ms.

    ⚠️ O ffmpeg escreve o `silencedetect` em STDERR, não em stdout. Ler só o
    stdout devolve lista vazia e faz parecer que ninguém tem pausa nenhuma —
    esse erro já custou uma rodada inteira de medição. Por isso os dois.
    """
    cmd = [
        "ffmpeg", "-hide_banner", "-nostats", "-i", str(path),
        "-af", f"silencedetect=noise={threshold_db}dB:d={min_seconds}",
        "-f", "null", "-",
    ]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    except Exception:
        return []
    saida = (r.stdout or "") + (r.stderr or "")
    return [round(float(m) * 1000) for m in _SILENCE_RE.findall(saida)]


def measure_natural_pause_ms(
    paths: "list[Path]",
    log: Callable[..., None] = lambda **k: None,
) -> "int | None":
    """Mediana da pausa de FRASE nos áudios do aluno, presa entre piso e teto.

    Devolve None quando não dá pra medir com confiança — e None significa
    "não calibra", ou seja a voz continua exatamente como se comportaria hoje.
    Nunca levanta exceção: calibrar pacing é melhoria, não pode derrubar treino.
    """
    try:
        amostras: list[int] = []
        for p in list(paths)[:MAX_FILES]:
            amostras.extend(_silences_ms(Path(p)))

        if len(amostras) < MIN_SAMPLES:
            log(level="info", event="train.pacing.skipped",
                reason="poucas amostras", n=len(amostras))
            return None

        amostras.sort()
        bruto = amostras[len(amostras) // 2]
        proposto = max(FLOOR_MS, min(CEIL_MS, bruto))
        log(level="info", event="train.pacing.measured",
            n=len(amostras), bruto_ms=bruto, proposto_ms=proposto,
            bateu_piso=proposto == FLOOR_MS and bruto < FLOOR_MS,
            bateu_teto=proposto == CEIL_MS and bruto > CEIL_MS)
        return proposto
    except Exception as exc:  # pacing é mimo: NUNCA derruba um treino que deu certo
        log(level="error", event="train.pacing.crashed", error=str(exc)[:300])
        return None


# ── Velocidade natural (regua do QA de ritmo) — incidente 165 ────────────────
# `voices.speech_rate_wps` e' lida em 3 lugares e, ate 28/08, escrita por
# NENHUM codigo (1.010 de 1.012 vozes NULL; so' o script offline
# medir_velocidade_voz.cjs gravava, na mao). O QA de ritmo caia no fallback
# "articulacao da propria referencia", que no caso Ellen deu 2,83 pal/s contra
# 1,7-2,2 de fala real: a regua errada faz o clone sair acelerado e o QA
# aprovar. Aqui a medida sai do DATASET inteiro (VAD ja tirou o silencio
# entre trechos; o que sobra dentro do trecho e' descontado por silencedetect),
# no mesmo treino, sem whisper extra: os .txt ja existem pro manifest.
RATE_FLOOR_WPS = 1.0
RATE_CEIL_WPS = 5.0
RATE_MIN_CHUNKS = 6
RATE_MAX_CHUNKS = 40
RATE_MIN_CHUNK_SECONDS = 3.0
RATE_MIN_CHUNK_WORDS = 6


def _duracao_s(path: Path) -> "float | None":
    try:
        import soundfile as sf
        info = sf.info(str(path))
        return float(info.frames) / float(info.samplerate) if info.samplerate else None
    except Exception:
        return None


def measure_speech_rate_wps(
    dataset_dir: Path,
    log: Callable[..., None] = lambda **k: None,
) -> "float | None":
    """Mediana de palavras / segundo FALANDO nos trechos voice_*.wav + .txt.

    Articulacao, nao ritmo bruto: pausas >=150ms dentro do trecho sao
    descontadas (mesmo limiar do pacing). Amostra limitada a RATE_MAX_CHUNKS
    trechos, espalhados pelo dataset (nao so' o comeco, onde a pessoa ainda
    esta se aquecendo). None = nao calibra: o QA segue no fallback de hoje.
    Nunca levanta excecao — e' medida, nao pode derrubar um treino que deu certo.
    """
    try:
        dataset_dir = Path(dataset_dir)
        wavs = sorted(dataset_dir.glob("voice_*.wav"))
        if len(wavs) > RATE_MAX_CHUNKS:
            passo = len(wavs) / RATE_MAX_CHUNKS
            wavs = [wavs[int(i * passo)] for i in range(RATE_MAX_CHUNKS)]
        amostras: list[float] = []
        for wav in wavs:
            txt = wav.with_suffix(".txt")
            if not txt.exists():
                continue
            palavras = len(txt.read_text(encoding="utf-8").split())
            dur = _duracao_s(wav)
            if dur is None or dur < RATE_MIN_CHUNK_SECONDS or palavras < RATE_MIN_CHUNK_WORDS:
                continue
            falando = dur - sum(_silences_ms(wav)) / 1000.0
            if falando < 1.0:
                continue
            amostras.append(palavras / falando)
        if len(amostras) < RATE_MIN_CHUNKS:
            log(level="info", event="train.rate.skipped", reason="poucas amostras", n=len(amostras))
            return None
        amostras.sort()
        bruto = amostras[len(amostras) // 2]
        wps = round(max(RATE_FLOOR_WPS, min(RATE_CEIL_WPS, bruto)), 3)
        log(level="info", event="train.rate.measured", n=len(amostras), bruto_wps=round(bruto, 3),
            wps=wps, bateu_piso=wps == RATE_FLOOR_WPS and bruto < RATE_FLOOR_WPS,
            bateu_teto=wps == RATE_CEIL_WPS and bruto > RATE_CEIL_WPS)
        return wps
    except Exception as exc:
        log(level="error", event="train.rate.crashed", error=str(exc)[:300])
        return None
