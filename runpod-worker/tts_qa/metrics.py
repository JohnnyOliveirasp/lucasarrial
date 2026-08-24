"""As RÉGUAS do QA de chunk — cada uma mede um defeito diferente.

  echo_leak_count   texto SOBRANDO (eco da referência)
  chunk_coverage    quanto do texto pedido está no áudio (0..1)
  chunk_intrusions  palavra A MAIS ou TROCADA
  maior_lacuna      FORMA do buraco: maior trecho contínuo que sumiu

Todas devolvem None quando o resultado é inconclusivo — QA aqui é rede de
segurança, nunca portão que derruba job por dúvida.
"""
from __future__ import annotations

import difflib

from .text import norm_words


def echo_leak_count(got, chunk_text, prompt_text, language: str = "pt"):
    """QA anti-eco (caso Carlos "mesma coisa" 2026-07-29): o continuation do
    VoxCPM vaza frases da REF no meio/fim dos chunks — o QA de 1a palavra não
    vê. Recebe a transcrição NORMALIZADA do chunk inteiro (`got` — a MESMA
    transcrição alimenta este QA e o de completude, uma chamada de whisper
    serve as duas análises) e procura bigramas que existem na ref mas NÃO no
    texto pedido (palavras ≥3 letras — filtra "e a"/"de um").
    Retorna o Nº de bigramas vazados (0 = limpo); None = inconclusivo/QA não
    aplicável (não bloqueia — rede de segurança, não gate).
    """
    if not prompt_text:
        return None
    ref_words = norm_words(prompt_text, language)
    text_words = norm_words(chunk_text, language)

    def grams(words: list[str]) -> set[tuple[str, str]]:
        return {
            (a, b) for a, b in zip(words, words[1:])
            if len(a) >= 3 and len(b) >= 3
        }

    suspect = grams(ref_words) - grams(text_words)
    if not suspect:
        return None
    if not got:
        return None
    return len(grams(got) & suspect)


def chunk_coverage(got, chunk_text, language: str = "pt"):
    """QA de COMPLETUDE (caso Katia 19/08, incidente ce6e157d): fração (0..1)
    das palavras do texto do chunk presentes NA ORDEM na transcrição do áudio
    gerado. O echo QA só vê texto SOBRANDO (eco da ref); este vê texto
    FALTANDO — áudio que começa no meio do chunk, ou chunk inteiro mudo,
    passava limpo por todos os QAs e era entregue como [ready] e cobrado.

    `got` é a MESMA transcrição usada pelo echo QA (não paga whisper 2x).
    None = inconclusivo (whisper falhou, ou chunk sem palavras) — não bloqueia;
    transcrição VAZIA de um chunk com texto é cobertura 0.0 (bloqueia).
    """
    expected = norm_words(chunk_text, language)
    if not expected:
        return None
    if got is None:
        return None
    if not got:
        return 0.0
    sm = difflib.SequenceMatcher(None, expected, got)
    matched = sum(b.size for b in sm.get_matching_blocks())
    return round(matched / len(expected), 3)


