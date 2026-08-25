"""Testes do corte de referência em FRONTEIRA DE PALAVRA (caso Katia 2026-08).

O defeito: `_slice_window` cortava a referência em tempo ARBITRÁRIO (offset por
espaçamento), decapitando palavras nas DUAS pontas — ~1 em 3 vozes novas nascia
com farelo de palavra na borda e o VoxCPM ecoava esse farelo nas gerações. A
cura manual provada (recortar em palavra completa) zerou as intrusões.

Estes testes provam que agora:
  1. os limites escolhidos caem em fronteira de palavra (via word_timestamps),
     inclusive nos casos de borda: palavra atravessando o início, palavra
     atravessando o fim, nenhuma palavra inteira dentro da janela;
  2. lista de words vazia / whisper falhando → FALLBACK pro corte por tempo de
     hoje (a melhoria nunca quebra o treino);
  3. clipe ajustado curto demais → candidata DESCARTADA (segue pro ranking);
     e se TODAS descartam, o laço refaz com o corte por TEMPO da main — a
     função nunca devolve lista vazia por causa do snap;
  4. o transcript devolvido é EXATAMENTE as palavras do clipe;
  5. sem `transcribe_words_fn` o comportamento antigo segue intacto (compat).

Roda SEM GPU e sem pesos — as words são injetadas (SimpleNamespace/dict), o
whisper não roda de verdade e o ffmpeg é mockado:

    cd runpod-worker && python3 test_reference_word_snap.py -v
"""
import sys
import tempfile
import types
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest import mock

# ── Stub do soundfile ANTES de importar o módulo (não precisa do binário) ──
if "soundfile" not in sys.modules:
    sys.modules["soundfile"] = types.ModuleType("soundfile")

# Importa reference.py DIRETO do arquivo (sem passar pelo __init__ do pacote,
# que puxa requests/preprocess — dependências que este teste não precisa).
import importlib.util  # noqa: E402

_spec = importlib.util.spec_from_file_location(
    "vp_reference", Path(__file__).resolve().parent / "voice_pipeline" / "reference.py"
)
reference = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(reference)


def W(start, end, word):
    """Palavra fake no formato do faster_whisper (atributos .start/.end/.word)."""
    return SimpleNamespace(start=start, end=end, word=word)


PAD = reference._EDGE_PAD_SECONDS


class TestSnapFraseInteira(unittest.TestCase):
    """28/08: a referencia entra e sai em FRASE, nao em palavra. 5 de 8 vozes
    reclamadas tinham referencia comecando no meio de uma frase."""

    def _janela(self):
        # "...luxo de dormir. Eu sei que existe uma parte. Ela cansou de tudo. e ai"
        return [
            W(0.0, 0.4, "luxo"), W(0.4, 0.7, "de"), W(0.7, 1.2, "dormir."),
            W(1.4, 1.6, "Eu"), W(1.6, 1.9, "sei"), W(1.9, 2.1, "que"), W(2.1, 2.5, "existe"),
            W(2.5, 2.8, "uma"), W(2.8, 3.3, "parte."), W(3.5, 3.8, "Ela"), W(3.8, 4.3, "cansou"),
            W(4.3, 4.5, "de"), W(4.5, 5.0, "tudo."), W(5.2, 5.3, "e"), W(5.3, 5.6, "ai"),
        ]

    def test_recorta_em_inicio_e_fim_de_frase(self):
        r = reference._snap_bounds_to_words(self._janela(), 0.0, 5.6, pad=0.0)
        self.assertIsNotNone(r)
        start, end, transcript = r
        self.assertEqual(transcript, "Eu sei que existe uma parte. Ela cansou de tudo.")
        self.assertAlmostEqual(start, 1.4)
        self.assertAlmostEqual(end, 5.0)

    def test_janela_que_ja_comeca_em_maiuscula_mantem_o_inicio(self):
        ws = self._janela()[3:]  # comeca em "Eu"
        _s, _e, transcript = reference._snap_bounds_to_words(ws, 1.4, 5.6, pad=0.0)
        self.assertTrue(transcript.startswith("Eu sei"))
        self.assertTrue(transcript.endswith("tudo."))

    def test_sem_fronteira_de_frase_cai_no_corte_por_palavra(self):
        ws = [W(0.0, 0.5, "uma"), W(0.5, 1.0, "frase"), W(1.0, 1.5, "sem"), W(1.5, 2.0, "ponto")]
        _s, _e, transcript = reference._snap_bounds_to_words(ws, 0.0, 2.0, pad=0.0)
        self.assertEqual(transcript, "uma frase sem ponto")

    def test_frase_curta_demais_nao_vale_a_pena_e_fica_por_palavra(self):
        # so 1s de frase inteira dentro de 30s de janela: perderia o timbre
        ws = [W(0.0, 0.5, "bla")] * 0 + [
            W(0.0, 10.0, "muitas"), W(10.0, 20.0, "palavras"), W(20.0, 28.0, "compridas."),
            W(28.2, 28.6, "Oi."), W(28.8, 30.0, "tchau"),
        ]
        _s, _e, transcript = reference._snap_bounds_to_words(ws, 0.0, 30.0, pad=0.0)
        self.assertEqual(transcript, "muitas palavras compridas. Oi. tchau")

    def test_fecha_frase_reconhece_pontuacao_com_aspas(self):
        self.assertTrue(reference._fecha_frase(W(0, 1, 'dormir."')))
        self.assertTrue(reference._fecha_frase(W(0, 1, "vai?")))
        self.assertTrue(reference._fecha_frase(W(0, 1, "fim…")))
        self.assertFalse(reference._fecha_frase(W(0, 1, "meio,")))


