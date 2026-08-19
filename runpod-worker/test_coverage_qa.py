"""Testes do QA de COMPLETUDE por chunk (caso Katia 19/08, incidente ce6e157d).

O defeito: uma geração de 557 caracteres saiu com ~30% do texto FALTANDO no
áudio e mesmo assim foi entregue como [ready] e cobrada. O QA de 1a palavra só
rodava no chunk 0 (`idx == 0`) e o echo QA só procura texto SOBRANDO (eco da
ref), nunca FALTANDO — chunk que começava no meio, ou saía mudo, passava limpo.

Estes testes provam que agora:
  1. chunk cujo áudio começa no meio do texto REPROVA e REGENERA;
  2. chunk praticamente mudo reprova (transcrição vazia = cobertura 0.0);
  3. esgotadas as tentativas com cobertura baixa, a cobertura ruim é devolvida
     ao chamador (que falha o job explícito em vez de entregar [ready]);
  4. o QA de 1a palavra roda em TODOS os chunks (o `idx == 0` caiu);
  5. echo QA e coverage QA dividem UMA transcrição por tentativa (custo não
     multiplica);
  6. whisper FALHANDO (None) segue inconclusivo e não bloqueia (rede de
     segurança, não gate).

Roda SEM GPU e sem pesos — os módulos pesados são stubados e o whisper é
simulado. Só precisa de numpy:

    cd runpod-worker && python3 test_coverage_qa.py -v
"""
import sys
import types
import unittest
from unittest import mock

# ── Stubs dos módulos pesados ANTES de importar o handler ──────────────────
for _name in ("runpod", "soundfile", "huggingface_hub"):
    if _name not in sys.modules:
        sys.modules[_name] = types.ModuleType(_name)
sys.modules["runpod"].serverless = types.SimpleNamespace(start=lambda *a, **k: None)
sys.modules["soundfile"].write = lambda *a, **k: None
sys.modules["huggingface_hub"].snapshot_download = lambda *a, **k: None

import numpy as np  # noqa: E402

import handler  # noqa: E402

