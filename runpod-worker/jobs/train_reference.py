"""Referencia da voz e amostra pos-treino — as duas coisas que o aluno OUVE.

A referencia e' o par (audio curto, transcricao) que a clonagem usa em modo
continuation. A amostra e' o "ola, sua voz esta pronta" que vai no e-mail.
As duas se cruzam: quando a amostra sai errada, a culpa costuma ser da
referencia — e aqui trocamos a referencia pela proxima candidata.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

from whisper_qa import sample_qa_similarity, transcribe_with_retry
from worker_config import REFERENCE_SECONDS, SAMPLE_QA_MAX_ATTEMPTS, SAMPLE_QA_MIN_SIMILARITY
from worker_log import log as _log


@dataclass
class Referencia:
    """O estado da referencia da voz ao longo do job."""
    uploaded: bool = False
    transcript: str | None = None
    error: str | None = None
    clip: Path | None = None
    candidatas: list = field(default_factory=list)   # ranking p/ o QA da amostra


def escolher_e_subir(inp: dict, dirs, norm_dir: Path, whisper_model: str,
                     language: str) -> Referencia:
    """Corta REFERENCE_SECONDS de um audio ja LIMPO pelo Demucs e sobe.

    Substitui o upload manual de referencia — garante que a ref e' curta (sem
    estourar o contexto do VoxCPM). Transcreve 1x aqui pra a geracao nao
    precisar re-transcrever toda vez.

    A referencia e' ATOMICA: a clonagem usa audio + transcricao JUNTOS (modo
    continuation). Transcrevemos AQUI e so subimos o audio se a transcricao der
    certo — nunca um meio-estado (audio sem texto), que faz a geracao cortar
    cedo. Falhou tudo -> sem referencia (a voz ainda gera com a LoRA pura), e
    isso fica REGISTRADO no resultado.
    """
    ref = Referencia()
    reference_upload_url = inp.get("reference_upload_url")
    if not reference_upload_url:
        return ref

    from voice_pipeline import select_reference_candidates, upload_file_to_presigned_url

    norm_files = sorted(norm_dir.glob("*_mono16k.wav"))
    if not norm_files:
        ref.error = "no normalized audio to slice the reference from"
        _log("error", "train.reference.no_norm_files")
        return ref

    # Selecao ANTI-BORDAO: em vez de cortar um trecho aleatorio de 120s, testa
    # varias janelas de REFERENCE_SECONDS em offsets diferentes, transcreve cada
    # uma e escolhe a de menor risco de "filler" ("entao/nao/ta/ne" na borda).
    # Conserta a raiz do bug "entao nao" (a ref aleatoria da Pri terminava em
    # "...apertando o botao nao").
    ref.candidatas = select_reference_candidates(
        norm_files,
        work_dir=dirs.job / "ref_candidates",
        ref_seconds=REFERENCE_SECONDS,
        transcribe_fn=lambda p: transcribe_with_retry(p, whisper_model, language, attempts=2),
        # Corte em FRONTEIRA DE PALAVRA (caso Katia): timestamps de palavra do
        # whisper. Se falhar/vier vazio, o seletor cai sozinho no corte por
        # tempo de sempre — nunca quebra o treino.
        transcribe_words_fn=lambda p: transcrever_palavras_seguro(p, whisper_model, language),
        language=language,
        log=lambda **k: _log(k.pop("level", "info"), k.pop("event", "train.reference"), **k),
    )
    escolhida = ref.candidatas[0] if ref.candidatas else None
    if not escolhida:
        ref.error = "reference selection/transcription returned empty"
        _log("error", "train.reference.transcribe_failed", detail=ref.error)
        return ref

    clip, transcript = escolhida
    upload_file_to_presigned_url(clip, reference_upload_url, content_type="audio/wav")
    ref.uploaded = True
    ref.transcript = transcript
    ref.clip = clip          # reusada na amostra pos-treino
    _log("info", "train.reference.done", seconds=REFERENCE_SECONDS,
         transcript_len=len(transcript))
    return ref


def transcrever_palavras_seguro(wav_path: Path, whisper_model: str, language: str):
    """Palavras com timestamp (.start/.end/.word) p/ o corte em fronteira de
    palavra. NUNCA levanta: erro vira None e o seletor cai no corte por tempo."""
    from voice_pipeline import transcribe_words

    try:
        words = transcribe_words(
            str(wav_path), model_name=whisper_model, language=language,
            log=lambda m: _log("info", "ref.whisper.words", detail=m),
        )
        return words or None
    except Exception as exc:
        _log("error", "ref.words.error", error=str(exc))
        return None


def gerar_amostra_com_qa(inp: dict, dirs, ref: Referencia, lora_path: Path,
                         lora_rank: int, lora_alpha: int, model_dir: Path,
                         whisper_model: str, language: str) -> dict:
    """Gera a amostra, TRANSCREVE e compara com o texto esperado.

    Similaridade baixa = referencia vazando conteudo na geracao (caso "me
    levantar" 2026-07-16) -> troca a referencia pela PROXIMA candidata do
    ranking e tenta de novo (ate SAMPLE_QA_MAX_ATTEMPTS).

    Best-effort: falha de QA nunca derruba o treino; se nada passar,
    sample_qa="failed" avisa o backend (que alerta o suporte).
    """
    info: dict = {"sample_uploaded": False, "sample_seconds": None, "sample_error": None}
    sample_upload_url = inp.get("sample_upload_url")
    if not sample_upload_url:
        return info

    reference_upload_url = inp.get("reference_upload_url")
    try:
        from sample_gen import generate_training_sample, sample_text_for
        from voice_pipeline import upload_file_to_presigned_url

        sample_text = str(inp.get("sample_text") or sample_text_for(language))
        candidatas = (ref.candidatas[:SAMPLE_QA_MAX_ATTEMPTS]
                      if ref.candidatas else [(ref.clip, ref.transcript)])

        for tentativa, (clip, texto) in enumerate(candidatas):
            if tentativa > 0 and reference_upload_url and clip is not None:
                # Promove a candidata: substitui a referencia OFICIAL (mesma
                # chave R2) e o transcript que vai pro banco via webhook.
                upload_file_to_presigned_url(clip, reference_upload_url, content_type="audio/wav")
                ref.clip, ref.transcript = clip, texto
                _log("info", "train.sample.qa.ref_swapped", attempt=tentativa)

            info = generate_training_sample(
                model_dir=model_dir,
                lora_path=lora_path,
                lora_rank=lora_rank,
                lora_alpha=lora_alpha,
                ref_wav=clip,
                ref_text=texto,
                sample_text=sample_text,
                upload_url=sample_upload_url,
                work_dir=dirs.job / "sample",
                log=lambda **k: _log(k.pop("level", "info"), k.pop("event", "train.sample"), **k),
            )
            if not info.get("sample_uploaded"):
                break   # falha tecnica de geracao/upload — sem QA a fazer

            sim = sample_qa_similarity(
                dirs.job / "sample" / "training_sample.wav",
                whisper_model, language, sample_text,
            )
            info["sample_qa_similarity"] = sim
            _log("info", "train.sample.qa", attempt=tentativa, similarity=sim)
            if sim is None or sim >= SAMPLE_QA_MIN_SIMILARITY:
                info["sample_qa"] = "passed" if tentativa == 0 else "retried_passed"
                break
            info["sample_qa"] = "failed"   # segue pro proximo candidato

        # backend grava a linha do historico com o texto REAL
        info["sample_text"] = sample_text
    except Exception as exc:
        # A amostra e' mimo: NUNCA pode derrubar um treino que ja deu certo.
        _log("error", "train.sample.crashed", error=str(exc))
        info["sample_error"] = str(exc)[:300]
    return info
