"""Todos os botoes da geracao num objeto so.

Antes eram ~30 variaveis soltas empurradas de trecho em trecho dentro de uma
funcao de 390 linhas. Cada uma tem um POR QUE medido em producao — o comentario
vai junto do campo, nao some no meio do codigo.

Regra: `inp` (o request) manda mais que a env var. Isso permite ajustar UMA voz
sem mexer no default de todo mundo.
"""
from __future__ import annotations

import os
from dataclasses import dataclass

FALSOS = ("0", "false", "False", "")


def _ligado(nome: str, default: str = "1") -> bool:
    return os.environ.get(nome, default) not in FALSOS


def _do_job_ou_env(inp: dict, chave: str, env: str, default: str) -> int:
    """Override por request; sem ele, cai na env. `0` e' valor VALIDO (ex.:
    desligar o crossfade), entao a checagem e' `is not None`."""
    v = inp.get(chave)
    return int(v) if v is not None else int(os.environ.get(env, default))


@dataclass(frozen=True)
class TtsSettings:
    # ── Geracao ────────────────────────────────────────────────────────────
    cfg_value: float
    """1.6 (era 2.0): doc do VoxCPM recomenda 1.5-1.6 p/ MAIS estabilidade e
    menos drift/alucinacao. O backend ja manda 1.6; isto e' so o fallback."""

    inference_timesteps: int
    """15 = meio termo. Doc oficial diz 5-10 draft, 15-25 quality. Em testes:
    10 = pace correto mas qualidade media, drift evidente em texto longo;
    20 = qualidade alta MAS acelerou o pace (Aluno2 de 55s -> 45s, mesmo texto).
    Drift NAO se resolve por timesteps (e estrutural):
    https://github.com/OpenBMB/VoxCPM/issues/302"""

    normalize: bool

    retry_max: int
    retry_ratio: float
    """Retry anti-badcase do VoxCPM (env-tunavel p/ ajustar sem rebuild). So
    pega FALHA GROSSA (audio ~Nx maior que o esperado = loop/repeticao); nao
    pega "entao nao" curto — pra isso vale o ensure_terminal + cfg 1.6."""

    # ── Chunking e montagem ────────────────────────────────────────────────
    chunk_max: int
    silence_ms: int
    crossfade_ms: int
    trim_enabled: bool
    trim_threshold: float
    trim_pad_ms: int
    par_pause_ms: int
    """Pausa REAL entre paragrafos do texto (\\n\\n) — silencio digital anexado
    ao fim do chunk que fecha o paragrafo. 0 desliga."""
    fade_ms: int
    """Micro fade-in: mata o chirp/click residual do 1o patch do VoxCPM (issue
    #272) sem comer fonema — 8ms e' inaudivel como fade."""

    ref_tail_silence_ms: int
    """CAUDA DE SILENCIO na ref (caso "hoje" engolido 2026-07-17): o VoxCPM
    continua ACUSTICAMENTE a cauda da referencia — ref que termina no meio de
    fala faz a 1a palavra da geracao sair fundida/engolida. 0.5-1.0s de silencio
    no fim da ref foi o unico workaround com relato de eliminacao completa no
    issue #272. Aplicado na hora (cache local) — cura TODAS as vozes existentes
    sem retreinar nem tocar no R2."""

    # ── QA por chunk ───────────────────────────────────────────────────────
    qa_language: str

    start_qa_enabled: bool
    start_qa_retries: int
    start_qa_model: str
    """QA do inicio: o continuation engole a 1a palavra quando a cauda da ref
    vaza (issue #272). Roda em TODOS os chunks (caso Katia 19/08 — antes so o
    1o era conferido). So roda em clonagem (com ref)."""

    echo_qa_enabled: bool
    echo_qa_retries: int
    echo_qa_model: str
    """QA anti-eco (caso Carlos 29/07): frases da ref vazando no meio/fim de
    QUALQUER chunk. Modelo proprio: o "small" do start_qa NAO OUVIU 4/7 ecos no
    E2E (recall baixo) — o turbo ja esta na imagem e e' rapido em GPU."""

    coverage_qa_enabled: bool
    coverage_qa_min: float
    coverage_qa_retries: int
    coverage_qa_gap_min: int
    """QA de COMPLETUDE (caso Katia 19/08): chunk cujo audio fala MENOS que o
    texto. `gap_min` e' o tamanho MINIMO (em palavras) do buraco CONTINUO pra
    derrubar o job — abaixo disso, cobertura baixa e' lida como
    texto-que-nao-se-fala e o audio e' ENTREGUE."""

    intrusion_qa_enabled: bool
    intrusion_qa_retries: int
    """QA de INTRUSAO (incidente fb8d29b7, 19/08): palavra a mais/trocada.
    GATE MACIO: regenera e escolhe a tentativa mais limpa, mas NUNCA falha o
    job (23/40 entregas recentes tem o defeito; gate duro = tempestade de
    estorno)."""

    tail_qa_interno_enabled: bool
    tail_qa_interno_modo: str
    tail_qa_interno_palavra: bool
    """QA de FIM ABRUPTO na fronteira INTERNA (#234, 02/09). Ate 01/09 so o
    ULTIMO chunk era julgado, com a premissa de que "a emenda com o proximo
    chunk cobre a transicao" — falsa: o chunk interno ja chega DECAPITADO na
    montagem, a emenda so cola dois pedacos. Medido (regua release_ms <= 35 E
    plato_db > -40, em 4.258 geracoes): 1.371 fronteiras internas ruins em 623
    geracoes (14,6%), 244 alunos, 281 vozes.
    `modo` = "sombra" (PADRAO) conta e loga sem mexer no score: NENHUMA entrega
    muda de rumo nesta fase. "reprovando" liga o peso 100 (= regen do chunk) —
    basta virar TTS_TAIL_QA_INTERNO_MODO=reprovando, sem deploy novo.
    `palavra` (TTS_TAIL_QA_INTERNO_PALAVRA, padrao 0) liga tambem a 2a prova por
    whisper com timestamp na fronteira interna: cara (N whispers por geracao em
    vez de 1) e FORA da regua que mediu o alcance — por isso desligada na sombra.
    TTS_TAIL_QA_INTERNO=0 desliga o julgamento interno inteiro (valvula: o
    envelope e' numpy puro, mas roda por chunk e por tentativa)."""

    reference_wav_too: bool
    """Passa a referencia tambem em reference_wav_path (README: 'maximum
    cloning similarity'). TTS_REFERENCE_WAV_TOO=0 desliga."""

    rate_qa_enabled: bool
    rate_qa_tolerance: float
    rate_qa_retries: int
    rate_qa_max_stretch: float
    rate_qa_model: str
    target_wps: "float | None"
    speech_rate_factor: float
    """Opcao B (Johnny 25/08): o aluno escolhe "mais calmo / normal / mais rapido"
    na tela = regua x 0,85 / 1,0 / 1,15. Vem no input como speech_rate_factor."""
    """QA de RITMO (caso Ellen/Johnny 25/08): o modelo articula mais rapido que
    a pessoa e varia por chunk. Regua = `speech_rate_wps` da voz (vem no input);
    sem ela, a articulacao da propria referencia medida uma vez no job.
    Chunk acima de (1+tolerance)x regua: regenera ate `retries` e estica o
    residuo com atempo (pitch preservado), nunca alem de `max_stretch`.
    GATE MACIO — nunca falha o job."""

    # ── Chunk ALUCINADO (#52, 27/08) ───────────────────────────────────────
    qa_alucinacao_min: float
    """Cobertura abaixo disto nao e' "faltou um pedaco": e' audio que NAO E' o
    texto (chunk alucinado). Medido no Ronald (27/08): 6 falhas no mesmo texto
    com coverage_best 0-0,1 enquanto os outros chunks davam 0,96."""
    qa_alucinacao_max_seguidas: int
    """Quantas tentativas seguidas abaixo de `qa_alucinacao_min` o laco tolera
    antes de PARAR de repetir a mesma chamada. Nada muda entre uma tentativa e
    outra (mesmo texto, mesmos parametros, sem seed): repetir e' cair no mesmo
    poco. Sair cedo entrega o chunk ao resgate, que muda de estrategia."""
    rescue_word_chars: int
    """Nivel 2 do resgate: tamanho maximo (chars) dos pedacos partidos ABAIXO da
    fronteira de frase (virgula/palavras). O split por frase (nivel 1) nao desce
    disso e uma frase longa unica ficava sem resgate ("frase_unica")."""
    rescue_cfg_delta: float
    """Quanto somar ao cfg_value no nivel 2 do resgate (aderencia maior ao
    texto). E' a UNICA alavanca que muda a geracao entre as tentativas — o
    VoxCPM nao expoe seed nem temperatura. Teto 2.5."""

    @property
    def algum_qa_ligado(self) -> bool:
        return (self.start_qa_enabled or self.echo_qa_enabled
                or self.coverage_qa_enabled or self.intrusion_qa_enabled)

    def amostras(self, ms: int, sample_rate: int) -> int:
        """Milissegundos -> nº de amostras, nunca negativo."""
        return max(0, int(sample_rate * ms / 1000))

    @classmethod
    def do_job(cls, inp: dict) -> "TtsSettings":
        return cls(
            cfg_value=float(inp.get("cfg_value", 1.6)),
            inference_timesteps=int(inp.get("inference_timesteps", 15)),
            normalize=bool(inp.get("normalize", False)),
            retry_max=int(os.environ.get("TTS_RETRY_MAX_TIMES", "4")),
            # 25/08 (caso Ellen): no modelo, max_len = tokens x ratio + 10 e a tomada
            # que passa disso e' DESCARTADA e refeita. Com 4.0, quem fala devagar
            # bate no teto: so as tomadas rapidas sobrevivem. Fabricante: 6.0.
            retry_ratio=float(os.environ.get("TTS_RETRY_RATIO", "6.0")),
            chunk_max=int(os.environ.get("TTS_CHUNK_MAX_CHARS", "160")),
            silence_ms=_do_job_ou_env(inp, "chunk_silence_ms", "TTS_CHUNK_SILENCE_MS", "0"),
            crossfade_ms=_do_job_ou_env(inp, "chunk_crossfade_ms", "TTS_CHUNK_CROSSFADE_MS", "60"),
            trim_enabled=_ligado("TTS_CHUNK_TRIM"),
            trim_threshold=float(os.environ.get("TTS_CHUNK_TRIM_THRESHOLD", "0.005")),
            trim_pad_ms=int(os.environ.get("TTS_CHUNK_TRIM_PAD_MS", "20")),
            par_pause_ms=int(os.environ.get("TTS_PARAGRAPH_PAUSE_MS", "300")),
            fade_ms=int(os.environ.get("TTS_START_FADE_MS", "8")),
            ref_tail_silence_ms=int(os.environ.get("TTS_REF_TAIL_SILENCE_MS", "600")),
            qa_language=inp.get("language", "pt"),
            start_qa_enabled=_ligado("TTS_START_QA"),
            start_qa_retries=int(os.environ.get("TTS_START_QA_RETRIES", "2")),
            start_qa_model=os.environ.get("TTS_START_QA_WHISPER", "small"),
            echo_qa_enabled=_ligado("TTS_ECHO_QA"),
            echo_qa_retries=int(os.environ.get("TTS_ECHO_QA_RETRIES", "3")),
            echo_qa_model=os.environ.get("TTS_ECHO_QA_WHISPER", "large-v3-turbo"),
            coverage_qa_enabled=_ligado("TTS_COVERAGE_QA"),
            coverage_qa_min=float(os.environ.get("TTS_COVERAGE_QA_MIN", "0.85")),
            coverage_qa_retries=int(os.environ.get("TTS_COVERAGE_QA_RETRIES", "3")),
            coverage_qa_gap_min=int(os.environ.get("TTS_COVERAGE_QA_GAP_MIN", "6")),
            intrusion_qa_enabled=_ligado("TTS_INTRUSION_QA"),
            intrusion_qa_retries=int(os.environ.get("TTS_INTRUSION_QA_RETRIES", "3")),
            tail_qa_interno_enabled=_ligado("TTS_TAIL_QA_INTERNO"),
            # SOMBRA e' o padrao DELIBERADO (#234): a 1a fase so mede. Trocar o
            # default aqui sem olhar a telemetria e' repetir 19/08.
            tail_qa_interno_modo=os.environ.get("TTS_TAIL_QA_INTERNO_MODO", "sombra"),
            tail_qa_interno_palavra=_ligado("TTS_TAIL_QA_INTERNO_PALAVRA", "0"),
            reference_wav_too=_ligado("TTS_REFERENCE_WAV_TOO"),
            # DESLIGADO por padrao desde 29/08 (Johnny, no ouvido): ele comparou
            # o MESMO texto na voz do Lucas com e sem o QA de ritmo e aprovou o
            # SEM ("ficou perfeito"). Medido no par: 67,7s sem QA contra 72,1s
            # com o esticador 0,85 -- e o incomodo nao era so o esticador: os
            # regens do QA de ritmo tambem mudavam a prosodia.
            # ⚠️ O QUE SE PERDE: a correcao de quem fala RAPIDO demais (casos
            # Victor e Ellen, 28/08), que era a razao do esticador existir.
            # Se voltar a aparecer "voz acelerada", religue com TTS_RATE_QA=1
            # no template do endpoint -- a env continua mandando.
            # Padrao DESLIGADO (29/08, Johnny no ouvido) e ESCOLHA DO ALUNO na
            # tela: `rate_qa` no input liga/desliga por geracao. Sem o campo,
            # vale a env (que hoje esta desligada).
            rate_qa_enabled=(
                bool(inp["rate_qa"]) if inp.get("rate_qa") is not None
                else _ligado("TTS_RATE_QA", "0")
            ),
            # 25/08 Ellen: com 0,20 so 1 de 5 chunks disparou (2,5-2,6 contra regua 2,16) e
            # o texto de 60s saiu em 48,6s; 0,10 pega os chunks a 2,4+ .
            rate_qa_tolerance=float(os.environ.get("TTS_RATE_QA_TOLERANCE", "0.10")),
            rate_qa_retries=int(os.environ.get("TTS_RATE_QA_RETRIES", "2")),
            # 0,85 (Johnny 28/08): o 0,75 POR PEDACO soou "bebado" (25/08); o
            # ajuste aqui e' UNICO e uniforme no audio inteiro, apos a montagem
            # (_ajustar_ritmo_global), e 0,90 (11%) nao alcancava desvios de
            # 30-35% medidos hoje (Victor, Ellen). 0,85 = ate 18% mais longo.
            # Referencia escolhida no ritmo da pessoa NAO resolveu (rodada 2 em
            # dev); o esticador e' a unica alavanca que age na SAIDA.
            rate_qa_max_stretch=float(os.environ.get("TTS_RATE_QA_MAX_STRETCH", "0.85")),
            rate_qa_model=os.environ.get("TTS_RATE_QA_WHISPER", os.environ.get("TTS_ECHO_QA_WHISPER", "large-v3-turbo")),
            target_wps=(float(inp["speech_rate_wps"]) if inp.get("speech_rate_wps") else None),
            speech_rate_factor=min(1.5, max(0.5, float(inp.get("speech_rate_factor") or 1.0))),
            qa_alucinacao_min=float(os.environ.get("TTS_QA_ALUCINACAO_MIN", "0.3")),
            qa_alucinacao_max_seguidas=int(os.environ.get("TTS_QA_ALUCINACAO_MAX_SEGUIDAS", "2")),
            rescue_word_chars=int(os.environ.get("TTS_RESCUE_WORD_CHARS", "70")),
            rescue_cfg_delta=float(os.environ.get("TTS_RESCUE_CFG_DELTA", "0.4")),
        )
