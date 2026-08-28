"""Referencia da voz e amostra pos-treino — as duas coisas que o aluno OUVE.

A referencia e' o par (audio curto, transcricao) que a clonagem usa em modo
continuation. A amostra e' o "ola, sua voz esta pronta" que vai no e-mail.
As duas se cruzam: quando a amostra sai errada, a culpa costuma ser da
referencia — e aqui trocamos a referencia pela proxima candidata.
"""
from __future__ import annotations

import re

from dataclasses import dataclass, field
from pathlib import Path

from whisper_qa import sample_qa_similarity, transcribe_with_retry
from worker_config import REFERENCE_SECONDS, SAMPLE_QA_MAX_ATTEMPTS, SAMPLE_QA_MIN_SIMILARITY
from worker_log import log as _log


@dataclass
class CuraTranscricao:
    """O que a 2a passada de whisper FEZ com o transcript — nao so o resultado.

    Existe por causa do incidente 52 (qa_coverage): a cura roda dentro do treino
    e, quando ela NAO acontece (whisper mudo ou explodindo), o codigo cai calado
    no texto previsto. Ficava impossivel, depois, dizer se uma voz teve o
    transcript curado ou nao — e cada ronda re-investigava do zero.

    `ramo` diz qual caminho rodou:
      curado               2a passada devolveu texto e ele SUBSTITUIU o previsto
      curado_cauda_podada  idem, mas com uma cauda de alucinacao CONHECIDA
                           ("Obrigado por assistir.", "Musica.") cortada do fim
      rejeitado_incoerente 2a passada devolveu texto que NAO fala do mesmo audio
                           (incidente 108) -> ficou o previsto
      fallback_vazio       whisper devolveu vazio/None -> ficou o previsto
      fallback_erro        whisper levantou excecao    -> ficou o previsto (ver `erro`)
      sem_previsto         whisper nao deu nada E nao havia previsto -> texto vazio

    `erro` e' preenchido sempre que houve excecao, inclusive quando o ramo sai
    `sem_previsto`: o ramo diz DE ONDE veio o texto final, e o erro nao se perde.
    """
    texto: str                      # o que vai pro banco (== texto_depois)
    ramo: str
    texto_antes: str | None = None  # o previsto pelo seletor, ANTES da cura
    erro: str | None = None

    @property
    def texto_depois(self) -> str:
        """Alias de `texto` — nome do par antes/depois usado no payload/DDL."""
        return self.texto


@dataclass
class Referencia:
    """O estado da referencia da voz ao longo do job."""
    uploaded: bool = False
    transcript: str | None = None
    error: str | None = None
    clip: Path | None = None
    candidatas: list = field(default_factory=list)   # ranking p/ o QA da amostra
    cura: CuraTranscricao | None = None   # COMO o transcript acima foi produzido
    speech_rate_wps: float | None = None      # velocidade natural (mediana, pal/s)
    reference_rate_wps: float | None = None   # velocidade da ref escolhida


def escolher_e_subir(inp: dict, dirs, norm_dir: Path, whisper_model: str,
                     language: str, target_wps: "float | None" = None) -> Referencia:
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
    medidas: dict = {}
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
        medidas=medidas,
        # Velocidade real da pessoa (dataset inteiro, #165). None = o seletor
        # usa a mediana das candidatas como regua, como em 25/08.
        target_wps=target_wps,
    )
    ref.speech_rate_wps = medidas.get("speech_rate_wps")
    ref.reference_rate_wps = medidas.get("reference_rate_wps")
    escolhida = ref.candidatas[0] if ref.candidatas else None
    if not escolhida:
        ref.error = "reference selection/transcription returned empty"
        _log("error", "train.reference.transcribe_failed", detail=ref.error)
        return ref

    clip, transcript = escolhida
    cura = transcricao_fiel(clip, transcript, whisper_model, language)
    upload_file_to_presigned_url(clip, reference_upload_url, content_type="audio/wav")
    ref.uploaded = True
    ref.transcript = cura.texto
    ref.cura = cura
    ref.clip = clip          # reusada na amostra pos-treino
    _log("info", "train.reference.done", seconds=REFERENCE_SECONDS,
         transcript_len=len(cura.texto), cura_ramo=cura.ramo)
    return ref


# ── Portao de plausibilidade da cura (incidente 108) ──────────────────────────
# A cura acredita CEGAMENTE na 2a passada de whisper. Mas whisper alucina em
# silencio de cauda: a propria cura ja ESCREVEU cauda fantasma em producao
# (voz a12d737d, 27/08: "...evolucao dos sintomas Obrigado por assistir." — sem
# ponto antes do "Obrigado", um segmento alucinado colado no real; voz acdcd52b:
# "...esquecidos Musica.", a tag [musica] vazando pro texto). Como o VoxCPM
# CONTINUA o texto da referencia, essa cauda vira artefato no comeco de TODA
# geracao do aluno. Daqui pra frente `real` precisa passar por dois filtros.

