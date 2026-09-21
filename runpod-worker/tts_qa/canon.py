"""CANONICALIZAÇÃO pt-BR dos DOIS lados do comparador de QA.

⚠️ ISTO NÃO AFROUXA RÉGUA. Afrouxar seria aceitar menos áudio; aqui a régua
continua exigindo o texto inteiro — o que muda é que os dois lados passam a ser
escritos da MESMA maneira antes de serem comparados. Hoje eles não são, e é por
isso que áudio íntegro aparece como "palavra faltando".

MEDIDO EM 18/09, sobre as 5.485 gerações da tabela `generations` (1.035
ocorrências de palavra em `qa->faltantes_amostra`, 571 gerações). As três
famílias do topo — e NENHUMA delas é áudio faltando:

 (a) CONTRAÇÃO ORAL. O texto normalizado guarda a forma plena (a guarda de
     mandato do normalizador REVERTE "pra"->"para" de propósito — ver
     `PROTEGIDAS` em frontend/src/lib/llm/mandato-normalizacao.ts) e o modelo
     fala como brasileiro fala. O whisper escreve o que ouviu.
       pra 65 · para 11 · esta 9 · ce 8 · estou 6 · pro 5
     PROVA PELO OUVIDO: geração 019c58d1-5eb9-410f-aa0a-66b4dcc399d8 (aluna
     Katia, 16/09). Texto: "Eu sei que está doendo, que está difícil". Áudio
     transcrito com carimbo de tempo: ÍNTEGRO, nada suprimido — o modelo disse
     "tá". `faltantes_amostra=["esta","esta"]`, e `coverage_min_visto=0.75`
     fecha a conta sozinho: o chunk tem 8 palavras e 6 casaram (6/8 = 0,75).

 (b) EXPANSÃO DE NÚMERO / MOEDA / PORCENTAGEM. O texto que vai pro TTS é
     normalizado por LLM e sai POR EXTENSO ("cinco por cento", "noventa e sete
     reais", "zero vírgula zero vinte e cinco"). O whisper escreve de volta em
     SÍMBOLO ("5%", "R$ 97", "0,025") e o `norm_words` jogava "%", "R$" e a
     vírgula no lixo junto com o resto da pontuação.
       por 50 · cento 43 · zero 11 · virgula 7 · reais 7
     CASOS REAIS CONFERIDOS um a um no `text_raw`:
       31e26482 "5 porcento"      -> faltantes ["por","cento"]
       8101e36a "R$ 97 ... R$10,03" -> faltantes ["reais","reais","centavos"]
       0a0c9413 "0,025% ou à 0,05%" -> faltantes ["virgula","zero","por","cento"] x2

 (c) NOME PRÓPRIO — skydivethru 11 · cestaro 8 · naldy 8 · riuls 6. ESSA FAMÍLIA
     NÃO ESTÁ AQUI, e não está DE PROPÓSITO: grafia diferente de nome próprio
     não prova áudio bom, só prova que o comparador não serve de juiz ali.
     Quem cuida dela é `classificar_ausencias` em metrics.py, que a separa em
     `divergencia_de_grafia` em vez de fingir que casou.

⚠️ PURO: só stdlib, nenhuma I/O, nenhum estado. Dá pra rodar a régua inteira em
teste sem GPU, sem whisper e sem rede — é o que test_canon_qa.py faz.

⚠️ SÓ pt. Em `en`/`es` as duas funções devolvem a entrada intacta: eu não tenho
caso medido nesses idiomas e chutar convenção de fala estrangeira aqui seria
inventar régua sem prova. `digits_to_words` continua cuidando do dígito solto
nos três idiomas, como sempre cuidou.
"""
from __future__ import annotations

import re

# ── (b) símbolo -> palavra falada ─────────────────────────────────────────
# Roda ANTES de `[^a-z0-9\s]` virar espaço, senão não sobra símbolo pra ler.
# A entrada já chegou minúscula e sem acento (é o 1o passo do `norm_words`),
# por isso "R$" aparece aqui como "r$".

