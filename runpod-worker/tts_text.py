"""Preparo do TEXTO antes de gerar: borda limpa e quebra em trechos.

Nao confundir com tts_qa/text.py — aquele normaliza pra COMPARAR (QA), este
prepara o texto que o modelo vai FALAR.
"""
from __future__ import annotations

import re


# Aspas (retas + tipograficas + guillemets) que aparecem no FIM de um trecho e
# confundem o "stop predictor" do VoxCPM — ele tenta "fechar" a fala inventando
# filler ("entao", "nao", "ne"). Removidas na borda (nao tem som proprio).
_QUOTES = "\"'`" + "“”‘’«»"


def ensure_terminal(s: str) -> str:
    """Garante que o TRECHO termine com pontuacao FORTE (. ! ? …).

    O VoxCPM alucina filler quando o chunk termina sem sinal claro de parada —
    tipico de linhas que terminam em ':' (ex.: 'Ela falou:'), ',' ou fechando
    aspas de dialogo. Aqui limpamos a borda: tira aspas/pontuacao fraca do fim e
    forca um ponto final. So afeta o FIM do chunk (a pontuacao interna fica).
    """
    s = s.strip().rstrip(_QUOTES).strip()
    if not s:
        return s
    if s[-1] in ".!?…":
        return s
    s = s.rstrip(",:;–—- ").strip()
    if not s:
        return s
    return s + "."


def split_text_for_tts(text: str, max_chars: int = 160) -> "list[tuple[str, bool]]":
    """Quebra texto em chunks <= max_chars respeitando fim de frase.

    VoxCPM gera 1 utterance por chamada e drifta/acelera em texto longo (issue
    #302). Quebrar em frases e gerar cada uma re-ancora a referencia + reinicia
    o estado interno do modelo a cada chunk — a doc oficial confirma que isso
    previne 'gradual speed-up' e drift de timbre.
    https://voxcpm.readthedocs.io/en/latest/usage_guide.html

    Cada chunk passa por ensure_terminal: termina sempre com . ! ? — sem isso o
    modelo inventa filler ("entao nao") pra "completar" a fala.

    Retorna (chunk, fim_de_paragrafo): quebras de paragrafo (\n\n) do texto do
    usuario viram pausa REAL na montagem (caso Joana 21/07: roteiro com
    paragrafos dramaticos saiu emendado sem respiro, 16%% mais rapido que o
    mesmo texto no concorrente).
    """
    text = (text or "").strip()
    if not text:
        return []
    out: "list[tuple[str, bool]]" = []
    paragraphs = [p for p in re.split(r"\n\s*\n", text) if p.strip()]
    for para in paragraphs:
        # Separa em frases por fim de pontuacao. Inclui ':' e ';' como
        # fronteira (linhas 'Ela falou:' viram seu proprio trecho, depois
        # normalizadas pra terminar em '.'). \n simples tambem corta.
        sentences = re.split(r"(?<=[.!?…:;])\s+|\n+", para)
        chunks: list[str] = []
        cur = ""
        for s in sentences:
            s = s.strip()
            if not s:
                continue
            # Se grudar a proxima frase passa do limite, fecha o chunk atual.
            # Se a frase sozinha estoura, deixa estourar (nao corta meio-palavra).
            if cur and len(cur) + 1 + len(s) > max_chars:
                chunks.append(cur)
                cur = s
            else:
                cur = (cur + " " + s) if cur else s
        if cur:
            chunks.append(cur)
        # Borda limpa em todo trecho (anti-filler). Remove vazios resultantes.
        cleaned = [c for c in (ensure_terminal(c) for c in chunks) if c]
        for i, c in enumerate(cleaned):
            out.append((c, i == len(cleaned) - 1))
    return out
