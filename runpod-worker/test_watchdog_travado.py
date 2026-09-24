"""Testes do watchdog de heartbeat CONGELADO (#15, d3d8d1b2, 22/09).

O defeito coberto: worker pendurado (hang nativo segurando o GIL) congela
TODAS as threads Python — inclusive a do heartbeat, medido na geração
9555c0d0 (22/09 14h: `visto_em` e `running_s` param de avançar juntos) — e o
job só morre no teto do executionTimeout (642s na 342e54a1, 2,0x o máximo da
faixa). O conserto: o heartbeat escreve um PULSO em arquivo a cada tick e um
PROCESSO filho (worker_watchdog.py, imune ao GIL do pai) SIGKILLa o worker
quando um pulso ATIVO fica sem sucessor por ~105s, com erro nomeado no stdout
e no banco (POST de fase antes do kill). O retry existente da RunPod faz o
resto.

Estes testes provam, SEM GPU e SEM rede:
  1. decidir() só autoriza matar em pulso ATIVO velho — todo caso ambíguo
     (sem pulso, ts inválido, relógio pra trás, idle) resolve para NÃO matar;
  2. montar_erro() produz o erro nomeado do cartão ("worker travado em <fase>
     chunk <n>") e cabe no teto de 64 chars do meta da rota;
  3. o tick do heartbeat escreve o pulso (ativo com fase/meta/cfg; idle sem
     postar fase — comportamento antigo intacto);
  4. set_current_job escreve pulso imediato (ativo no início, idle no fim);
  5. _matar POSTa o erro nomeado pro webhook de fase ANTES do SIGKILL, e
     não posta nada quando o pulso não tem cfg;
  6. start_heartbeat sobe o processo do vigia UMA vez, com os argv certos;
  7. INTEGRAÇÃO REAL: worker_watchdog.py rodando como processo de verdade
     mata um processo-vítima congelado (pulso ativo velho) e sai sozinho
     quando o pai morre primeiro — sem GPU, sem rede, em segundos.

    cd runpod-worker && python3 test_watchdog_travado.py -v
"""
import json
import os
import signal
import subprocess
import sys
import tempfile
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

import worker_log  # noqa: E402
import worker_watchdog as wd  # noqa: E402

CFG = {"url": "https://app.exemplo.com/api/v1/webhooks/runpod-fase",
       "token": "t" * 64, "ref": "11111111-2222-3333-4444-555555555555"}


def le_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def pulso(ativo=True, ts=None, fase="inference.chunk.generate",
          meta=None, cfg=None, running_s=114.9, job_type="inference"):
    return {"ts": time.time() if ts is None else ts, "ativo": ativo,
            "job_type": job_type, "fase": fase, "running_s": running_s,
            "meta": {"chunk": 7, "attempt": 1} if meta is None else meta,
            "fase_cfg": cfg}


