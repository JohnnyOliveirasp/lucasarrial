"""Testes da telemetria de fase → app (incidente d3d8d1b2, chamado #15).

O defeito coberto: jobs de geração morrem por executionTimeout (SIGKILL) e a
fase pendurada só existe no STDOUT do worker — que vive no console da RunPod e
expira. O app passa `fase_url`/`fase_token`/`fase_ref` no input do job e a
thread de heartbeat POSTa a fase corrente pro app, que grava no banco.

Estes testes provam, SEM GPU e SEM rede:
  1. a config só liga com as TRÊS chaves presentes e url https;
  2. `_fase_post` monta o POST certo (url, headers, body) a partir da config;
  3. sem config, `_fase_post` não faz NENHUMA chamada de rede;
  4. erro de rede no POST não propaga (telemetria jamais derruba job);
  5. o tick do heartbeat chama `_fase_post` com a fase do topo da pilha;
  6. `handler()` seta a config a partir do input e SEMPRE limpa no finally
     (config de um job nunca vaza pro próximo).

Roda sem GPU e sem pesos — módulos pesados stubados, rede mockada:

    cd runpod-worker && python3 test_fase_telemetria.py -v
(portado do b9bc646 da main para os modulos do refator: worker_log.py)
"""
import json
import sys
import time
import types
import unittest
from unittest import mock

# ── Stubs dos módulos pesados ANTES de importar o handler ──────────────────
for _name in ("runpod", "soundfile", "huggingface_hub"):
    if _name not in sys.modules:
        sys.modules[_name] = types.ModuleType(_name)
sys.modules["runpod"].serverless = types.SimpleNamespace(start=lambda *a, **k: None)
if not hasattr(sys.modules["soundfile"], "write"):
    sys.modules["soundfile"].write = lambda *a, **k: None
if not hasattr(sys.modules["huggingface_hub"], "snapshot_download"):
    sys.modules["huggingface_hub"].snapshot_download = lambda *a, **k: None

import handler  # noqa: E402
import worker_log  # noqa: E402  (no refator, heartbeat + telemetria vivem aqui)

CFG_INPUT = {
    "fase_url": "https://app.exemplo.com/api/v1/webhooks/runpod-fase",
    "fase_token": "a" * 64,
    "fase_ref": "11111111-2222-3333-4444-555555555555",
}


class FaseCfgFromInputTest(unittest.TestCase):
    def test_liga_com_as_tres_chaves(self):
        cfg = worker_log._fase_cfg_from_input(dict(CFG_INPUT))
        self.assertEqual(cfg, {
            "url": CFG_INPUT["fase_url"],
            "token": CFG_INPUT["fase_token"],
            "ref": CFG_INPUT["fase_ref"],
        })

    def test_desligado_sem_alguma_chave(self):
        for faltando in ("fase_url", "fase_token", "fase_ref"):
            inp = dict(CFG_INPUT)
            del inp[faltando]
            self.assertIsNone(worker_log._fase_cfg_from_input(inp), faltando)

    def test_desligado_com_url_nao_https(self):
        inp = dict(CFG_INPUT, fase_url="http://app.exemplo.com/x")
        self.assertIsNone(worker_log._fase_cfg_from_input(inp))

    def test_desligado_com_tipos_errados(self):
        self.assertIsNone(worker_log._fase_cfg_from_input(dict(CFG_INPUT, fase_token=123)))
        self.assertIsNone(worker_log._fase_cfg_from_input({}))
        self.assertIsNone(worker_log._fase_cfg_from_input(dict(CFG_INPUT, fase_ref="")))


class FasePostTest(unittest.TestCase):
    def setUp(self):
        worker_log._FASE_CFG = worker_log._fase_cfg_from_input(dict(CFG_INPUT))

    def tearDown(self):
        worker_log._FASE_CFG = None

    def test_post_monta_url_headers_e_body(self):
        with mock.patch.object(worker_log.urllib.request, "urlopen") as urlopen:
            urlopen.return_value.__enter__ = lambda s: s
            urlopen.return_value.__exit__ = lambda s, *a: False
            worker_log._fase_post("inference.chunk.generate", 312.4, "inference")
        urlopen.assert_called_once()
        req = urlopen.call_args[0][0]
        self.assertEqual(req.full_url, CFG_INPUT["fase_url"])
        self.assertEqual(req.get_method(), "POST")
        self.assertEqual(req.get_header("Content-type"), "application/json")
        body = json.loads(req.data.decode("utf-8"))
        self.assertEqual(body, {
            "generation_id": CFG_INPUT["fase_ref"],
            "token": CFG_INPUT["fase_token"],
            "fase": "inference.chunk.generate",
            "running_s": 312.4,
            "job_type": "inference",
        })
        # timeout curto SEMPRE presente: POST pendurado não pode segurar nada
        self.assertEqual(urlopen.call_args[1].get("timeout"), worker_log.FASE_POST_TIMEOUT_S)

    def test_sem_cfg_nao_ha_chamada_de_rede(self):
        worker_log._FASE_CFG = None
        with mock.patch.object(worker_log.urllib.request, "urlopen") as urlopen:
            worker_log._fase_post("model.load", 1.0, "inference")
        urlopen.assert_not_called()

    def test_erro_de_rede_nao_propaga(self):
        with mock.patch.object(
            worker_log.urllib.request, "urlopen", side_effect=OSError("rede caiu")
        ):
            worker_log._fase_post("inference.upload", 9.9, "inference")  # não lança

    def test_erro_de_serializacao_nao_propaga(self):
        # meta não-serializável em algum lugar não pode derrubar o heartbeat
        worker_log._FASE_CFG = {"url": CFG_INPUT["fase_url"], "token": "t", "ref": object()}
        worker_log._fase_post("x", None, None)  # não lança


