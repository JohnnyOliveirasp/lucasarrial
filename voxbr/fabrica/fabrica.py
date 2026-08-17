#!/usr/bin/env python3
"""
VoxBR — FÁBRICA DE DADOS pt-BR (09/08/2026).

Transforma o YODAS2 `pt000` (vídeos CC do YouTube com legenda HUMANA) no
dataset de treino do VoxCPM2: clipes de 3-30s em FLAC 16kHz mono + manifesto
JSONL no formato que o `train_voxcpm_finetune.py` espera.

REGRA Nº 1 (achado do Johnny): o YODAS agrupa por idioma da LEGENDA, não do
ÁUDIO — 26% do lote "pt" é inglês/coreano/khmer/só-música. Todo vídeo passa
por identificação de idioma DO ÁUDIO antes de virar dado.

Desenho:
  - trabalha pacote a pacote (baixa → processa → APAGA o bruto): disco fica
    baixo mesmo com 300GB de origem;
  - estado em `state.json` → pode matar e retomar de onde parou;
  - cada linha do manifesto guarda a ORIGEM (fonte, vídeo, licença) pra
    permitir remover uma fonte depois sem refazer tudo.

Armazenamento: NÃO usa Network Volume (prende região e custa 10x mais). Cada
pacote processado vira um .tar de clipes + um .jsonl, enviados pro R2 (o
mesmo que a plataforma já usa): US$0,90/mês em vez de US$10,50, sem prender
o treino a um datacenter e sem custo de saída (R2 não cobra egress).

Uso:
  python fabrica.py --out /workspace/dataset --shards 0-201 [--max-hours 0]
     [--r2-prefix voxbr/dataset_v1]   # vazio = não envia (fica só local)
"""
import argparse
import json
import os
import shutil
import subprocess
import sys
import tarfile
import time
import urllib.request
from pathlib import Path

import numpy as np
import soundfile as sf

YODAS = "https://huggingface.co/datasets/espnet/yodas2/resolve/main/data"
LICENCA = "CC-BY-3.0"
SR = 16_000  # sample_rate do treino (conf/voxcpm_v2/voxcpm_finetune_all.yaml)

# Clipe: a doc oficial do VoxCPM diz que 3-30s é o ponto ideal.
MIN_CLIPE_S = 3.0
MAX_CLIPE_S = 30.0
# Falas contíguas com gap <= isso viram um clipe só (mesma lição do fix do
# chunking 08/08: pausa natural entre frases é 0,7-1,5s).
MERGE_GAP_S = 1.2
# Texto: descarta legenda que não é fala (tags, ruído) ou fora de proporção.
TAGS_RUIM = ("[música]", "[music]", "[aplausos]", "[applause]", "[risos]", "♪")
MIN_CHARS_POR_S = 4.0   # menos que isso = legenda solta / silêncio legendado
MAX_CHARS_POR_S = 28.0  # mais que isso = legenda dessincronizada
MIN_RMS = 0.005         # clipe quase mudo
LANG_MIN_PROB = 0.6


def log(msg: str) -> None:
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def baixar(url: str, destino: Path, tentativas: int = 4) -> bool:
    for i in range(tentativas):
        try:
            with urllib.request.urlopen(url, timeout=180) as r, open(destino, "wb") as f:
                shutil.copyfileobj(r, f, length=1 << 22)
            return True
        except Exception as e:  # rede é instável; tenta de novo
            log(f"  download falhou ({i+1}/{tentativas}): {e}")
            time.sleep(5 * (i + 1))
    return False


def ts_do_utt_id(utt_id: str) -> tuple[float, float]:
    """`Yxxxx-00007-00002940-00003217` → (29.40, 32.17) em segundos."""
    p = utt_id.split("-")
    return int(p[-2]) / 100.0, int(p[-1]) / 100.0


def limpar_texto(t: str) -> str:
    return " ".join(t.replace("\n", " ").split()).strip()


def texto_ruim(t: str) -> bool:
    baixo = t.lower()
    return (not t) or any(tag in baixo for tag in TAGS_RUIM)


def juntar_falas(utts: list[tuple[float, float, str]]) -> list[tuple[float, float, str]]:
    """Une falas contíguas em blocos de MIN..MAX segundos."""
    if not utts:
        return []
    blocos = []
    ini, fim, txt = utts[0]
    for s, e, t in utts[1:]:
        if s - fim <= MERGE_GAP_S and (e - ini) <= MAX_CLIPE_S:
            fim, txt = e, f"{txt} {t}"
        else:
            blocos.append((ini, fim, txt))
            ini, fim, txt = s, e, t
    blocos.append((ini, fim, txt))
    return [b for b in blocos if MIN_CLIPE_S <= (b[1] - b[0]) <= MAX_CLIPE_S]


