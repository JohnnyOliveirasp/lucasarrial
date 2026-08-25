"""QA de RITMO por chunk (caso Ellen/Johnny 25/08) — prova sem GPU.

  1. articulacao = palavras / segundos falando (pausas nao contam);
  2. chunk no ritmo passa intacto (zero regen, zero stretch);
  3. chunk rapido: regenera, fica com o mais lento; se ainda rapido, estica
     ate o alvo, nunca alem de max_stretch;
  4. sem regua (target None) ou whisper mudo: chunk volta como veio;
  5. stretch de verdade com ffmpeg: fator 0,8 deixa o audio ~25% mais longo.

    cd runpod-worker && python test_rate_qa.py -v
"""
import shutil
import sys
import types
import unittest
from unittest import mock

import numpy as np

if "soundfile" not in sys.modules:
    try:
        import soundfile  # noqa: F401
    except Exception:
        sys.modules["soundfile"] = types.ModuleType("soundfile")

from tts_qa import rate  # noqa: E402

SR = 16000


def W(n, wps, gap=0.0):
    """n palavras a `wps` de articulacao, com `gap`s de pausa entre elas."""
    dur = 1.0 / wps
    t, out = 0.0, []
    for i in range(n):
        out.append({"word": f"p{i}", "start": t, "end": t + dur})
        t += dur + gap
    return out


class ArticulacaoTest(unittest.TestCase):
    def test_pausas_nao_contam(self):
        self.assertAlmostEqual(rate.articulation_wps(W(20, 2.0, gap=1.0)), 2.0, places=1)

    def test_poucas_palavras_e_none(self):
        self.assertIsNone(rate.articulation_wps(W(3, 2.0)))
        self.assertIsNone(rate.articulation_wps([]))


class ApplyRateQaTest(unittest.TestCase):
    def setUp(self):
        self.seg = np.zeros(SR * 2, dtype=np.float32)
        self.stats = {}

    def _run(self, medidas, target=2.0, retries=2, max_stretch=0.8):
        """`medidas` = articulacao devolvida a cada chamada do whisper (1a = chunk original)."""
        fila = list(medidas)
        with mock.patch.object(rate, "measure_seg_rate", side_effect=lambda *a, **k: fila.pop(0)), \
             mock.patch.object(rate, "stretch", side_effect=lambda s, sr, f: np.concatenate([s, np.zeros(int(s.size * (1 / f - 1)), dtype=np.float32)])) as st:
            out = rate.apply_rate_qa(
                self.seg, 0, SR, target, lambda: np.zeros(SR, dtype=np.float32),
                "turbo", "pt", tolerance=0.2, retries=retries, max_stretch=max_stretch,
                qa_stats=self.stats,
            )
        return out, st

    def test_no_ritmo_passa_intacto(self):
        out, st = self._run([2.1])
        self.assertIs(out, self.seg)
        self.assertEqual(self.stats.get("rate_regens", 0), 0)
        st.assert_not_called()

    def test_rapido_regenera_e_fica_com_o_mais_lento(self):
        out, st = self._run([3.0, 2.3])   # regen ja cai dentro da tolerancia (2,4)
        self.assertEqual(self.stats["rate_regens"], 1)
        self.assertEqual(self.stats["rate_flagged"], 1)
        st.assert_not_called()
        self.assertEqual(out.size, SR)     # e' o segmento regenerado

    def test_ainda_rapido_estica_ate_o_alvo(self):
        out, st = self._run([3.0, 2.9, 2.8])  # 2 regens, melhor = 2,8 > 2,4 -> stretch 2,0/2,8 = 0,714 -> clamp 0,8
        self.assertEqual(self.stats["rate_regens"], 2)
        self.assertEqual(self.stats["rate_stretched"], 1)
        fator = st.call_args[0][2]
        self.assertAlmostEqual(fator, 0.8, places=3)

    def test_sem_regua_nao_mede(self):
        with mock.patch.object(rate, "measure_seg_rate") as m:
            out = rate.apply_rate_qa(self.seg, 0, SR, None, lambda: self.seg, "t", "pt", 0.2, 2, 0.8, self.stats)
        m.assert_not_called()
        self.assertIs(out, self.seg)

    def test_whisper_mudo_devolve_como_veio(self):
        out, _ = self._run([None])
        self.assertIs(out, self.seg)
        self.assertEqual(self.stats["rate_none"], 1)