class DecidirTest(unittest.TestCase):
    """A função PURA que autoriza (ou não) o SIGKILL."""

    STALE = 105.0

    def test_pulso_ativo_fresco_nao_mata(self):
        self.assertEqual(wd.decidir(pulso(), time.time(), self.STALE), wd.OK)

    def test_pulso_ativo_velho_mata(self):
        # O formato exato da pane 9555c0d0: último pulso ativo, nada depois.
        agora = time.time()
        p = pulso(ts=agora - 106)
        self.assertEqual(wd.decidir(p, agora, self.STALE), wd.TRAVADO)

    def test_pulso_idle_velho_NAO_mata(self):
        # Worker parado entre jobs não tem aluno pra salvar — matar seria
        # derrubar um worker saudável à toa.
        agora = time.time()
        p = pulso(ativo=False, ts=agora - 9999)
        self.assertEqual(wd.decidir(p, agora, self.STALE), wd.IDLE_VELHO)

    def test_na_fronteira_exata_nao_mata(self):
        # <= stale_s é OK: o vigia só age quando passou DO limite.
        agora = time.time()
        self.assertEqual(wd.decidir(pulso(ts=agora - self.STALE), agora, self.STALE), wd.OK)

    def test_sem_pulso_nao_mata(self):
        for ruim in (None, [], "x", 42):
            self.assertEqual(wd.decidir(ruim, time.time(), self.STALE), wd.SEM_PULSO, repr(ruim))

    def test_ts_invalido_nao_mata(self):
        for ts in (None, "ontem", True):
            p = pulso()
            p["ts"] = ts
            self.assertEqual(wd.decidir(p, time.time(), self.STALE), wd.SEM_PULSO, repr(ts))

    def test_relogio_pra_tras_nao_mata(self):
        # ts no futuro (ajuste de relógio): idade negativa <= stale_s → OK.
        agora = time.time()
        self.assertEqual(wd.decidir(pulso(ts=agora + 3600), agora, self.STALE), wd.OK)

    def test_ativo_precisa_ser_True_literal(self):
        # "ativo": "sim"/1/None não autorizam kill — só o booleano True.
        agora = time.time()
        for v in ("sim", 1, None):
            p = pulso(ts=agora - 999)
            p["ativo"] = v
            self.assertEqual(wd.decidir(p, agora, self.STALE), wd.IDLE_VELHO, repr(v))


class MontarErroTest(unittest.TestCase):
    def test_erro_nomeado_do_cartao(self):
        # A forma pedida no cartão: "worker travado em <fase> chunk <n>".
        self.assertEqual(wd.montar_erro(pulso()),
                         "worker travado em inference.chunk.generate chunk 7")

    def test_sem_chunk_no_meta_fica_so_a_fase(self):
        self.assertEqual(wd.montar_erro(pulso(meta={})),
                         "worker travado em inference.chunk.generate")

    def test_sem_fase_usa_o_rotulo_padrao(self):
        # Pilha vazia (caso 86254b30): a fase do pulso vem None.
        self.assertEqual(wd.montar_erro(pulso(fase=None, meta={})),
                         "worker travado em (sem fase instrumentada)")

    def test_cabe_no_teto_de_64_chars_do_meta(self):
        # metaDaFaseSanitizado (rota) DESCARTA string >64 — estourar o teto
        # apagaria justamente a mensagem que o vigia existe pra deixar.
        p = pulso(fase="x" * 200)
        self.assertLessEqual(len(wd.montar_erro(p)), 64)

    def test_pulso_lixo_nao_lanca(self):
        for ruim in (None, {}, {"meta": "x"}, {"fase": 3, "meta": {"chunk": True}}):
            erro = wd.montar_erro(ruim)
            self.assertTrue(erro.startswith("worker travado em"), repr(ruim))


