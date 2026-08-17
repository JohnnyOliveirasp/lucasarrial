# -*- coding: utf-8 -*-
"""Converte um checkpoint VoxBR de F32 -> BF16 sem torch (safetensors + numpy).

Igual ao conversor do v1, mas com origem/destino por env (roda no pod):
  SRC=/work/model.safetensors DST=/work/bf16/model.safetensors python3 converter_bf16.py

BF16 = os 16 bits DE CIMA de um float32 (mesmo expoente, mantissa encurtada),
com round-to-nearest-even igual ao torch.to(bfloat16). Valida no fim relendo
o arquivo novo: erro relativo máximo permitido é o próprio passo de
arredondamento do BF16 (2^-8 = 0,39%). Acima disso = bug, aborta.
"""
import json
import os
import struct
import sys

import numpy as np
from safetensors import safe_open
from safetensors.numpy import save_file

SRC = os.environ["SRC"]
DST = os.environ["DST"]


def f32_to_bf16_bits(a: np.ndarray) -> np.ndarray:
    """float32 -> uint16 com os bits BF16, round-to-nearest-even."""
    bits = a.view(np.uint32)
    upper = bits >> 16
    rounded = (bits + 0x7FFF + ((bits >> 16) & 1)) >> 16
    # NaN precisa continuar NaN (arredondar poderia virar Inf)
    is_nan = (bits & 0x7F800000) == 0x7F800000
    is_nan &= (bits & 0x007FFFFF) != 0
    out = np.where(is_nan, upper | 0x0040, rounded)
    return out.astype(np.uint16)


def bf16_bits_to_f32(u16: np.ndarray) -> np.ndarray:
    return (u16.astype(np.uint32) << 16).view(np.float32)


def main() -> int:
    os.makedirs(os.path.dirname(DST), exist_ok=True)

    tensors = {}
    names = []
    with safe_open(SRC, framework="numpy") as f:
        for name in f.keys():
            a = f.get_tensor(name)
            if a.dtype != np.float32:
                print(f"  [mantido] {name}: {a.dtype}")
                tensors[name] = a
                continue
            tensors[name] = f32_to_bf16_bits(a)
            names.append(name)

    save_file(tensors, DST)

    # ── troca U16 -> BF16 no header (formato safetensors: len + json + dados) ──
    with open(DST, "rb") as fh:
        n = struct.unpack("<Q", fh.read(8))[0]
        header = json.loads(fh.read(n))
        rest = fh.read()
    changed = 0
    for k, v in header.items():
        if k == "__metadata__":
            continue
        if v["dtype"] == "U16" and k in set(names):
            v["dtype"] = "BF16"
            changed += 1
    hdr = json.dumps(header, separators=(",", ":")).encode()
    pad = (8 - (len(hdr) % 8)) % 8  # alinhamento em 8, regra do formato
    hdr += b" " * pad
    with open(DST, "wb") as fh:
        fh.write(struct.pack("<Q", len(hdr)))
        fh.write(hdr)
        fh.write(rest)
    print(f"convertidos {changed} tensores para BF16")

    # ── validação: relê e compara com o original ──
    max_rel = 0.0
    max_abs = 0.0
    with safe_open(SRC, framework="numpy") as fsrc, open(DST, "rb") as fdst:
        n = struct.unpack("<Q", fdst.read(8))[0]
        header = json.loads(fdst.read(n))
        base = 8 + n
        for name in names[:: max(1, len(names) // 40)]:
            info = header[name]
            s, e = info["data_offsets"]
            fdst.seek(base + s)
            raw = fdst.read(e - s)
            got = bf16_bits_to_f32(np.frombuffer(raw, dtype=np.uint16)).astype(np.float64)
            ref = fsrc.get_tensor(name).ravel().astype(np.float64)
            finite = np.isfinite(ref) & (np.abs(ref) > 1e-30)
            if finite.any():
                rel = np.max(np.abs(got[finite] - ref[finite]) / np.abs(ref[finite]))
                max_rel = max(max_rel, float(rel))
        max_abs = max(max_abs, float(np.max(np.abs(got - ref))))
    print(f"validacao: erro relativo max {max_rel:.6f} (limite 0.003906)")
    if max_rel > 0.003906:
        print("ERRO: acima do arredondamento esperado — conversao INVALIDA")
        return 1
    print(f"OK — {DST} com {os.path.getsize(DST)/1e9:.2f} GB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
