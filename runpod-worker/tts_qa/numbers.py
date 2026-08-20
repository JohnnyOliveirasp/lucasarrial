"""Número → palavras faladas, por idioma (pt/en/es).

Extraído do handler em 20/08. Existe por causa do caso pestanatiago (19/08):
o texto do TTS chega por extenso ("E trinta e seis") e o Whisper devolve
dígito ("E36") — sem expandir dos DOIS lados, todo texto com número perdia
cobertura em áudio PERFEITO e o QA reprovava de graça.
"""
from __future__ import annotations


def _num_pt(n: int) -> list[str]:
    """36 -> ["trinta","e","seis"] (sem acento — casa com o norm_words)."""
    U = ["zero", "um", "dois", "tres", "quatro", "cinco", "seis", "sete",
         "oito", "nove", "dez", "onze", "doze", "treze", "quatorze", "quinze",
         "dezesseis", "dezessete", "dezoito", "dezenove"]
    T = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta",
         "setenta", "oitenta", "noventa"]
    C = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos",
         "seiscentos", "setecentos", "oitocentos", "novecentos"]
    if n < 20:
        return [U[n]]
    if n < 100:
        t, r = divmod(n, 10)
        return [T[t]] + (["e", U[r]] if r else [])
    if n == 100:
        return ["cem"]
    if n < 1000:
        c, r = divmod(n, 100)
        return [C[c]] + (["e"] + _num_pt(r) if r else [])
    if n < 1_000_000:
        m, r = divmod(n, 1000)
        head = ["mil"] if m == 1 else _num_pt(m) + ["mil"]
        return head + (["e"] + _num_pt(r) if r else [])
    m, r = divmod(n, 1_000_000)
    head = ["um", "milhao"] if m == 1 else _num_pt(m) + ["milhoes"]
    return head + (["e"] + _num_pt(r) if r else [])


def _num_en(n: int) -> list[str]:
    U = ["zero", "one", "two", "three", "four", "five", "six", "seven",
         "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen",
         "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"]
    T = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy",
         "eighty", "ninety"]
    if n < 20:
        return [U[n]]
    if n < 100:
        t, r = divmod(n, 10)
        return [T[t]] + ([U[r]] if r else [])
    if n < 1000:
        h, r = divmod(n, 100)
        return [U[h], "hundred"] + (_num_en(r) if r else [])
    if n < 1_000_000:
        m, r = divmod(n, 1000)
        return _num_en(m) + ["thousand"] + (_num_en(r) if r else [])
    m, r = divmod(n, 1_000_000)
    return _num_en(m) + ["million"] + (_num_en(r) if r else [])


def _num_es(n: int) -> list[str]:
    U = ["cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete",
         "ocho", "nueve", "diez", "once", "doce", "trece", "catorce",
         "quince", "dieciseis", "diecisiete", "dieciocho", "diecinueve",
         "veinte", "veintiuno", "veintidos", "veintitres", "veinticuatro",
         "veinticinco", "veintiseis", "veintisiete", "veintiocho",
         "veintinueve"]
    T = ["", "", "veinte", "treinta", "cuarenta", "cincuenta", "sesenta",
         "setenta", "ochenta", "noventa"]
    C = ["", "ciento", "doscientos", "trescientos", "cuatrocientos",
         "quinientos", "seiscientos", "setecientos", "ochocientos",
         "novecientos"]
    if n < 30:
        return [U[n]]
    if n < 100:
        t, r = divmod(n, 10)
        return [T[t]] + (["y", U[r]] if r else [])
    if n == 100:
        return ["cien"]
    if n < 1000:
        c, r = divmod(n, 100)
        return [C[c]] + (_num_es(r) if r else [])
    if n < 1_000_000:
        m, r = divmod(n, 1000)
        head = ["mil"] if m == 1 else _num_es(m) + ["mil"]
        return head + (_num_es(r) if r else [])
    m, r = divmod(n, 1_000_000)
    head = ["un", "millon"] if m == 1 else _num_es(m) + ["millones"]
    return head + (_num_es(r) if r else [])


def digits_to_words(tok: str, language: str) -> list[str]:
    """Token só de dígitos vira as palavras faladas no idioma do job."""
    if len(tok) > 9:
        # gigante (telefone, CPF): fala-se dígito a dígito
        return [w for d in tok for w in digits_to_words(d, language)]
    n = int(tok)
    lang = (language or "pt").lower()
    if lang.startswith("en"):
        return _num_en(n)
    if lang.startswith("es"):
        return _num_es(n)
    return _num_pt(n)