class PulsoDoHeartbeatTest(unittest.TestCase):
    """O lado do PAI: o tick escreve o pulso que o vigia lê."""

    def setUp(self):
        fd, self.path = tempfile.mkstemp(suffix=".json")
        os.close(fd)
        os.unlink(self.path)  # o teste começa SEM arquivo
        self._path_patch = mock.patch.object(worker_log, "_WATCHDOG_PULSE_PATH", self.path)
        self._path_patch.start()

    def tearDown(self):
        self._path_patch.stop()
        worker_log._CURRENT_JOB_TYPE = None
        worker_log._FASE_CFG = None
        with worker_log._PHASE_LOCK:
            worker_log._PHASE_STACK.clear()
        for p in (self.path, f"{self.path}.tmp"):
            if os.path.exists(p):
                os.unlink(p)

    def _rodar_um_tick(self):
        with mock.patch.object(worker_log.time, "sleep",
                               side_effect=[None, KeyboardInterrupt()]):
            with self.assertRaises(KeyboardInterrupt):
                worker_log._heartbeat_loop()

    def test_tick_ativo_escreve_pulso_com_fase_meta_e_cfg(self):
        worker_log._CURRENT_JOB_TYPE = "inference"
        worker_log._FASE_CFG = dict(CFG)
        with worker_log._PHASE_LOCK:
            worker_log._PHASE_STACK.append({
                "name": "inference.chunk.generate", "start": time.monotonic(),
                "meta": {"chunk": 7, "attempt": 1},
            })
        antes = time.time()
        with mock.patch.object(worker_log, "_fase_post"):
            self._rodar_um_tick()
        p = le_json(self.path)
        self.assertIs(p["ativo"], True)
        self.assertEqual(p["fase"], "inference.chunk.generate")
        self.assertEqual(p["meta"]["chunk"], 7)
        self.assertEqual(p["meta"]["attempt"], 1)
        self.assertEqual(p["job_type"], "inference")
        # A cfg viaja no pulso: é ela que deixa o FILHO postar o erro nomeado
        # pro banco antes do SIGKILL.
        self.assertEqual(p["fase_cfg"], CFG)
        self.assertGreaterEqual(p["ts"], antes)
        # e nada de .tmp sobrando (write atômico terminou no os.replace)
        self.assertFalse(os.path.exists(f"{self.path}.tmp"))

    def test_tick_idle_escreve_pulso_mas_nao_posta_fase(self):
        # O pulso idle é prova de vida do PROCESSO; a fase continua calada
        # entre jobs (comportamento antigo, guardado pelo teste existente
        # test_tick_idle_nao_posta — aqui o par dele).
        worker_log._CURRENT_JOB_TYPE = None
        with mock.patch.object(worker_log, "_fase_post") as post:
            self._rodar_um_tick()
        post.assert_not_called()
        p = le_json(self.path)
        self.assertIs(p["ativo"], False)

    def test_pulso_que_falha_nao_derruba_o_tick(self):
        # Pulso é telemetria: disco cheio/caminho ruim não pode calar o
        # heartbeat antigo (log + POST de fase seguem saindo).
        worker_log._CURRENT_JOB_TYPE = "inference"
        with mock.patch.object(worker_log, "_WATCHDOG_PULSE_PATH",
                               "/caminho/que/nao/existe/pulso.json"), \
             mock.patch.object(worker_log, "_fase_post") as post:
            self._rodar_um_tick()
        post.assert_called_once()  # o tick sobreviveu ao pulso quebrado

    def test_set_current_job_escreve_pulso_imediato(self):
        # Início do job: pulso ATIVO na hora (fecha a janela do 1º tick — um
        # freeze no download do LoRA, caso 86254b30, já nasce vigiado).
        worker_log.set_current_job("inference", {
            "fase_url": CFG["url"], "fase_token": CFG["token"], "fase_ref": CFG["ref"]})
        p = le_json(self.path)
        self.assertIs(p["ativo"], True)
        self.assertEqual(p["fase_cfg"], CFG)
        # Fim do job: pulso IDLE na hora (freeze depois do fim não pode ser
        # atribuído a um job que já acabou).
        worker_log.set_current_job(None)
        p = le_json(self.path)
        self.assertIs(p["ativo"], False)
        self.assertIsNone(p["fase_cfg"])


