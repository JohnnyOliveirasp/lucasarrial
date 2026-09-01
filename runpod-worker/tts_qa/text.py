"""Normalização de texto para comparação de QA."""
from __future__ import annotations

import re
import unicodedata

from .numbers import digits_to_words


def norm_words(s: str, language: str = "pt") -> list[str]:
    """Palavras minúsculas sem acento/pontuação (comparação de QA).

    Dígitos viram PALAVRAS no idioma do job (caso pestanatiago 19/08): o texto
    do TTS chega por extenso ("E trinta e seis") e o whisper devolve dígitos
    ("E36") — sem expandir, todo texto com número perdia cobertura em áudio
    PERFEITO e o coverage QA reprovava de graça (0.609 medido, 2 estornos).
    Expande dos DOIS lados (esperado e transcrito), então texto cru com dígito
    (fallback sem normalizador) também casa."""
    s = unicodedata.normalize("NFD", (s or "").lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = re.sub(r"[^a-z0-9\s]", " ", s)
    # "e36" / "36kg" -> "e 36" / "36 kg": separa letra de dígito antes de expandir
    s = re.sub(r"(?<=[a-z])(?=[0-9])|(?<=[0-9])(?=[a-z])", " ", s)
    out: list[str] = []
    for w in s.split():
        out.extend(digits_to_words(w, language) if w.isdigit() else [w])
    return out
