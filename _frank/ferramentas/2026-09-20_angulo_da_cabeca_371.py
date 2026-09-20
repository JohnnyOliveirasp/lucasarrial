#!/usr/bin/env python3
"""
#371 — MEDE O ÂNGULO DA CABEÇA COM GEOMETRIA, NÃO COM OLHO.

POR QUE ESTA FERRAMENTA EXISTE
==============================
O gabarito do #371 inverteu DUAS VEZES em sete dias, e as duas vezes por
julgamento visual — inclusive entre dois leitores independentes (o Frank e o
`olho`) que divergiram em 4 das 9 imagens. A régua que existia
(`2026-09-20_regua_gate_rosto_371.cjs`) carrega um gabarito montado a olho que
marca 4 fotos da Alice como NEGATIVO porque "ela olha para o lado".

O CONTRATO DO PORTÃO NÃO CONCORDA. `face-gate.ts:74`, na lista de ACEITAR, diz
com todas as letras:

    "eyes narrowed, closed, or pointing away from the lens"  -> true (accept)

e `face-gate.ts:64` resume: "O contrato, portanto, é POSE DA CABEÇA + BOCA
VISÍVEL. Direção do olhar não entra."

Ou seja: a régua antiga reprova, por olhar, exatamente o que o contrato manda
aceitar. Usar aquele gabarito pra aprovar conserto faz um conserto CERTO
parecer errado. Por isso aqui não se pergunta "pra onde ela olha" — pergunta-se
o ÚNICO número que o contrato cita: **quantos graus a CABEÇA está virada**.

O QUE ELA MEDE
==============
Landmarks faciais (MediaPipe FaceLandmarker, 478 pontos) -> matriz de
transformação facial -> ângulos de Euler yaw / pitch / roll, em graus.

O contrato aceita até ~30° em yaw, pitch e roll. Então o veredito geométrico é:
    max(|yaw|, |pitch|, |roll|) <= 30  ->  o contrato manda ACEITAR
    caso contrário                     ->  o contrato manda RECUSAR

CONTROLES — E ELA ABORTA SE OS CONTROLES NÃO BATEREM
====================================================
Medir sem controle já produziu "zero de instrumento cego" nesta casa mais de
uma vez. Esta régua carrega dois controles de fora da Alice, com veredito já
estabelecido e estável nas duas versões do gate:

  itamar_40b59813_POS  — passa 5/5 no gate antes E depois  -> tem que dar <= 30°
  itamar_8cd37f59_NEG  — barrado 0/5 no gate antes E depois -> tem que dar  > 30°

Se qualquer um dos dois contrariar, a medição inteira é descartada: o problema
passa a ser a régua, não as fotos. Não se decide nada com instrumento que erra
o caso conhecido.

USO
    python3 2026-09-20_angulo_da_cabeca_371.py --dir /tmp/gate371-img \
        --modelo /tmp/face_landmarker.task
"""

import argparse
import math
import os
import sys

import cv2
import numpy as np
import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision

# Contrato: face-gate.ts:73 — "within about 30 degrees of yaw, pitch and roll"
LIMITE_GRAUS = 30.0

# (arquivo, rótulo curto, papel). Papel 'CONTROLE+' e 'CONTROLE-' abortam.
ALVOS = [
    ("itamar_40b59813_POS.png", "itamar 40b59813", "CONTROLE+"),
    ("itamar_8cd37f59_NEG.png", "itamar 8cd37f59", "CONTROLE-"),
    ("alice_4100fc07_GERADA.png", "alice 4100fc07", "alice"),
    ("alice_128b3050.jpg", "alice 128b3050", "alice"),
    ("alice_0e6a538a.jpg", "alice 0e6a538a", "alice"),
    ("alice_b5c6dea7.jpg", "alice b5c6dea7", "alice"),
    ("alice_2b274f51.png", "alice 2b274f51", "alice"),
    ("alice_5f610dda.jpg", "alice 5f610dda", "alice"),
    ("alice_8cd4c73c.jpg", "alice 8cd4c73c", "alice"),
]


