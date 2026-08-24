"""Smoke do job de TREINO — sem GPU, sem Demucs, sem Whisper, sem rede.

Por que existe: o treino nunca teve teste nenhum. Ele e' o codigo que produz a
voz do aluno e custa 10k creditos por rodada — quando ele erra, alguem fica dias
travado. Este arquivo prende por escrito as REGRAS DE NEGOCIO que ja custaram
incidente, pra elas nao se perderem num refator:

  * arquivo SEM faixa de audio (foto na pasta do Drive, incidente 910ea757)
    e' PULADO e o treino segue com os que prestam;
  * so falha o job quando NENHUM arquivo serve — a mensagem ao aluno tem que
    ser verdadeira;
  * pouco audio util depois da limpeza aborta ANTES do treino (~1min de GPU)
    pro backend estornar com a mensagem certa, em vez de entregar voz ruim;
  * amostra pos-treino e' mimo: se ela quebrar, o treino que ja deu certo
    continua dando certo;
  * similaridade baixa na amostra TROCA a referencia pela proxima candidata
    (caso "me levantar" 2026-07-16).

    cd runpod-worker && python test_train_smoke.py -v
"""
import os
import sys
import tempfile
import types
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest import mock

_TMP = Path(tempfile.mkdtemp(prefix="train_smoke_"))
os.environ.update({
    "WORKSPACE_DIR": str(_TMP / "jobs"),
    "JOB_TMP_DIR": str(_TMP / "tmp"),
    "TORCHINDUCTOR_CACHE_DIR": str(_TMP / "inductor"),
    "VOXCPM_MODEL_DIR": str(_TMP / "model"),
    "TRAIN_MIN_USEFUL_SECONDS": "600",
})

SR = 16000
SEG_SEGUNDOS = 30.0          # cada chunk cortado "dura" isso
_estado = SimpleNamespace(save_path=None, chunks_por_arquivo=24, returncode=0)


def _toca(p: Path) -> Path:
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_bytes(b"RIFF" + b"\0" * 40)
    return p


def _stub():
    sf = types.ModuleType("soundfile")
    sf.write = lambda t, d, sr, format=None: None
    sf.info = lambda path: SimpleNamespace(frames=int(SR * SEG_SEGUNDOS), samplerate=SR)
    sys.modules["soundfile"] = sf

    rp = types.ModuleType("runpod")
    rp.serverless = types.SimpleNamespace(start=lambda *a, **k: None)
    sys.modules["runpod"] = rp

    hf = types.ModuleType("huggingface_hub")
    hf.snapshot_download = lambda *a, **k: None
    sys.modules["huggingface_hub"] = hf

    sg = types.ModuleType("sample_gen")
    sg.sample_text_for = lambda lang: "texto da amostra."
    sg.generate_training_sample = lambda **k: (
        _toca(Path(k["work_dir"]) / "training_sample.wav"),
        {"sample_uploaded": True, "sample_seconds": 3.0, "sample_error": None},
    )[1]
    sys.modules["sample_gen"] = sg

    vp = types.ModuleType("voice_pipeline")

    def download_to_dir(urls, target_dir):
        return [_toca(Path(target_dir) / f"{i:03d}_{Path(u.split('?')[0]).name}")
                for i, u in enumerate(urls)]

    def separate_vocals_demucs(stereo_wav, vocals_dir, log=None):
        return _toca(Path(vocals_dir) / (Path(stereo_wav).stem + "_vocals.wav"))

    def extract_to_wav(src, dst, sample_rate=16000):
        return _toca(Path(dst))

    def cut_audio_by_segments(normalized, chunks, dataset_dir, start_index=0):
        return [_toca(Path(dataset_dir) / f"chunk_{start_index + i:04d}.wav")
                for i in range(len(chunks))]

    def create_training_config(repo, manifest, model_dir, save_path=None, **k):
        _estado.save_path = Path(save_path)
        return Path(save_path).parent / "config.json"

    def run_training(repo, config, log=None):
        if _estado.returncode == 0:
            _toca(_estado.save_path / "latest" / "lora_weights.safetensors")
        return {"returncode": _estado.returncode, "stdout_tail": "t", "stderr_tail": "e"}

    vp.download_to_dir = download_to_dir
    vp.upload_file_to_presigned_url = lambda *a, **k: None
    vp.extract_to_wav = extract_to_wav
    vp.separate_vocals_demucs = separate_vocals_demucs
    vp.vad_segments_silero = lambda p: [(0.0, 120.0)]
    vp.chunk_vad_segments = lambda vad, **k: [(0, 30)] * _estado.chunks_por_arquivo
    vp.cut_audio_by_segments = cut_audio_by_segments
    vp.transcribe_audio_folder = lambda *a, **k: None
    vp.transcribe_file = lambda *a, **k: "transcricao."
    vp.build_train_manifest = lambda d: Path(d) / "manifest.jsonl"
    vp.create_training_config = create_training_config
    vp.run_training = run_training
    vp.select_reference_candidates = lambda norm_files, work_dir, **k: [
        (_toca(Path(work_dir) / "cand_0.wav"), "primeira candidata."),
        (_toca(Path(work_dir) / "cand_1.wav"), "segunda candidata."),
        (_toca(Path(work_dir) / "cand_2.wav"), "terceira candidata."),
    ]
    vp.detect_language = lambda p, model_name=None: ("pt", 0.99)
    # Modulos que a main adicionou depois do refator (080dd74 pacing,
    # 93f9b3b transcribe_words): o stub precisa conhece-los.
    pac = types.ModuleType("voice_pipeline.pacing")
    pac.measure_natural_pause_ms = lambda files, log=None: None
    vp.pacing = pac
    vp.transcribe_words = lambda *a, **k: None
    sys.modules["voice_pipeline.pacing"] = pac
    sys.modules["voice_pipeline"] = vp