def para_16k_mono(src: Path, dst: Path) -> bool:
    r = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(src), "-ac", "1", "-ar", str(SR), "-y", str(dst)],
        capture_output=True,
    )
    return r.returncode == 0 and dst.exists()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--shards", default="0-201", help="ex.: 0-201 ou 0-9")
    ap.add_argument("--max-hours", type=float, default=0.0, help="0 = sem teto")
    ap.add_argument("--tmp", default="/workspace/tmp")
    ap.add_argument("--r2-prefix", default="", help="ex.: voxbr/dataset_v1 (vazio = só local)")
    ap.add_argument("--lote", default="pt000", help="lote do YODAS: pt000 (pt) ou en000 (âncora)")
    ap.add_argument("--idioma", default="pt", help="idioma esperado do ÁUDIO")
    args = ap.parse_args()

    r2 = None
    if args.r2_prefix:
        import boto3
        r2 = boto3.client(
            "s3",
            endpoint_url=os.environ["R2_ENDPOINT"],
            aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
            aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
            region_name="auto",
        )
        bucket = os.environ["R2_BUCKET"]

    base = f"{YODAS}/{args.lote}"
    fonte = f"yodas2:{args.lote}"
    out = Path(args.out)
    (out / "wav").mkdir(parents=True, exist_ok=True)
    tmp = Path(args.tmp)
    tmp.mkdir(parents=True, exist_ok=True)
    manifesto = out / "train.jsonl"
    estado_path = out / "state.json"

    estado = json.loads(estado_path.read_text()) if estado_path.exists() else {
        "shards_ok": [], "horas": 0.0, "clipes": 0,
        "videos": {"pt": 0, "outro_idioma": 0, "sem_fala": 0},
        "descartes": {"texto": 0, "duracao": 0, "mudo": 0, "proporcao": 0},
        "idiomas": {},
    }

    a, b = (args.shards.split("-") + [args.shards])[:2]
    shards = range(int(a), int(b) + 1)

    log("carregando modelo de identificação de idioma (faster-whisper small)...")
    from faster_whisper import WhisperModel
    lang_model = WhisperModel("small", device="cuda", compute_type="float16")

    mf = open(manifesto, "a", encoding="utf-8")

    for idx in shards:
        nome = f"{idx:08d}"
        if nome in estado["shards_ok"]:
            continue
        if args.max_hours and estado["horas"] >= args.max_hours:
            log(f"teto de {args.max_hours}h atingido — parando.")
            break

        log(f"=== pacote {nome} ({estado['horas']:.1f}h acumuladas) ===")
        tar_path = tmp / f"{nome}.tar.gz"
        json_path = tmp / f"{nome}.json"
        if not baixar(f"{base}/text/{nome}.json", json_path):
            log("  sem texto — pulando pacote")
            continue
        if not baixar(f"{base}/audio/{nome}.tar.gz", tar_path):
            log("  sem áudio — pulando pacote")
            continue

        textos = {v["audio_id"]: v["text"] for v in json.loads(json_path.read_text(encoding="utf-8"))}
        extraidos = tmp / nome
        extraidos.mkdir(exist_ok=True)
        try:
            with tarfile.open(tar_path) as t:
                t.extractall(extraidos)
        except Exception as e:
            log(f"  tar corrompido ({e}) — pulando")
            shutil.rmtree(extraidos, ignore_errors=True)
            tar_path.unlink(missing_ok=True)
            continue
        tar_path.unlink(missing_ok=True)

        wavs = sorted(extraidos.rglob("*.wav"))
        log(f"  {len(wavs)} vídeos no pacote")
        for w in wavs:
            vid = w.stem
            utt_map = textos.get(vid) or textos.get("Y" + vid[1:]) or {}
            if not utt_map:
                continue
            wav16 = tmp / f"{vid}_16k.wav"
            if not para_16k_mono(w, wav16):
                w.unlink(missing_ok=True)
                continue

            try:
                audio, _ = sf.read(str(wav16), dtype="float32")
            except Exception:
                wav16.unlink(missing_ok=True); w.unlink(missing_ok=True)
                continue

            # ── REGRA Nº 1: idioma do ÁUDIO (nunca confiar na etiqueta) ──
            meio = len(audio) // 2
            amostra = audio[max(0, meio - 15 * SR): meio + 15 * SR]
            lang, prob = "?", 0.0
            if len(amostra) > SR:
                amostra_path = tmp / "_lang.wav"
                sf.write(str(amostra_path), amostra, SR)
                try:
                    _, info = lang_model.transcribe(str(amostra_path), beam_size=1, without_timestamps=True)
                    lang, prob = info.language, float(info.language_probability or 0)
                except Exception:
                    pass
            estado["idiomas"][lang] = estado["idiomas"].get(lang, 0) + 1
            if lang != args.idioma or prob < LANG_MIN_PROB:
                estado["videos"]["outro_idioma" if lang != args.idioma else "sem_fala"] += 1
                wav16.unlink(missing_ok=True); w.unlink(missing_ok=True)
                continue
            estado["videos"]["pt"] += 1

            # ── falas → blocos de 3-30s ──
            utts = []
            for utt_id, texto in utt_map.items():
                t = limpar_texto(texto)
                if texto_ruim(t):
                    estado["descartes"]["texto"] += 1
                    continue
                try:
                    s, e = ts_do_utt_id(utt_id)
                except Exception:
                    continue
                if e > s:
                    utts.append((s, e, t))
            utts.sort()
            for ini, fim, txt in juntar_falas(utts):
                dur = fim - ini
                cps = len(txt) / dur
                if not (MIN_CHARS_POR_S <= cps <= MAX_CHARS_POR_S):
                    estado["descartes"]["proporcao"] += 1
                    continue
                trecho = audio[int(ini * SR): int(fim * SR)]
                if len(trecho) < MIN_CLIPE_S * SR:
                    estado["descartes"]["duracao"] += 1
                    continue
                if float(np.sqrt(np.mean(trecho ** 2))) < MIN_RMS:
                    estado["descartes"]["mudo"] += 1
                    continue
                nome_clipe = f"{vid}_{int(ini*100):08d}.flac"
                sf.write(str(out / "wav" / nome_clipe), trecho, SR)
                mf.write(json.dumps({
                    "audio": str(out / "wav" / nome_clipe),
                    "text": txt,
                    "duration": round(dur, 2),
                    "fonte": fonte, "video": vid, "licenca": LICENCA,
                }, ensure_ascii=False) + "\n")
                estado["clipes"] += 1
                estado["horas"] += dur / 3600.0

            wav16.unlink(missing_ok=True)
            w.unlink(missing_ok=True)

        mf.flush()
        shutil.rmtree(extraidos, ignore_errors=True)
        json_path.unlink(missing_ok=True)

        # ── empacota o pacote e manda pro R2 (1 objeto, não 1 por clipe:
        # 300k PUTs custariam caro e o treino lê tar muito mais rápido) ──
        if r2:
            clipes = sorted((out / "wav").glob("*.flac"))
            if clipes:
                tar_out = out / f"clipes_{nome}.tar"
                with tarfile.open(tar_out, "w") as t:
                    for c in clipes:
                        t.add(c, arcname=c.name)
                try:
                    r2.upload_file(str(tar_out), bucket, f"{args.r2_prefix}/clipes_{nome}.tar")
                    r2.upload_file(str(manifesto), bucket, f"{args.r2_prefix}/train.jsonl")
                    r2.upload_file(str(estado_path), bucket, f"{args.r2_prefix}/state.json") if estado_path.exists() else None
                    log(f"  R2 ok: clipes_{nome}.tar ({tar_out.stat().st_size/1e6:.0f} MB, {len(clipes)} clipes)")
                    for c in clipes:
                        c.unlink(missing_ok=True)  # libera disco: o tar já está na nuvem
                    tar_out.unlink(missing_ok=True)
                except Exception as e:
                    log(f"  ⚠️ upload R2 falhou ({e}) — clipes ficam no disco local")

        estado["shards_ok"].append(nome)
        estado_path.write_text(json.dumps(estado, indent=1, ensure_ascii=False))
        log(f"  acumulado: {estado['horas']:.1f}h em {estado['clipes']} clipes "
            f"| vídeos pt {estado['videos']['pt']} / descartados {estado['videos']['outro_idioma']}")

    mf.close()
    log("=== FIM ===")
    log(json.dumps(estado["videos"], ensure_ascii=False))
    log(json.dumps(estado["descartes"], ensure_ascii=False))
    log(f"TOTAL: {estado['horas']:.1f}h em {estado['clipes']} clipes")
    return 0


if __name__ == "__main__":
    sys.exit(main())
