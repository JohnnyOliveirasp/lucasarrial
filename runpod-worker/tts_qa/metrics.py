"""As RÉGUAS do QA de chunk — cada uma mede um defeito diferente.

  echo_leak_count     texto SOBRANDO (eco da referência)
  chunk_coverage      QUANTO do texto pedido está no áudio (0..1)
  chunk_intrusions    palavra A MAIS ou TROCADA
  maior_lacuna        FORMA do buraco: maior trecho contínuo que sumiu
  palavras_faltantes  O QUE sumiu — TELEMETRIA PURA, nenhum gate a consulta

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


def palavras_faltantes(got, chunk_text, language: str = "pt"):
    """QUAIS palavras do texto não saíram no áudio, na ordem do texto.

    ⚠️ NÃO É RÉGUA — é TELEMETRIA. Nada aqui entra em score, e nenhum portão
    de entrega consulta esta função. Ela só descreve, pra quem lê o banco
    depois, o que as outras réguas já mediram sem nomear.

    POR QUE EXISTE (incidente 702cc916, 04/09 — e é o que trava o caso Katia):
    hoje o QA sabe QUANTO sumiu (`chunk_coverage`) e a FORMA do buraco
    (`maior_lacuna`), e a escotilha `_entregar_mesmo_com_cobertura_baixa`
    ENTREGA áudio abaixo da régua quando o buraco é espalhado, apostando que
    "espalhado = texto que ninguém fala". A aposta é razoável e não dá pra
    auditar: com cobertura 0,800 e buraco espalhado, os dois mundos abaixo são
    numericamente IDÊNTICOS e só um deles é entrega honesta:

      • sumiu "negrito", "pausa", rótulo de locutor → markup, o áudio está bom;
      • sumiu "voce", "nao", "muito" → o modelo comeu palavra do aluno.

    Sem o NOME do que sumiu, decidir entre os dois é chute. Com ele, é leitura.
    Sai de graça: o `chunk_coverage` já monta o `SequenceMatcher`; as palavras
    perdidas caem dos opcodes `delete`/`replace` no lado do `expected`, o
    espelho exato do que `chunk_intrusions` já faz pro lado do `got`.

    CONTRATO, o MESMO de `chunk_coverage` (não invente outro ao ler isto):
      None  = inconclusivo — whisper falhou (`got is None`) ou o chunk não tem
              palavra nenhuma pra comparar;
      []    = nada faltou;
      lista = as palavras ausentes, na ordem em que aparecem no texto.
    Chunk MUDO (`got == []`) não é inconclusivo: é a informação real "o áudio
    não falou nada" (caso Katia, chunk 3) e devolve o texto inteiro — o
    `SequenceMatcher` já resolve isso num único opcode `delete`, sem atalho.

    ⚠️ TOKEN DE 1 LETRA NÃO CONTA, a mesma regra de "palavra FALÁVEL" do
    `maior_lacuna` (correção 24/08, incidente 37bacb68): sigla soletrada
    ("B P C, L O A S") normaliza pra 7 tokens de 1 letra que o whisper escreve
    juntos ("BPC LOAS") — reportá-los como "sumiram 7 palavras" encheria a
    amostra de lixo justamente no chunk que parece pior.
    Aqui o corte é 1 letra, e NÃO as 3 de `chunk_intrusions`: lá o filtro
    existe pra descartar ruído que o whisper INVENTA no lado do `got`; aqui a
    lista vem do texto do PRÓPRIO ALUNO, onde "de"/"um"/"já" sumido é perda
    real — é exatamente o tipo de palavra curta e comum que separa o caso
    Katia do markup.
    """
    expected = norm_words(chunk_text, language)
    if not expected:
        return None
    if got is None:
        return None
    sm = difflib.SequenceMatcher(None, expected, got)
    faltantes: list[str] = []
    for tag, i1, i2, _j1, _j2 in sm.get_opcodes():
        if tag in ("delete", "replace"):
            faltantes.extend(w for w in expected[i1:i2] if len(w) >= 2)
    return faltantes


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


# ── Fim abrupto (caso Carol Crozeta 26/08) ────────────────────────────────
# O QA de cobertura usa whisper, e whisper RECONSTRÓI palavra truncada: a
# geração "…sua nutricionista." saiu com a última sílaba cortada, o whisper
# transcreveu a palavra inteira, a cobertura deu 100% e o áudio foi entregue
# cortado. Nenhum critério textual enxerga esse defeito — só o ENVELOPE.
# Fala que termina naturalmente decai (a energia cai antes do silêncio);
# fala truncada vai de energia alta a zero num frame.
def fim_abrupto(seg, sample_rate: int, janela_ms: int = 50, limiar: float = 0.015) -> "bool | None":
    """True quando a fala termina ALTA — sinal de corte no meio da palavra.

    ⚠️ Não basta olhar os últimos 50 ms do buffer: quase sempre são silêncio
    (padding do encoder, sobra do trim) e a medida daria sempre "ok". Aqui a
    janela é ancorada no ÚLTIMO ponto com som — é ali que se vê se a voz
    decaiu ou foi decepada.

    `limiar` é amplitude RMS (0..1). Medido em 26/08: entregas cortadas em
    0.027, 0.062 e 0.071; sete entregas boas do mesmo dia entre 0.005 e 0.010.
    ⚠️ O limiar nasceu 0.030 e DEIXOU PASSAR o 0.027 — o Johnny ouviu o áudio e
    o corte estava lá. Apertado pra 0.015, no meio da separação real.
    Devolve None quando não dá pra medir.
    """
    if seg is None or seg.size == 0:
        return None
    import numpy as _np

    janela = max(1, int(sample_rate * janela_ms / 1000))
    if seg.size < janela:
        return None
    piso = 0.005  # mesmo piso do trim_silence: abaixo disso é silêncio
    ativos = _np.where(_np.abs(seg) > piso)[0]
    if ativos.size == 0:
        return None
    fim = int(ativos[-1]) + 1
    ini = max(0, fim - janela)
    cauda = seg[ini:fim]
    if cauda.size == 0:
        return None
    rms = float(_np.sqrt(_np.mean(_np.square(cauda))))
    return rms > limiar


# ── Última palavra rápida demais pra existir (caso Carol 26/08, 2ª rodada) ──
# O envelope sozinho deixou passar um corte que o ouvido humano pegou. Esta é a
# prova mais dura, e vem do próprio whisper que antes escondia o defeito: se a
# ÚLTIMA palavra do áudio dura menos do que fisicamente cabe nas sílabas dela,
# o áudio acabou no meio e o whisper completou o resto de cabeça.
#
# Medido em 26/08 (whisper com timestamp por palavra):
#   cortadas → "nutricionista" em 0,20s e 0,32s  = 0,040 e 0,064 s/sílaba
#   boas     → 0,100 a 0,340 s/sílaba (sete alunos diferentes)
# O limiar 0,085 fica no meio dessa separação.
_VOGAIS = "aeiouáéíóúâêôãõàäëïöü"


def contar_silabas(palavra: str) -> int:
    """Aproximação por grupos de vogais — suficiente pra saber se 6 sílabas
    couberam em 0,2s. Não precisa de separação silábica de verdade."""
    grupos, dentro = 0, False
    for ch in (palavra or "").lower():
        if ch in _VOGAIS:
            if not dentro:
                grupos += 1
                dentro = True
        else:
            dentro = False
    return max(grupos, 1)


def ultima_palavra_truncada(
    palavras: "list | None", limiar_s_por_silaba: float = 0.085
) -> "bool | None":
    """True quando a última palavra saiu curta demais pra ser pronunciável.

    `palavras` = lista de objetos/dicts com `word`/`start`/`end` (o que o
    faster-whisper devolve com word_timestamps=True). None = não deu pra medir.
    """
    if not palavras:
        return None
    u = palavras[-1]
    texto = getattr(u, "word", None) if not isinstance(u, dict) else u.get("word")
    ini = getattr(u, "start", None) if not isinstance(u, dict) else u.get("start")
    fim = getattr(u, "end", None) if not isinstance(u, dict) else u.get("end")
    if texto is None or ini is None or fim is None:
        return None
    dur = float(fim) - float(ini)
    if dur <= 0:
        return None
    return (dur / contar_silabas(str(texto).strip())) < limiar_s_por_silaba