class TestSnapBoundsToWords(unittest.TestCase):
    """_snap_bounds_to_words puro: injeta words, confere os limites."""

    def test_limites_caem_em_fronteira_de_palavra(self):
        words = [W(1.0, 1.4, " Olá,"), W(1.5, 2.0, " tudo"), W(2.1, 2.6, " bem.")]
        got = reference._snap_bounds_to_words(words, 0.5, 3.0)
        self.assertIsNotNone(got)
        start, end, transcript = got
        self.assertAlmostEqual(start, 1.0 - PAD)
        self.assertAlmostEqual(end, 2.6 + PAD)
        self.assertEqual(transcript, "Olá, tudo bem.")

    def test_palavra_atravessando_o_inicio_fica_de_fora(self):
        # "meio" começa ANTES da região → excluída; 1º limite = início de "tudo".
        words = [W(0.8, 1.2, " meio"), W(1.5, 2.0, " tudo"), W(2.1, 2.6, " bem.")]
        got = reference._snap_bounds_to_words(words, 1.0, 3.0)
        start, end, transcript = got
        self.assertAlmostEqual(start, 1.5 - PAD)
        self.assertEqual(transcript, "tudo bem.")

    def test_palavra_atravessando_o_fim_fica_de_fora(self):
        # "cortada" termina DEPOIS da região → excluída; limite = fim de "tudo".
        words = [W(1.0, 1.4, " Olá,"), W(1.5, 2.0, " tudo"), W(2.8, 3.4, " cortada")]
        got = reference._snap_bounds_to_words(words, 0.5, 3.0)
        start, end, transcript = got
        self.assertAlmostEqual(end, 2.0 + PAD)
        self.assertEqual(transcript, "Olá, tudo")

    def test_nenhuma_palavra_inteira_dentro_da_janela(self):
        # Uma única palavra atravessando a janela inteira → None.
        words = [W(0.5, 3.5, " palavrão")]
        self.assertIsNone(reference._snap_bounds_to_words(words, 1.0, 3.0))

    def test_lista_vazia_e_none(self):
        self.assertIsNone(reference._snap_bounds_to_words([], 0.0, 30.0))
        self.assertIsNone(reference._snap_bounds_to_words(None, 0.0, 30.0))

    def test_start_nunca_fica_negativo(self):
        words = [W(0.0, 0.5, " Oi,"), W(0.6, 1.0, " gente.")]
        start, _end, _t = reference._snap_bounds_to_words(words, 0.0, 2.0)
        self.assertGreaterEqual(start, 0.0)

    def test_aceita_dicts_e_ordena_words_fora_de_ordem(self):
        words = [
            {"start": 2.1, "end": 2.6, "word": " bem."},
            {"start": 1.0, "end": 1.4, "word": " Olá,"},
            {"start": 1.5, "end": 2.0, "word": " tudo"},
        ]
        start, end, transcript = reference._snap_bounds_to_words(words, 0.5, 3.0)
        self.assertAlmostEqual(start, 1.0 - PAD)
        self.assertAlmostEqual(end, 2.6 + PAD)
        self.assertEqual(transcript, "Olá, tudo bem.")

    def test_word_sem_timestamp_e_ignorada(self):
        words = [W(None, None, " quebrada"), W(1.0, 1.5, " boa.")]
        start, end, transcript = reference._snap_bounds_to_words(words, 0.5, 2.0)
        self.assertEqual(transcript, "boa.")


def _fake_slice(calls):
    """Mock de _slice_window que registra as chamadas e 'cria' o dst."""
    def fake(src, dst, offset, seconds):
        calls.append((Path(src).name, Path(dst).name, round(offset, 3), round(seconds, 3)))
        Path(dst).parent.mkdir(parents=True, exist_ok=True)
        Path(dst).write_bytes(b"RIFFfake")
        return True
    return fake


