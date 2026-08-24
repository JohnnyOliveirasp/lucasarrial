"""#108 — a referencia comeca e termina em FRONTEIRA DE FRASE (24/08).

Caso-prova: Kessuly. O corte por palavra (PR #16) acertava o fim ("...Assim,
antes de" virou frase fechada) mas errava o COMECO: a ref nova comecava em
"americano. Na 18a peca...". O VoxCPM continua o TEXTO da referencia; ref que
comeca ou termina no meio de frase faz cada chunk nascer atropelado/com eco.

Prova, sem GPU e sem whisper:
  1. com min_sentence_seconds, o recorte cai na 1a palavra DEPOIS de um ponto
     e na ultima palavra COM ponto;
  2. a 1a palavra do audio conta como inicio de frase;
  3. se a frase inteira nao cabe, cede primeiro o inicio (end_only), depois o
     fim (start_only), e por ultimo fica no corte por palavra — NUNCA None;
  4. sem min_sentence_seconds o comportamento antigo e' identico;
  5. o score pune comeco em minuscula tanto quanto fim sem pontuacao.

    cd runpod-worker && python test_reference_sentence_snap.py -v
"""
import sys
import types
import unittest

if "soundfile" not in sys.modules:
    sys.modules["soundfile"] = types.ModuleType("soundfile")

from voice_pipeline import reference  # noqa: E402


def W(text, start, end):
    return {"word": text, "start": start, "end": end}


WORDS = [
    W("da", 0.0, 0.3), W("anterior.", 0.3, 0.9),
    W("Uma", 1.0, 1.3), W("frase", 1.3, 1.7), W("inteira", 1.7, 2.2), W("aqui.", 2.2, 2.8),
    W("Outra", 3.0, 3.3), W("frase", 3.3, 3.7), W("inteira.", 3.7, 4.4),
    W("e", 4.6, 4.7), W("um", 4.7, 4.9), W("comeco", 4.9, 5.4),
]


class TrimToSentenceTest(unittest.TestCase):
    def test_comeca_depois_do_ponto_e_termina_no_ponto(self):
        start, end, transcript = reference._snap_bounds_to_words(
            WORDS, 0.2, 5.5, pad=0.0, min_sentence_seconds=1.0,
        )
        self.assertEqual(transcript, "Uma frase inteira aqui. Outra frase inteira.")
        self.assertAlmostEqual(start, 1.0)
        self.assertAlmostEqual(end, 4.4)

    def test_primeira_palavra_do_audio_conta_como_inicio_de_frase(self):
        words = [W("Oi", 0.0, 0.2), W("gente.", 0.2, 0.6), W("e", 0.7, 0.8)]
        _s, _e, transcript = reference._snap_bounds_to_words(
            words, 0.0, 1.0, pad=0.0, min_sentence_seconds=0.3,
        )
        self.assertEqual(transcript, "Oi gente.")

    def test_frase_inteira_nao_cabe_cede_o_inicio_primeiro(self):
        _s, _e, transcript = reference._snap_bounds_to_words(
            WORDS, 0.0, 1.8, pad=0.0, min_sentence_seconds=0.5,
        )
        self.assertEqual(transcript, "da anterior.")

    def test_sem_ponto_nenhum_cede_o_fim(self):
        words = [W("fim.", 0.0, 0.3), W("Comeco", 0.4, 0.8), W("sem", 0.8, 1.0), W("ponto", 1.0, 1.5)]
        _s, _e, transcript = reference._snap_bounds_to_words(
            words, 0.35, 1.6, pad=0.0, min_sentence_seconds=0.5,
        )
        self.assertEqual(transcript, "Comeco sem ponto")

    def test_curto_demais_fica_no_corte_por_palavra_nunca_none(self):
        got = reference._snap_bounds_to_words(
            WORDS, 0.2, 5.5, pad=0.0, min_sentence_seconds=60.0,
        )
        self.assertIsNotNone(got)
        self.assertEqual(got[2], " ".join(w["word"] for w in WORDS[1:]))  # "da" (0.0s) fica fora da janela 0.2s

    def test_sem_min_sentence_comportamento_antigo(self):
        got = reference._snap_bounds_to_words(WORDS, 0.2, 5.5, pad=0.0)
        self.assertEqual(got[2], " ".join(w["word"] for w in WORDS[1:]))  # "da" (0.0s) fica fora da janela 0.2s

    def test_modo_reportado(self):
        ordered = list(WORDS)
        _w, modo = reference._trim_to_sentence(ordered, ordered, 1.0)
        self.assertEqual(modo, "sentence")
        _w, modo = reference._trim_to_sentence(ordered[2:4], ordered, 0.1)
        self.assertEqual(modo, "start_only")


class ScoreTest(unittest.TestCase):
    def test_comeco_em_minuscula_pesa_como_fim_sem_ponto(self):
        base = "Uma frase inteira e boa de ouvir."
        meio = "americano. Na peca seguinte a gente fala."
        sem_fim = "Uma frase inteira e boa de ouvir"
        self.assertAlmostEqual(
            reference.score_reference_transcript(meio) - reference.score_reference_transcript(base),
            reference.score_reference_transcript(sem_fim) - reference.score_reference_transcript(base),
            places=1,
        )


if __name__ == "__main__":
    unittest.main()