_ACENTOS = str.maketrans(
    "áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ",
    "aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC",
)

# Abaixo disto a fracao de sobreposicao e' RUIDO, nao evidencia: com 3 palavras,
# uma divergencia legitima de borda ja derruba a fracao pra 0,66. Referencia de
# verdade tem ~30s de fala (dezenas de palavras) — o portao so age onde mede.
_CURA_MIN_PALAVRAS = 8
_CURA_MIN_COBERTURA = 0.5

# Cauda que o whisper INVENTA em silencio — lista fechada e curta, so o que ja
# apareceu em producao ou e' folclore documentado do modelo. Nao e' um filtro
# generico de "frase suspeita": e' uma lista de nomes proprios de alucinacao.
_CAUDAS_FANTASMA = frozenset({
    "obrigado por assistir",
    "obrigada por assistir",
    "obrigado por assistirem",
    "legendas pela comunidade amara org",
    "legendado pela comunidade amara org",
    "legendas pela comunidade",
    "thanks for watching",
    "subtitles by the amara org community",
    "musica",      # tag [Musica] do whisper vazando como palavra
    "aplausos",
    "risos",
})


def _palavras_norm(texto: "str | None") -> list:
    """Palavras em minuscula, sem acento e sem pontuacao — base da comparacao."""
    limpo = re.sub(r"[^\w\s]", " ", (texto or "").translate(_ACENTOS).lower())
    return [p for p in limpo.split() if p]


def _cobertura_do_previsto(real: str, previsto: str) -> float:
    """Fracao das palavras do previsto que TAMBEM aparecem no real (0..1).

    O previsto vem do snap por timestamp de palavra: por construcao ele e'
    exatamente o que esta DENTRO do audio cortado. Se a 2a passada quase nao
    repete essas palavras, ela nao esta descrevendo este audio.
    """
    pv = _palavras_norm(previsto)
    if not pv:
        return 1.0
    rl = set(_palavras_norm(real))
    return sum(1 for p in pv if p in rl) / len(pv)


def _podar_cauda_fantasma(real: str, previsto: str) -> "tuple[str, str | None]":
    """Corta do FIM do `real` uma cauda de alucinacao conhecida.

    So corta se a MESMA cauda nao estiver no fim do previsto: se o audio de
    fato termina em "obrigado por assistir", o previsto (ancorado nos
    timestamps) tambem termina — e ai nao ha nada a cortar.
    """
    tokens = real.split()
    pv_norm = " ".join(_palavras_norm(previsto))
    for corte in range(1, min(len(tokens), 8) + 1):
        cauda_raw = " ".join(tokens[-corte:])
        cauda = " ".join(_palavras_norm(cauda_raw))
        if cauda in _CAUDAS_FANTASMA and not pv_norm.endswith(cauda):
            return " ".join(tokens[:-corte]).strip(), cauda_raw
    return real, None