class TestCutSnappedCandidate(unittest.TestCase):
    """_cut_snapped_candidate: recorte + status ok/discard/unavailable."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name)
        self.primary = self.dir / "primary.wav"
        self.primary.write_bytes(b"RIFFfake")
        self.clip = self.dir / "cand_0.wav"
        self.logs = []
        self.log = lambda **k: self.logs.append(k)

    def tearDown(self):
        self.tmp.cleanup()

    def test_recorte_ok_em_fronteira_de_palavra(self):
        # Região desejada: [10, 40] (30s). Janela folgada: [8.5, 41.5].
        # Words RELATIVAS à janela folgada: 1ª inteira começa em 1.6 (=10.1 abs),
        # última inteira termina em 31.2 (=39.7 abs).
        words = (
            [W(0.9, 1.55, " farelo")]                       # atravessa o início
            + [W(1.6 + i, 2.2 + i, f" p{i}") for i in range(0, 30)]
            + [W(31.45, 32.2, " decapitada")]               # atravessa o fim
        )
        calls = []
        with mock.patch.object(reference, "_slice_window", _fake_slice(calls)):
            status, transcript, _wps = reference._cut_snapped_candidate(
                self.primary, self.clip, 10.0, 30, 120.0,
                lambda p: words, self.log,
            )
        self.assertEqual(status, reference._SNAP_OK)
        self.assertNotIn("farelo", transcript)
        self.assertNotIn("decapitada", transcript)
        self.assertEqual(transcript.split()[0], "p0")
        self.assertEqual(transcript.split()[-1], "p29")
        # 1ª chamada: janela folgada [8.5, 41.5] a partir do primary.
        self.assertEqual(calls[0][2:], (8.5, 33.0))
        # 2ª chamada: re-corte NA PADDED em fronteira de palavra ± pad.
        _, _, cut_off, cut_len = calls[1]
        self.assertAlmostEqual(cut_off, 1.6 - PAD, places=3)
        self.assertAlmostEqual(cut_off + cut_len, 31.2 + PAD, places=3)  # p29 termina em 2.2+29

    def test_whisper_sem_words_vira_fallback(self):
        calls = []
        with mock.patch.object(reference, "_slice_window", _fake_slice(calls)):
            status, transcript, _wps = reference._cut_snapped_candidate(
                self.primary, self.clip, 10.0, 30, 120.0,
                lambda p: [], self.log,
            )
        self.assertEqual(status, reference._SNAP_UNAVAILABLE)
        self.assertIsNone(transcript)

    def test_whisper_levantando_excecao_vira_fallback(self):
        def boom(p):
            raise RuntimeError("cuda out of memory")
        calls = []
        with mock.patch.object(reference, "_slice_window", _fake_slice(calls)):
            status, _, _wps = reference._cut_snapped_candidate(
                self.primary, self.clip, 10.0, 30, 120.0, boom, self.log,
            )
        self.assertEqual(status, reference._SNAP_UNAVAILABLE)
        self.assertTrue(any(l.get("event") == "reference.snap.words_error" for l in self.logs))

    def test_clipe_curto_demais_descarta_candidata(self):
        # Só 2 palavras inteiras (~1.1s) numa região de 30s → < 60% → discard.
        words = [W(1.6, 2.0, " oi"), W(2.1, 2.7, " gente.")]
        calls = []
        with mock.patch.object(reference, "_slice_window", _fake_slice(calls)):
            status, _, _wps = reference._cut_snapped_candidate(
                self.primary, self.clip, 10.0, 30, 120.0,
                lambda p: words, self.log,
            )
        self.assertEqual(status, reference._SNAP_DISCARD)

    def test_nenhuma_palavra_inteira_descarta_candidata(self):
        words = [W(0.0, 40.0, " zumbido")]  # atravessa a região inteira
        calls = []
        with mock.patch.object(reference, "_slice_window", _fake_slice(calls)):
            status, _, _wps = reference._cut_snapped_candidate(
                self.primary, self.clip, 10.0, 30, 120.0,
                lambda p: words, self.log,
            )
        self.assertEqual(status, reference._SNAP_DISCARD)

    def test_padded_temporario_e_removido(self):
        words = [W(1.6 + i, 2.2 + i, f" p{i}") for i in range(0, 30)]
        calls = []
        with mock.patch.object(reference, "_slice_window", _fake_slice(calls)):
            reference._cut_snapped_candidate(
                self.primary, self.clip, 10.0, 30, 120.0,
                lambda p: words, self.log,
            )
        self.assertFalse(list(self.dir.glob("*_padded.wav")))


class TestSelectReferenceCandidatesIntegration(unittest.TestCase):
    """O laço de candidatas usando (ou não) o corte por palavra."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name)
        self.norm = self.dir / "norm_mono16k.wav"
        self.norm.write_bytes(b"RIFFfake")
        self.work = self.dir / "work"

    def tearDown(self):
        self.tmp.cleanup()

    def _run(self, transcribe_words_fn=None, transcribe_fn=None):
        calls = []
        with mock.patch.object(reference, "_slice_window", _fake_slice(calls)), \
             mock.patch.object(reference, "_audio_duration_seconds", lambda p: 120.0):
            ranked = reference.select_reference_candidates(
                [self.norm], self.work, 30,
                transcribe_fn or (lambda p: "fallback por tempo."),
                language="pt", max_candidates=2,
                transcribe_words_fn=transcribe_words_fn,
            )
        return ranked, calls

    def test_snap_ok_usa_transcript_das_words_sem_2a_passada(self):
        words = [W(1.6 + i, 2.2 + i, f" p{i}") for i in range(0, 30)] + [W(31.3, 31.9, " Fim.")]
        fallback_called = []

        def never(p):
            fallback_called.append(p)
            return "NUNCA"

        ranked, _ = self._run(transcribe_words_fn=lambda p: words, transcribe_fn=never)
        self.assertTrue(ranked)
        self.assertEqual(fallback_called, [])  # transcribe_fn não rodou
        for _clip, transcript in ranked:
            self.assertTrue(transcript.startswith("p0"))

    def test_words_indisponiveis_cai_no_corte_por_tempo(self):
        ranked, calls = self._run(transcribe_words_fn=lambda p: None)
        self.assertTrue(ranked)
        self.assertEqual(ranked[0][1], "fallback por tempo.")

    def test_todas_descartadas_cai_no_corte_por_tempo(self):
        # Nenhuma palavra inteira em candidata NENHUMA → todas _SNAP_DISCARD.
        # A função NÃO pode devolver []: refaz o laço com o corte por TEMPO
        # da main (mesmas offsets), não o ref_fallback de 0s.
        words = [W(0.0, 40.0, " zumbido")]
        ranked, _ = self._run(transcribe_words_fn=lambda p: words)
        self.assertTrue(ranked)          # nunca lista vazia
        self.assertEqual(len(ranked), 2)  # as 2 candidatas por tempo
        for clip, transcript in ranked:
            self.assertEqual(transcript, "fallback por tempo.")
            self.assertIn("_time", clip.name)
            self.assertNotIn("ref_fallback", clip.name)

    def test_todas_descartadas_transcreve_de_verdade_no_retry(self):
        # No retry por tempo o transcript vem do transcribe_fn REAL (2ª
        # passada), nunca das words que falharam no snap.
        words = [W(0.0, 40.0, " zumbido")]
        seen = []

        def real_transcribe(p):
            seen.append(Path(p).name)
            return "texto do corte por tempo."

        ranked, calls = self._run(
            transcribe_words_fn=lambda p: words, transcribe_fn=real_transcribe,
        )
        self.assertTrue(ranked)
        self.assertEqual(ranked[0][1], "texto do corte por tempo.")
        self.assertEqual(len(seen), 2)  # transcreveu as 2 candidatas do retry
        # e o retry cortou nas MESMAS offsets espaçadas, não em 0s:
        time_cuts = [c for c in calls if "_time" in c[1]]
        self.assertEqual(len(time_cuts), 2)
        self.assertTrue(all(seconds == 30 for *_x, seconds in time_cuts))

    def test_sem_transcribe_words_fn_comportamento_antigo(self):
        ranked, calls = self._run(transcribe_words_fn=None)
        self.assertTrue(ranked)
        self.assertEqual(ranked[0][1], "fallback por tempo.")
        # nenhum corte de janela folgada (_padded) aconteceu
        self.assertFalse(any("_padded" in c[1] for c in calls))

    def test_select_reference_clip_assinatura_intacta(self):
        # compat: o wrapper segue funcionando SEM o novo parâmetro.
        calls = []
        with mock.patch.object(reference, "_slice_window", _fake_slice(calls)), \
             mock.patch.object(reference, "_audio_duration_seconds", lambda p: 120.0):
            got = reference.select_reference_clip(
                [self.norm], self.work, 30, lambda p: "texto antigo.",
            )
        self.assertIsNotNone(got)
        self.assertEqual(got[1], "texto antigo.")


if __name__ == "__main__":
    unittest.main(verbosity=2)