def euler_da_matriz(m):
    """Ângulos de Euler (graus) da parte rotacional 3x3 da matriz de pose.

    Decomposição R = Rz(roll) * Ry(yaw) * Rx(pitch), que é a convenção que
    casa com o vocabulário do contrato (yaw = virar pro lado, pitch = subir/
    baixar o queixo, roll = inclinar a cabeça no ombro).
    """
    r = np.array(m)[:3, :3]
    sy = math.sqrt(r[0, 0] ** 2 + r[1, 0] ** 2)
    if sy > 1e-6:
        pitch = math.atan2(r[2, 1], r[2, 2])
        yaw = math.atan2(-r[2, 0], sy)
        roll = math.atan2(r[1, 0], r[0, 0])
    else:  # gimbal lock
        pitch = math.atan2(-r[1, 2], r[1, 1])
        yaw = math.atan2(-r[2, 0], sy)
        roll = 0.0
    return tuple(math.degrees(x) for x in (pitch, yaw, roll))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", default="/tmp/gate371-img")
    ap.add_argument("--modelo", default="/tmp/face_landmarker.task")
    args = ap.parse_args()

    if not os.path.exists(args.modelo):
        sys.exit(f"modelo nao encontrado: {args.modelo}")

    opts = vision.FaceLandmarkerOptions(
        base_options=mp_python.BaseOptions(model_asset_path=args.modelo),
        output_facial_transformation_matrixes=True,
        num_faces=1,
    )

    linhas = []
    with vision.FaceLandmarker.create_from_options(opts) as det:
        for arq, rotulo, papel in ALVOS:
            caminho = os.path.join(args.dir, arq)
            if not os.path.exists(caminho):
                linhas.append((rotulo, papel, None, None, None, "ARQUIVO AUSENTE"))
                continue

            bgr = cv2.imread(caminho)
            if bgr is None:
                linhas.append((rotulo, papel, None, None, None, "NAO DECODIFICOU"))
                continue

            rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
            img = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
            res = det.detect(img)

            if not res.facial_transformation_matrixes:
                linhas.append((rotulo, papel, None, None, None, "NENHUM ROSTO"))
                continue

            pitch, yaw, roll = euler_da_matriz(res.facial_transformation_matrixes[0])
            linhas.append((rotulo, papel, pitch, yaw, roll, None))

    # ---------- tabela ----------
    print()
    print(f"ÂNGULO DA CABEÇA — contrato aceita até {LIMITE_GRAUS:.0f}° "
          f"em yaw, pitch e roll (face-gate.ts:73)")
    print("=" * 86)
    print(f"{'imagem':<18}{'papel':<11}{'pitch':>9}{'yaw':>9}{'roll':>9}"
          f"{'pior':>9}{'contrato':>13}")
    print("-" * 86)

    vereditos = {}
    for rotulo, papel, pitch, yaw, roll, erro in linhas:
        if erro:
            print(f"{rotulo:<18}{papel:<11}{erro:>50}")
            vereditos[rotulo] = None
            continue
        pior = max(abs(pitch), abs(yaw), abs(roll))
        manda = "ACEITAR" if pior <= LIMITE_GRAUS else "RECUSAR"
        vereditos[rotulo] = (manda, pior)
        print(f"{rotulo:<18}{papel:<11}{pitch:>8.1f}°{yaw:>8.1f}°{roll:>8.1f}°"
              f"{pior:>8.1f}°{manda:>13}")

    # ---------- controles ----------
    print()
    print("CONTROLES (a medição inteira cai se um destes falhar)")
    print("-" * 86)
    ok = True

    v_pos = vereditos.get("itamar 40b59813")
    if v_pos is None:
        print("  ✗ CONTROLE+ nao mediu"); ok = False
    else:
        bate = v_pos[0] == "ACEITAR"
        print(f"  {'✓' if bate else '✗'} CONTROLE+ itamar 40b59813: "
              f"pior {v_pos[1]:.1f}° -> {v_pos[0]} "
              f"(gate passa 5/5; esperado ACEITAR)")
        ok = ok and bate

    v_neg = vereditos.get("itamar 8cd37f59")
    if v_neg is None:
        print("  ✗ CONTROLE- nao mediu"); ok = False
    else:
        bate = v_neg[0] == "RECUSAR"
        print(f"  {'✓' if bate else '✗'} CONTROLE- itamar 8cd37f59: "
              f"pior {v_neg[1]:.1f}° -> {v_neg[0]} "
              f"(gate barra 0/5; esperado RECUSAR)")
        ok = ok and bate

    print()
    if not ok:
        print(">>> RÉGUA REPROVADA nos controles. NÃO decida nada com estes números.")
        sys.exit(2)

    print(">>> Régua aprovada nos dois controles. Os números da Alice valem.")


if __name__ == "__main__":
    main()
