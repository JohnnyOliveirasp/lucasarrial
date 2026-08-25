"""Caso Ellen (25/08): a referencia precisa falar na VELOCIDADE da pessoa.

O VoxCPM copia o ritmo da referencia. A Ellen fala a 1,4 palavras/s; a ref
escolhida tinha 3,7 (um trecho acelerado) e o clone falou o mesmo texto em
metade do tempo. O score nunca olhava velocidade.

Prova, sem GPU e sem whisper (words_fn falso):
  1. wps e' medido por candidata;
  2. a mediana das candidatas vira a velocidade natural;
  3. candidata 2x mais rapida perde pra candidata no ritmo, mesmo com texto igual;
  4. sem medida (fallback por tempo) nada muda;
  5. `medidas` devolve speech_rate_wps e reference_rate_wps.

    cd runpod-worker && python test_reference_speech_rate.py -v
"""
import sys
import tempfile
import types
import unittest
from pathlib import Path
from unittest import mock

if "soundfile" not in sys.modules:
    sys.modules["soundfile"] = types.ModuleType("soundfile")

from voice_pipeline import reference  # noqa: E402


def W(text, start, end):
    return {"word": text, "start": start, "end": end}


def frase(n, wps, t0=0.0):
    """n palavras a `wps` palavras/s, terminando com ponto."""
    dt = 1.0 / wps
    ws = [W("palavra", t0 + i * dt, t0 + (i + 1) * dt - 0.01) for i in range(n)]
    ws[0]["word"] = "Frase"
    ws[-1]["word"] = "final."
    return ws


class RatePenaltyTest(unittest.TestCase):
    def test_penalidade_proporcional_ao_desvio(self):
        self.assertEqual(reference.rate_penalty(1.4, 1.4), 0.0)
        self.assertAlmostEqual(reference.rate_penalty(1.75, 1.4), 25.0, places=0)
        self.assertAlmostEqual(reference.rate_penalty(2.8, 1.4), 100.0, places=0)
        self.assertEqual(reference.rate_penalty(None, 1.4), 0.0)
        self.assertEqual(reference.rate_penalty(2.0, None), 0.0)

    def test_mediana(self):
        self.assertEqual(reference._median([3.0, 1.0, 2.0]), 2.0)
        self.assertEqual(reference._median([1.0, None, 3.0]), 2.0)
        self.assertIsNone(reference._median([None]))


class SelecaoPorVelocidadeTest(unittest.TestCase):
    """3 janelas: 2 no ritmo da pessoa (1,4 pal/s) e 1 acelerada (2,8)."""

    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="rate_"))
        self.primary = self.tmp / "a_mono16k.wav"
        self.primary.write_bytes(b"x")
        self.ritmos = {}

    def _words_fn_factory(self, rates):
        # cada clipe folgado e' identificado pelo offset embutido no nome
        def fn(padded: Path):
            off = int(padded.name.split("_")[3].rstrip("s"))  # ref_cand_{i}_{off}s_padded
            wps = rates[off]
            return frase(int(wps * 30), wps, t0=1.5)  # 30s de fala a partir do slack
        return fn

    def test_candidata_acelerada_perde(self):
        rates = {0: 1.4, 30: 2.8, 60: 1.4}
        log = []
        with mock.patch.object(reference, "_audio_duration_seconds", return_value=95.0), \
             mock.patch.object(reference, "_candidate_offsets", return_value=[0.0, 30.0, 60.0]), \
             mock.patch.object(reference, "_slice_window", return_value=True):
            medidas = {}
            ranked = reference.select_reference_candidates(
                [self.primary], self.tmp / "cand", 30, lambda p: "x",
                max_candidates=3, log=lambda **k: log.append(k),
                transcribe_words_fn=self._words_fn_factory(rates), medidas=medidas,
            )
        self.assertEqual(len(ranked), 3)
        self.assertNotIn("_30s", ranked[0][0].name)       # a acelerada nao e' a 1a
        self.assertIn("_30s", ranked[-1][0].name)         # e' a ultima
        self.assertAlmostEqual(medidas["speech_rate_wps"], 1.4, places=1)
        self.assertAlmostEqual(medidas["reference_rate_wps"], 1.4, places=1)
        ev = [l for l in log if l.get("event") == "reference.speech_rate"]
        self.assertEqual(len(ev), 1)

    def test_regua_do_dataset_vence_a_mediana(self):
        """28/08: a mediana das candidatas ENGANA quando a maioria das janelas
        cai em trecho acelerado (2 de 3 a 2,8). A regua do dataset inteiro
        (#165, `target_wps`) diz que a pessoa fala a 1,4 — e a unica candidata
        nesse ritmo tem que ganhar, mesmo sendo minoria."""
        rates = {0: 2.8, 30: 1.4, 60: 2.8}
        log = []
        with mock.patch.object(reference, "_audio_duration_seconds", return_value=95.0),              mock.patch.object(reference, "_candidate_offsets", return_value=[0.0, 30.0, 60.0]),              mock.patch.object(reference, "_slice_window", return_value=True):
            medidas = {}
            ranked = reference.select_reference_candidates(
                [self.primary], self.tmp / "cand", 30, lambda p: "x",
                max_candidates=3, log=lambda **k: log.append(k),
                transcribe_words_fn=self._words_fn_factory(rates), medidas=medidas,
                target_wps=1.4,
            )
        self.assertIn("_30s", ranked[0][0].name)          # a unica no ritmo dela ganha
        self.assertAlmostEqual(medidas["speech_rate_wps"], 1.4, places=1)   # regua = dataset
        self.assertAlmostEqual(medidas["reference_rate_wps"], 1.4, places=1)
        ev = [l for l in log if l.get("event") == "reference.speech_rate"]
        self.assertEqual(ev[0]["regua_origem"], "dataset")

    def test_sem_target_cai_na_mediana(self):
        """Sem `target_wps` (treino antigo/medicao falhou) a regua e' a mediana — 25/08 intacto."""
        rates = {0: 1.4, 30: 2.8, 60: 1.4}
        log = []
        with mock.patch.object(reference, "_audio_duration_seconds", return_value=95.0),              mock.patch.object(reference, "_candidate_offsets", return_value=[0.0, 30.0, 60.0]),              mock.patch.object(reference, "_slice_window", return_value=True):
            reference.select_reference_candidates(
                [self.primary], self.tmp / "cand", 30, lambda p: "x",
                max_candidates=3, log=lambda **k: log.append(k),
                transcribe_words_fn=self._words_fn_factory(rates), medidas={},
            )
        ev = [l for l in log if l.get("event") == "reference.speech_rate"]
        self.assertEqual(ev[0]["regua_origem"], "mediana")

    def test_sem_words_fn_nao_muda_nada(self):
        with mock.patch.object(reference, "_audio_duration_seconds", return_value=95.0), \
             mock.patch.object(reference, "_candidate_offsets", return_value=[0.0, 30.0]), \
             mock.patch.object(reference, "_slice_window", return_value=True):
            medidas = {}
            ranked = reference.select_reference_candidates(
                [self.primary], self.tmp / "cand", 30, lambda p: "Texto de teste.",
                max_candidates=2, medidas=medidas,
            )
        self.assertEqual(len(ranked), 2)
        self.assertIsNone(medidas["speech_rate_wps"])


if __name__ == "__main__":
    unittest.main()
