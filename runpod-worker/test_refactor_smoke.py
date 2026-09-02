"""Smoke do refator 20/08: o worker inteiro roda SEM GPU, SEM modelo e SEM rede.

Por que existe: o refator quebrou o handler.py (1.683 linhas) em modulos. Os 38
testes de test_coverage_qa.py cobrem o QA — mas nao cobriam o caminho que gera
o audio de todo aluno. Este arquivo fecha esse buraco ANTES de qualquer deploy:

  1. os modulos novos importam e as pecas continuam se enxergando;
  2. o dispatch entrega cada `type` na funcao certa;
  3. o caminho COMPLETO de inferencia com clone roda ponta a ponta — chunking
     -> laco de QA -> crossfade -> wav — com o VoxCPM stubado;
  4. a decisao nova de 20/08 (buraco espalhado ENTREGA, buraco continuo FALHA)
     continua valendo depois da mudanca de endereco;
  5. a faxina de disco nao derruba job.

    cd runpod-worker && python test_refactor_smoke.py -v
"""
import os
import sys
import tempfile
import types
import unittest
from pathlib import Path
from unittest import mock

import numpy as np

# -- Ambiente de teste ANTES de importar (worker_config le env no import) ----
_TMP = Path(tempfile.mkdtemp(prefix="worker_smoke_"))
os.environ.update({
    "WORKSPACE_DIR": str(_TMP / "jobs"),
    "JOB_TMP_DIR": str(_TMP / "tmp"),
    "TORCHINDUCTOR_CACHE_DIR": str(_TMP / "inductor"),
    "LORA_CACHE_DIR": str(_TMP / "loras"),
    "VOXCPM_MODEL_DIR": str(_TMP / "model"),
    "TTS_REF_TAIL_SILENCE_MS": "0",   # sem ffmpeg no teste
})

SR = 16000


class FakeTTS:
    sample_rate = SR


class FakeVoxCPM:
    """Devolve audio proporcional ao texto — o suficiente pro pipeline andar."""
    tts_model = FakeTTS()
    gerados = []

    @classmethod
    def from_pretrained(cls, *a, **k):
        return cls()

    kwargs = []

    def generate(self, text, **k):
        FakeVoxCPM.gerados.append(text)
        FakeVoxCPM.kwargs.append(k)
        n = max(int(SR * 0.3), int(SR * len(text) / 120))
        # 100ms de silencio em cada ponta: o VoxCPM real deixa "respiracao" no
        # fim de cada chunk e boot-up no comeco, e e' isso que o trim tira. Sem
        # o silencio aqui, o teste do trim nao testaria nada.
        quieto = np.zeros(int(SR * 0.1), dtype=np.float32)
        corpo = np.ones(n, dtype=np.float32) * 0.1
        # Fala de verdade DECAI no fim (a última sílaba perde energia antes do
        # silêncio). Sem essa rampa o QA de fim abrupto (caso Carol 26/08) leria
        # este fake como áudio decepado e mandaria regenerar — o teste passaria
        # a medir o fake, não o pipeline.
        rampa = min(int(SR * 0.4), n)  # 400 ms: decaimento de fala natural
        if rampa > 1:
            corpo[-rampa:] *= np.linspace(1.0, 0.0, rampa, dtype=np.float32)
        return np.concatenate([quieto, corpo, quieto])


def _stub_modulos():
    sf = types.ModuleType("soundfile")

    def _write(target, data, sr, format=None):
        if hasattr(target, "write"):
            target.write(b"RIFF" + b"\0" * 40)
        else:
            Path(target).write_bytes(b"RIFF" + b"\0" * 40)

    sf.write = _write
    sys.modules["soundfile"] = sf

    rp = types.ModuleType("runpod")
    rp.serverless = types.SimpleNamespace(start=lambda *a, **k: None)
    sys.modules["runpod"] = rp

    hf = types.ModuleType("huggingface_hub")
    hf.snapshot_download = lambda *a, **k: None
    sys.modules["huggingface_hub"] = hf

    vox = types.ModuleType("voxcpm")
    vox.VoxCPM = FakeVoxCPM
    sys.modules["voxcpm"] = vox
    vm = types.ModuleType("voxcpm.model.voxcpm")
    vm.LoRAConfig = lambda **k: dict(k)
    sys.modules["voxcpm.model.voxcpm"] = vm

    vp = types.ModuleType("voice_pipeline")

    def _download_to_dir(urls, target_dir):
        target_dir = Path(target_dir)
        target_dir.mkdir(parents=True, exist_ok=True)
        out = []
        for i, _u in enumerate(urls):
            p = target_dir / f"{i:03d}_ref.wav"
            p.write_bytes(b"RIFF" + b"\0" * 40)
            out.append(p)
        return out

    vp.download_to_dir = _download_to_dir
    vp.transcribe_file = lambda *a, **k: "transcricao falsa da referencia."
    vp.upload_file_to_presigned_url = lambda *a, **k: None
    sys.modules["voice_pipeline"] = vp


