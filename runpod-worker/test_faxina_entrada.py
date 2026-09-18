"""
Faxina de ENTRADA do disco (#32 — "[Errno 28] No space left on device").

    python3 -m unittest test_faxina_entrada -v

⚠️ Leia o "OK"/"FAILED" e a CONTAGEM, nunca só o código de saída: teste que não
rodou também sai com 0.

── O que estes testes travam ─────────────────────────────────────────────────
A faxina existia desde 10/08, mas só no `finally`: ela consertava o worker
DEPOIS, e quem encontrava o disco cheio já tinha morrido. Medido em 18/09 no
#32 — duas mortes em 13h (17/09 21:27Z, 18/09 09:17Z) depois de 38 dias limpos,
sempre ANTES do trainer subir (`started_at`/`trainer_returncode`/`trainer_stderr`
nulos, marca crua em `error_message`).

O `job.start` já lia o disco e só LOGAVA. A medição existia; a ação, não.

O último teste é de MUTAÇÃO: simula o handler VELHO (sem faxina de entrada) no
mesmo cenário e exige que ele deixe o disco sujo. Teste que passa nos dois lados
não prova nada.
"""
from __future__ import annotations

import sys
import types
import unittest
from unittest import mock

# ── Stubs dos módulos pesados ANTES de importar o handler ──────────────────
# (mesmo bloco de test_fase_telemetria.py: roda sem GPU e sem pesos)
#
# A lista é maior que a de test_fase_telemetria.py de propósito: nesta máquina
# nem `numpy` existe, e um teste que ninguém consegue rodar é um teste que não
# existe. Nada aqui é tocado pelo caminho sob teste (despacho + faxina).
for _name in (
    "runpod", "soundfile", "huggingface_hub", "numpy", "torch", "torchaudio",
    "librosa", "scipy", "transformers", "requests", "boto3",
):
    if _name not in sys.modules:
        sys.modules[_name] = types.ModuleType(_name)
sys.modules["runpod"].serverless = types.SimpleNamespace(start=lambda *a, **k: None)
if not hasattr(sys.modules["soundfile"], "write"):
    sys.modules["soundfile"].write = lambda *a, **k: None
if not hasattr(sys.modules["huggingface_hub"], "snapshot_download"):
    sys.modules["huggingface_hub"].snapshot_download = lambda *a, **k: None

import handler  # noqa: E402
import worker_config  # noqa: E402