_stub()

import jobs.train as train                 # noqa: E402
import jobs.train_dataset as tdataset      # noqa: E402
import jobs.train_reference as tref        # noqa: E402


def _job(**over):
    j = {"voice_id": "aluno-teste", "audio_urls": ["https://r2/a.mp3", "https://r2/b.mp3"],
         "lora_upload_url": "https://r2/lora.safetensors?sig=x", "max_steps": 100}
    j.update(over)
    return j


class TrainBase(unittest.TestCase):
    def setUp(self):
        _estado.chunks_por_arquivo = 24
        _estado.returncode = 0
        # ffmpeg de verdade nao roda no teste; por padrao TODO arquivo tem audio
        self.ffmpeg = mock.patch.object(tdataset, "run_ffmpeg_stereo_44k",
                                        side_effect=lambda src, dst: _toca(Path(dst)))
        self.ffmpeg.start()
        self.addCleanup(self.ffmpeg.stop)
        for nome in ("ensure_model_downloaded", "free_cuda"):
            p = mock.patch.object(train, nome); p.start(); self.addCleanup(p.stop)


class EntradaTest(TrainBase):
    def test_sem_audio_urls(self):
        self.assertEqual(train.handle_train(_job(audio_urls=[]))["error"],
                         "missing 'audio_urls'")

    def test_sem_url_de_upload_da_lora(self):
        self.assertEqual(train.handle_train(_job(lora_upload_url=None))["error"],
                         "missing 'lora_upload_url'")


class ArquivoSemAudioTest(TrainBase):
    """Incidente 910ea757: o aluno joga FOTO na mesma pasta do Drive."""

    def test_foto_no_meio_e_pulada_e_o_treino_segue(self):
        def so_o_primeiro_tem_audio(src, dst):
            if "b.mp3" in str(src):
                raise RuntimeError("ffmpeg stereo 44k failed: does not contain any stream")
            return _toca(Path(dst))

        self.ffmpeg.stop()
        with mock.patch.object(tdataset, "run_ffmpeg_stereo_44k", side_effect=so_o_primeiro_tem_audio):
            r = train.handle_train(_job())
        self.ffmpeg.start()
        self.assertTrue(r.get("lora_uploaded"), f"o treino tinha que seguir: {r}")
        # PROVA de que pulou de verdade: entraram os chunks de UM arquivo so
        # (24), nao dos dois (48) — e ainda assim a voz saiu.
        self.assertEqual(r["dataset_chunks"], 24)
        self.assertEqual(r["useful_seconds"], 720.0)

    def test_TODOS_sem_audio_falha_com_a_verdade(self):
        self.ffmpeg.stop()
        with mock.patch.object(tdataset, "run_ffmpeg_stereo_44k",
                               side_effect=RuntimeError("does not contain any stream")):
            r = train.handle_train(_job())
        self.ffmpeg.start()
        self.assertIn("no usable speech segments", r["error"])
        self.assertEqual(len(r["preprocess_stats"]), 2)
        self.assertTrue(all(s.get("skipped") for s in r["preprocess_stats"]))


