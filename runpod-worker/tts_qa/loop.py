"""Laço de QA de UM chunk: mede, regenera, devolve a MELHOR tentativa."""
from __future__ import annotations

import difflib
import tempfile
from pathlib import Path

import numpy as np
import soundfile as sf

from worker_log import log as _log

from .metrics import (chunk_coverage, chunk_intrusions, echo_leak_count, fim_abrupto,
                      maior_lacuna, ultima_palavra_truncada)
from .rate import measure_seg_rate
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


def palavras_com_tempo(seg, sample_rate, whisper_model, language):
    """Palavras + tempos do trecho (pro QA de última palavra truncada).
    Lista vazia quando não dá pra medir — o QA nunca bloqueia por falha sua."""
    try:
        from voice_pipeline import transcribe_file_words
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            tmp_path = Path(tmp.name)
        sf.write(str(tmp_path), seg, sample_rate)
        try:
            return transcribe_file_words(tmp_path, model_name=whisper_model, language=language)
        finally:
            tmp_path.unlink(missing_ok=True)
    except Exception as exc:
        _log("error", "inference.tail_words.error", error=str(exc)[:200])
        return []


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


def transcribe_seg_autodetect(seg, sample_rate, whisper_model, label):
    """Igual a `transcribe_seg`, mas DEIXA o whisper descobrir o idioma (PR #47).

    Devolve (palavras_normalizadas, idioma, confianca) ou (None, None, 0.0).
    As palavras sao normalizadas no idioma DETECTADO — e ele que manda na
    expansao de digito ("36" -> "thirty six" em ingles, "trinta e seis" em pt).
    """
    try:
        from voice_pipeline import transcribe_file_autodetect
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            tmp_path = Path(tmp.name)
        sf.write(str(tmp_path), seg, sample_rate)
        try:
            texto, lang, prob = transcribe_file_autodetect(tmp_path, model_name=whisper_model)
            return norm_words(texto, lang), lang, prob
        finally:
            tmp_path.unlink(missing_ok=True)
    except Exception as exc:
        _log("error", f"inference.{label}.error", error=str(exc))
        return None, None, 0.0


