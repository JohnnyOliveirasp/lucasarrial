"""QA das gerações de TTS do worker.

Saiu do handler.py em 20/08 (o arquivo tinha ~1.700 linhas misturando treino,
inferência e QA). Cada régua está em metrics.py, o laço que regenera em
loop.py, e a normalização de texto/número em text.py e numbers.py.

Os 38 testes de test_coverage_qa.py cobrem exatamente estas funções.
"""
from .loop import registrar_cobertura, run_chunk_qa, start_word_ok, transcribe_seg
from .metrics import chunk_coverage, chunk_intrusions, echo_leak_count, maior_lacuna
from .numbers import digits_to_words
from .text import norm_words

__all__ = [
    "chunk_coverage",
    "chunk_intrusions",
    "digits_to_words",
    "echo_leak_count",
    "maior_lacuna",
    "norm_words",
    "registrar_cobertura",
    "run_chunk_qa",
    "start_word_ok",
    "transcribe_seg",
]