# "1.000" -> "1000". Separador de milhar, não fim de frase: exige 3 dígitos
# depois e NENHUM quarto (senão "1.0000" viraria número).
_MILHAR = re.compile(r"(?<=\d)\.(?=\d{3}(?!\d))")

# "r$ 10,03" -> "10 reais e 03 centavos". A ORDEM é o ponto: o símbolo vem
# ANTES do número no texto e a palavra vem DEPOIS na fala. Sem reordenar, o
# alinhamento (que é sensível a ordem) não casaria nem trocando "r$" por
# "reais". Tem que rodar antes de `_DECIMAL`: aqui a vírgula é centavo, não
# vírgula falada.
_MOEDA = re.compile(r"r\$\s*(\d+)(?:,(\d{1,2}))?")

# "5%" / "5 %" -> "5 por cento"
_PORCENTO = re.compile(r"(\d)\s*%")

# "0,05" -> "0 virgula zero 5" (ver `_le_decimal` pro porquê do "zero")
_DECIMAL = re.compile(r"(\d),(\d+)")


def _le_moeda(m: "re.Match[str]") -> str:
    inteiro, centavos = m.group(1), m.group(2)
    # "r$ 1" é "um real", não "um reais". Um token de diferença, mas é UM token
    # a menos de ruído na amostra de faltantes.
    moeda = "real" if inteiro == "1" else "reais"
    if not centavos:
        return f" {inteiro} {moeda} "
    unidade = "centavo" if centavos.lstrip("0") == "1" else "centavos"
    # Centavo NÃO ganha o "zero" na frente: o normalizador escreve "dez reais e
    # três centavos" pra "R$10,03" (caso 8101e36a, conferido no text_raw), e
    # `digits_to_words("03")` já devolve "tres".
    return f" {inteiro} {moeda} e {centavos} {unidade} "


def _le_decimal(m: "re.Match[str]") -> str:
    """"0,025" -> "0 virgula zero 25".

    O zero à esquerda da parte decimal é FALADO, um "zero" por zero, e só o
    resto vira número. É o que o normalizador produz e o que a aluna do caso
    0a0c9413 ouviu: "zero vírgula zero vinte e cinco por cento". Sem isso,
    `digits_to_words("025")` devolveria só "vinte e cinco" e o "zero" do meio
    continuaria contando como palavra perdida.
    """
    inteiro, frac = m.group(1), m.group(2)
    zeros = len(frac) - len(frac.lstrip("0"))
    resto = frac[zeros:]
    partes = [inteiro, "virgula"] + ["zero"] * zeros + ([resto] if resto else [])
    return " " + " ".join(partes) + " "


def expandir_falado(s: str, language: str = "pt") -> str:
    """Símbolo que se PRONUNCIA vira a palavra que se pronuncia.

    Recebe e devolve TEXTO (não lista): tem que rodar enquanto "%", "r$" e a
    vírgula ainda existem. Idempotente — passar duas vezes dá o mesmo
    resultado, porque nenhuma saída contém os símbolos que as regras procuram.
    """
    if not (language or "pt").lower().startswith("pt"):
        return s
    s = _MILHAR.sub("", s)
    s = _MOEDA.sub(_le_moeda, s)
    s = _PORCENTO.sub(r"\1 por cento", s)
    s = _DECIMAL.sub(_le_decimal, s)
    return s


