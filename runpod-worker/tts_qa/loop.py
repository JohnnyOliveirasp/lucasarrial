"""Laço de QA de UM chunk: mede, regenera, devolve a MELHOR tentativa."""
from __future__ import annotations

import difflib
import tempfile
from pathlib import Path

import numpy as np
import soundfile as sf

from worker_log import log as _log

from .metrics import (chunk_coverage, chunk_intrusions, divergencias_de_grafia,
                      echo_leak_count, fim_abrupto, maior_lacuna,
                      palavras_faltantes, ultima_palavra_truncada)
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


def registrar_cobertura(qa_stats: dict, best_coverage: "float | None") -> None:
    """Acumula a cobertura de um pedaco ENTREGUE nas estatisticas da geracao.

    Ate 26/08 a cobertura so aparecia no payload de FALHA (`coverage_best` em
    `_resultado_incompleto`): das 279 geracoes entregues desde 24/08 dava pra
    contar quantas vezes o QA reprovou, mas NAO a que distancia da regua
    (`coverage_qa_min`) os audios entregues estavam passando — logo nao dava
    pra dizer se apertar/afrouxar a regua move a taxa de reprovacao.

    Registra, por GERACAO:
      coverage_min_visto — menor cobertura entre os pedacos (o elo fraco do
                           audio que foi entregue);
      coverage_medio     — media das coberturas medidas;
      coverage_soma      — soma crua (deixa a media auditavel, sem drift de
                           arredondamento incremental);
      coverage_medido_n  — quantos pedacos entraram na media (o DENOMINADOR:
                           media sem ele nao distingue "bom" de "nao mediu").

    Chunk inconclusivo (coverage None) fica FORA da media — ele ja e' contado
    em `coverage_none`. So contador: nao decide nada sobre o audio.

    ⚠️ QUEM CHAMA E' O CHAMADOR, DE PROPOSITO (26/08). A 1a versao chamava isto
    no fim de `run_chunk_qa`, o que parecia certo mas registrava audio JOGADO
    FORA: quando a cobertura reprova com buraco continuo, o chunk vai pra
    `_resgatar_por_subdivisao`, que gera OUTRO audio — e e' o do resgate que o
    aluno recebe. O numero do chunk descartado ficava como `coverage_min_visto`
    da geracao.
    Nao e' hipotese: medido em 26/08 nas 294 geracoes com telemetria desde
    24/08, o resgate ENTREGOU 5 vezes, e 4 delas tambem passaram pela escotilha
    de cobertura espalhada — ou seja, exatamente a populacao que este contador
    existe pra julgar. Duas dessas 5 sao os casos mais olhados do chamado 52:
    `96a09526` (janetecasarotto2, o exemplo que motivou a 2a opiniao de idioma)
    e `71a68eb6` (godoyalessandroadv, a pista que o Vigia levantou na ronda das
    00h). Nas duas, a leitura ingenua reportaria a tomada descartada e acenderia
    alarme falso na primeira vez que alguem lesse o instrumento novo.
    So o chamador sabe qual audio virou entrega. Por isso a chamada mora nos
    dois pontos de decisao de `_gerar_todos_os_chunks`/`_resgatar_por_subdivisao`
    e NAO aqui dentro.

    ⚠️ LIMITE HONESTO: os contadores so descrevem entrega quando a geracao
    termina `ready`. Se um chunk posterior derrubar o job, os chunks ja
    registrados continuam na conta e o aluno nao recebeu nada — leia estes
    campos filtrando por `status='ready'` (no job que falha, quem responde e'
    `coverage_best`, no payload de falha).
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


def registrar_tail_interno(
    qa_stats: dict,
    tail_interno: "bool | None",
    dur_s: "float | None" = None,
    amostra_max: int = 40,
) -> None:
    """Acumula o veredito de FRONTEIRA INTERNA do pedaco ENTREGUE (#234).

    DUAS METRICAS DIFERENTES, e confundi-las foi o defeito que este codigo
    conserta (02/09). Elas medem coisas distintas e as duas servem:

      tail_interno_checked / _flagged / _sombra  (contadores POR TENTATIVA,
        incrementados dentro do laco de `run_chunk_qa`)
        -> medem PRESSAO DE REGEN: quantas TENTATIVAS ganhariam +100 se a
           chave `TTS_TAIL_QA_INTERNO_MODO` virasse pra "reprovando". Contam
           tentativas DESCARTADAS de proposito — e' exatamente isso que a
           estimativa de custo do rollout precisa saber. NAO descrevem o audio
           que o aluno recebeu.

      tail_interno_entregue / _entregue_n  (registrados AQUI, pelo chamador)
        -> medem a ENTREGA: de todos os pedacos que viraram audio do aluno,
           quantos tinham a fronteira interna decepada. E' o numero que
           responde "o #234 ainda chega no aluno?".

    Prova de que uma nao substitui a outra: a geracao 97464f01 tem regens=19 e
    tail_interno_checked=37 — 37 checagens pra um numero de chunks muito menor,
    porque cada regen re-checa. Ler aquele 37 como "37 fronteiras entregues"
    reportaria um alcance varias vezes maior que o real.

    Campos:
      tail_interno_entregue    — NUMERADOR: pedacos entregues com a fronteira
                                 interna reprovada;
      tail_interno_entregue_n  — DENOMINADOR: pedacos entregues em que a
                                 fronteira interna teve VEREDITO (sem ele o
                                 numerador nao distingue "bom" de "nao mediu",
                                 mesmo motivo do `coverage_medido_n`);
      tail_interno_entregue_sem_veredito — pedacos entregues SEM veredito
                                 (ultimo chunk do arquivo, julgamento interno
                                 desligado, ou medida inconclusiva/audio mudo).
                                 Fecha a conta: entregues = n + sem_veredito.

    POSICAO DA FRONTEIRA (f8587cef/#234, 22/09) — o contador acima diz QUE uma
    fronteira reprovada foi entregue, mas nao ONDE no audio; foi isso que
    impediu a ronda de 21/09 de mandar um ouvido conferir ponto a ponto as 4
    geracoes discordantes. Quando o chamador passa `dur_s` (duracao em segundos
    do pedaco entregue), dois campos novos nascem JUNTOS na primeira chamada
    com duracao (ausentes = codigo antigo / duracao nao medida; presentes com
    lista vazia = mediu e nenhuma fronteira reprovou — a mesma disciplina
    numerador-nasce-com-denominador do resto deste arquivo):

      tail_interno_entregue_t_s   — relogio de entrega: soma das duracoes de
                                    TODOS os pedacos ja registrados, inclusive
                                    os sem veredito. Inclusive de proposito:
                                    um pedaco mudo/inconclusivo no MEIO do
                                    arquivo ocupa tempo, e pular a duracao
                                    dele deslocaria toda posicao seguinte.
      tail_interno_entregue_pos_s — offsets (fim do pedaco atual, em s) das
                                    fronteiras com veredito True, na ordem de
                                    entrega, com teto `amostra_max` (mesmo
                                    padrao de `registrar_faltantes`: as
                                    PRIMEIRAS; `entregue` ao lado denuncia
                                    quando a amostra esta cortada).

    ⚠️ HONESTIDADE DA MEDIDA — estes offsets sao APROXIMACAO, nao timestamp
    exato no arquivo final:
      - a montagem aplica CROSSFADE entre pedacos, que ENCURTA o audio: a
        posicao real fica ~(n_fronteiras_anteriores x crossfade) ANTES do
        offset gravado. O chamador grava o crossfade usado em
        `tail_interno_pos_crossfade_ms` (inference.py) pra quem le poder
        corrigir;
      - pausa de paragrafo e silencio entre chunks sao concatenados DEPOIS
        do registro e ALONGAM o audio: quando existem, a posicao real fica
        DEPOIS do offset gravado.
    Ou seja: use como guia pra apontar o ouvido humano na regiao certa
    (±poucos segundos), nunca como corte automatico por timestamp.

    `dur_s=None` (default) = comportamento anterior, inalterado: so os
    contadores, nenhum campo novo criado.

    ⚠️ QUEM CHAMA E' O CHAMADOR, DE PROPOSITO — mesma razao de
    `registrar_cobertura` (leia o aviso de la, 26/08): o audio julgado dentro
    de `run_chunk_qa` ainda pode ser jogado fora pelo resgate por subdivisao, e
    no resgate quem entrega sao os SUB-PEDACOS. So o chamador sabe o que virou
    entrega. Por isso a chamada mora nos mesmos pontos de
    `registrar_cobertura` e NAO dentro do laco.

    ⚠️ LIMITE HONESTO, igual ao da cobertura: os contadores so descrevem
    entrega quando a geracao termina `ready`. Se um chunk posterior derrubar o
    job, os pedacos ja registrados continuam na conta e o aluno nao recebeu
    nada — leia estes campos filtrando por `status='ready'`.
    """
    if dur_s is not None:
        # O relogio anda pra TODO pedaco com duracao medida — inclusive sem
        # veredito (ver docstring: pedaco mudo no meio do arquivo ocupa tempo).
        # A lista nasce junto, mesmo vazia: ausente != "mediu e nada reprovou".
        qa_stats["tail_interno_entregue_t_s"] = round(
            qa_stats.get("tail_interno_entregue_t_s", 0.0) + float(dur_s), 3
        )
        qa_stats.setdefault("tail_interno_entregue_pos_s", [])
    if tail_interno is None:
        qa_stats["tail_interno_entregue_sem_veredito"] = (
            qa_stats.get("tail_interno_entregue_sem_veredito", 0) + 1
        )
        return
    qa_stats["tail_interno_entregue_n"] = qa_stats.get("tail_interno_entregue_n", 0) + 1
    # O numerador nasce em 0 junto com o denominador: campo AUSENTE com o
    # denominador presente seria de novo "nao mediu" indistinguivel de "mediu e
    # deu zero".
    qa_stats["tail_interno_entregue"] = (
        qa_stats.get("tail_interno_entregue", 0) + (1 if tail_interno else 0)
    )
    if tail_interno and dur_s is not None:
        # Fronteira reprovada ENTREGUE: apenda o fim do pedaco atual (limite
        # superior — ver "HONESTIDADE DA MEDIDA" acima). Teto obrigatorio, o
        # mesmo motivo do `registrar_faltantes`: qa_stats vira jsonb no banco.
        pos = qa_stats["tail_interno_entregue_pos_s"]
        if len(pos) < max(0, int(amostra_max)):
            pos.append(qa_stats["tail_interno_entregue_t_s"])


def registrar_faltantes(qa_stats: dict, faltantes, amostra_max: int = 20) -> None:
    """Acumula QUAIS palavras sumiram do pedaco ENTREGUE (702cc916, 04/09).

    TELEMETRIA PURA: nao decide nada. Nenhum portao le estes campos, nenhum job
    passa a falhar por causa deles. Existem pra que o proximo caso Katia seja
    LIDO em vez de adivinhado — ver `palavras_faltantes` em metrics.py pro
    porque (cobertura 0,800 com buraco espalhado e' indistinguivel entre
    "sumiu **negrito**" e "sumiu voce/nao/muito", e a escotilha
    `_entregar_mesmo_com_cobertura_baixa` entrega os dois).

    Campos:
      faltantes_total          — palavras perdidas somando TODOS os pedacos
                                 entregues da geracao;
      faltantes_medido_n       — DENOMINADOR: pedacos entregues em que deu pra
                                 medir. Sem ele, `faltantes_total` = 0 nao
                                 distingue "audio integro" de "nao mediu" —
                                 mesmo motivo do `coverage_medido_n` e do
                                 `tail_interno_entregue_n`;
      faltantes_sem_veredito   — pedacos entregues sem medida (whisper falhou,
                                 ou chunk sem palavra). Fecha a conta:
                                 entregues = medido_n + sem_veredito;
      faltantes_pior_n         — quantas palavras sumiram no PIOR pedaco;
      faltantes_amostra        — as `amostra_max` PRIMEIRAS palavras perdidas
                                 desse pior pedaco, na ordem do texto.

    PIOR = o pedaco que perdeu MAIS palavras (nao o de menor cobertura). Os
    dois eixos ja tem dono e respondem perguntas diferentes: quem responde
    "qual pedaco ficou proporcionalmente mais fraco" e' `coverage_min_visto`.
    Aqui a pergunta e' "onde foi parar o texto que sumiu", e a resposta e'
    contagem absoluta — um chunk longo com cobertura 0,90 pode ter comido mais
    palavras que um curto com 0,60. Empate mantem o primeiro: sem criterio de
    desempate a amostra trocaria de dono a cada geracao, sem ganho de leitura.

    ⚠️ TETO OBRIGATORIO. `qa_stats` vira jsonb no banco; despejar a lista
    inteira seria gravar o texto do aluno a cada geracao com chunk mudo (chunk
    mudo = TODAS as palavras faltando). `amostra_max=0` e' valido e desliga so
    a amostra — os CONTADORES continuam, que e' o que responde "piorou?".
    `faltantes_pior_n` fica ao lado justamente pra denunciar quando a amostra
    esta cortada (pior_n > len(amostra)) em vez de fingir que aquilo e' tudo.

    ⚠️ QUEM CHAMA E' O CHAMADOR, DE PROPOSITO — a mesma razao de
    `registrar_cobertura` (26/08) e `registrar_tail_interno` (02/09), e aqui
    ela pesa MAIS que nos dois: o audio julgado dentro de `run_chunk_qa` ainda
    pode ser jogado fora pelo resgate por subdivisao, e um chunk descartado e'
    exatamente o que perde MAIS palavras — ele viraria o "pior" de quase toda
    geracao resgatada e a amostra descreveria audio que o aluno nunca ouviu.
    So o chamador sabe o que virou entrega.

    ⚠️ LIMITE HONESTO, igual ao dos outros dois: os contadores so descrevem
    entrega quando a geracao termina `ready`. Se um chunk posterior derrubar o
    job, os pedacos ja registrados continuam na conta e o aluno nao recebeu
    nada — leia estes campos filtrando por `status='ready'`.
    """
    if faltantes is None:
        qa_stats["faltantes_sem_veredito"] = qa_stats.get("faltantes_sem_veredito", 0) + 1
        return
    # O total nasce em 0 junto com o denominador: campo AUSENTE com o
    # denominador presente seria de novo "nao mediu" indistinguivel de "mediu e
    # nao faltou nada".
    qa_stats["faltantes_medido_n"] = qa_stats.get("faltantes_medido_n", 0) + 1
    qa_stats["faltantes_total"] = qa_stats.get("faltantes_total", 0) + len(faltantes)
    # `is None` e nao `> 0`: no 1o pedaco medido os dois campos tem que NASCER,
    # mesmo com zero faltando — `faltantes_pior_n` ausente ao lado de um
    # denominador presente cairia na mesma armadilha que o resto deste arquivo
    # passa a vida evitando. Empate nao troca o dono da amostra.
    pior = qa_stats.get("faltantes_pior_n")
    if pior is None or len(faltantes) > pior:
        qa_stats["faltantes_pior_n"] = len(faltantes)
        qa_stats["faltantes_amostra"] = list(faltantes[:max(0, int(amostra_max))])


def registrar_grafias(qa_stats: dict, grafias, amostra_max: int = 20) -> None:
    """Acumula o que o audio DISSE e o whisper escreveu de outro jeito (18/09).

    TELEMETRIA PURA, o MESMO contrato de `registrar_faltantes`: nao decide
    nada, nenhum portao le estes campos, nenhum job passa a falhar por causa
    deles.

    POR QUE ELA PRECISA SER CONTAVEL SEPARADO. Ate hoje nome proprio grafado
    diferente (skydivethru 11, cestaro 8, naldy 8, riuls 6 nos 1.035 faltantes
    medidos em 18/09) entrava na conta de "palavra perdida" e sujava os dois
    lados da leitura: inflava `faltantes_total` com audio bom e escondia a
    pergunta que realmente importa, que e "quanto do que o comparador chama de
    divergencia e nome proprio, e quanto e o modelo trocando palavra de
    verdade?". Somar as duas classes num numero so nao responde nenhuma das
    duas. Agora a classe tem coluna propria e da pra contar.

    ⚠️ ELA NAO INOCENTA NADA. Grafia divergente nao prova audio bom — prova que
    o comparador nao serve de juiz naquele ponto. O que estes campos entregam e
    o TAMANHO da zona cinzenta, pra que alguem possa ir OUVIR uma amostra dela
    depois. Ler `grafia_total` como "tudo isso estava certo" seria repetir, com
    outro nome, o erro que esta correcao desfaz.

    Campos (espelham `faltantes_*` de proposito, pra ler lado a lado):
      grafia_total        — pares somando TODOS os pedacos entregues;
      grafia_medido_n     — DENOMINADOR: pedacos entregues em que deu pra
                            medir. Sem ele, `grafia_total` = 0 nao distingue
                            "grafia bateu sempre" de "nao mediu";
      grafia_sem_veredito — pedacos entregues sem medida. Fecha a conta:
                            entregues = medido_n + sem_veredito;
      grafia_pior_n       — quantos pares no PIOR pedaco;
      grafia_amostra      — os `amostra_max` PRIMEIROS pares desse pedaco, no
                            formato "texto>audio" e na ordem do texto.

    ⚠️ QUEM CHAMA E' O CHAMADOR, pelo mesmo motivo de `registrar_cobertura`
    (26/08), `registrar_tail_interno` (02/09) e `registrar_faltantes` (04/09):
    o audio julgado dentro de `run_chunk_qa` ainda pode ser jogado fora pelo
    resgate por subdivisao, e so o chamador sabe o que virou entrega.

    ⚠️ LIMITE HONESTO, o mesmo dos outros tres: estes contadores so descrevem
    entrega quando a geracao termina `ready`. Leia filtrando por
    `status='ready'`.
    """
    if grafias is None:
        qa_stats["grafia_sem_veredito"] = qa_stats.get("grafia_sem_veredito", 0) + 1
        return
    qa_stats["grafia_medido_n"] = qa_stats.get("grafia_medido_n", 0) + 1
    qa_stats["grafia_total"] = qa_stats.get("grafia_total", 0) + len(grafias)
    pior = qa_stats.get("grafia_pior_n")
    if pior is None or len(grafias) > pior:
        qa_stats["grafia_pior_n"] = len(grafias)
        qa_stats["grafia_amostra"] = list(grafias[:max(0, int(amostra_max))])


def intrusao_sistemica(qa_stats: dict, fracao_min: float, checadas_min: int) -> "dict | None":
    """Veredito de INTRUSAO SISTEMICA da geracao inteira (#530, 23/09).

    O gate de intrusao por tentativa e MACIO de proposito (peso 50 no score,
    nunca falha o job — ver o comentario no laco de `run_chunk_qa`): intrusao
    PARCIAL e comum (media 2,46 pedacos sinalizados por geracao entregue,
    fracao media 17,6%, medido em 776 geracoes ready de 14 dias em 23/09) e
    reprovar por ela seria a tempestade de 19/08 de novo.

    O que o gate macio NAO cobre: a geracao onde TODO pedaco, em TODA
    tentativa, acusa conteudo fora do texto. Caso-indice 65f26a72 (23/09):
    18 de 18 checagens sinalizadas, cobertura PERFEITA (faltantes_total 0,
    coverage_medio 1.0), entregue e cobrada 684 cr — o aluno ouviu uma frase
    que nao esta no texto dele repetida a cada paragrafo. O QA de cobertura
    nao ve porque nada FALTA; SOBRA. Regenerar nao resolveu (12 regens): e
    defeito sistematico do par voz/texto, nao azar de tentativa — por isso o
    remedio e falhar o job (o webhook estorna sozinho via handleTechFailure),
    nunca entregar e cobrar em silencio.

    A regua foi medida ANTES de ser escolhida, contra as 776 entregas:
      flagged == checked (100%), qualquer n   -> 7 casos, mas 5 sao textos
        curtos de 1 chunk (33-227 chars, checked 3-4) onde "100%" e so o
        mesmo chunk retentado 3x — sinal fraco demais pra custar uma falha;
      fracao >= 0.9 E checked >= 5 (ESTA)     -> 5 casos de 3 ALUNOS
        distintos (0,64% das entregas; raqueldejuli aparece 3x — e
        reincidencia da mesma aluna, nao alcance maior), todos com a
        assinatura severa: texto longo, muitas regens, quase toda checagem
        acusando. Inclui os 2 confirmados por reclamacao (65f26a72 e
        be84aa8f) e 3 do mesmo padrao que a regua estrita de 100% deixaria
        passar (33/36, 18/19 e 15/16 — dois da MESMA aluna do caso
        confirmado de 15/09, reincidindo em 21/09).

    Denominador de alunos (documentado porque a fracao so vale se a query
    for reproduzivel): count(DISTINCT user_id) sobre a MESMA populacao das
    entregas — generations com status='ready', qa ? 'intrusion_checked',
    created_at >= now() - interval '14 days'. Em 23/09 isso dava ~245
    alunos (a janela desliza com now(): no mesmo dia mediu-se 776/245,
    774 e 775/244 em horas diferentes). Os 3 alunos atingidos sao estaveis
    — o conjunto dos 5 casos nao muda nem alargando a janela pra 16 dias.
    NAO e "alunos ativos" em sentido de assinatura: e alunos com entrega
    ready E telemetria de intrusao na janela, o unico denominador
    comparavel com o numerador.

    Devolve um dict com os numeros (pro payload de falha) quando a geracao e
    sistemica, None quando nao. `fracao_min <= 0` desliga (valvula, mesmo
    padrao das outras chaves de QA). Quem decide falhar e o CHAMADOR — esta
    funcao so mede, pelo mesmo motivo de `registrar_cobertura`.
    """
    if fracao_min is None or fracao_min <= 0:
        return None
    checked = qa_stats.get("intrusion_checked") or 0
    flagged = qa_stats.get("intrusion_flagged") or 0
    if checked < max(1, checadas_min):
        return None
    fracao = flagged / checked
    if fracao < fracao_min:
        return None
    return {
        "intrusion_checked": checked,
        "intrusion_flagged": flagged,
        "intrusion_fracao": round(fracao, 4),
    }


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
    tail_qa_interno_enabled: bool = True,
    tail_qa_interno_modo: str = "sombra",
    tail_qa_interno_palavra: bool = False,
    alucinacao_min: float = 0.3,
    alucinacao_max_seguidas: int = 2,
):
    """Laço de QA de UM chunk: reprovou → regenera (regen_fn); esgotou as
    tentativas → devolve a MELHOR tentativa (menos eco; 1a palavra errada e
    texto faltando pesam mais), não a última.

    Devolve (melhor_seg, cobertura_da_melhor, maior_lacuna_da_melhor,
    fronteira_interna_da_melhor, palavras_faltantes_da_melhor).
    O CHAMADOR decide o que fazer quando a
    cobertura da melhor tentativa ficou abaixo do mínimo: falhar o job
    explícito, nunca entregar incompleto em silêncio (caso Katia 19/08 —
    ~30% do texto ausente saiu [ready] e custou 555 créditos).

    O 4o valor (`bool | None`) é o veredito de fronteira INTERNA da tentativa
    VENCEDORA — o que de fato vira entrega. None = sem veredito (último chunk
    do arquivo, julgamento interno desligado, ou medida inconclusiva). Quem
    acumula é o chamador, via `registrar_tail_interno`, pelo mesmo motivo da
    cobertura: só ele sabe qual áudio virou entrega.

    O 5o valor (`list | None`) são as PALAVRAS que sumiram na tentativa
    VENCEDORA (702cc916, 04/09) — telemetria pura, não pesa no score e não
    muda decisão nenhuma; acompanha a cobertura porque descreve o MESMO áudio
    que ela mede. Quem acumula é o chamador, via `registrar_faltantes`, pela
    terceira vez pelo mesmo motivo.

    O 6o valor (`list | None`) são as DIVERGÊNCIAS DE GRAFIA da tentativa
    VENCEDORA (18/09): o que o áudio disse e o Whisper escreveu de outro jeito,
    em pares "texto>audio". Telemetria pura também, e anda junto das faltantes
    porque as duas saem do MESMO alinhamento — uma nomeia o que o modelo não
    falou, a outra nomeia o que ele falou e o comparador não soube reconhecer.
    Quem acumula é o chamador, via `registrar_grafias`, pela quarta vez pelo
    mesmo motivo.
    """
    attempt = 0
    max_attempts = max(
        start_qa_retries, echo_qa_retries, coverage_qa_retries, intrusion_qa_retries,
        rate_retries if rate_target else 0,
    )
    best_seg, best_score, best_coverage = seg, None, None
    best_lacuna = None
    # Palavras perdidas na tentativa VENCEDORA (a que vira entrega). Anda junto
    # de `best_lacuna` de proposito: as duas descrevem o MESMO buraco, uma pela
    # forma e a outra pelo nome. Ver `registrar_faltantes`.
    best_faltantes = None
    # Pares "texto>audio" da tentativa VENCEDORA. Mesmo alinhamento das
    # faltantes, resposta complementar: o que o audio FALOU e o whisper grafou
    # diferente. Ver `registrar_grafias`.
    best_grafias = None
    # Veredito de fronteira INTERNA da tentativa VENCEDORA (a que vira entrega).
    # Os contadores `tail_interno_*` do laco contam TENTATIVA — inclusive as
    # descartadas —, e por isso nao respondem "o aluno recebeu decepado?".
    # Ver `registrar_tail_interno`.
    best_tail_interno = None
    # Chunk ALUCINADO (#52, 27/08): cobertura ~0 nao e' "faltou um pedaco", e'
    # audio que nao e' o texto. Entre uma tentativa e outra NADA muda (mesmo
    # texto, mesmos parametros, sem seed) — o Ronald viu 6 falhas seguidas no
    # mesmo texto, cada uma gastando 3 tentativas + 3 por sub-frase do resgate,
    # todas identicas. Duas seguidas abaixo do piso: para e entrega ao
    # chamador, que muda de ESTRATEGIA (resgate nivel 2) em vez de repetir.
    alucinadas_seguidas = 0
    while attempt < max_attempts:
        score = 0
        coverage = None
        lacuna_desta = None
        faltantes_desta = None
        grafias_desta = None
        # Resetado a cada volta DE PROPOSITO: e' o veredito DESTA tentativa,
        # nao o acumulado. None = a fronteira interna nao foi julgada aqui.
        interno_cortado_desta = None
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
            # Telemetria pura, na carona da MESMA transcricao e do MESMO
            # alinhamento: nao paga whisper nem entra no `score`.
            faltantes = palavras_faltantes(got, chunk, qa_language)
            grafias = divergencias_de_grafia(got, chunk, qa_language)
            qa_stats["coverage_checked"] += 1
            if coverage is None:
                qa_stats["coverage_none"] += 1
            else:
                _log(
                    "info", "inference.coverage_qa", idx=idx, attempt=attempt,
                    coverage=coverage, maior_lacuna=lacuna,
                    # ⚠️ SO A CONTAGEM no log de nivel info. A LISTA das
                    # palavras vai pro `qa_stats` (banco, com teto), e nao pro
                    # log: num chunk mudo "as palavras que faltaram" E' o texto
                    # inteiro do aluno, e o log do worker nao e' lugar de
                    # despejar isso a cada tentativa.
                    faltantes_n=(None if faltantes is None else len(faltantes)),
                    # Mesma regra da linha de cima: SO A CONTAGEM no log. Os
                    # pares carregam texto do aluno e vao pro `qa_stats`, com
                    # teto, e nao pro log do worker.
                    grafias_n=(None if grafias is None else len(grafias)),
                )
                if coverage < coverage_qa_min:
                    qa_stats["coverage_flagged"] += 1
                    # Penalidade proporcional ao que falta: entre duas
                    # tentativas ruins, best_seg fica com a MAIS completa.
                    score += 100 + int((coverage_qa_min - coverage) * 100)
                if coverage < alucinacao_min:
                    alucinadas_seguidas += 1
                    qa_stats["coverage_alucinado"] = qa_stats.get("coverage_alucinado", 0) + 1
                else:
                    alucinadas_seguidas = 0
            lacuna_desta = lacuna
            faltantes_desta = faltantes
            grafias_desta = grafias
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
        # palavra e' entrega quebrada.
        #
        # ⚠️ 02/09 (#234) — A PREMISSA QUE CAIU. Ate aqui este teste vinha
        # dentro de `if eh_ultimo_chunk:`, com o comentario "no meio do texto a
        # emenda com o proximo chunk cobre a transicao". E' FALSO: o chunk
        # interno ja chega DECAPITADO na montagem, e a emenda so cola dois
        # pedacos — ela nao devolve a silaba que o modelo nao gerou.
        # MEDIDO no _frank/prova/cauda_decepada.jsonl (regua release_ms <= 35
        # E plato_db > -40, que e' o envelope visto de fora): 4.258 geracoes,
        # 10.663 fronteiras internas, 1.371 fronteiras ruins em 623 geracoes
        # (14,6%), 244 alunos e 281 VOZES — espalhado assim e' defeito de
        # PRODUTO, nao de voz. Cronico de 27/07 a 01/09, nao e' regressao.
        # Caso-indice 81d4f3f4 (a aluna reclamou de "voce" cortado no s34): das
        # 6 fronteiras, 5 decaem a ~-50 dB em 115-305 ms e a do s34,494 desliga
        # em 10 ms ainda a -27,9 dB. O ouvido dela estava certo.
        #
        # POR QUE SOMBRA (padrao): ligar o peso 100 na fronteira interna
        # multiplica REGEN em ~15% das geracoes de um dia pro outro — o mesmo
        # tipo de salto que virou tempestade em 19/08 e a razao de a intrusao
        # ter ficado com gate macio. Primeiro mede-se em producao, depois vira
        # a chave por env (TTS_TAIL_QA_INTERNO_MODO=reprovando), sem deploy.
        if eh_ultimo_chunk or tail_qa_interno_enabled:
            interno = not eh_ultimo_chunk
            pref = "tail_interno" if interno else "tail"
            cortado = fim_abrupto(seg, sample_rate)
            # 2a prova, mais dura que o envelope (o envelope sozinho deixou
            # passar o 0,027 que o Johnny pegou de ouvido): a ULTIMA palavra
            # cabe no tempo que ela levou? Só roda quando o envelope aprovou —
            # se já reprovou, não gasta um whisper a mais.
            # Na fronteira INTERNA ela e' OPCIONAL (TTS_TAIL_QA_INTERNO_PALAVRA)
            # e vem desligada: seriam N whispers com timestamp por palavra por
            # geracao em vez de 1, e a regua que mediu o alcance do #234 e' a do
            # ENVELOPE — ligar a palavra na sombra mediria coisa diferente da
            # estimativa que justificou a mudanca.
            if cortado is False and (not interno or tail_qa_interno_palavra):
                truncada = ultima_palavra_truncada(
                    palavras_com_tempo(seg, sample_rate, echo_qa_model, qa_language)
                )
                if truncada:
                    qa_stats[f"{pref}_word_flagged"] = qa_stats.get(f"{pref}_word_flagged", 0) + 1
                    _log("info", "inference.tail_qa.palavra_curta", idx=idx,
                         attempt=attempt, interno=interno)
                    cortado = True
            # ⚠️ ESTES CONTADORES SAO POR TENTATIVA (inclusive as descartadas):
            # medem PRESSAO DE REGEN, "quantas tentativas ganhariam +100 se a
            # chave virasse". Quem mede a ENTREGA e' `tail_interno_entregue*`,
            # registrado pelo CHAMADOR a partir do valor devolvido aqui embaixo
            # — a confusao entre as duas quase virou numero errado em relatorio
            # (02/09). Os dois servem; nao troque um pelo outro.
            qa_stats[f"{pref}_checked"] = qa_stats.get(f"{pref}_checked", 0) + 1
            if interno:
                # `cortado` ja incorpora a 2a prova (palavra), quando ligada.
                interno_cortado_desta = cortado
            if cortado is None:
                qa_stats[f"{pref}_none"] = qa_stats.get(f"{pref}_none", 0) + 1
            elif cortado:
                qa_stats[f"{pref}_flagged"] = qa_stats.get(f"{pref}_flagged", 0) + 1
                # SOMBRA: a fronteira interna reprovada e' CONTADA e LOGADA, e
                # nao mexe no score — nenhuma entrega muda de rumo por causa
                # dela nesta fase. O ultimo chunk continua pontuando como
                # sempre pontuou (nao ha regressao no que ja protegia).
                pontua = (not interno) or (str(tail_qa_interno_modo).lower() == "reprovando")
                _log("info", "inference.tail_qa", idx=idx, attempt=attempt,
                     abrupto=True, interno=interno, pontua=pontua)
                if pontua:
                    score += 100
                else:
                    qa_stats["tail_interno_sombra"] = qa_stats.get("tail_interno_sombra", 0) + 1

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
            best_tail_interno = interno_cortado_desta
            best_faltantes = faltantes_desta
            best_grafias = grafias_desta
        if score == 0:
            break
        attempt += 1
        if alucinacao_max_seguidas > 0 and alucinadas_seguidas >= alucinacao_max_seguidas:
            _log("error", "inference.qa.alucinado", idx=idx, attempt=attempt,
                 coverage=coverage, seguidas=alucinadas_seguidas)
            qa_stats["coverage_alucinado_saida"] = qa_stats.get("coverage_alucinado_saida", 0) + 1
            break
        if attempt >= max_attempts:
            _log("error", "inference.qa.exhausted", idx=idx, best_score=best_score)
            qa_stats["exhausted"] += 1
            # O SCORE DO CHUNK ENTREGUE (#226): ate 01/09 o `exhausted` ia pro
            # banco como CONTAGEM e o `best_score` morria no log do worker —
            # entao "esgotou" era indistinguivel entre "saiu 20% rapido demais"
            # e "comeu uma palavra". Sem o numero, a flag nao prioriza nada.
            #
            # COMO LER O SCORE (as faixas saem dos pesos deste mesmo laco):
            #   < 50   -> so ritmo (int(60*desvio)): audio integro, so fora da
            #             regua de velocidade. E' o caso BENIGNO.
            #   50..99 -> intrusao (50 por intrusa): fala algo que nao estava
            #             no texto; gate macio de proposito (fb8d29b7).
            #   >= 100 -> cobertura (100+) ou fim abrupto (100): FALTA texto ou
            #             o audio corta no meio da palavra. E' o caso GRAVE.
            # Um score alto pode somar varios eixos; use como severidade, nao
            # como diagnostico de um defeito unico.
            pior = qa_stats.get("exhausted_score_max")
            if pior is None or best_score > pior:
                qa_stats["exhausted_score_max"] = best_score
            # Lista pra distribuicao (nao so o pior). Teto de 50 pra nao inchar
            # o jsonb num texto muito longo; o `exhausted` continua sendo a
            # contagem verdadeira quando a lista satura.
            scores = qa_stats.setdefault("exhausted_scores", [])
            if len(scores) < 50:
                scores.append(best_score)
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
                # A lista tem que vir da leitura ADOTADA. Manter a da 1a
                # leitura aqui seria pior que nao ter lista nenhuma: o texto
                # foi transcrito no idioma errado (whisper TRADUZIU), entao
                # "sumiu" ali dentro e' a traducao, nao o audio — e a amostra
                # apontaria palavra perdida em audio que acabou de ser
                # inocentado. Recalcula no idioma detectado, sem whisper novo.
                best_faltantes = palavras_faltantes(got2, chunk, lang2)
                # Pelo MESMO motivo do comentario acima: a lista tem que vir da
                # leitura ADOTADA. Grafia medida contra uma transcricao que o
                # whisper TRADUZIU descreveria a traducao, nao o audio.
                best_grafias = divergencias_de_grafia(got2, chunk, lang2)
    # NAO registra a cobertura, a fronteira interna, as palavras faltantes nem
    # as divergencias de grafia aqui: este audio ainda pode ser DESCARTADO pelo
    # resgate por subdivisao. Quem registra e' o chamador, quando sabe o que
    # virou entrega — ver `registrar_cobertura`, `registrar_tail_interno`,
    # `registrar_faltantes` e `registrar_grafias`.
    return (best_seg, best_coverage, best_lacuna, best_tail_interno,
            best_faltantes, best_grafias)