_stub_modulos()

import audio_ops          # noqa: E402
import handler            # noqa: E402
import jobs.inference     # noqa: E402
import tts_qa             # noqa: E402
import tts_qa.loop        # noqa: E402
import tts_text           # noqa: E402
import worker_config      # noqa: E402
import worker_disk        # noqa: E402


class ImportesTest(unittest.TestCase):
    """As pecas continuam se enxergando depois de mudarem de arquivo."""

    def test_handler_enxerga_tudo_que_usa(self):
        for nome in ("handle_train", "handle_inference", "handle_transcribe",
                     "free_cuda", "faxina", "disk_percent"):
            self.assertTrue(hasattr(handler, nome), f"handler perdeu {nome}")
        import jobs.inference as ji, jobs.inference_setup as js, jobs.train as jt
        import jobs.train_dataset as td, jobs.train_reference as tr
        for mod, nomes in (
            (ji, ("run_chunk_qa", "norm_words", "split_text_for_tts", "trim_silence",
                  "crossfade_concat", "wav_to_base64", "free_cuda", "WORKSPACE",
                  "baixar_lora", "carregar_modelo", "preparar_referencia", "TtsSettings")),
            (js, ("ensure_local_from_url", "ensure_model_downloaded", "free_cuda",
                  "ensure_terminal", "LORA_CACHE_DIR", "MODEL_DIR", "WORKSPACE",
                  "LORA_RANK", "LEGACY_LORA_ALPHA")),
            (jt, ("ensure_model_downloaded", "free_cuda", "VOXCPM_REPO", "MODEL_DIR",
                  "TRAIN_LORA_ALPHA", "LORA_RANK", "WORKSPACE", "TrainDirs",
                  "preparar_dataset", "segundos_uteis", "idioma_do_audio",
                  "escolher_e_subir", "gerar_amostra_com_qa")),
            (td, ("run_ffmpeg_stereo_44k", "minimo_util_exigido")),
            (tr, ("sample_qa_similarity", "transcribe_with_retry", "REFERENCE_SECONDS",
                  "SAMPLE_QA_MIN_SIMILARITY", "SAMPLE_QA_MAX_ATTEMPTS")),
        ):
            for nome in nomes:
                self.assertTrue(hasattr(mod, nome), f"{mod.__name__} perdeu {nome}")

    def test_log_e_o_mesmo_objeto_em_todo_mundo(self):
        # Se cada modulo tivesse o seu, o formato do log divergiria com o tempo.
        import worker_log
        import jobs.inference
        self.assertIs(handler._log, worker_log.log)
        self.assertIs(jobs.inference._log, worker_log.log)
        self.assertIs(tts_qa.loop._log, worker_log.log)
        self.assertIs(worker_disk._log, worker_log.log)


class DispatchTest(unittest.TestCase):
    """Cada `type` cai na funcao certa — e erro nunca sobe como excecao."""

    def test_health(self):
        r = handler.handler({"input": {"type": "health"}})
        self.assertTrue(r["ok"])

    def test_type_desconhecido_nao_explode(self):
        r = handler.handler({"input": {"type": "nao_existe"}})
        self.assertIn("unknown type", r["error"])

    def test_inference_sem_texto(self):
        r = handler.handler({"input": {"type": "inference"}})
        self.assertEqual(r["error"], "missing 'text'")

    def test_transcribe_sem_url(self):
        r = handler.handler({"input": {"type": "transcribe"}})
        self.assertEqual(r["error"], "missing 'audio_url'")

    def test_prompt_text_sem_wav_e_recusado(self):
        r = handler.handler({"input": {"type": "inference", "text": "oi",
                                       "prompt_text": "ref"}})
        self.assertIn("prompt_text provided without", r["error"])

    def test_excecao_vira_erro_e_solta_a_vram(self):
        with mock.patch.object(handler, "handle_inference",
                               side_effect=RuntimeError("boom")), \
             mock.patch.object(handler, "free_cuda") as libera:
            r = handler.handler({"input": {"type": "inference", "text": "oi"}})
        self.assertEqual(r["error"], "boom")
        libera.assert_called_once()   # VRAM nao fica presa apos crash


