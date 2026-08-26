"""QA de FIM ABRUPTO — o defeito que nenhum critério textual enxerga.

Caso real (Carol Crozeta, 26/08): a geração "Olá, eu sou Carol Crozeta, sua
nutricionista." saiu com a última sílaba decepada. O whisper RECONSTRUIU a
palavra inteira, a cobertura deu 100%, e o áudio cortado foi entregue.
Só o envelope denuncia: fala natural decai, fala truncada vai de energia alta
a zero num frame.

Os números aqui são os medidos nos arquivos reais daquele dia:
entrega cortada terminou em RMS 0.056; sete entregas boas do mesmo dia
terminaram entre 0.005 e 0.010.
"""
import unittest

import numpy as np

from tts_qa.metrics import fim_abrupto

SR = 16000


def _fala(dur_s: float = 1.0, amp: float = 0.1) -> np.ndarray:
    return np.ones(int(SR * dur_s), dtype=np.float32) * amp


def _com_decaimento(dur_s: float = 1.0, decai_ms: int = 200, amp: float = 0.1) -> np.ndarray:
    w = _fala(dur_s, amp)
    n = min(int(SR * decai_ms / 1000), w.size)
    w[-n:] *= np.linspace(1.0, 0.0, n, dtype=np.float32)
    return w


class FimAbruptoTest(unittest.TestCase):
    def test_corte_seco_e_flagrado(self):
        """Energia alta até o último sample = decepado."""
        self.assertTrue(fim_abrupto(_fala(), SR))

    def test_decaimento_natural_passa(self):
        """Fala que se apaga sozinha não é corte."""
        self.assertFalse(fim_abrupto(_com_decaimento(), SR))

    def test_silencio_no_fim_nao_engana(self):
        """O bug da 1a versão: medir os últimos 50 ms pegava o silêncio do
        encoder e dava 'ok' pra áudio decepado. A janela é ancorada no último
        ponto COM som."""
        cortado = np.concatenate([_fala(), np.zeros(int(SR * 0.5), dtype=np.float32)])
        self.assertTrue(fim_abrupto(cortado, SR))

    def test_audio_mudo_devolve_none(self):
        self.assertIsNone(fim_abrupto(np.zeros(SR, dtype=np.float32), SR))

    def test_vazio_devolve_none(self):
        self.assertIsNone(fim_abrupto(np.zeros(0, dtype=np.float32), SR))
        self.assertIsNone(fim_abrupto(None, SR))

    def test_curto_demais_devolve_none(self):
        self.assertIsNone(fim_abrupto(np.ones(10, dtype=np.float32) * 0.1, SR))

    def test_limiar_bate_com_os_numeros_reais(self):
        """0.056 (o caso da Carol) reprova; 0.010 (entrega boa) passa."""
        self.assertTrue(fim_abrupto(_fala(amp=0.056), SR))
        self.assertFalse(fim_abrupto(_fala(amp=0.010), SR))


if __name__ == "__main__":
    unittest.main()