@unittest.skipUnless(shutil.which("ffmpeg"), "sem ffmpeg")
class StretchRealTest(unittest.TestCase):
    def test_atempo_0_8_alonga_25_por_cento(self):
        t = np.linspace(0, 2.0, SR * 2, endpoint=False)
        seg = (0.3 * np.sin(2 * np.pi * 220 * t)).astype(np.float32)
        out = rate.stretch(seg, SR, 0.8)
        self.assertAlmostEqual(out.size / seg.size, 1.25, delta=0.03)

    def test_fator_1_nao_toca(self):
        seg = np.zeros(SR, dtype=np.float32)
        self.assertIs(rate.stretch(seg, SR, 1.0), seg)


class RitmoNoLacoUnicoTest(unittest.TestCase):
    """v4: o ritmo e' julgado no MESMO laco do conteudo — tentativa rapida
    perde pra tentativa no ritmo, mas tentativa com palavra faltando perde
    pra tentativa rapida (peso menor)."""

    def _roda(self, rates, coverages, target=2.0):
        from tts_qa import loop
        fila_r = list(rates); fila_c = list(coverages)
        regen = lambda: np.zeros(SR, dtype=np.float32)
        with mock.patch.object(loop, "measure_seg_rate", side_effect=lambda *a, **k: fila_r.pop(0)), \
             mock.patch.object(loop, "transcribe_seg", return_value=["x"]), \
             mock.patch.object(loop, "echo_leak_count", return_value=0), \
             mock.patch.object(loop, "chunk_coverage", side_effect=lambda *a, **k: fila_c.pop(0)), \
             mock.patch.object(loop, "maior_lacuna", return_value=0), \
             mock.patch.object(loop, "chunk_intrusions", return_value=0):
            stats = {k: 0 for k in ("echo_checked", "echo_none", "coverage_checked", "coverage_none",
                                    "intrusion_checked", "intrusion_none", "regens", "exhausted",
                                    "echo_flagged", "coverage_flagged", "intrusion_flagged")}
            seg0 = np.zeros(SR * 2, dtype=np.float32)
            best, cov, _ = loop.run_chunk_qa(
                seg0, 0, "texto de teste", regen, SR, None, "pt",
                start_qa_enabled=False, start_qa_retries=0, start_qa_model="s",
                echo_qa_enabled=True, echo_qa_retries=3, echo_qa_model="t",
                coverage_qa_enabled=True, coverage_qa_retries=3, coverage_qa_min=0.85,
                intrusion_qa_enabled=True, intrusion_qa_retries=3, qa_stats=stats,
                rate_target=target, rate_tolerance=0.10, rate_retries=3, rate_model="t",
            )
        return best, stats

    def test_rapido_regenera_e_fica_com_a_no_ritmo(self):
        best, stats = self._roda(rates=[3.0, 2.05], coverages=[1.0, 1.0])
        self.assertEqual(stats["regens"], 1)
        self.assertEqual(stats["rate_flagged"], 1)
        self.assertEqual(best.size, SR)          # a regenerada (no ritmo)

    def test_palavra_faltando_pesa_mais_que_ritmo(self):
        # 1a: rapida (desvio 50% -> +30) · 2a: no ritmo mas cobertura 0.5 (+135) · 3a: rapida
        best, stats = self._roda(rates=[3.0, 2.0, 3.0], coverages=[1.0, 0.5, 1.0])
        self.assertEqual(best.size, SR * 2)      # ficou com a 1a (rapida, mas completa)


if __name__ == "__main__":
    unittest.main()
