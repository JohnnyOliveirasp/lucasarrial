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
     (config de um job nunca vaza pro próximo);
  7. os REGENS ACUMULADOS do job viajam no payload do heartbeat (17/09) —
     leitura ao vivo, resistente a provedor quebrado, e sem vazar entre jobs;
  8. setup_s + since_t0_s pegam carona no heartbeat (22/09, feat/heartbeat-
     setup-s): durante o setup as chaves estão AUSENTES; depois do setup as
     duas viajam, com since_t0_s recalculado a cada leitura; e o teto de 12
     itens do meta não expulsa chunk/attempt.

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
        # #15 (28/08): sem UA nosso a Cloudflare responde 403 e o heartbeat
        # inteiro morre calado — foi o que segurou a causa raiz por 4 semanas.
        self.assertEqual(req.get_header("User-agent"), worker_log.WORKER_USER_AGENT)
        self.assertNotIn("urllib", req.get_header("User-agent").lower())
        body = json.loads(req.data.decode("utf-8"))
        # `meta` entrou no corpo em 07/09 (#15, PR #209) e este teste ficou
        # DEFASADO — falhava na main desde então, ou seja o instrumento que o
        # #15 depende ficou 1 dia sem guarda. Chamada sem meta manda `{}`
        # (nunca ausente: chave que some não distingue "sem meta" de "campo
        # não viajou", que é justamente o modo de falha que o #15 investiga).
        self.assertEqual(body, {
            "generation_id": CFG_INPUT["fase_ref"],
            "token": CFG_INPUT["fase_token"],
            "fase": "inference.chunk.generate",
            "running_s": 312.4,
            "job_type": "inference",
            "meta": {},
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
        # 4 posicionais desde 07/09 (#15, PR #209): o `meta` da fase do topo
        # viaja JUNTO. Este teste desempacotava 3 e quebrava com ValueError.
        fase, running_s, job_type, meta = post.call_args[0]
        self.assertEqual(fase, "inference.chunk.generate")
        self.assertIsInstance(running_s, float)
        self.assertEqual(job_type, "inference")
        # A GUARDA QUE FALTAVA, e é o ponto do #15: sem o `chunk` chegando ao
        # banco não dá pra separar "pendurado num chunk" de "tempestade de
        # regen" — que é a única pergunta aberta do chamado.
        self.assertEqual(meta, {"chunk": 3})

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


class RegensAcumuladosTest(unittest.TestCase):
    """Regens ACUMULADOS do job no heartbeat (#15, 17/09).

    O defeito: `qa_stats["regens"]` só é persistido no FIM do job, então os 19
    executionTimeout medidos no #15 têm regens NULO — 19 de 19. Como o regen é
    o multiplicador do relógio, o número que explica o estouro é justamente o
    que morre com o SIGKILL. O heartbeat passa a carregá-lo junto da fase.
    """

    def tearDown(self):
        worker_log.set_job_stats_provider(None)
        worker_log._CURRENT_JOB_TYPE = None
        worker_log._FASE_CFG = None
        with worker_log._PHASE_LOCK:
            worker_log._PHASE_STACK.clear()

    # ── a leitura em si ────────────────────────────────────────────────────
    def test_sem_provedor_nao_ha_contador(self):
        # Worker rodando job que não registra provedor (train/transcribe):
        # payload idêntico ao de hoje, sem chave nova aparecendo na row.
        self.assertEqual(worker_log._stats_do_job(), {})

    def test_le_o_regens_do_provedor(self):
        worker_log.set_job_stats_provider(lambda: {"regens": 7, "exhausted": 2})
        # Só `regens` atravessa: a lista branca existe pra que o qa_stats
        # inteiro (~40 chaves, uma delas lista) não vaze pro payload da fase.
        self.assertEqual(worker_log._stats_do_job(), {"regens": 7})

    def test_leitura_e_AO_VIVO_nao_congelada(self):
        """O ponto do cartão: o valor tem que ser o de AGORA.

        `inference.chunk.qa` é entrada UMA vez por chunk e os regens sobem
        DENTRO dela. Um valor capturado na entrada da fase mostraria o
        acumulado do início do chunk e calaria a tempestade em curso.
        """
        qa_stats = {"regens": 0}  # o dict VIVO do job
        worker_log.set_job_stats_provider(lambda: qa_stats)
        self.assertEqual(worker_log._stats_do_job(), {"regens": 0})
        for _ in range(31):  # tempestade de regen, job ainda vivo
            qa_stats["regens"] += 1
        self.assertEqual(worker_log._stats_do_job(), {"regens": 31})

    # ── nunca derruba nada ─────────────────────────────────────────────────
    def test_provedor_que_lanca_nao_propaga(self):
        def explode():
            raise RuntimeError("provedor quebrado")

        worker_log.set_job_stats_provider(explode)
        self.assertEqual(worker_log._stats_do_job(), {})  # não lança

    def test_provedor_com_tipos_errados_e_ignorado(self):
        for valor in (None, "12", [1, 2], {"a": 1}, True, False):
            worker_log.set_job_stats_provider(lambda v=valor: {"regens": v})
            self.assertEqual(
                worker_log._stats_do_job(), {},
                f"{valor!r} ({type(valor).__name__}) não deveria virar contador")

    def test_provedor_devolvendo_nao_dict_nao_propaga(self):
        worker_log.set_job_stats_provider(lambda: None)
        self.assertEqual(worker_log._stats_do_job(), {})
        worker_log.set_job_stats_provider(lambda: "nada disso")
        self.assertEqual(worker_log._stats_do_job(), {})  # .get inexistente

    # ── o tick do heartbeat ────────────────────────────────────────────────
    def _rodar_um_tick(self):
        """Um tick do loop real: 1º sleep passa, 2º encerra o teste."""
        with mock.patch.object(
            worker_log.time, "sleep", side_effect=[None, KeyboardInterrupt()]
        ):
            with self.assertRaises(KeyboardInterrupt):
                worker_log._heartbeat_loop()

    def test_tick_manda_regens_junto_da_fase(self):
        worker_log._CURRENT_JOB_TYPE = "inference"
        worker_log.set_job_stats_provider(lambda: {"regens": 23})
        with worker_log._PHASE_LOCK:
            worker_log._PHASE_STACK.append({
                "name": "inference.chunk.generate",
                "start": time.monotonic(),
                "meta": {"chunk": 4, "attempt": 3},
            })
        with mock.patch.object(worker_log, "_fase_post") as post:
            self._rodar_um_tick()
        post.assert_called_once()
        fase, _running_s, _job_type, meta = post.call_args[0]
        self.assertEqual(fase, "inference.chunk.generate")
        # O QUE ESTE CARTÃO EXISTE PRA GARANTIR: `attempt` é POR CHUNK (zera a
        # cada chunk) e `regens` é o ACUMULADO do job. Os dois JUNTOS separam
        # "pendurou num chunk" de "queimou o orçamento em regen".
        self.assertEqual(meta, {"regens": 23, "chunk": 4, "attempt": 3})

    def test_tick_sem_fase_instrumentada_ainda_manda_regens(self):
        # Pilha vazia era o caso "(sem fase instrumentada)" da geração
        # 86254b30. Mesmo sem fase, saber quantos regens já queimaram informa.
        worker_log._CURRENT_JOB_TYPE = "inference"
        worker_log.set_job_stats_provider(lambda: {"regens": 12})
        with mock.patch.object(worker_log, "_fase_post") as post:
            self._rodar_um_tick()
        fase, _running_s, _job_type, meta = post.call_args[0]
        self.assertEqual(fase, "(sem fase instrumentada)")
        self.assertEqual(meta, {"regens": 12})

    def test_meta_da_fase_manda_em_colisao_de_chave(self):
        # Contrato documentado no _heartbeat_loop: em colisão, a fase (que
        # descreve o que roda AGORA) sobrescreve o contador acumulado.
        worker_log._CURRENT_JOB_TYPE = "inference"
        worker_log.set_job_stats_provider(lambda: {"regens": 99})
        with worker_log._PHASE_LOCK:
            worker_log._PHASE_STACK.append({
                "name": "x", "start": time.monotonic(), "meta": {"regens": 1},
            })
        with mock.patch.object(worker_log, "_fase_post") as post:
            self._rodar_um_tick()
        self.assertEqual(post.call_args[0][3], {"regens": 1})

    def test_provedor_quebrado_nao_impede_o_post_da_fase(self):
        """A regra dura: telemetria nova não pode custar a telemetria velha."""
        worker_log._CURRENT_JOB_TYPE = "inference"

        def explode():
            raise RuntimeError("provedor quebrado")

        worker_log.set_job_stats_provider(explode)
        with worker_log._PHASE_LOCK:
            worker_log._PHASE_STACK.append({
                "name": "inference.setup.model", "start": time.monotonic(), "meta": {},
            })
        with mock.patch.object(worker_log, "_fase_post") as post:
            self._rodar_um_tick()
        post.assert_called_once()  # a fase continuou chegando
        self.assertEqual(post.call_args[0][0], "inference.setup.model")
        self.assertEqual(post.call_args[0][3], {})

    # ── ponta a ponta: o regens no BODY que sai na rede ────────────────────
    def test_regens_aparece_no_body_do_post(self):
        """Prova de ponta a ponta — do qa_stats do job até o JSON no wire.

        Os testes acima param no `_fase_post`; este vai até o request, que é o
        que a rota /api/v1/webhooks/runpod-fase recebe e grava em
        generations.qa.fase_corrente.meta (jsonb existente, sem migration).
        """
        worker_log._CURRENT_JOB_TYPE = "inference"
        worker_log._FASE_CFG = worker_log._fase_cfg_from_input(dict(CFG_INPUT))
        qa_stats = {"regens": 41}
        worker_log.set_job_stats_provider(lambda: qa_stats)
        with worker_log._PHASE_LOCK:
            worker_log._PHASE_STACK.append({
                "name": "inference.chunk.generate",
                "start": time.monotonic(),
                "meta": {"chunk": 9, "attempt": 5},
            })
        with mock.patch.object(worker_log.urllib.request, "urlopen") as urlopen:
            urlopen.return_value.__enter__ = lambda s: s
            urlopen.return_value.__exit__ = lambda s, *a: False
            self._rodar_um_tick()
        urlopen.assert_called_once()
        body = json.loads(urlopen.call_args[0][0].data.decode("utf-8"))
        self.assertEqual(body["generation_id"], CFG_INPUT["fase_ref"])
        self.assertEqual(body["fase"], "inference.chunk.generate")
        self.assertEqual(body["meta"], {"regens": 41, "chunk": 9, "attempt": 5})
        # `_meta_serializavel` deixa inteiro passar como inteiro: a rota grava
        # número no jsonb, não string (senão não dá pra comparar/ordenar).
        self.assertIsInstance(body["meta"]["regens"], int)

    # ── não vaza entre jobs ────────────────────────────────────────────────
    def test_set_current_job_none_limpa_o_provedor(self):
        worker_log.set_job_stats_provider(lambda: {"regens": 5})
        self.assertEqual(worker_log._stats_do_job(), {"regens": 5})
        worker_log.set_current_job(None)  # fim do job (finally do handler)
        self.assertIsNone(worker_log._JOB_STATS_PROVIDER)
        self.assertEqual(worker_log._stats_do_job(), {})

    def test_handler_limpa_o_provedor_mesmo_quando_o_job_lanca(self):
        # Um job que morre no meio não pode deixar o provedor pendurado
        # servindo número velho pro próximo aluno.
        worker_log.set_job_stats_provider(lambda: {"regens": 5})
        with mock.patch.object(handler, "start_heartbeat", lambda: None), \
             mock.patch.object(handler, "faxina", lambda *a, **k: None), \
             mock.patch.object(handler, "handle_transcribe",
                               side_effect=RuntimeError("boom")):
            out = handler.handler({"input": {"type": "transcribe", **CFG_INPUT}})
        self.assertIn("error", out)
        self.assertIsNone(worker_log._JOB_STATS_PROVIDER)


class RegensProvedorDoJobTest(unittest.TestCase):
    """O CALL SITE de produção: `InferenceJob.run()` registra o provedor.

    Sem este teste os de cima provariam só o mecanismo do worker_log, com o
    registro real podendo nem existir — verde que não prova nada.
    """

    def tearDown(self):
        worker_log.set_job_stats_provider(None)

    def test_run_registra_o_provedor_antes_do_trabalho_pesado(self):
        from jobs import inference as inf

        class Sentinela(Exception):
            pass

        job = inf.InferenceJob({}, "texto qualquer")
        visto = {}

        def no_primeiro_download(*_a, **_k):
            # `baixar_lora` é a PRIMEIRA coisa pesada do run(); o que já estiver
            # registrado aqui foi registrado antes de qualquer download.
            visto["provedor"] = worker_log._JOB_STATS_PROVIDER
            raise Sentinela()

        with mock.patch.object(inf, "baixar_lora", side_effect=no_primeiro_download):
            with self.assertRaises(Sentinela):
                job.run()

        # Registrado ANTES do setup: um job que pendura baixando o LoRA (caso
        # 86254b30, morto no teto com a fase vazia) já nasce com o contador
        # visível pro heartbeat.
        self.assertIsNotNone(visto["provedor"])
        # E lê o estado VIVO do job, não uma cópia congelada no registro.
        # (Desde feat/heartbeat-setup-s o provedor devolve um SNAPSHOT montado
        # na hora da leitura — a garantia que importa é que mutação posterior
        # do qa_stats aparece na próxima leitura, não a identidade do dict.)
        job.qa_stats["regens"] += 17
        self.assertEqual(worker_log._stats_do_job(), {"regens": 17})


class SetupESinceT0Test(unittest.TestCase):
    """setup_s + since_t0_s no heartbeat (#15, 22/09 — feat/heartbeat-setup-s).

    O defeito: `qa.setup_s` só é persistido no SUCESSO. Num job morto por
    SIGKILL no executionTimeout o único número de que a régua depende não
    existe — e as duas explicações opostas ((A) pico de setup comendo a base
    do teto, causa nomeada em 10/09; (B) worker degradado rodando ~3x lento)
    sobrevivem a cada morte pedindo consertos opostos. Com os dois campos
    pegando carona no heartbeat, a última linha gravada em
    generations.qa.fase_corrente.meta passa a dizer quanto o setup comeu e
    quanto já correu desde o t0 — TAMBÉM no job morto.
    """

    def tearDown(self):
        worker_log.set_job_stats_provider(None)
        worker_log._CURRENT_JOB_TYPE = None
        worker_log._FASE_CFG = None
        with worker_log._PHASE_LOCK:
            worker_log._PHASE_STACK.clear()

    def _rodar_um_tick(self):
        """Um tick do loop real: 1º sleep passa, 2º encerra o teste."""
        with mock.patch.object(
            worker_log.time, "sleep", side_effect=[None, KeyboardInterrupt()]
        ):
            with self.assertRaises(KeyboardInterrupt):
                worker_log._heartbeat_loop()

    # ── o contrato das chaves ──────────────────────────────────────────────
    def test_lista_branca_deixa_passar_os_dois_e_so_numero(self):
        worker_log.set_job_stats_provider(lambda: {
            "regens": 7, "setup_s": 12.3, "since_t0_s": 45.6, "exhausted": 2})
        self.assertEqual(worker_log._stats_do_job(),
                         {"regens": 7, "setup_s": 12.3, "since_t0_s": 45.6})
        # Contrato do filtro intacto: bool/None/str continuam de fora.
        worker_log.set_job_stats_provider(
            lambda: {"setup_s": True, "since_t0_s": "9.9", "regens": None})
        self.assertEqual(worker_log._stats_do_job(), {})

    # ── DURANTE o setup: chaves AUSENTES, sem ambiguidade ──────────────────
    def test_heartbeat_durante_o_setup_sem_setup_s_nem_since_t0(self):
        from jobs import inference as inf

        class Sentinela(Exception):
            pass

        job = inf.InferenceJob({}, "texto qualquer")
        visto = {}

        def no_meio_do_setup(*_a, **_k):
            # `baixar_lora` é a primeira coisa do setup: o que o heartbeat
            # leria AQUI é o que um job pendurado no download reporta.
            visto["stats"] = worker_log._stats_do_job()
            raise Sentinela()

        with mock.patch.object(inf, "baixar_lora", side_effect=no_meio_do_setup):
            with self.assertRaises(Sentinela):
                job.run()

        # Chave AUSENTE = "ainda no setup". NÃO pode ser 0 nem None: os dois
        # são indistinguíveis de "mediu e deu zero".
        self.assertNotIn("setup_s", visto["stats"])
        self.assertNotIn("since_t0_s", visto["stats"])
        # E o contador que já viajava continua viajando.
        self.assertEqual(visto["stats"].get("regens"), 0)

    # ── DEPOIS do setup: os dois viajam ────────────────────────────────────
    def test_heartbeat_depois_do_setup_manda_setup_s_e_since_t0(self):
        from jobs import inference as inf

        class Sentinela(Exception):
            pass

        job = inf.InferenceJob({}, "texto qualquer")
        visto = {}

        def durante_os_chunks(_chunks):
            # Ponto do run() logo DEPOIS de `self.t0 = time.monotonic()` —
            # é onde um job vivo gerando chunks é lido pelo heartbeat.
            visto["stats"] = worker_log._stats_do_job()
            raise Sentinela()

        with mock.patch.object(inf, "baixar_lora", return_value=None), \
             mock.patch.object(inf, "preparar_referencia", return_value=(None, None)), \
             mock.patch.object(inf, "carregar_modelo", return_value=(None, 16000)), \
             mock.patch.object(job, "_medir_em_amostras", lambda: None), \
             mock.patch.object(job, "_definir_regua_de_ritmo", lambda: None), \
             mock.patch.object(job, "_gerar_todos_os_chunks",
                               side_effect=durante_os_chunks):
            with self.assertRaises(Sentinela):
                job.run()

        stats = visto["stats"]
        self.assertIn("setup_s", stats)
        self.assertIn("since_t0_s", stats)
        # setup_s é o MESMO número que o caminho de sucesso persiste em
        # qa.setup_s — publicado no dict vivo assim que medido.
        self.assertEqual(stats["setup_s"], job.qa_stats["setup_s"])
        self.assertGreaterEqual(stats["since_t0_s"], 0.0)

    def test_since_t0_e_recalculado_a_cada_leitura(self):
        """O ponto do cartão: since_t0_s é o valor de AGORA, não o congelado.

        Um número estático gravado no dict na hora do t0 diria sempre ~0 e
        calaria justamente o relógio que separa (A) de (B).
        """
        from jobs import inference as inf

        job = inf.InferenceJob({}, "texto qualquer")
        job.setup_s = 33.21
        job.qa_stats["setup_s"] = job.setup_s
        job.t0 = 1000.0
        worker_log.set_job_stats_provider(job._stats_para_heartbeat)
        with mock.patch.object(inf.time, "monotonic", side_effect=[1030.5, 1091.0]):
            self.assertEqual(
                worker_log._stats_do_job(),
                {"regens": 0, "setup_s": 33.21, "since_t0_s": 30.5})
            self.assertEqual(
                worker_log._stats_do_job(),
                {"regens": 0, "setup_s": 33.21, "since_t0_s": 91.0})

    # ── teto de 12 itens: chunk/attempt NÃO caem fora ──────────────────────
    def test_teto_de_12_preserva_chunk_e_attempt_no_body_do_post(self):
        """`_meta_serializavel` corta em 12 itens NA ORDEM do dict, e os
        contadores acumulados entram ANTES do meta da fase. Com regens +
        setup_s + since_t0_s na frente, o meta REAL de inference.chunk.generate
        (chunk, attempt, chars, cfg — o call site de produção em
        jobs/inference.py:_gerar) tem que continuar passando INTEIRO:
        chunk/attempt fora do payload é exatamente a cegueira do #15."""
        worker_log._CURRENT_JOB_TYPE = "inference"
        worker_log._FASE_CFG = worker_log._fase_cfg_from_input(dict(CFG_INPUT))
        worker_log.set_job_stats_provider(
            lambda: {"regens": 31, "setup_s": 88.2, "since_t0_s": 391.7})
        with worker_log._PHASE_LOCK:
            worker_log._PHASE_STACK.append({
                "name": "inference.chunk.generate",
                "start": time.monotonic(),
                "meta": {"chunk": 7, "attempt": 9, "chars": 512, "cfg": None},
            })
        with mock.patch.object(worker_log.urllib.request, "urlopen") as urlopen:
            urlopen.return_value.__enter__ = lambda s: s
            urlopen.return_value.__exit__ = lambda s, *a: False
            self._rodar_um_tick()
        urlopen.assert_called_once()
        body = json.loads(urlopen.call_args[0][0].data.decode("utf-8"))
        self.assertEqual(body["meta"], {
            "regens": 31, "setup_s": 88.2, "since_t0_s": 391.7,
            "chunk": 7, "attempt": 9, "chars": 512, "cfg": None,
        })
        # 7 de 12: folga comprovada, nada foi cortado pelo teto.
        self.assertLessEqual(len(body["meta"]), 12)


if __name__ == "__main__":
    unittest.main()