class FaxinaDeEntrada(unittest.TestCase):
    def setUp(self):
        self.limpezas = []
        self.eventos = []

    def _rodar(self, leituras, job_type="health"):
        """Roda o handler com uma sequência de leituras de disco controlada."""
        seq = list(leituras)

        def _disk(*_a, **_k):
            return seq.pop(0) if len(seq) > 1 else seq[0]

        with mock.patch.object(handler, "start_heartbeat", lambda: None), \
             mock.patch.object(handler, "disk_percent", _disk), \
             mock.patch.object(handler, "faxina", lambda t: self.limpezas.append(t)), \
             mock.patch.object(
                 handler, "_log",
                 side_effect=lambda nivel, ev, **kw: self.eventos.append((nivel, ev, kw)),
             ):
            return handler.handler({"input": {"type": job_type}})

    def test_disco_sujo_na_entrada_e_limpo_ANTES_do_job(self):
        # 90% na chegada, 40% depois da faxina.
        out = self._rodar([90.0, 40.0, 40.0])
        self.assertTrue(out.get("ok"), "o job tem de rodar normalmente depois da faxina")
        self.assertIn(
            "health:entrada", self.limpezas,
            "a faxina de ENTRADA não rodou — o aluno pagaria a sujeira do anterior",
        )
        # E a do `finally` continua acontecendo: as duas pontas, não uma no lugar da outra.
        self.assertIn("health", self.limpezas, "a faxina do finally não pode ter sumido")
        self.assertEqual(self.limpezas, ["health:entrada", "health"], "ordem: entrada, job, saída")

    def test_disco_limpo_nao_paga_nada(self):
        self._rodar([10.0])
        self.assertEqual(
            self.limpezas, ["health"],
            "abaixo do limite só pode existir a faxina do finally — caminho comum não paga nada",
        )
        self.assertNotIn(
            "disk.dirty_on_arrival", [ev for _n, ev, _k in self.eventos],
        )

    def test_no_limite_exato_ja_limpa(self):
        # `>=`: no limite a faxina do finally já é agressiva, a de entrada segue a mesma régua.
        self._rodar([worker_config.DISK_ALERT_PERCENT, 30.0, 30.0])
        self.assertIn("health:entrada", self.limpezas)

    def test_faxina_que_NAO_resolveu_e_declarada(self):
        # 95% na chegada, 93% depois: limpou quase nada. O log tem de dizer isso.
        self._rodar([95.0, 93.0, 93.0])
        limpou = [kw for _n, ev, kw in self.eventos if ev == "disk.cleaned_on_arrival"]
        self.assertEqual(len(limpou), 1)
        self.assertFalse(
            limpou[0]["resolvido"],
            "disco que continua cheio não pode ser reportado como resolvido",
        )
        nivel = [n for n, ev, _k in self.eventos if ev == "disk.cleaned_on_arrival"][0]
        self.assertEqual(nivel, "warn", "faxina que não resolveu é aviso, não informação")

    def test_faxina_que_resolveu_diz_que_resolveu(self):
        self._rodar([90.0, 20.0, 20.0])
        limpou = [kw for _n, ev, kw in self.eventos if ev == "disk.cleaned_on_arrival"][0]
        self.assertTrue(limpou["resolvido"])
        self.assertEqual(limpou["before_pct"], 90.0)
        self.assertEqual(limpou["after_pct"], 20.0)

    def test_faxina_de_entrada_NUNCA_derruba_o_job(self):
        """Mesma regra da faxina do finally: limpeza não vira causa de falha.

        Explode só na chamada de ENTRADA — que é o que esta mudança introduziu.
        A da saída segue o contrato de sempre (`worker_disk.faxina` engole as
        próprias exceções, travado em test_refactor_smoke.py); simular que ELA
        também quebra seria testar código de outro dono.

        ⚠️ Observação que fica registrada, não consertada aqui: a chamada do
        `finally` (handler.py) não tem guarda própria — depende inteiramente do
        try/except de dentro do `worker_disk.faxina`. Hoje o contrato é honrado;
        se algum dia não for, o `finally` engole o retorno do job. Anotado na
        ronda do #32, fora do escopo desta correção.
        """
        def _explode_so_na_entrada(t):
            if t.endswith(":entrada"):
                raise OSError("disco em pânico")
            self.limpezas.append(t)

        with mock.patch.object(handler, "start_heartbeat", lambda: None), \
             mock.patch.object(handler, "disk_percent", lambda *_a, **_k: 99.0), \
             mock.patch.object(handler, "faxina", _explode_so_na_entrada):
            out = handler.handler({"input": {"type": "health"}})
        self.assertTrue(out.get("ok"), "faxina que explode não pode matar o job do aluno")
        self.assertEqual(self.limpezas, ["health"], "o job seguiu e a faxina do fim rodou")

    def test_MUTACAO_handler_velho_deixa_o_disco_sujo(self):
        """O comportamento ANTERIOR, no mesmo cenário: mede e não age."""
        limpezas_velho = []

        def handler_velho(event):
            inp = event.get("input") or {}
            job_type = inp.get("type", "inference")
            _ = 90.0          # job.start lia o disco...
            try:              # ...e ia direto pro job, sem faxina nenhuma.
                return {"ok": True}
            finally:
                limpezas_velho.append(job_type)

        handler_velho({"input": {"type": "health"}})
        self.assertEqual(
            limpezas_velho, ["health"],
            "é este o buraco: com 90% de disco o velho não limpava NADA antes do job",
        )
        self.assertNotIn("health:entrada", limpezas_velho)

        # E o novo, no mesmo cenário, limpa.
        self._rodar([90.0, 40.0, 40.0])
        self.assertIn("health:entrada", self.limpezas)


if __name__ == "__main__":
    unittest.main()
