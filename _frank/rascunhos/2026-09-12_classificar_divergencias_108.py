#!/usr/bin/env python3
"""LEITURA PURA. Classifica as 27 DIVERGENCIA_CONFIRMADA do chamado 108.

Nao acessa rede, nao acessa banco, nao toca em voz nenhuma. Le so os dois
artefatos ja medidos:
  amostra_estratificada.json          -> reference_transcript INTEIRO (texto salvo)
  medicao_108_amostra50_2026-09-12.json -> cauda_medida (transcricao ESTAVEL
                                           dos ultimos 4s do audio, 3 leituras
                                           identicas) e ouvido_fim.

O veredito original e' por CAUDA: DIVERGENCIA sse norm(texto) NAO termina em
cauda_medida. Logo a classificacao aqui e' da CAUDA — ver o relatorio para o
que essa medicao nao consegue enxergar.
"""
import json, re, sys, unicodedata, difflib
from pathlib import Path

DIR = Path("/mnt/Data/Projetos/PlatformLucasArrial/frontend/_Bugs/chamado_108_referencias")

def norm(s):
    s = unicodedata.normalize("NFD", (s or "").lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.findall(r"[a-z0-9]+", s)

amostra = {r["id"]: r for r in json.load(open(DIR / "amostra_estratificada.json"))}
med = json.load(open(DIR / "medicao_108_amostra50_2026-09-12.json"))

def classificar(TN, AT):
    """TN = texto salvo (palavras norm), AT = cauda do audio (palavras norm)."""
    if not AT:
        return "sem_cauda_medida", {}
    # regiao de cauda do texto, com folga p/ ancorar o alinhamento
    ctx = len(AT) + 12
    TT = TN[-ctx:]
    sm = difflib.SequenceMatcher(None, TT, AT, autojunk=False)
    ops = sm.get_opcodes()
    # descarta o 'delete' de contexto que antecede o 1o 'equal'
    i0 = next((i for i, o in enumerate(ops) if o[0] == "equal"), None)
    if i0 is None:
        return "sem_sobreposicao", {"ratio": round(sm.ratio(), 2)}
    ops = ops[i0:]
    equal_words = sum(o[2] - o[1] for o in ops if o[0] == "equal")
    cob = equal_words / len(AT)
    if cob < 0.34:
        return "sem_sobreposicao", {"cobertura_cauda": round(cob, 2)}
    ult = ops[-1]
    det = {"cobertura_cauda": round(cob, 2)}
    meio = [o for o in ops[:-1] if o[0] != "equal"]
    if ult[0] == "delete":                       # sobra no TEXTO depois do audio
        det["palavras_a_mais_no_texto"] = " ".join(TT[ult[1]:ult[2]])
        return "cauda_extra", det
    if ult[0] == "insert":                       # sobra no AUDIO depois do texto
        det["palavras_a_mais_no_audio"] = " ".join(AT[ult[3]:ult[4]])
        return "cauda_faltante", det
    if ult[0] == "replace":
        det["texto"] = " ".join(TT[ult[1]:ult[2]])
        det["audio"] = " ".join(AT[ult[3]:ult[4]])
        return "cauda_substituida", det
    # termina em 'equal': a divergencia esta ANTES do fim comum
    if meio:
        o = meio[-1]
        det["texto"] = " ".join(TT[o[1]:o[2]]) or "(nada)"
        det["audio"] = " ".join(AT[o[3]:o[4]]) or "(nada)"
        if o[0] == "insert":
            return "repeticao_ou_insercao_no_audio", det
        if o[0] == "delete":
            return "palavra_so_no_texto_no_miolo_da_cauda", det
        return "miolo_da_cauda_trocado", det
    return "indefinido", det

out = []
for r in med:
    if r["veredito"] != "DIVERGENCIA_CONFIRMADA":
        continue
    T = amostra[r["id"]]["transcript"]
    TN, AT = norm(T), norm(r["cauda_medida"])
    tipo, det = classificar(TN, AT)
    out.append({"id": r["id"], "polo": r["polo"], "corte_seco": r["corte_seco"],
                "tipo": tipo, "det": det, "texto_fim": " ".join(TN[-14:]),
                "audio_cauda": " ".join(AT), "texto_completo": T,
                "ouvido_fim": r["ouvido_fim"], "n_palavras_texto": len(TN)})

from collections import Counter
print("n divergencias:", len(out))
print(Counter(o["tipo"] for o in out).most_common())
print()
for o in out:
    print(f'--- {o["id"][:8]} polo={o["polo"]} seco={o["corte_seco"]} TIPO={o["tipo"]} {o["det"]}')
    print(f'    TEXTO fim : ...{o["texto_fim"]}')
    print(f'    AUDIO 4s  : {o["audio_cauda"]}')
json.dump(out, open(DIR / "classificacao_27_divergencias_2026-09-12.json", "w"),
          ensure_ascii=False, indent=1)
print("\narquivo:", DIR / "classificacao_27_divergencias_2026-09-12.json")
