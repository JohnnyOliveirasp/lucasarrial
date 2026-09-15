#!/usr/bin/env python3
"""LEITURA PURA — classificacao FINAL das 27 do chamado 108 (v2).

Diferenca p/ a v1: separa a divergencia que encosta no FIM (a que o VoxCPM
continua) da que fica so' DENTRO da janela de 4s — e, dentro dessa, isola a
que esta na PRIMEIRA palavra da janela, que e' artefato do proprio corte
`ffmpeg -sseof -4` da medicao (ele decapita a palavra de entrada).
"""
import json, re, unicodedata, difflib
from pathlib import Path
from collections import Counter
DIR = Path("/mnt/Data/Projetos/PlatformLucasArrial/frontend/_Bugs/chamado_108_referencias")
def norm(s):
    s = unicodedata.normalize("NFD", (s or "").lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.findall(r"[a-z0-9]+", s)
am = {r["id"]: r for r in json.load(open(DIR / "amostra_estratificada.json"))}
med = json.load(open(DIR / "medicao_108_amostra50_2026-09-12.json"))
out = []
for r in med:
    if r["veredito"] != "DIVERGENCIA_CONFIRMADA": continue
    T = am[r["id"]]["transcript"]; TN, AT = norm(T), norm(r["cauda_medida"])
    TT = TN[-(len(AT) + 12):]
    ops = difflib.SequenceMatcher(None, TT, AT, autojunk=False).get_opcodes()
    i0 = next((i for i, o in enumerate(ops) if o[0] == "equal"), None)
    ops = ops[i0:] if i0 is not None else ops
    diffs = [o for o in ops if o[0] != "equal"]
    ult = ops[-1]
    if not diffs:
        # unica diferenca ficou ANTES do 1o bloco igual = 1a palavra da janela
        # de 4s, que o proprio `ffmpeg -sseof -4` da medicao decapita.
        tipo, det = "D_artefato_do_corte_de_4s_da_medicao", {}
    elif ult[0] == "delete":
        tipo, det = "A_cauda_extra_no_texto", {"sobra_no_texto": " ".join(TT[ult[1]:ult[2]])}
    elif ult[0] == "replace":
        tipo, det = "B_ultima_palavra_trocada", {"texto": " ".join(TT[ult[1]:ult[2]]), "audio": " ".join(AT[ult[3]:ult[4]])}
    elif ult[0] == "insert":
        tipo, det = "C_cauda_faltante_no_texto", {"sobra_no_audio": " ".join(AT[ult[3]:ult[4]])}
    else:  # termina em 'equal' -> fim do texto == fim do audio
        d = diffs[0]
        if len(diffs) == 1 and d[3] == 0:
            tipo = "D_artefato_do_corte_de_4s_da_medicao"
        else:
            tipo = "E_divergencia_no_miolo_da_janela"
        det = {"texto": " ".join(TT[d[1]:d[2]]) or "(nada)", "audio": " ".join(AT[d[3]:d[4]]) or "(nada)",
               "n_diffs": len(diffs)}
    out.append({"id": r["id"], "polo": r["polo"], "tipo": tipo, "det": det,
                "folga_final_s": r["folga_final_s"], "corte_seco": r["corte_seco"],
                "duracao_s": r["duracao_s"], "texto_completo": T,
                "texto_fim_norm": " ".join(TN[-16:]), "audio_cauda_4s": " ".join(AT),
                "ouvido_fim_leitura_cheia": r["ouvido_fim"], "email": r["email"]})
c = Counter(o["tipo"] for o in out)
print("TOTAL", len(out), "| textos distintos:", len(set(o["texto_completo"] for o in out)))
for k in sorted(c): print(f"  {k:40} {c[k]}")
print("\nENCOSTA NO FIM (A+B):", c["A_cauda_extra_no_texto"] + c["B_ultima_palavra_trocada"])
print("FIM IDENTICO (C+D+E):", len(out) - c["A_cauda_extra_no_texto"] - c["B_ultima_palavra_trocada"])
for k in sorted(c):
    print(f"\n### {k}")
    for o in [x for x in out if x["tipo"] == k]:
        print(f'  {o["id"][:8]} folga={o["folga_final_s"]:<5} dur={o["duracao_s"]:<6} {o["det"]}')
json.dump(out, open(DIR / "classificacao_27_divergencias_2026-09-12.json", "w"), ensure_ascii=False, indent=1)