# ── (a) contração oral -> forma plena ─────────────────────────────────────
# Chave e valor já em minúscula sem acento (é o formato do `norm_words`). O
# valor é uma LISTA porque algumas contrações carregam artigo ("pro" = "para
# o") e expandir mantém a contagem de palavras igual dos dois lados.
#
# ⚠️ O QUE FICOU DE FORA, e por quê — a lista do que NÃO entra vale tanto
# quanto a do que entra:
#
#   "num" -> "nao"  RECUSADO. O cartão pedia, e eu não fiz. "num" é as duas
#       coisas em português ("num vou" = não vou, mas "num dia" = em um dia), e
#       o erro cai pro lado ERRADO: casar "num" com "não" faria um "não" de
#       verdade, COMIDO pelo modelo, aparecer como presente. "não" é
#       literalmente o exemplo que o docstring de `palavras_faltantes` usa pra
#       "o modelo comeu palavra do aluno". Régua que esconde "não" sumido é
#       pior do que a de hoje.
#   "tao" -> "estao"  RECUSADO, mesma armadilha: "tão bonito" é advérbio.
#       Sem acento os dois viram "tao" e não dá pra separar.
#   "ne", "dum", "duma"  fora: viram duas palavras com fronteira ambígua, e
#       nenhuma aparece nos 1.035 faltantes medidos.
_CONTRACOES: dict[str, list[str]] = {
    "pra": ["para"],          # ambíguo entre "para" e "para a": fica no seguro,
                              # 1 token. O artigo perdido tem 1 letra e o
                              # `palavras_faltantes` já descarta token de 1 letra.
    "pras": ["para", "as"],
    "pro": ["para", "o"],     # "pro"/"pros" SEMPRE carregam o artigo.
    "pros": ["para", "os"],
    "ta": ["esta"],
    "tar": ["estar"],
    "tava": ["estava"],
    "tavam": ["estavam"],
    "tamo": ["estamos"],
    "tamos": ["estamos"],
    "to": ["estou"],
    "tou": ["estou"],
    "ce": ["voce"],
    "ces": ["voces"],
    # "porcento" junto é como o aluno digita (casos 31e26482 e aedbfbe4); o
    # normalizador separa. Sem isto, o texto cru (fallback sem normalizador)
    # perde os dois tokens contra qualquer áudio.
    "porcento": ["por", "cento"],
}

# NOMES DE LETRA — a mesma lista de `NOMES_DE_LETRA` em
# frontend/src/lib/llm/mandato-normalizacao.ts, e ela está aqui por um motivo
# só: "ce" é contração de "você" E é o nome da letra C. Expandir "ce" no meio
# de uma sigla soletrada ("ce be esse" = CBS) inventaria um "você" onde há uma
# letra — e soletração já é o defeito que MATOU job no incidente #52. Então
# "ce"/"ces" só viram "você" quando NÃO há nome de letra encostado.
_NOMES_DE_LETRA = frozenset({
    "a", "be", "ce", "de", "e", "efe", "ge", "aga", "i", "jota", "ka", "ele",
    "eme", "ene", "o", "pe", "que", "erre", "esse", "sse", "te", "u", "ve",
    "xis", "ipsilon", "ze",
})


def _dentro_de_soletracao(palavras: list[str], i: int) -> bool:
    """O vizinho (esquerda ou direita) também é nome de letra?"""
    if i > 0 and palavras[i - 1] in _NOMES_DE_LETRA:
        return True
    if i + 1 < len(palavras) and palavras[i + 1] in _NOMES_DE_LETRA:
        return True
    return False


def canonizar_contracoes(palavras: list[str], language: str = "pt") -> list[str]:
    """Contração oral e forma plena viram O MESMO token, nos dois lados.

    Idempotente: a forma plena nunca é chave do mapa, então aplicar de novo não
    muda nada. Recebe e devolve lista de tokens já normalizados.
    """
    if not (language or "pt").lower().startswith("pt"):
        return palavras
    out: list[str] = []
    for i, w in enumerate(palavras):
        troca = _CONTRACOES.get(w)
        if troca is None:
            out.append(w)
            continue
        if w in ("ce", "ces") and _dentro_de_soletracao(palavras, i):
            out.append(w)
            continue
        out.extend(troca)
    return out