SR = 16000
# Texto no padrão do caso Katia (sintético — mesmo formato/tamanho de chunk).
CHUNK = (
    "Eu sei que existe uma parte de voce que esta cansada de viver no piloto "
    "automatico, esperando o momento perfeito que nunca chega para comecar."
)
CHUNK_WORDS = handler._qa_norm_words(CHUNK)
# Áudio que começa NO MEIO do chunk (padrão do chunk 1 da Katia: faltavam os
# 96 primeiros caracteres) — transcrição só contém a metade final, na ordem.
HALF_WORDS = CHUNK_WORDS[len(CHUNK_WORDS) // 2:]


def make_seg(seconds: float = 1.0) -> np.ndarray:
    return np.ones(int(SR * seconds), dtype=np.float32) * 0.1


def qa_kwargs(**over):
    """Config padrão do laço de QA (só coverage ligado; testes ligam o resto)."""
    base = dict(
        sample_rate=SR,
        prompt_text=None,
        qa_language="pt",
        start_qa_enabled=False,
        start_qa_retries=2,
        start_qa_model="small",
        echo_qa_enabled=False,
        echo_qa_retries=3,
        echo_qa_model="large-v3-turbo",
        coverage_qa_enabled=True,
        coverage_qa_retries=3,
        coverage_qa_min=0.85,
    )
    base.update(over)
    return base


def fresh_stats() -> dict:
    return {
        "echo_checked": 0, "echo_flagged": 0, "echo_none": 0,
        "coverage_checked": 0, "coverage_flagged": 0, "coverage_none": 0,
        "coverage_exhausted": 0,
        "regens": 0, "exhausted": 0,
    }


class ChunkCoverageTest(unittest.TestCase):
    """_chunk_coverage: a régua que mede se o áudio contém o texto do chunk."""

    def test_transcricao_completa_da_cobertura_total(self):
        self.assertEqual(handler._chunk_coverage(CHUNK_WORDS, CHUNK), 1.0)

    def test_audio_que_comeca_no_meio_reprova(self):
        cov = handler._chunk_coverage(HALF_WORDS, CHUNK)
        self.assertIsNotNone(cov)
        self.assertLess(cov, 0.85)

    def test_chunk_mudo_e_cobertura_zero(self):
        # Padrão do chunk 3 da Katia: chunk INTEIRO ausente do áudio.
        self.assertEqual(handler._chunk_coverage([], CHUNK), 0.0)

    def test_whisper_falhou_e_inconclusivo(self):
        # None = whisper quebrou — QA é rede de segurança, não bloqueia.
        self.assertIsNone(handler._chunk_coverage(None, CHUNK))

    def test_chunk_sem_palavras_e_inconclusivo(self):
        self.assertIsNone(handler._chunk_coverage(CHUNK_WORDS, "..."))


class RunChunkQATest(unittest.TestCase):
    """_run_chunk_qa: o laço reprovar → regenerar → (falhar explícito)."""

    def test_chunk_incompleto_reprova_regenera_e_passa(self):
        # 1a tentativa: áudio começa no meio (cobertura baixa) → regenera.
        # 2a tentativa: áudio completo → passa.
        transcripts = iter([HALF_WORDS, CHUNK_WORDS])
        stats = fresh_stats()
        seg_ruim, seg_bom = make_seg(), make_seg(2.0)
        with mock.patch.object(
            handler, "_qa_transcribe_seg", side_effect=lambda *a, **k: next(transcripts)
        ):
            best, cov = handler._run_chunk_qa(
                seg_ruim, 1, CHUNK, regen_fn=lambda: seg_bom,
                qa_stats=stats, **qa_kwargs(),
            )
        self.assertEqual(stats["regens"], 1)            # regenerou 1x
        self.assertEqual(stats["coverage_flagged"], 1)  # a 1a reprovou
        self.assertEqual(cov, 1.0)                      # a 2a cobre tudo
        self.assertIs(best, seg_bom)                    # e é a entregue
        self.assertEqual(stats["exhausted"], 0)

    def test_chunk_mudo_esgota_e_devolve_cobertura_baixa(self):
        # Áudio praticamente mudo em TODAS as tentativas (chunk 3 da Katia):
        # o laço esgota e devolve cobertura 0.0 — o chamador falha o job.
        seg_mudo = np.zeros(100, dtype=np.float32)  # < 0.2s → nem transcreve
        stats = fresh_stats()
        transcriber = mock.Mock()
        with mock.patch.object(handler, "_qa_transcribe_seg", transcriber):
            _best, cov = handler._run_chunk_qa(
                seg_mudo, 3, CHUNK, regen_fn=lambda: seg_mudo,
                qa_stats=stats, **qa_kwargs(),
            )
        transcriber.assert_not_called()  # mudo = "não ouvi nada", sem whisper
        self.assertEqual(cov, 0.0)
        self.assertEqual(stats["exhausted"], 1)
        self.assertEqual(stats["regens"], 2)  # tentou as 3 (2 regens)
        # O gate do chamador (_handle_inference) com esta cobertura FALHA o job:
        self.assertTrue(cov is not None and cov < 0.85)

    def test_sempre_incompleto_devolve_a_mais_completa(self):
        # Nenhuma tentativa passa: devolve a MELHOR (mais completa), e a
        # cobertura dela continua abaixo do mínimo → chamador falha o job.
        seqs = [HALF_WORDS, CHUNK_WORDS[:3], HALF_WORDS]
        it = iter(seqs)
        stats = fresh_stats()
        with mock.patch.object(
            handler, "_qa_transcribe_seg", side_effect=lambda *a, **k: next(it)
        ):
            _best, cov = handler._run_chunk_qa(
                make_seg(), 2, CHUNK, regen_fn=make_seg,
                qa_stats=stats, **qa_kwargs(),
            )
        self.assertIsNotNone(cov)
        self.assertLess(cov, 0.85)
        self.assertEqual(cov, handler._chunk_coverage(HALF_WORDS, CHUNK))
        self.assertEqual(stats["exhausted"], 1)

    def test_start_qa_roda_em_chunk_que_nao_e_o_primeiro(self):
        # O `idx == 0` caiu: a 1a palavra é conferida em TODOS os chunks.
        start_ok = mock.Mock(return_value=True)
        with mock.patch.object(handler, "_start_word_ok", start_ok), \
             mock.patch.object(handler, "_qa_transcribe_seg", return_value=CHUNK_WORDS):
            handler._run_chunk_qa(
                make_seg(), 2, CHUNK, regen_fn=make_seg,
                qa_stats=fresh_stats(), **qa_kwargs(start_qa_enabled=True),
            )
        start_ok.assert_called_once()

    def test_echo_e_coverage_dividem_uma_transcricao_por_tentativa(self):
        # Custo: echo QA + coverage QA = UMA chamada de whisper, não duas.
        prompt = "a raposa marrom pulou sobre o cachorro preguicoso dormindo"
        transcriber = mock.Mock(return_value=CHUNK_WORDS)
        stats = fresh_stats()
        with mock.patch.object(handler, "_qa_transcribe_seg", transcriber):
            handler._run_chunk_qa(
                make_seg(), 0, CHUNK, regen_fn=make_seg,
                qa_stats=stats,
                **qa_kwargs(echo_qa_enabled=True, prompt_text=prompt),
            )
        self.assertEqual(transcriber.call_count, 1)  # 1 tentativa = 1 whisper
        self.assertEqual(stats["echo_checked"], 1)
        self.assertEqual(stats["coverage_checked"], 1)

    def test_whisper_quebrado_nao_bloqueia(self):
        # Transcrição None (whisper FALHOU) = inconclusivo → entrega sem regen.
        stats = fresh_stats()
        with mock.patch.object(handler, "_qa_transcribe_seg", return_value=None):
            _best, cov = handler._run_chunk_qa(
                make_seg(), 1, CHUNK, regen_fn=make_seg,
                qa_stats=stats, **qa_kwargs(),
            )
        self.assertIsNone(cov)
        self.assertEqual(stats["regens"], 0)
        self.assertEqual(stats["coverage_none"], 1)
        # Gate do chamador NÃO dispara com None (não falha job às cegas):
        self.assertFalse(cov is not None and cov < 0.85)


class SplitParityTest(unittest.TestCase):
    """Sanidade: o texto padrão quebra em chunks e todos passam pela régua."""

    def test_todo_chunk_do_split_tem_palavras_mensuraveis(self):
        text = " ".join([CHUNK] * 4)
        chunks = handler._split_text_for_tts(text, max_chars=160)
        self.assertGreater(len(chunks), 1)
        for c, _ends in chunks:
            words = handler._qa_norm_words(c)
            self.assertTrue(words)
            self.assertEqual(handler._chunk_coverage(words, c), 1.0)


if __name__ == "__main__":
    unittest.main(verbosity=2)