class MatarPostaAntesTest(unittest.TestCase):
    """O lado do FILHO: erro nomeado no banco ANTES do SIGKILL."""

    def tearDown(self):
        wd.worker_log._FASE_CFG = None

    def test_posta_o_erro_nomeado_e_depois_mata(self):
        ordem = []
        p = pulso(ts=time.time() - 200, cfg=dict(CFG))
        with mock.patch.object(wd.worker_log, "_fase_post",
                               side_effect=lambda *a, **k: ordem.append(("post", a))), \
             mock.patch.object(wd.os, "kill",
                               side_effect=lambda *a: ordem.append(("kill", a))):
            wd._matar(4242, p, 105.0)
        # Ordem é contrato: depois do kill não há mais quem conte a história.
        self.assertEqual([o[0] for o in ordem], ["post", "kill"])
        fase, running_s, job_type, meta = ordem[0][1]
        self.assertEqual(fase, "watchdog.travado")
        self.assertEqual(running_s, 114.9)   # o último valor conhecido, congelado
        self.assertEqual(job_type, "inference")
        self.assertEqual(meta["erro"], "worker travado em inference.chunk.generate chunk 7")
        self.assertEqual(meta["chunk"], 7)
        self.assertEqual(meta["attempt"], 1)
        self.assertEqual(meta["parado_s"], 105)
        # e o cfg do pulso virou o _FASE_CFG do PROCESSO DO FILHO
        self.assertEqual(wd.worker_log._FASE_CFG, CFG)
        self.assertEqual(ordem[1][1], (4242, signal.SIGKILL))

    def test_sem_cfg_no_pulso_mata_sem_postar(self):
        # Job sem telemetria de fase (train/transcribe, env ausente): o kill
        # continua valendo; só não há onde deixar o rastro no banco.
        p = pulso(ts=time.time() - 200, cfg=None)
        with mock.patch.object(wd.worker_log, "_fase_post") as post, \
             mock.patch.object(wd.os, "kill") as kill:
            wd._matar(4242, p, 105.0)
        post.assert_not_called()
        kill.assert_called_once_with(4242, signal.SIGKILL)

    def test_pid_de_init_jamais_recebe_sigkill(self):
        with mock.patch.object(wd.worker_log, "_fase_post"), \
             mock.patch.object(wd.os, "kill") as kill:
            wd._matar(1, pulso(ts=0), 105.0)
            wd._matar(0, pulso(ts=0), 105.0)
        kill.assert_not_called()

    def test_post_que_lanca_nao_impede_o_kill(self):
        # A regra dura invertida: aqui o kill É o comportamento — telemetria
        # quebrada não pode deixar o worker congelado vivo até o teto.
        p = pulso(ts=time.time() - 200, cfg=dict(CFG))
        with mock.patch.object(wd.worker_log, "_fase_post",
                               side_effect=OSError("rede caiu")), \
             mock.patch.object(wd.os, "kill") as kill:
            wd._matar(4242, p, 105.0)
        kill.assert_called_once_with(4242, signal.SIGKILL)


class StartWatchdogTest(unittest.TestCase):
    """start_heartbeat sobe o vigia UMA vez, com os argv certos."""

    def setUp(self):
        self._proc = worker_log._WATCHDOG_PROC
        self._started = worker_log._HEARTBEAT_STARTED
        worker_log._WATCHDOG_PROC = None
        worker_log._HEARTBEAT_STARTED = False

    def tearDown(self):
        worker_log._WATCHDOG_PROC = self._proc
        worker_log._HEARTBEAT_STARTED = self._started

    def test_sobe_processo_com_script_pulso_pid_e_stale(self):
        with mock.patch.object(worker_log.threading, "Thread"), \
             mock.patch.object(worker_log.subprocess, "Popen") as popen:
            worker_log.start_heartbeat()
        popen.assert_called_once()
        argv = popen.call_args[0][0]
        self.assertEqual(argv[0], worker_log.sys.executable)
        self.assertTrue(argv[1].endswith("worker_watchdog.py"))
        self.assertEqual(argv[2], worker_log._WATCHDOG_PULSE_PATH)
        self.assertEqual(argv[3], str(os.getpid()))
        # stale = N ticks + margem — a régua de ~105s do cartão (N=3).
        esperado = (worker_log.TTS_WATCHDOG_TICKS * worker_log.TTS_HEARTBEAT_SECONDS
                    + worker_log.TTS_WATCHDOG_MARGEM_S)
        self.assertEqual(float(argv[4]), esperado)

    def test_segunda_chamada_nao_sobe_outro(self):
        with mock.patch.object(worker_log.threading, "Thread"), \
             mock.patch.object(worker_log.subprocess, "Popen") as popen:
            worker_log.start_heartbeat()
            worker_log.start_heartbeat()
        self.assertEqual(popen.call_count, 1)

    def test_ticks_zero_desliga_o_vigia(self):
        with mock.patch.object(worker_log, "TTS_WATCHDOG_TICKS", 0), \
             mock.patch.object(worker_log.threading, "Thread"), \
             mock.patch.object(worker_log.subprocess, "Popen") as popen:
            worker_log.start_heartbeat()
        popen.assert_not_called()

    def test_popen_que_falha_nao_derruba_o_start(self):
        with mock.patch.object(worker_log.threading, "Thread"), \
             mock.patch.object(worker_log.subprocess, "Popen",
                               side_effect=OSError("sem fork")):
            worker_log.start_heartbeat()  # não lança — worker segue como hoje


