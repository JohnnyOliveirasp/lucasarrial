"""Normalização de texto para comparação de QA."""
from __future__ import annotations

import re
import unicodedata

from .canon import canonizar_contracoes, expandir_falado
from .numbers import digits_to_words


def norm_words(s: str, language: str = "pt") -> list[str]:
    """Palavras minúsculas sem acento/pontuação (comparação de QA).

    Dígitos viram PALAVRAS no idioma do job (caso pestanatiago 19/08): o texto
    do TTS chega por extenso ("E trinta e seis") e o whisper devolve dígitos
    ("E36") — sem expandir, todo texto com número perdia cobertura em áudio
    PERFEITO e o coverage QA reprovava de graça (0.609 medido, 2 estornos).
    Expande dos DOIS lados (esperado e transcrito), então texto cru com dígito
    (fallback sem normalizador) também casa.

    18/09 — a MESMA ideia, dois buracos a mais (os números medidos estão em
    canon.py). O dígito solto já casava; o que não casava era:
      • SÍMBOLO que se fala: "%" -> "por cento", "R$ 97" -> "noventa e sete
        reais", "0,05" -> "zero vírgula zero cinco". Iam pro lixo junto com a
        pontuação, e a palavra falada virava "faltante" em áudio perfeito.
      • CONTRAÇÃO ORAL: o texto guarda "para"/"está"/"você" (a guarda de
        mandato do normalizador REVERTE "pra"->"para" de propósito) e o modelo
        fala "pra"/"tá"/"cê" — o whisper escreve o que ouviu.
    As duas rodam nos DOIS lados, e é o mesmo `norm_words` que normaliza o
    texto do chunk (metrics.py) e a transcrição do whisper (`transcribe_seg`).
    Escrever igual antes de comparar não é afrouxar régua: é parar de comparar
    duas grafias da MESMA fala.
    """
    s = unicodedata.normalize("NFD", (s or "").lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    # ⚠️ ANTES do `[^a-z0-9\s]`: depois dele não sobra "%", "r$" nem vírgula
    # pra ler. Esta é a única ordem em que a regra tem o que ver.
    s = expandir_falado(s, language)
    s = re.sub(r"[^a-z0-9\s]", " ", s)
    # "e36" / "36kg" -> "e 36" / "36 kg": separa letra de dígito antes de expandir
    s = re.sub(r"(?<=[a-z])(?=[0-9])|(?<=[0-9])(?=[a-z])", " ", s)
    out: list[str] = []
    for w in s.split():
        out.extend(digits_to_words(w, language) if w.isdigit() else [w])
    # DEPOIS de o dígito virar palavra: contração é regra de TOKEN, e o token
    # só está completo aqui.
    return canonizar_contracoes(out, language)