def transcricao_fiel(clip: Path, texto_previsto: "str | None", whisper_model: str,
                     language: str) -> CuraTranscricao:
    """O transcript gravado no banco tem que ser o que o AUDIO CORTADO contem.

    Caso Negrini (#124, 24/08): o corte por palavra escolhe as palavras pelos
    timestamps do whisper e corta o audio nos limites delas — mas timestamp de
    palavra curta na borda e impreciso: o 'O' final ficou NO TEXTO e FORA do
    audio ('...se precisar O' x audio terminando em 'precisar'). O VoxCPM
    continua o TEXTO da referencia, entao ecoou 'Ou' no comeco de CADA frase
    gerada. Cura manual reescrevendo o transcript resolveu 100% — isto e a
    mesma cura, automatica, no treino: 2a passada de whisper no clipe FINAL.
    Se o whisper falhar, fica o texto previsto (comportamento de antes).
    Fecha com '.' quando o audio termina sem pontuacao: o modelo entende que a
    frase acabou e nao emenda a fala nova na cauda da referencia.

    Devolve CuraTranscricao (texto + QUAL ramo rodou). A DECISAO nao mudou —
    so passou a ficar registrada: antes, whisper mudo e whisper explodindo eram
    indistinguiveis depois do fato.

    Incidente 108: a cura acreditava CEGAMENTE no `real`. Whisper alucina em
    silencio de cauda, entao a cura podia ESCREVER a cauda fantasma que existe
    pra apagar. Agora `real` so entra se for plausivel — ver o bloco de portao
    acima. Divergencia de BORDA (uma ou duas palavras) segue passando: e' pra
    isso que a cura existe.
    """
    real = None
    erro = None
    try:
        real = (transcribe_with_retry(clip, whisper_model, language, attempts=2) or "").strip()
    except Exception as exc:  # nunca derruba o treino
        erro = str(exc)[:300]
        _log("error", "train.reference.transcript_recheck_error", error=str(exc))
    previsto = (texto_previsto or "").strip()

    # Portao: com os DOIS textos na mao, da pra desconfiar do `real`. Sem
    # previsto nao ha com que comparar — segue o comportamento de sempre.
    cauda_podada = None
    rejeitado = False
    if real and previsto:
        bruto = real
        real, cauda_podada = _podar_cauda_fantasma(real, previsto)
        cobertura = _cobertura_do_previsto(real, previsto)
        poucas = len(_palavras_norm(previsto)) < _CURA_MIN_PALAVRAS
        if not real or (not poucas and cobertura < _CURA_MIN_COBERTURA):
            # Wholesale: a 2a passada fala de outro audio. Fica o previsto, que
            # e' ancorado nos timestamps das palavras que estao MESMO no clipe.
            _log("warning", "train.reference.transcript_cura_rejeitada",
                 cobertura=round(cobertura, 3), min_cobertura=_CURA_MIN_COBERTURA,
                 cauda_prevista=previsto[-80:], cauda_real=bruto[-80:])
            real, cauda_podada, rejeitado = "", None, True
        elif cauda_podada:
            _log("warning", "train.reference.transcript_cauda_fantasma_podada",
                 cauda_podada=cauda_podada[:80], cauda_prevista=previsto[-80:])

    texto = real or previsto
    # Fecha a frase: sem pontuacao, ou terminando em virgula/ponto-e-virgula/
    # dois-pontos (whisper corta em ',' quando o clipe acaba no meio) -> '.'.
    texto = re.sub(r"[,;:\-\s]+$", "", texto)
    if texto and texto[-1] not in ".!?…":
        texto += "."
    if real and texto_previsto and real.split()[-1:] != (texto_previsto or "").split()[-1:]:
        _log("info", "train.reference.transcript_fixed",
             cauda_prevista=(texto_previsto or "")[-40:], cauda_real=texto[-40:])

    if real:
        ramo = "curado_cauda_podada" if cauda_podada else "curado"
    elif rejeitado:
        ramo = "rejeitado_incoerente"
    elif previsto:
        ramo = "fallback_erro" if erro else "fallback_vazio"
    else:
        # Nem whisper nem previsto: a referencia sai SEM texto util. Nao e' novo
        # (era o comportamento silencioso de antes), agora fica dito.
        ramo = "sem_previsto"
    cura = CuraTranscricao(texto=texto, ramo=ramo,
                           texto_antes=texto_previsto, erro=erro)
    _log("info", "train.reference.transcript_cura", ramo=ramo,
         len_antes=len(previsto), len_depois=len(texto), erro=erro)
    return cura


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
            # `texto` e' o transcript CRU do seletor; o que vai pro banco — e que
            # o aluno usa em TODA geracao dali pra frente — e' o CURADO. O QA tem
            # que medir o par (audio, texto) que realmente vai ao ar: `ref_text`.
            if tentativa == 0:
                # A cura da candidata 0 ja rodou em escolher_e_subir e esta em
                # ref.transcript/ref.cura: reusa, nao gasta outra passada de whisper.
                ref_text = ref.transcript if ref.transcript is not None else texto
            elif reference_upload_url and clip is not None:
                # Promove a candidata: substitui a referencia OFICIAL (mesma
                # chave R2) e o transcript que vai pro banco via webhook.
                upload_file_to_presigned_url(clip, reference_upload_url, content_type="audio/wav")
                # A cura acompanha a candidata PROMOVIDA: o que fica registrado
                # tem que descrever a referencia que ficou de pe, nao a descartada.
                cura = transcricao_fiel(clip, texto, whisper_model, language)
                ref.clip, ref.transcript, ref.cura = clip, cura.texto, cura
                ref_text = cura.texto
                _log("info", "train.sample.qa.ref_swapped", attempt=tentativa,
                     cura_ramo=cura.ramo)
            else:
                # Candidata NAO promovida (sem URL de referencia): nao ha cura
                # deste clipe, e a da anterior descreve OUTRO audio. Fica o cru.
                ref_text = texto

            info = generate_training_sample(
                model_dir=model_dir,
                lora_path=lora_path,
                lora_rank=lora_rank,
                lora_alpha=lora_alpha,
                ref_wav=clip,
                ref_text=ref_text,
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