class IntegracaoProcessoRealTest(unittest.TestCase):
    """worker_watchdog.py como PROCESSO de verdade, matando uma vítima real.

    É o fio inteiro sem mock: pulso velho em disco → vigia (subprocess) →
    SIGKILL na vítima (outro subprocess congelado num sleep). Sem GPU, sem
    rede (o pulso não carrega cfg, então não há POST), em poucos segundos.
    """

    def setUp(self):
        fd, self.path = tempfile.mkstemp(suffix=".json")
        os.close(fd)
        self.vitima = subprocess.Popen(
            [sys.executable, "-c", "import time; time.sleep(60)"])

    def tearDown(self):
        if self.vitima.poll() is None:
            self.vitima.kill()
        self.vitima.wait(timeout=10)
        if os.path.exists(self.path):
            os.unlink(self.path)

    def _rodar_vigia(self, stale_s="1", poll_s="0.2"):
        script = os.path.join(os.path.dirname(os.path.abspath(wd.__file__)),
                              "worker_watchdog.py")
        return subprocess.run(
            [sys.executable, script, self.path, str(self.vitima.pid), stale_s, poll_s],
            capture_output=True, text=True, timeout=30)

    def test_pulso_ativo_velho_mata_a_vitima_e_loga_o_erro_nomeado(self):
        with open(self.path, "w", encoding="utf-8") as f:
            json.dump(pulso(ts=time.time() - 60, cfg=None), f)
        out = self._rodar_vigia()
        self.assertEqual(out.returncode, 1)  # 1 = matou por travado
        self.assertEqual(self.vitima.wait(timeout=10), -signal.SIGKILL)
        # O erro NOMEADO do cartão, no formato de log do worker (1 linha JSON).
        linha = json.loads(out.stdout.strip().splitlines()[-1])
        self.assertEqual(linha["msg"], "phase.watchdog.travado")
        self.assertEqual(linha["meta"]["erro"],
                         "worker travado em inference.chunk.generate chunk 7")

    def test_pulso_idle_velho_nao_mata_e_vigia_sai_quando_o_pai_morre(self):
        with open(self.path, "w", encoding="utf-8") as f:
            json.dump(pulso(ativo=False, ts=time.time() - 60, cfg=None), f)
        vigia = subprocess.Popen(
            [sys.executable,
             os.path.join(os.path.dirname(os.path.abspath(wd.__file__)),
                          "worker_watchdog.py"),
             self.path, str(self.vitima.pid), "1", "0.2"])
        try:
            time.sleep(1.5)  # várias voltas de poll com pulso idle velho
            self.assertIsNone(self.vitima.poll(), "vítima idle foi morta")
            self.vitima.kill()  # o "pai" morre por conta própria…
            self.vitima.wait(timeout=10)
            self.assertEqual(vigia.wait(timeout=10), 0)  # …e o vigia sai em 0
        finally:
            if vigia.poll() is None:
                vigia.kill()
                vigia.wait(timeout=10)


if __name__ == "__main__":
    unittest.main()
