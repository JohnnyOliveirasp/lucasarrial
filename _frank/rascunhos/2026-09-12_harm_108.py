#!/usr/bin/env python3
"""LEITURA PURA. Cruza a classificacao da cauda com as DUAS outras evidencias
que ja estao medidas no JSON: folga_final_s e ouvido_fim (ultimas 6 palavras da
leitura do CLIPE INTEIRO — leitura independente da leitura dos 4s)."""
import json, re, unicodedata, difflib
from pathlib import Path
from collections import Counter
DIR = Path("/mnt/Data/Projetos/PlatformLucasArrial/frontend/_Bugs/chamado_108_referencias")
def norm(s):
    s = unicodedata.normalize("NFD", (s or "").lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.findall(r"[a-z0-9]+", s)
med = {r["id"]: r for r in json.load(open(DIR / "medicao_108_amostra50_2026-09-12.json"))}
cls = json.load(open(DIR / "classificacao_27_divergencias_2026-09-12.json"))
print(f'{"id":9} {"tipo":42} {"folga":>6} {"seco":5} {"cauda4s==fim_cheio?":19} sobra_no_texto')
for o in cls:
    m = med[o["id"]]
    a4, af = norm(m["cauda_medida"]), norm(m["ouvido_fim"])
    # as duas leituras independentes concordam sobre COMO O AUDIO TERMINA?
    k = min(4, len(a4), len(af))
    concorda = a4[-k:] == af[-k:] if k else False
    sobra = o["det"].get("palavras_a_mais_no_texto") or (
        (o["det"].get("texto","") + " <-> " + o["det"].get("audio","")) if "texto" in o["det"] else "")
    print(f'{o["id"][:8]:9} {o["tipo"]:42} {m["folga_final_s"]:>6} {str(m["corte_seco"]):5} {str(concorda):19} {sobra}')
print()
fim = [o for o in cls if o["tipo"] in ("cauda_extra","cauda_substituida")]
print("divergencia ENCOSTA NO FIM do texto:", len(fim), "de", len(cls))
print("  por corte_seco:", Counter(med[o["id"]]["corte_seco"] for o in fim))
print("  cauda_extra por n de palavras sobrando:",
      Counter(len(o["det"]["palavras_a_mais_no_texto"].split()) for o in cls if o["tipo"]=="cauda_extra"))
dentro = [o for o in cls if o["tipo"] not in ("cauda_extra","cauda_substituida")]
print("divergencia SO DENTRO da janela (fim do texto == fim do audio):", len(dentro))
print("  por corte_seco:", Counter(med[o["id"]]["corte_seco"] for o in dentro))
# textos identicos?
t = Counter(o["texto_completo"] for o in cls)
print("\ntextos identicos entre vozes distintas:", [(v, [x['id'][:8] for x in cls if x['texto_completo']==kk]) for kk,v in t.items() if v>1])
