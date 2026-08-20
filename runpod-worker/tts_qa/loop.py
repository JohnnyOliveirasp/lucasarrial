"""Laço de QA de UM chunk: mede, regenera, devolve a MELHOR tentativa."""
from __future__ import annotations

import difflib
import tempfile
from pathlib import Path

import numpy as np
import soundfile as sf

from worker_log import log as _log

from .metrics import chunk_coverage, chunk_intrusions, echo_leak_count, maior_lacuna
from .text import norm_words


def transcribe_seg(seg, sample_rate, whisper_model, language, label):
    """Transcreve um trecho de áudio pra QA e devolve as palavras normalizadas.

    None = whisper FALHOU (inconclusivo — QA é rede de segurança, não bloqueia).
    Lista VAZIA = whisper rodou e não ouviu fala — isso é informação REAL, não
    falha: o QA de completude usa a diferença (caso Katia 19/08, chunk que saiu
    praticamente mudo tem que reprovar, não passar como "inconclusivo")."""
    try:
        from voice_pipeline import transcribe_file
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            tmp_path = Path(tmp.name)
        sf.write(str(tmp_path), seg, sample_rate)
        try:
            return norm_words(transcribe_file(tmp_path, model_name=whisper_model, language=language), language)
        finally:
            tmp_path.unlink(missing_ok=True)
    except Exception as exc:
        _log("error", f"inference.{label}.error", error=str(exc))
        return None


def start_word_ok(
    seg: np.ndarray, sample_rate: int, expected_text: str,
    whisper_model: str, language: str,
) -> "bool | None":
    """QA do INÍCIO da geração (caso "hoje" engolido 2026-07-17): transcreve os
    primeiros ~4s do chunk e confere se a 1a palavra esperada está lá. O modo
    continuation do VoxCPM engole/atropela a 1a palavra quando a cauda da ref
    vaza (issue #272). True = ok; False = 1a palavra sumiu (regerar);
    None = Whisper inconclusivo (não bloqueia — QA é rede de segurança).
    """
    expected = norm_words(expected_text, language)
    if not expected:
        return True
    head = seg[: int(sample_rate * 4)]
    if head.size < int(sample_rate * 0.2):
        return None
    got = transcribe_seg(head, sample_rate, whisper_model, language, "start_qa")
    if not got:
        return None
    first = expected[0]
    return any(
        difflib.SequenceMatcher(None, first, w).ratio() >= 0.8 for w in got[:3]
    )


