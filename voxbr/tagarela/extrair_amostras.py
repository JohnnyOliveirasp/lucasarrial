from __future__ import annotations

import io
import json
from collections import Counter
from pathlib import Path

import pyarrow.parquet as pq
import soundfile as sf


BASE = Path(__file__).resolve().parent
PARQUET = BASE / "test-00000-of-00001.parquet"
SAIDA = BASE / "ouvir"
QUANTIDADE = 12


def main() -> None:
    tabela = pq.read_table(PARQUET)
    linhas = tabela.to_pylist()
    analisadas = []

    for indice, linha in enumerate(linhas):
        dados = linha["audio"]["bytes"]
        info = sf.info(io.BytesIO(dados))
        analisadas.append(
            {
                "indice": indice,
                "duracao": float(info.duration),
                "accent": linha.get("accent") or "desconhecido",
                "sentence": linha["sentence"],
                "path": linha["path"],
                "bytes": dados,
            }
        )

    # Evita escolher somente o início do arquivo e distribui as amostras.
    candidatos = [x for x in analisadas if 5 <= x["duracao"] <= 30]
    passo = max(1, len(candidatos) // QUANTIDADE)
    escolhidas = candidatos[::passo][:QUANTIDADE]

    SAIDA.mkdir(exist_ok=True)
    manifesto = []
    for numero, item in enumerate(escolhidas, 1):
        destino = SAIDA / f"{numero:02d}_{item['accent']}_{item['duracao']:.1f}s.flac"
        destino.write_bytes(item.pop("bytes"))
        item["arquivo"] = destino.name
        manifesto.append(item)

    (SAIDA / "manifesto.json").write_text(
        json.dumps(manifesto, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    resumo = {
        "clipes": len(analisadas),
        "horas": round(sum(x["duracao"] for x in analisadas) / 3600, 3),
        "duracao_min": round(min(x["duracao"] for x in analisadas), 2),
        "duracao_media": round(
            sum(x["duracao"] for x in analisadas) / len(analisadas), 2
        ),
        "duracao_max": round(max(x["duracao"] for x in analisadas), 2),
        "acentos": Counter(x["accent"] for x in analisadas),
        "extraidas": len(manifesto),
    }
    print(json.dumps(resumo, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