def chunk_intrusions(got, chunk_text, language="pt"):
    """QA de INTRUSÃO (incidente fb8d29b7, 19/08): palavra A MAIS ou TROCADA no
    áudio — o inverso do coverage (que só vê palavra FALTANDO). Caso medido:
    23 de 40 entregas recentes com palavra inventada/trocada, 21 passando no
    portão; o mecanismo dominante é o VoxCPM vazar a CAUDA da referência entre
    frases (a ref da Katia termina em "por menos" → "Menos." brotava nas
    junções de chunk).

    Método: alinha `expected` × `got` (SequenceMatcher) e olha os opcodes de
    insert/replace do lado do `got`. Palavra inserida SÓ conta como intrusão
    quando NÃO é parecida (ratio < 0.7) com nenhuma palavra esperada do
    replace correspondente ou vizinha — senão "quatorze" falado "catorze"
    (variação de Whisper/sotaque) viraria falso positivo. Palavra com menos de
    3 letras não conta (ruído de transcrição: "e", "a", "o").

    Retorna o Nº de intrusões (0 = limpo); None = inconclusivo (não bloqueia —
    rede de segurança, não gate).
    """
    expected = norm_words(chunk_text, language)
    if not expected or not got:
        return None

    def parecida(w, candidatas):
        for c in candidatas:
            if difflib.SequenceMatcher(None, w, c).ratio() >= 0.7:
                return True
            # Whisper separa/junta palavra composta ("autoconhecimento" →
            # "auto conhecimento"): pedaço-prefixo/sufixo da vizinha não é
            # intrusão. Só vale com pedaço ≥3 (senão tudo casa com tudo).
            if len(w) >= 3 and len(c) >= 3 and (
                c.startswith(w) or c.endswith(w) or w.startswith(c) or w.endswith(c)
            ):
                return True
        return False

    sm = difflib.SequenceMatcher(None, expected, got)
    intrusoes = 0
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag not in ("insert", "replace"):
            continue
        # Vizinhança APERTADA: as palavras do replace + 1 de cada lado. Janela
        # de 2 deixava intrusão real escapar por parentesco acidental — no caso
        # medido, o "menos" vazado da ref casava com "mesmos" duas posições
        # antes (ratio 0.73) e a tomada 1 da Katia passava limpa.
        vizinhas = expected[max(0, i1 - 1) : min(len(expected), i2 + 1)]
        for w in got[j1:j2]:
            if len(w) >= 3 and not parecida(w, vizinhas):
                intrusoes += 1
    return intrusoes


def maior_lacuna(got, chunk_text, language="pt"):
    """Maior TRECHO CONTÍNUO do texto que sumiu do áudio (em palavras).

    ⚠️ Por que isto existe (20/08): a cobertura sozinha é uma régua RUIM pra
    decidir reprovar. Ela conta palavra faltando sem olhar ONDE — e o texto do
    aluno está cheio de coisa que NINGUÉM FALA em voz alta: número por extenso
    virando dígito na transcrição, **markdown**, emoji, rótulo de locutor
    ("Seres:" num roteiro de diálogo), URL, "[pausa]". Cada uma dessas derruba
    a cobertura alguns pontos e reprovava ÁUDIO PERFEITO — 3 casos medidos em
    24h, cada um custando o áudio de um aluno, e sempre aparece uma variação
    nova. Tapar buraco com lista de exceção é corrida perdida.

    A DIFERENÇA REAL entre os dois mundos é a FORMA do buraco:
      • defeito de verdade (caso Katia): o modelo pula um PEDAÇÃO — chunk mudo,
        ou áudio que começa no meio. Some um trecho CONTÍNUO e longo.
      • falso negativo (markup): somem palavras SOLTAS, espalhadas, de 1 em 1.

    Então medimos o maior buraco contínuo em vez de só contar o que falta.
    Isso não depende de saber QUAIS símbolos não se fala — funciona pra
    variação que ainda nem apareceu.
    """
    expected = norm_words(chunk_text, language)
    if not expected:
        return None
    if got is None:
        return None
    if not got:
        return len(expected)  # chunk inteiro mudo: buraco = tudo
    sm = difflib.SequenceMatcher(None, expected, got)
    maior = 0
    for tag, i1, i2, _j1, _j2 in sm.get_opcodes():
        if tag in ("delete", "replace"):
            # CORREÇÃO 24/08 (incidente 37bacb68): buraco medido em palavras
            # FALÁVEIS — token de 1 letra não conta. SIGLA SOLETRADA ("B P C,
            # L O A S") normaliza pra 7 tokens de 1 letra e o whisper escreve
            # "BPC LOAS": buraco contínuo de 7, indistinguível de parágrafo
            # comido, e o gate reprovava ÁUDIO BOM (tulliojeronimo, 23/08:
            # mesmo roteiro falhou 2x soletrado e passou escrito "Bê pê cê").
            # Trecho realmente comido é feito de palavra de verdade — o
            # desconto NÃO enfraquece a proteção do caso Katia.
            faladas = sum(1 for w in expected[i1:i2] if len(w) >= 2)
            maior = max(maior, faladas)
    return maior