class AudioInsuficienteTest(TrainBase):
    def test_pouco_audio_util_aborta_ANTES_do_treino(self):
        _estado.chunks_por_arquivo = 1          # 2 arquivos x 30s = 60s < 600s
        with mock.patch.object(tref, "sample_qa_similarity") as qa:
            r = train.handle_train(_job())
        self.assertEqual(r["error"], "insufficient_audio")
        self.assertEqual(r["useful_seconds"], 60.0)
        self.assertEqual(r["min_required_seconds"], 600.0)
        qa.assert_not_called()                  # nao gastou GPU de treino


class TreinoTest(TrainBase):
    def test_caminho_feliz(self):
        r = train.handle_train(_job(reference_upload_url="https://r2/ref.wav?sig=x"))
        self.assertTrue(r["lora_uploaded"])
        self.assertEqual(r["trainer_returncode"], 0)
        self.assertEqual(r["dataset_chunks"], 48)      # 2 arquivos x 24 chunks
        self.assertEqual(r["useful_seconds"], 1440.0)
        self.assertTrue(r["reference_uploaded"])
        self.assertEqual(r["reference_transcript"], "primeira candidata.")
        self.assertEqual(r["language"], "pt")
        self.assertIsNone(r["reference_error"])

    def test_trainer_quebrado_devolve_o_log(self):
        _estado.returncode = 1
        r = train.handle_train(_job())
        self.assertEqual(r["error"], "trainer failed")
        self.assertEqual(r["trainer_returncode"], 1)
        self.assertEqual(r["stderr_tail"], "e")

    def test_sem_lora_no_disco_nao_mente_sucesso(self):
        with mock.patch.dict(sys.modules["voice_pipeline"].__dict__,
                             {"run_training": lambda *a, **k: {"returncode": 0,
                                                               "stdout_tail": "", "stderr_tail": ""}}):
            r = train.handle_train(_job())
        self.assertEqual(r["error"], "no safetensors produced")


class AmostraTest(TrainBase):
    """A amostra e' mimo — nunca pode derrubar um treino que deu certo."""

    def test_amostra_que_explode_nao_derruba_o_treino(self):
        with mock.patch.dict(sys.modules["sample_gen"].__dict__,
                             {"generate_training_sample": mock.Mock(side_effect=RuntimeError("boom"))}):
            r = train.handle_train(_job(sample_upload_url="https://r2/s.wav?sig=x"))
        self.assertTrue(r["lora_uploaded"])
        self.assertIn("boom", r["sample_error"])

    def test_similaridade_baixa_TROCA_a_referencia_pela_proxima(self):
        # 1a candidata reprova, 2a passa -> a referencia oficial vira a 2a.
        notas = iter([0.10, 0.95])
        with mock.patch.object(tref, "sample_qa_similarity", side_effect=lambda *a, **k: next(notas)):
            r = train.handle_train(_job(sample_upload_url="https://r2/s.wav?sig=x",
                                        reference_upload_url="https://r2/ref.wav?sig=x"))
        self.assertEqual(r["sample_qa"], "retried_passed")
        self.assertEqual(r["reference_transcript"], "segunda candidata.")

    def test_todas_reprovando_marca_failed_sem_derrubar(self):
        with mock.patch.object(tref, "sample_qa_similarity", return_value=0.10):
            r = train.handle_train(_job(sample_upload_url="https://r2/s.wav?sig=x",
                                        reference_upload_url="https://r2/ref.wav?sig=x"))
        self.assertEqual(r["sample_qa"], "failed")
        self.assertTrue(r["lora_uploaded"])

    def test_whisper_mudo_no_qa_nao_bloqueia(self):
        # similaridade None = whisper falhou -> inconclusivo, nao reprova.
        with mock.patch.object(tref, "sample_qa_similarity", return_value=None):
            r = train.handle_train(_job(sample_upload_url="https://r2/s.wav?sig=x",
                                        reference_upload_url="https://r2/ref.wav?sig=x"))
        self.assertEqual(r["sample_qa"], "passed")


if __name__ == "__main__":
    unittest.main(verbosity=2)
