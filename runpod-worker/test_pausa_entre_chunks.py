"""Pausa entre chunks (botao "Pausa entre frases" na tela) estava INERTE.

POR QUE ESTE ARQUIVO EXISTE (medido na ronda de 25/09):
`_gerar_todos_os_chunks` so aplicava `silence_ms` entre chunks quando
`crossfade_samples == 0`. Em producao `crossfade_ms=60` (default), entao a
condicao nunca era verdadeira e o silencio escolhido pelo aluno nunca entrava
no audio — 194 geracoes de 88 alunos com `chunk_silence_ms > 0` desde 28/08,
ZERO delas com `crossfade_ms == 0`. O botao clicava e nao acontecia nada.

O CONSERTO: a pausa entre chunks passa a ser anexada ao PROPRIO segmento,
igual a pausa de paragrafo ja fazia (sobrevive ao crossfade porque o fade
desliza pra dentro do silencio, nao o contrario). Numa fronteira que tambem e'
fim de paragrafo, os dois pedidos (`par_pause_ms` e `silence_ms`) sao a MESMA
pausa — usa o MAIOR dos dois, nunca a soma.

    cd runpod-worker && python test_pausa_entre_chunks.py -v
"""
import os
import sys
import tempfile
import types
import unittest
from pathlib import Path

import numpy as np

# -- Ambiente ANTES de importar (worker_config le env no import) ------------
_TMP = Path(tempfile.mkdtemp(prefix="pausa_chunks_"))
os.environ.setdefault("WORKSPACE_DIR", str(_TMP / "jobs"))
os.environ.setdefault("JOB_TMP_DIR", str(_TMP / "tmp"))
os.environ.setdefault("LORA_CACHE_DIR", str(_TMP / "loras"))
os.environ.setdefault("VOXCPM_MODEL_DIR", str(_TMP / "model"))


def _stub_se_faltar(nome: str, fabrica) -> None:
    """So stuba o que NAO existe (mesmo padrao de test_cura_fim_telemetria.py)."""
    try:
        __import__(nome)
    except ImportError:
        sys.modules[nome] = fabrica()


def _hf():
    m = types.ModuleType("huggingface_hub")
    m.snapshot_download = lambda *a, **k: None
    return m


def _soundfile():
    m = types.ModuleType("soundfile")
    m.write = lambda *a, **k: None
    return m


def _runpod():
    m = types.ModuleType("runpod")
    m.serverless = types.SimpleNamespace(start=lambda *a, **k: None)
    return m


_stub_se_faltar("huggingface_hub", _hf)
_stub_se_faltar("soundfile", _soundfile)
_stub_se_faltar("runpod", _runpod)

from jobs import inference as ji  # noqa: E402

SR = 16000


def _seg(dur_s: float = 0.2, amp: float = 0.1) -> np.ndarray:
    return np.ones(int(SR * dur_s), dtype=np.float32) * amp


class _JobBase(unittest.TestCase):
    """Monta um job fake com N chunks de tamanho fixo, sem QA (prompt_wav_local
    None desativa inteiramente o ramo de QA em `_gerar_todos_os_chunks`, que
    nao e' o alvo deste teste)."""

    def _job(self, silence_ms: int, crossfade_ms: int, par_pause_ms: int = 300):
        class Fake(ji.InferenceJob):
            def __init__(self):
                self.sample_rate = SR
                self.qa_stats = {}
                self.prompt_wav_local = None  # desliga o ramo de QA inteiro
                self.cfg = type("C", (), {"algum_qa_ligado": False})()
                c = type("C2", (), {"amostras": staticmethod(
                    lambda ms, sr: max(0, int(sr * ms / 1000)))})()
                self.silence_samples = c.amostras(silence_ms, SR)
                self.crossfade_samples = c.amostras(crossfade_ms, SR)
                self.par_pause_samples = c.amostras(par_pause_ms, SR)

            def _gerar(self, chunk, idx):
                return _seg()

            def _aparar(self, x, idx):
                return x

        return Fake()

    def _tamanhos_das_fronteiras(self, pieces, tam_chunk: int):
        """Devolve, para cada fronteira interna, quantas amostras de silencio
        foram anexadas ALEM do proprio chunk gerado (tam_chunk amostras)."""
        return [p.size - tam_chunk for p in pieces[:-1]]


class DefaultSemMudancaTest(_JobBase):
    """Caso 1: default (silence_ms=0, crossfade_ms=60) — nenhuma amostra extra
    em nenhuma fronteira. Trava que as 5.919 geracoes historicas sem pausa
    pedida continuam byte-a-byte iguais."""

    def test_nenhuma_amostra_extra_em_nenhuma_fronteira(self):
        job = self._job(silence_ms=0, crossfade_ms=60)
        chunks = [("um.", False), ("dois.", False), ("tres.", False)]
        pieces, falha = job._gerar_todos_os_chunks(chunks)
        self.assertIsNone(falha)
        tam_chunk = _seg().size
        self.assertEqual(len(pieces), 3, "sem pausa nao nasce piece extra")
        for p in pieces:
            self.assertEqual(p.size, tam_chunk)