def _registrar_cobertura(qa_stats: dict, best_coverage: "float | None") -> None:
    """Acumula a cobertura do chunk ENTREGUE nas estatisticas da geracao.

    Ate 26/08 a cobertura so aparecia no payload de FALHA (`coverage_best` em
    `_resultado_incompleto`): das 279 geracoes entregues desde 24/08 dava pra
    contar quantas vezes o QA reprovou, mas NAO a que distancia da regua
    (`coverage_qa_min`) os audios entregues estavam passando — logo nao dava
    pra dizer se apertar/afrouxar a regua move a taxa de reprovacao.

    Registra, por GERACAO:
      coverage_min_visto — menor cobertura entre os chunks (o elo fraco do
                           audio que foi entregue);
      coverage_medio     — media das coberturas medidas;
      coverage_soma      — soma crua (deixa a media auditavel, sem drift de
                           arredondamento incremental);
      coverage_medido_n  — quantos chunks entraram na media (o DENOMINADOR:
                           media sem ele nao distingue "bom" de "nao mediu").

    Chunk inconclusivo (coverage None) fica FORA da media — ele ja e' contado
    em `coverage_none`. So contador: nao decide nada sobre o audio.
    """
    if best_coverage is None:
        return
    anterior = qa_stats.get("coverage_min_visto")
    if anterior is None or best_coverage < anterior:
        qa_stats["coverage_min_visto"] = round(best_coverage, 4)
    soma = qa_stats.get("coverage_soma", 0.0) + best_coverage
    n = qa_stats.get("coverage_medido_n", 0) + 1
    qa_stats["coverage_soma"] = round(soma, 6)
    qa_stats["coverage_medido_n"] = n
    qa_stats["coverage_medio"] = round(soma / n, 4)


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
    rate_target: "float | None" = None,
    rate_tolerance: float = 0.10,
    rate_retries: int = 0,
    rate_model: "str | None" = None,
    eh_ultimo_chunk: bool = False,
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
        start_qa_retries, echo_qa_retries, coverage_qa_retries, intrusion_qa_retries,
        rate_retries if rate_target else 0,
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
        # FIM ABRUPTO (caso Carol Crozeta 26/08) — no MESMO laco, pelo mesmo
        # motivo do ritmo: e' um defeito que NENHUM criterio textual ve, porque
        # o whisper reconstroi a palavra truncada e a cobertura da 100%. Peso
        # 100 (mesmo nivel de palavra faltando): audio que corta no meio da
        # palavra e' entrega quebrada. So o ULTIMO chunk e' julgado — no meio
        # do texto a emenda com o proximo chunk cobre a transicao.
        if eh_ultimo_chunk:
            cortado = fim_abrupto(seg, sample_rate)
            # 2a prova, mais dura que o envelope (o envelope sozinho deixou
            # passar o 0,027 que o Johnny pegou de ouvido): a ULTIMA palavra
            # cabe no tempo que ela levou? Só roda quando o envelope aprovou —
            # se já reprovou, não gasta um whisper a mais.
            if cortado is False:
                truncada = ultima_palavra_truncada(
                    palavras_com_tempo(seg, sample_rate, echo_qa_model, qa_language)
                )
                if truncada:
                    qa_stats["tail_word_flagged"] = qa_stats.get("tail_word_flagged", 0) + 1
                    _log("info", "inference.tail_qa.palavra_curta", idx=idx, attempt=attempt)
                    cortado = True
            qa_stats["tail_checked"] = qa_stats.get("tail_checked", 0) + 1
            if cortado is None:
                qa_stats["tail_none"] = qa_stats.get("tail_none", 0) + 1
            elif cortado:
                qa_stats["tail_flagged"] = qa_stats.get("tail_flagged", 0) + 1
                _log("info", "inference.tail_qa", idx=idx, attempt=attempt, abrupto=True)
                score += 100

        # RITMO (caso Ellen/Johnny 25/08) dentro do MESMO laco: a tentativa e'
        # julgada por conteudo E velocidade juntos — o regen por ritmo nunca
        # mais passa por cima do QA de 1a palavra/cobertura/eco (foi assim que
        # a Ellen perdeu a 1a palavra na v3). Desvio da regua vira pontos
        # proporcionais (20% = +12, 50% = +30): regenera, mas pesa MENOS que
        # palavra faltando (100+) ou intrusa (50).
        if rate_target and attempt < rate_retries:
            wps = measure_seg_rate(seg, sample_rate, rate_model or echo_qa_model, qa_language)
            qa_stats["rate_checked"] = qa_stats.get("rate_checked", 0) + 1
            if wps is None:
                qa_stats["rate_none"] = qa_stats.get("rate_none", 0) + 1
            else:
                desvio = abs(wps / rate_target - 1.0)
                _log("info", "inference.rate_qa", idx=idx, attempt=attempt,
                     wps=wps, alvo=rate_target, desvio=round(desvio, 3))
                if desvio > rate_tolerance:
                    qa_stats["rate_flagged"] = qa_stats.get("rate_flagged", 0) + 1
                    score += int(60 * desvio)
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
    # SEGUNDA OPINIAO NO IDIOMA QUE O WHISPER OUVIU (PR #47, incidente 37bacb68).
    # `qa_language` e o idioma da VOZ, nao do TEXTO. Texto em outro idioma faz o
    # whisper forcado TRADUZIR: cobertura 0, buraco continuo, audio BOM reprovado.
    # Roda SO no caminho de reprovacao e so adota a 2a leitura se for melhor —
    # chunk mudo/comido continua mudo/comido em qualquer idioma (caso Katia).
    if (
        coverage_qa_enabled
        and best_coverage is not None
        and best_coverage < coverage_qa_min
        and best_seg is not None
        and best_seg.size >= int(sample_rate * 0.2)
    ):
        # Telemetria (26/08): o contador sobe assim que o bloco RODA, antes de
        # saber se ajudou. Sem isto, "a chave nao esta na qa" era indecidivel
        # entre "nao rodou" e "rodou e nao melhorou" — foi o que deixou a
        # geracao ed8a5e6b (texto em ingles, voz pt) sem resposta.
        qa_stats["coverage_idioma_checked"] = qa_stats.get("coverage_idioma_checked", 0) + 1
        got2, lang2, prob2 = transcribe_seg_autodetect(
            best_seg, sample_rate, echo_qa_model, "chunk_qa_autodetect"
        )
        if got2 is not None and lang2:
            qa_stats["coverage_idioma_detectado"] = lang2
            qa_stats["coverage_idioma_prob"] = round(prob2, 3)
            if str(lang2).lower() != str(qa_language).lower():
                # Divergencia conta MESMO quando a 2a leitura nao melhorou:
                # este e' o contador que responde "quantos alunos escrevem
                # num idioma diferente do da voz".
                qa_stats["coverage_idioma_divergente"] = qa_stats.get("coverage_idioma_divergente", 0) + 1
            cov2 = chunk_coverage(got2, chunk, lang2)
            lac2 = maior_lacuna(got2, chunk, lang2)
            _log(
                "info", "inference.coverage_qa.autodetect", idx=idx,
                qa_language=qa_language, detectado=lang2, probabilidade=round(prob2, 3),
                coverage_antes=best_coverage, coverage_depois=cov2,
                lacuna_antes=best_lacuna, lacuna_depois=lac2,
            )
            if cov2 is not None and cov2 > best_coverage:
                qa_stats["coverage_idioma_corrigido"] = qa_stats.get("coverage_idioma_corrigido", 0) + 1
                best_coverage, best_lacuna = cov2, lac2
    _registrar_cobertura(qa_stats, best_coverage)
    return best_seg, best_coverage, best_lacuna