def run_chunk_qa(
    seg,
    idx: int,
    chunk: str,
    regen_fn,
    sample_rate: int,
    prompt_text,
    qa_language: str,
    start_qa_enabled: bool,
    start_qa_retries: int,
    start_qa_model: str,
    echo_qa_enabled: bool,
    echo_qa_retries: int,
    echo_qa_model: str,
    coverage_qa_enabled: bool,
    coverage_qa_retries: int,
    coverage_qa_min: float,
    intrusion_qa_enabled: bool,
    intrusion_qa_retries: int,
    qa_stats: dict,
):
    """Laço de QA de UM chunk: reprovou → regenera (regen_fn); esgotou as
    tentativas → devolve a MELHOR tentativa (menos eco; 1a palavra errada e
    texto faltando pesam mais), não a última.

    Devolve (melhor_seg, cobertura_da_melhor). O CHAMADOR decide o que fazer
    quando a cobertura da melhor tentativa ficou abaixo do mínimo: falhar o
    job explícito, nunca entregar incompleto em silêncio (caso Katia 19/08 —
    ~30% do texto ausente saiu [ready] e custou 555 créditos).
    """
    attempt = 0
    max_attempts = max(
        start_qa_retries, echo_qa_retries, coverage_qa_retries, intrusion_qa_retries
    )
    best_seg, best_score, best_coverage = seg, None, None
    best_lacuna = None
    while attempt < max_attempts:
        score = 0
        coverage = None
        lacuna_desta = None
        # Caso Katia 19/08: o `idx == 0` que havia aqui limitava o QA de 1a
        # palavra ao PRIMEIRO chunk — do 2o em diante o áudio podia começar no
        # meio do texto sem ninguém conferir (foi exatamente onde quebrou: o
        # chunk 0, único protegido, saiu perfeito). Roda em TODOS os chunks.
        if start_qa_enabled and attempt < start_qa_retries:
            ok = start_word_ok(seg, sample_rate, chunk, start_qa_model, qa_language)
            _log("info", "inference.start_qa", idx=idx, attempt=attempt, ok=ok)
            if ok is False:
                score += 100
        # UMA transcrição do chunk inteiro alimenta echo QA E coverage QA —
        # não multiplica o número de chamadas de whisper por chunk.
        got = None
        if (echo_qa_enabled and attempt < echo_qa_retries) or (
            coverage_qa_enabled and attempt < coverage_qa_retries
        ) or (intrusion_qa_enabled and attempt < intrusion_qa_retries):
            if seg.size >= int(sample_rate * 0.2):
                got = transcribe_seg(seg, sample_rate, echo_qa_model, qa_language, "chunk_qa")
            else:
                # Áudio praticamente MUDO: "não ouvi nada" é informação real
                # (chunk 3 da Katia), não falha de whisper — não vira None.
                got = []
        if echo_qa_enabled and attempt < echo_qa_retries:
            leak = echo_leak_count(got, chunk, prompt_text, qa_language)
            qa_stats["echo_checked"] += 1
            if leak is None:
                qa_stats["echo_none"] += 1
            else:
                _log("info", "inference.echo_qa", idx=idx, attempt=attempt, leak=leak)
                if leak > 0:
                    qa_stats["echo_flagged"] += 1
                score += leak
        if coverage_qa_enabled and attempt < coverage_qa_retries:
            coverage = chunk_coverage(got, chunk, qa_language)
            lacuna = maior_lacuna(got, chunk, qa_language)
            qa_stats["coverage_checked"] += 1
            if coverage is None:
                qa_stats["coverage_none"] += 1
            else:
                _log(
                    "info", "inference.coverage_qa", idx=idx, attempt=attempt,
                    coverage=coverage, maior_lacuna=lacuna,
                )
                if coverage < coverage_qa_min:
                    qa_stats["coverage_flagged"] += 1
                    # Penalidade proporcional ao que falta: entre duas
                    # tentativas ruins, best_seg fica com a MAIS completa.
                    score += 100 + int((coverage_qa_min - coverage) * 100)
            lacuna_desta = lacuna
        if intrusion_qa_enabled and attempt < intrusion_qa_retries:
            intrusoes = chunk_intrusions(got, chunk, qa_language)
            qa_stats["intrusion_checked"] += 1
            if intrusoes is None:
                qa_stats["intrusion_none"] += 1
            else:
                _log("info", "inference.intrusion_qa", idx=idx, attempt=attempt, intrusions=intrusoes)
                if intrusoes > 0:
                    qa_stats["intrusion_flagged"] += 1
                    # GATE MACIO (deliberado): intrusão regenera e escolhe a
                    # tentativa mais limpa, mas NUNCA falha o job no esgotamento
                    # — 23 de 40 entregas recentes têm o defeito (fb8d29b7);
                    # gate duro agora viraria tempestade de falha+estorno como
                    # a de 19/08. Peso 50: acima do eco, abaixo do coverage.
                    score += 50 * intrusoes
        if best_score is None or score < best_score:
            best_seg, best_score, best_coverage = seg, score, coverage
            best_lacuna = lacuna_desta
        if score == 0:
            break
        attempt += 1
        if attempt >= max_attempts:
            _log("error", "inference.qa.exhausted", idx=idx, best_score=best_score)
            qa_stats["exhausted"] += 1
            break
        qa_stats["regens"] += 1
        seg = regen_fn()
    return best_seg, best_coverage, best_lacuna
