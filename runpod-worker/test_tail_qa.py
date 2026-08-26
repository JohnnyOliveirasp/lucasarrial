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


def _com_decaimento(dur_s: float = 1.0, decai_ms: int = 400, amp: float = 0.1) -> np.ndarray:
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


class CuraDoFimTest(unittest.TestCase):
    """A cura gera ALÉM do texto do aluno (frase-isca) e corta no fim da última
    palavra dele, com o tempo vindo do whisper. Medido em 26/08: só ter fala
    depois conserta (0,002); reticências não bastaram (voltou a cortar em prod).
    """

    def _fake(self, gerado, palavras):
        from jobs import inference as ji

        class Fake(ji.InferenceJob):
            ISCA = "Muito obrigada."

            def __init__(self):
                self.sample_rate = SR
                self.qa_stats = {}
                self.cfg = type("C", (), {"echo_qa_model": "small", "qa_language": "pt"})()

            def _gerar(self, chunk, idx):
                self.chunk_pedido = chunk
                return gerado

            def _aparar(self, x, idx):
                return x

        f = Fake()
        ji.palavras_com_tempo = lambda *a, **k: palavras
        return f

    def test_corta_no_fim_da_ultima_palavra_do_aluno(self):
        # fala do aluno decaindo até 0,60s, pausa, depois a isca — é a forma
        # real: entre a frase e a isca existe silêncio, e é nele que o corte cai
        gerado = np.concatenate([
            _com_decaimento(0.60), np.zeros(int(SR * 0.25), dtype=np.float32),
            _com_decaimento(0.40),
        ])
        palavras = [{"word": "nutricionista", "start": 0.2, "end": 0.60},
                    {"word": "Muito", "start": 0.9, "end": 1.0},
                    {"word": "obrigada", "start": 1.0, "end": 1.15}]
        f = self._fake(gerado, palavras)
        curado = f._curar_fim_abrupto(_fala(), 0, "sua nutricionista.")
        self.assertIn("Muito obrigada", f.chunk_pedido)
        self.assertLess(curado.size, gerado.size, "cortou a isca fora")
        self.assertEqual(f.qa_stats.get("tail_healed"), 1)

    def test_sem_palavras_suficientes_mantem_original(self):
        original = _fala(2.0)
        f = self._fake(_fala(1.0), [{"word": "obrigada", "start": 0.1, "end": 0.4}])
        self.assertIs(f._curar_fim_abrupto(original, 0, "sua nutricionista."), original)
        self.assertNotIn("tail_healed", f.qa_stats)

    def test_corte_que_continua_decepado_mantem_original(self):
        original = _fala(2.0)
        palavras = [{"word": "nutricionista", "start": 0.2, "end": 0.60},
                    {"word": "Muito", "start": 0.9, "end": 1.0},
                    {"word": "obrigada", "start": 1.0, "end": 1.15}]
        f = self._fake(_fala(1.5), palavras)  # tudo plano: corte segue abrupto
        self.assertIs(f._curar_fim_abrupto(original, 0, "sua nutricionista."), original)
        self.assertNotIn("tail_healed", f.qa_stats)

    def test_chunk_vazio_nao_gera(self):
        f = self._fake(_fala(), [])
        seg = _fala()
        self.assertIs(f._curar_fim_abrupto(seg, 0, "   "), seg)


class UltimaPalavraTruncadaTest(unittest.TestCase):
    """Números reais medidos em 26/08 com timestamp por palavra (whisper).

    cortadas: "nutricionista" em 0,20s e 0,32s = 0,040 e 0,064 s/sílaba
    boas:     0,100 a 0,340 s/sílaba, sete alunos diferentes
    """

    def _p(self, word, dur):
        return [{"word": word, "start": 1.0, "end": 1.0 + dur}]

    def test_caso_real_cortado_reprova(self):
        from tts_qa.metrics import ultima_palavra_truncada

        self.assertTrue(ultima_palavra_truncada(self._p("nutricionista", 0.20)))
        self.assertTrue(ultima_palavra_truncada(self._p("nutricionista", 0.32)))

    def test_casos_reais_bons_passam(self):
        from tts_qa.metrics import ultima_palavra_truncada

        for word, dur in [("vinda", 0.26), ("Cruzeta", 0.66), ("voz", 0.34),
                          ("vídeos", 0.30), ("querida", 0.46), ("investir", 0.36),
                          ("cabeça", 0.30), ("vendas", 0.46)]:
            self.assertFalse(ultima_palavra_truncada(self._p(word, dur)), word)

    def test_sem_dados_devolve_none(self):
        from tts_qa.metrics import ultima_palavra_truncada

        self.assertIsNone(ultima_palavra_truncada(None))
        self.assertIsNone(ultima_palavra_truncada([]))
        self.assertIsNone(ultima_palavra_truncada([{"word": "oi"}]))

    def test_contagem_de_silabas(self):
        from tts_qa.metrics import contar_silabas

        self.assertEqual(contar_silabas("nutricionista"), 5)
        self.assertEqual(contar_silabas("voz"), 1)
        self.assertEqual(contar_silabas("cabeça"), 3)
        self.assertEqual(contar_silabas(""), 1)

    def test_limiar_apertado_pega_o_que_o_johnny_ouviu(self):
        """0,027 passava no limiar antigo (0,030) e o corte estava lá."""
        self.assertTrue(fim_abrupto(_fala(amp=0.027), SR))
        self.assertFalse(fim_abrupto(_fala(amp=0.010), SR))