class SilenciaEntreChunksTest(_JobBase):
    """Caso 2: silence_ms=550, crossfade_ms=60, SEM paragrafo — cada fronteira
    interna ganha exatamente 550ms de zeros anexados ao segmento anterior.

    ESTE TESTE TEM QUE FALHAR NO CODIGO ANTIGO (crossfade_samples==0 exigido).
    """

    def test_cada_fronteira_ganha_550ms(self):
        job = self._job(silence_ms=550, crossfade_ms=60)
        chunks = [("um.", False), ("dois.", False), ("tres.", False)]
        pieces, falha = job._gerar_todos_os_chunks(chunks)
        self.assertIsNone(falha)
        tam_chunk = _seg().size
        esperado_amostras = int(SR * 550 / 1000)
        extras = self._tamanhos_das_fronteiras(pieces, tam_chunk)
        self.assertEqual(extras, [esperado_amostras, esperado_amostras],
                         "as duas fronteiras internas (0->1, 1->2) levam 550ms")
        # ultimo piece sem pausa (nao ha fronteira depois dele)
        self.assertEqual(pieces[-1].size, tam_chunk)


class ParagrafoSemSilencioTest(_JobBase):
    """Caso 3: paragrafo com silence_ms=0 — continua par_pause_ms (300),
    inalterado (nao regride o comportamento ja existente)."""

    def test_paragrafo_usa_par_pause_quando_nao_ha_pedido_de_silencio(self):
        job = self._job(silence_ms=0, crossfade_ms=60, par_pause_ms=300)
        chunks = [("um.", True), ("dois.", False)]
        pieces, falha = job._gerar_todos_os_chunks(chunks)
        self.assertIsNone(falha)
        tam_chunk = _seg().size
        esperado_amostras = int(SR * 300 / 1000)
        self.assertEqual(pieces[0].size - tam_chunk, esperado_amostras)


class ParagrafoComSilencioUsaMaxTest(_JobBase):
    """Caso 4: paragrafo com silence_ms=550 (par_pause_ms=300) -> da 550 (o
    MAIOR dos dois), NAO 850. Prova que nao ha soma dupla."""

    def test_paragrafo_e_silencio_usam_o_maior_nao_a_soma(self):
        job = self._job(silence_ms=550, crossfade_ms=60, par_pause_ms=300)
        chunks = [("um.", True), ("dois.", False)]
        pieces, falha = job._gerar_todos_os_chunks(chunks)
        self.assertIsNone(falha)
        tam_chunk = _seg().size
        esperado_amostras = int(SR * 550 / 1000)  # max(550, 300) = 550
        self.assertEqual(pieces[0].size - tam_chunk, esperado_amostras)

    def test_o_inverso_par_pause_maior_tambem_usa_o_maior(self):
        """par_pause_ms (900) > silence_ms (550): vale o maior, 900."""
        job = self._job(silence_ms=550, crossfade_ms=60, par_pause_ms=900)
        chunks = [("um.", True), ("dois.", False)]
        pieces, falha = job._gerar_todos_os_chunks(chunks)
        self.assertIsNone(falha)
        tam_chunk = _seg().size
        esperado_amostras = int(SR * 900 / 1000)
        self.assertEqual(pieces[0].size - tam_chunk, esperado_amostras)


class UltimoChunkSemPausaTest(_JobBase):
    """Caso 5: o ULTIMO chunk nunca ganha pausa no fim, mesmo pedindo
    silence_ms alto e mesmo o ultimo terminando em paragrafo."""

    def test_ultimo_chunk_fica_sem_pausa_no_fim(self):
        job = self._job(silence_ms=550, crossfade_ms=60, par_pause_ms=900)
        chunks = [("um.", False), ("dois.", True)]  # ultimo termina paragrafo
        pieces, falha = job._gerar_todos_os_chunks(chunks)
        self.assertIsNone(falha)
        tam_chunk = _seg().size
        self.assertEqual(pieces[-1].size, tam_chunk,
                         "nao existe fronteira depois do ultimo chunk")

    def test_chunk_unico_tambem_fica_sem_pausa(self):
        job = self._job(silence_ms=550, crossfade_ms=60)
        pieces, falha = job._gerar_todos_os_chunks([("so um.", False)])
        self.assertIsNone(falha)
        self.assertEqual(pieces[0].size, _seg().size)


if __name__ == "__main__":
    unittest.main()