TEXTO = (
    "Eu sei que existe uma parte de voce que esta cansada de viver no piloto "
    "automatico. Esperando o momento perfeito que nunca chega para comecar. "
    "Hoje o dia e outro e a escolha e sua."
)


def _clone_job(**over):
    job = {"type": "inference", "text": TEXTO,
           "prompt_wav_url": "https://r2.exemplo/ref.wav?sig=x",
           "prompt_text": "esta e a voz de referencia.",
           "language": "pt"}
    job.update(over)
    return job


class InferenciaPontaAPontaTest(unittest.TestCase):
    """O caminho que gera o audio de TODO aluno, com o VoxCPM stubado."""

    def setUp(self):
        FakeVoxCPM.gerados = []
        FakeVoxCPM.kwargs = []

    def test_frase_longa_ALUCINADA_e_resgatada_no_nivel_2(self):
        # #52, caso Ronald (27/08): um chunk de frase UNICA sai alucinado
        # (whisper nao ouve nada dele) em toda tentativa. Ate 26/08: 3
        # tentativas identicas + resgate "frase_unica" -> job cai, aluno
        # tenta 6x. Agora: 2 tentativas -> resgate nivel 2 (parte abaixo da
        # frase, cfg mais alto) -> pedacos curtos passam -> ENTREGA.
        frase = ("Boa tarde a todos e uma honra dividir esse momento com um "
                 "publico que entende na pratica o que e construir um negocio "
                 "do zero com as proprias maos")
        self.assertLess(len(frase), 160)  # cabe num chunk so': frase unica

        def aluc_em_texto_longo(seg, sr, m, lang, label):
            pedido = FakeVoxCPM.gerados[-1]
            return [] if len(pedido) > 80 else tts_qa.norm_words(pedido, lang)

        with mock.patch.object(tts_qa.loop, "transcribe_seg", side_effect=aluc_em_texto_longo), \
             mock.patch.object(tts_qa.loop, "transcribe_seg_autodetect", return_value=([], "pt", 0.0)):
            r = handler.handler({"input": _clone_job(text=frase)})
        self.assertNotIn("error", r, r.get("error"))
        qa = r["qa"]
        self.assertGreaterEqual(qa["coverage_alucinado_saida"], 1, "saiu cedo do laco")
        self.assertEqual(qa["coverage_rescue_nivel2"], 1)
        self.assertEqual(qa["coverage_rescued"], 1)
        # Os pedacos do nivel 2 foram gerados com cfg MAIOR (1.6 + 0.4).
        cfgs = {k.get("cfg_value") for k in FakeVoxCPM.kwargs}
        self.assertIn(2.0, cfgs)
        self.assertIn(1.6, cfgs)
        # E o audio entregue e' feito dos pedacos curtos, nao do chunk alucinado.
        self.assertTrue(all(len(t) <= 80 for t in FakeVoxCPM.gerados[-3:]))

    def test_clone_completo_entrega_audio(self):
        # QA ouve exatamente o texto pedido -> nada regenera, entrega limpa.
        def ouviu(seg, sr, m, lang, label):
            return tts_qa.norm_words(FakeVoxCPM.gerados[-1], lang)

        with mock.patch.object(tts_qa.loop, "transcribe_seg", side_effect=ouviu):
            r = handler.handler({"input": _clone_job()})
        self.assertNotIn("error", r)
        self.assertGreater(len(r["audio_base64"]), 0)
        self.assertEqual(r["sample_rate"], SR)
        self.assertGreater(r["duration_s"], 0)
        self.assertGreater(len(FakeVoxCPM.gerados), 1, "o texto foi quebrado em trechos")
        self.assertEqual(r["qa"]["regens"], 0)
        self.assertGreater(r["qa"]["coverage_checked"], 0, "o QA de completude rodou")

    def _ouviu_tudo(self, seg, sr, m, lang, label):
        return tts_qa.norm_words(FakeVoxCPM.gerados[-1], lang)

    def test_fronteira_interna_e_registrada_por_PEDACO_ENTREGUE(self):
        """#234 (02/09): a metrica de ENTREGA sai do caminho que grava o `qa`.

        O texto vira 2 chunks: o 0 tem fronteira INTERNA (tem veredito) e o 1 e'
        o fim do ARQUIVO (nao e' fronteira interna, entra em `_sem_veredito`).
        A conta fecha em PEDACOS ENTREGUES, nao em tentativas.
        """
        with mock.patch.object(tts_qa.loop, "transcribe_seg",
                               side_effect=self._ouviu_tudo):
            r = handler.handler({"input": _clone_job()})
        self.assertNotIn("error", r)
        qa = r["qa"]
        self.assertEqual(qa["regens"], 0, "nada regenerou: 1 tentativa por chunk")
        self.assertEqual(qa["tail_interno_entregue_n"], 1)
        self.assertEqual(qa["tail_interno_entregue"], 0, "o fake decai: nao e' decepado")
        self.assertEqual(qa["tail_interno_entregue_sem_veredito"], 1, "o ultimo chunk")
        # entregues = com veredito + sem veredito = os 2 chunks
        self.assertEqual(qa["tail_interno_entregue_n"]
                         + qa["tail_interno_entregue_sem_veredito"], 2)

    def test_regen_NAO_infla_a_metrica_de_entrega(self):
        """O defeito que este conserto mata: com regen, o contador por
        TENTATIVA dispara (era ele que ia pro relatorio — 97464f01 tinha
        tail_interno_checked=37 com regens=19) enquanto a ENTREGA continua
        sendo 1 pedaco. Aqui toda tentativa sai decepada, no modo reprovando.
        """
        with mock.patch.dict(os.environ, {"TTS_TAIL_QA_INTERNO_MODO": "reprovando"}), \
             mock.patch.object(tts_qa.loop, "transcribe_seg",
                               side_effect=self._ouviu_tudo), \
             mock.patch.object(tts_qa.loop, "fim_abrupto", return_value=True):
            r = handler.handler({"input": _clone_job()})
        self.assertNotIn("error", r)
        qa = r["qa"]
        self.assertGreater(qa["regens"], 0, "peso 100 regenerou")
        self.assertGreater(qa["tail_interno_checked"], qa["tail_interno_entregue_n"],
                           "o contador por tentativa TEM que ser maior — e' regen")
        # ...e a entrega continua sendo UM pedaco interno, decepado.
        self.assertEqual(qa["tail_interno_entregue_n"], 1)
        self.assertEqual(qa["tail_interno_entregue"], 1)

    def test_buraco_CONTINUO_derruba_o_job_sem_subir_audio(self):
        # Metade final sumindo = o modelo comeu um pedaco (caso Katia 19/08).
        def so_a_metade(seg, sr, m, lang, label):
            w = tts_qa.norm_words(FakeVoxCPM.gerados[-1], lang)
            return w[len(w) // 2:]

        with mock.patch.object(tts_qa.loop, "transcribe_seg", side_effect=so_a_metade):
            r = handler.handler({"input": _clone_job()})
        self.assertIn("qa_coverage", r["error"])
        self.assertNotIn("audio_base64", r)
        self.assertGreater(r["qa"]["regens"], 0, "tentou regenerar antes de desistir")

    def test_buraco_ESPALHADO_entrega_o_audio(self):
        # Palavras soltas faltando = texto que ninguem fala (markdown, emoji,
        # rotulo de locutor). A regua de 20/08 tem que ENTREGAR isto.
        def salpicado(seg, sr, m, lang, label):
            w = tts_qa.norm_words(FakeVoxCPM.gerados[-1], lang)
            return [x for i, x in enumerate(w) if i % 4 != 0]

        with mock.patch.object(tts_qa.loop, "transcribe_seg", side_effect=salpicado):
            r = handler.handler({"input": _clone_job()})
        self.assertNotIn("error", r)
        self.assertGreater(r["qa"].get("coverage_espalhada", 0), 0)

    def test_log_do_chunk_separa_bruto_de_aparado(self):
        # samples_raw e medido ANTES do trim. Se os dois virarem o mesmo numero,
        # perdemos a unica medida de quanto silencio o VoxCPM deixa nas pontas.
        import worker_log
        vistos = []
        real = worker_log.log

        def espiao(level, msg, **meta):
            if msg == "inference.chunk":
                vistos.append(meta)
            return real(level, msg, **meta)

        def ouviu(seg, sr, m, lang, label):
            return tts_qa.norm_words(FakeVoxCPM.gerados[-1], lang)

        with mock.patch.object(jobs.inference, "_log", espiao),              mock.patch.object(tts_qa.loop, "transcribe_seg", side_effect=ouviu):
            handler.handler({"input": _clone_job()})
        self.assertTrue(vistos, "nenhum inference.chunk logado")
        self.assertTrue(any(v["samples_raw"] != v["samples_trim"] for v in vistos),
                        f"raw e trim sairam iguais em todos: {vistos}")

    def test_junta_os_chunks_COM_crossfade(self):
        # Sem crossfade a costura entre chunks vira clique audivel. 60ms no
        # sample rate do modelo = 960 amostras de sobreposicao.
        def ouviu(seg, sr, m, lang, label):
            return tts_qa.norm_words(FakeVoxCPM.gerados[-1], lang)

        real = jobs.inference.crossfade_concat
        espiao = mock.Mock(side_effect=real)
        with mock.patch.object(jobs.inference, "crossfade_concat", espiao),              mock.patch.object(tts_qa.loop, "transcribe_seg", side_effect=ouviu):
            r = handler.handler({"input": _clone_job()})
        self.assertNotIn("error", r)
        espiao.assert_called_once()
        self.assertEqual(espiao.call_args[0][1], int(SR * 60 / 1000))
        pedacos = espiao.call_args[0][0]
        self.assertGreater(len(pedacos), 1)

    def test_solta_a_VRAM_no_fim_da_geracao(self):
        # Worker QUENTE serve treino e geracao no mesmo processo: sem soltar a
        # VRAM, o treino que cair neste worker morre de OOM (visto em prod
        # 21/07: GPU de 95GB com 18MiB livres).
        def ouviu(seg, sr, m, lang, label):
            return tts_qa.norm_words(FakeVoxCPM.gerados[-1], lang)

        with mock.patch.object(jobs.inference, "free_cuda") as solta,              mock.patch.object(tts_qa.loop, "transcribe_seg", side_effect=ouviu):
            r = handler.handler({"input": _clone_job()})
        self.assertNotIn("error", r)
        solta.assert_called()

    def test_solta_a_VRAM_tambem_quando_o_QA_derruba_o_job(self):
        def so_a_metade(seg, sr, m, lang, label):
            w = tts_qa.norm_words(FakeVoxCPM.gerados[-1], lang)
            return w[len(w) // 2:]

        with mock.patch.object(jobs.inference, "free_cuda") as solta,              mock.patch.object(tts_qa.loop, "transcribe_seg", side_effect=so_a_metade):
            r = handler.handler({"input": _clone_job()})
        self.assertIn("qa_coverage", r["error"])
        solta.assert_called()

    def test_sem_clone_nao_chama_whisper(self):
        # Voz pronta (sem referencia) nao paga QA — mesma regra de antes.
        with mock.patch.object(tts_qa.loop, "transcribe_seg") as t:
            r = handler.handler({"input": {"type": "inference", "text": TEXTO}})
        self.assertNotIn("error", r)
        t.assert_not_called()


class PecasPurasTest(unittest.TestCase):
    """As funcoes que mudaram de arquivo continuam fazendo o mesmo."""

    def test_split_respeita_o_limite_e_fecha_com_pontuacao(self):
        chunks = tts_text.split_text_for_tts(TEXTO, max_chars=80)
        self.assertGreater(len(chunks), 1)
        for c, _fim in chunks:
            self.assertIn(c[-1], ".!?…")

    def test_crossfade_nao_perde_nem_estoura_amostra(self):
        a = np.ones(1000, dtype=np.float32)
        b = np.ones(1000, dtype=np.float32)
        junto = audio_ops.crossfade_concat([a, b], 100)
        self.assertEqual(junto.size, 1900)
        self.assertLessEqual(float(np.abs(junto).max()), 1.0 + 1e-6)

    def test_trim_tira_silencio_das_bordas(self):
        w = np.concatenate([np.zeros(500), np.ones(500) * 0.5, np.zeros(500)]).astype(np.float32)
        self.assertEqual(audio_ops.trim_silence(w).size, 500)

    def test_faxina_roda_e_nunca_derruba_o_job(self):
        lixo = worker_config.JOB_TMP / "sujeira.bin"
        lixo.parent.mkdir(parents=True, exist_ok=True)
        lixo.write_bytes(b"x" * 1024)
        worker_disk.faxina("teste")
        self.assertFalse(lixo.exists())
        with mock.patch.object(worker_disk, "purge_dir", side_effect=OSError("disco")):
            worker_disk.faxina("teste")   # nao pode levantar


if __name__ == "__main__":
    unittest.main(verbosity=2)