class HeartbeatTickTest(unittest.TestCase):
    """Um tick do loop de heartbeat posta a fase do topo da pilha."""

    def tearDown(self):
        worker_log._CURRENT_JOB_TYPE = None
        worker_log._FASE_CFG = None
        with worker_log._PHASE_LOCK:
            worker_log._PHASE_STACK.clear()

    def test_tick_chama_fase_post_com_a_fase_do_topo(self):
        worker_log._CURRENT_JOB_TYPE = "inference"
        with worker_log._PHASE_LOCK:
            worker_log._PHASE_STACK.append(
                {"name": "inference.chunk.generate", "start": time.monotonic(), "meta": {"chunk": 3}}
            )
        # 1º sleep passa (roda um tick), 2º lança KeyboardInterrupt (BaseException,
        # escapa do `except Exception` do loop) pra encerrar o teste.
        with mock.patch.object(
            worker_log.time, "sleep", side_effect=[None, KeyboardInterrupt()]
        ), mock.patch.object(worker_log, "_fase_post") as post:
            with self.assertRaises(KeyboardInterrupt):
                worker_log._heartbeat_loop()
        post.assert_called_once()
        fase, running_s, job_type = post.call_args[0]
        self.assertEqual(fase, "inference.chunk.generate")
        self.assertIsInstance(running_s, float)
        self.assertEqual(job_type, "inference")

    def test_tick_idle_nao_posta(self):
        worker_log._CURRENT_JOB_TYPE = None  # entre jobs
        with mock.patch.object(
            worker_log.time, "sleep", side_effect=[None, KeyboardInterrupt()]
        ), mock.patch.object(worker_log, "_fase_post") as post:
            with self.assertRaises(KeyboardInterrupt):
                worker_log._heartbeat_loop()
        post.assert_not_called()


class HandlerCfgLifecycleTest(unittest.TestCase):
    """handler() seta a config do input e SEMPRE limpa no finally."""

    def tearDown(self):
        worker_log._CURRENT_JOB_TYPE = None
        worker_log._FASE_CFG = None

    def test_health_seta_e_limpa_cfg(self):
        visto = {}
        # _start_heartbeat roda logo depois da config ser setada — captura ali,
        # e de quebra evita subir a thread daemon de verdade no teste.
        with mock.patch.object(
            handler, "start_heartbeat",
            side_effect=lambda: visto.update(cfg=worker_log._FASE_CFG),
        ), mock.patch.object(handler, "faxina", lambda *a, **k: None):
            out = handler.handler({"input": {"type": "health", **CFG_INPUT}})
        self.assertTrue(out.get("ok"))
        self.assertEqual(visto["cfg"], {
            "url": CFG_INPUT["fase_url"],
            "token": CFG_INPUT["fase_token"],
            "ref": CFG_INPUT["fase_ref"],
        })
        self.assertIsNone(worker_log._FASE_CFG)          # limpou no finally
        self.assertIsNone(worker_log._CURRENT_JOB_TYPE)  # comportamento antigo intacto

    def test_job_que_lanca_tambem_limpa_cfg(self):
        with mock.patch.object(handler, "start_heartbeat", lambda: None), \
             mock.patch.object(handler, "faxina", lambda *a, **k: None), \
             mock.patch.object(handler, "handle_transcribe", side_effect=RuntimeError("boom")):
            out = handler.handler({"input": {"type": "transcribe", **CFG_INPUT}})
        self.assertIn("error", out)
        self.assertIsNone(worker_log._FASE_CFG)

    def test_sem_chaves_no_input_cfg_fica_none(self):
        visto = {}
        with mock.patch.object(
            handler, "start_heartbeat",
            side_effect=lambda: visto.update(cfg=worker_log._FASE_CFG),
        ), mock.patch.object(handler, "faxina", lambda *a, **k: None):
            handler.handler({"input": {"type": "health"}})
        self.assertIsNone(visto["cfg"])


if __name__ == "__main__":
    unittest.main()
