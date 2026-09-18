"""
Despejo dos acumuladores de disco (#32 — "[Errno 28] No space left on device").

    python3 -m unittest test_faxina_despejo -v

⚠️ Leia o "OK"/"FAILED" e a CONTAGEM, nunca só o código de saída: teste que não
rodou também sai com 0.

── O que estes testes travam ─────────────────────────────────────────────────
A faxina de 10/08 recuperava TEMPORÁRIO e CACHE DE COMPILAÇÃO. Medido no código
em 18/09 (grep de rmtree/unlink/purge_dir em runpod-worker/, fora de testes: as
únicas deleções são as de `worker_disk.purge_dir` e a de `jobs/train.py:121`),
três coisas nunca eram apagadas por ninguém:

  (a) WORKSPACE/<voice_id>/      área de UM treino. O único rmtree dela é o
      `_limpar_area` (jobs/train.py:119-122), que roda ANTES do treino e SÓ pra
      própria voice_id — `run()` não tem finally e todo return sai direto.
  (b) LORA_CACHE_DIR/<hash>_...  LoRA baixada pela inferência
      (jobs/inference_setup.py:22 -> downloads.py:20), com "se já existe,
      reusa" DE PROPÓSITO e sem despejo nenhum.
  (c) WORKSPACE/refs/<hash>_... + o ..._tail<N>.wav ao lado: referência baixada
      (jobs/inference_setup.py:66) e cópia acolchoada (linha 36).

Três acumuladores MONOTÔNICOS num disco de 50GB sem volume de rede
(containerDiskInGb: 50, volumeInGb: 0). O piso sobe até o primeiro job não
caber — 13 dias limpos e depois 5 falhas em 18h, que é a forma observada.

O teste mais importante deste arquivo é `test_area_do_job_EM_EXECUCAO_sobrevive`:
apagar a área do treino corrente derruba o aluno que está treinando agora, que é
a falha mais grave possível nesta mudança.

O último teste é de MUTAÇÃO: roda a faxina ANTIGA no mesmo cenário e exige que
ela deixe o disco sujo. Teste que passa nos dois lados não prova nada.
"""
from __future__ import annotations

import os
import sys
import shutil
import tempfile
import types
import unittest
from pathlib import Path
from unittest import mock

# ── Stubs dos módulos pesados ANTES de importar ────────────────────────────
# (mesmo bloco de test_faxina_entrada.py: nesta máquina nem `numpy` existe, e um
# teste que ninguém consegue rodar é um teste que não existe. Nada aqui é tocado
# pelo caminho sob teste — só disco e Path.)
for _name in (
    "runpod", "soundfile", "huggingface_hub", "numpy", "torch", "torchaudio",
    "librosa", "scipy", "transformers", "requests", "boto3",
):
    if _name not in sys.modules:
        sys.modules[_name] = types.ModuleType(_name)
sys.modules["runpod"].serverless = types.SimpleNamespace(start=lambda *a, **k: None)

# -- Ambiente de teste ANTES de importar (worker_config lê env no import) ----
# Só vale se ESTE módulo for o primeiro a importar `worker_config` — rodando a
# suíte inteira num processo só, quem importa primeiro é outro arquivo e estas
# envs são ignoradas. Por isso os testes NÃO dependem delas: cada caso aponta o
# `worker_disk` pra uma árvore própria (ver `setUp`). Isto aqui é só pra evitar
# que um import solto tente criar /workspace na máquina de quem roda.
_TMP = Path(tempfile.mkdtemp(prefix="worker_despejo_"))
os.environ.setdefault("WORKSPACE_DIR", str(_TMP / "jobs"))
os.environ.setdefault("JOB_TMP_DIR", str(_TMP / "tmp" / "jobs"))
os.environ.setdefault("TORCHINDUCTOR_CACHE_DIR", str(_TMP / "tmp" / "inductor"))
os.environ.setdefault("LORA_CACHE_DIR", str(_TMP / "loras"))
os.environ.setdefault("VOXCPM_MODEL_DIR", str(_TMP / "models" / "VoxCPM2"))

import worker_disk  # noqa: E402

VELHO = worker_disk.DESPEJO_IDADE_MINIMA_S + 3600  # bem fora da janela de folga


def _envelhecer(p: Path, segundos_atras: float, agora: float) -> None:
    ts = agora - segundos_atras
    os.utime(p, (ts, ts))


def _arquivo(p: Path, bytes_: int = 1024) -> Path:
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_bytes(b"x" * bytes_)
    return p


class DespejoBase(unittest.TestCase):
    """Cada caso roda numa árvore PRÓPRIA, apontada por patch no `worker_disk`.

    O despejo APAGA de verdade, então o teste não pode herdar o disco do caso
    anterior — e, mais importante, não pode apagar o disco de OUTRO arquivo de
    teste. `worker_config` é importado uma vez só no processo: rodando a suíte
    inteira de uma vez, os diretórios de `worker_config` pertencem a quem
    importou primeiro (test_refactor_smoke.py, por exemplo). Limpar aquilo no
    `setUp` derruba a suíte do vizinho — medido, 16 falhas.
    """

    def setUp(self):
        self.raiz = Path(tempfile.mkdtemp(prefix="despejo_caso_"))
        self.addCleanup(shutil.rmtree, self.raiz, ignore_errors=True)
        self.workspace = self.raiz / "jobs"
        self.loras = self.raiz / "loras"
        self.modelo = self.raiz / "models" / "VoxCPM2"
        self.job_tmp = self.raiz / "tmp" / "jobs"
        self.inductor = self.raiz / "tmp" / "inductor"
        for d in (self.workspace, self.loras, self.modelo, self.job_tmp, self.inductor):
            d.mkdir(parents=True, exist_ok=True)
        for nome, valor in (
            ("WORKSPACE", self.workspace),
            ("LORA_CACHE_DIR", self.loras),
            ("MODEL_DIR", self.modelo),
            ("JOB_TMP", self.job_tmp),
            ("INDUCTOR_CACHE", self.inductor),
        ):
            remendo = mock.patch.object(worker_disk, nome, valor)
            remendo.start()
            self.addCleanup(remendo.stop)
        worker_disk._EM_USO.clear()
        self.addCleanup(worker_disk._EM_USO.clear)
        self.agora = 1_700_000_000.0
        self.eventos = []

    def _area_de_treino(self, voice_id: str) -> Path:
        """Um WORKSPACE/<voice_id>/ com a cara do que o treino deixa pra trás."""
        area = self.workspace / voice_id
        for sub in ("raw", "vocals", "norm", "dataset", "lora_runs"):
            _arquivo(area / sub / "sobra.bin")
        return area

    def _disco(self, sequencia):
        """disk_percent() controlado: devolve o próximo, repete o último."""
        seq = list(sequencia)

        def _ler(*_a, **_k):
            return seq.pop(0) if len(seq) > 1 else seq[0]

        return _ler

    def _capturar_log(self):
        return mock.patch.object(
            worker_disk, "_log",
            side_effect=lambda nivel, ev, **kw: self.eventos.append((nivel, ev, kw)),
        )


class Despejo(DespejoBase):
    def test_apaga_do_mais_VELHO_pro_mais_novo(self):
        antiga = self._area_de_treino("voz-antiga")
        media = self._area_de_treino("voz-media")
        recente = self._area_de_treino("voz-recente")
        _envelhecer(antiga, VELHO + 3000, self.agora)
        _envelhecer(media, VELHO + 2000, self.agora)
        _envelhecer(recente, VELHO + 1000, self.agora)

        # 90% até liberar duas áreas; aí volta pra 40%.
        with mock.patch.object(worker_disk, "disk_percent",
                               self._disco([90.0, 90.0, 40.0])):
            conta = worker_disk.despejar(75.0, agora=self.agora)

        self.assertEqual(conta["removidos"], 2, conta)
        self.assertFalse(antiga.exists(), "a área mais VELHA tinha de sair primeiro")
        self.assertFalse(media.exists(), "a segunda mais velha também")
        self.assertTrue(
            recente.exists(),
            "parou cedo demais? não: o disco voltou abaixo do limite, e aí o "
            "despejo PARA — não apaga tudo de uma vez",
        )

    def test_para_assim_que_o_disco_volta(self):
        for i in range(5):
            _envelhecer(self._area_de_treino(f"voz-{i}"), VELHO + i, self.agora)
        # Já abaixo do limite na primeira leitura: nada a fazer.
        with mock.patch.object(worker_disk, "disk_percent", lambda *_a, **_k: 50.0):
            conta = worker_disk.despejar(75.0, agora=self.agora)
        self.assertEqual(conta["removidos"], 0)
        self.assertEqual(len(list(self.workspace.iterdir())), 5)

    def test_os_TRES_acumuladores_entram_no_despejo(self):
        alvos = {
            # (a) área de treino
            "area": self._area_de_treino("voz-a"),
            # (b) LoRA cacheada por hash de URL
            "lora": _arquivo(self.loras / "abc123_lora.safetensors"),
            # (c) referência baixada e a cópia acolchoada, ao lado
            "ref": _arquivo(self.workspace / "refs" / "def456_ref.wav"),
            "tail": _arquivo(self.workspace / "refs" / "def456_ref_tail700.wav"),
            # achados na mesma medição, mesmo tipo de sobra
            "transcribe": _arquivo(self.workspace / "transcribe" / "ghi_audio.wav"),
            "gen": _arquivo(self.workspace / "gen_1700000000000.wav"),
        }
        for alvo in alvos.values():
            _envelhecer(alvo, VELHO, self.agora)

        with mock.patch.object(worker_disk, "disk_percent", lambda *_a, **_k: 99.0):
            conta = worker_disk.despejar(75.0, agora=self.agora)

        for nome, alvo in alvos.items():
            self.assertFalse(alvo.exists(), f"o acumulador '{nome}' sobreviveu ao despejo")
        self.assertEqual(conta["removidos"], len(alvos), conta)
        self.assertGreater(conta["liberado"], 0)

    def test_novo_demais_NAO_e_despejado(self):
        """Rede de segurança pra caminho que ninguém registrou em `area_em_uso`."""
        fresca = self._area_de_treino("voz-de-agora")
        _envelhecer(fresca, 10, self.agora)  # tocada 10s atrás
        with mock.patch.object(worker_disk, "disk_percent", lambda *_a, **_k: 99.0):
            conta = worker_disk.despejar(75.0, agora=self.agora)
        self.assertTrue(fresca.exists())
        self.assertEqual(conta["novos"], 1, conta)
        self.assertEqual(conta["removidos"], 0)

    def test_modelo_base_NAO_e_tocado(self):
        """Rebaixar o modelo é caro e o Dockerfile aponta VOXCPM_MODEL_DIR pra lá."""
        modelo = _arquivo(self.modelo / "pesos.safetensors", 4096)
        _envelhecer(modelo, VELHO * 10, self.agora)
        _envelhecer(self.modelo, VELHO * 10, self.agora)
        with mock.patch.object(worker_disk, "disk_percent", lambda *_a, **_k: 99.0):
            worker_disk.despejar(75.0, agora=self.agora)
        self.assertTrue(modelo.exists(), "o despejo entrou no diretório do modelo base")

    def test_modelo_base_DENTRO_do_workspace_tambem_e_poupado(self):
        """REQUISITO 6 por regra, não por sorte do caminho.

        Hoje MODEL_DIR fica fora das raízes por endereço. Basta apontar
        WORKSPACE_DIR pra /workspace pra que ele vire filho de uma raiz — e aí
        o despejo rebaixaria o modelo base, que é caro de baixar de novo.
        """
        modelo = self.workspace / "models" / "VoxCPM2"
        _arquivo(modelo / "pesos.safetensors", 4096)
        _envelhecer(modelo.parent, VELHO * 10, self.agora)
        with mock.patch.object(worker_disk, "MODEL_DIR", modelo), \
             mock.patch.object(worker_disk, "disk_percent", lambda *_a, **_k: 99.0):
            worker_disk.despejar(75.0, agora=self.agora)
        self.assertTrue((modelo / "pesos.safetensors").exists(),
                        "o despejo rebaixou o modelo base")

    def test_falha_de_remocao_e_CONTADA_nao_engolida(self):
        """`purge_dir` engole exceção e segue; aqui a falha tem de aparecer."""
        alvo = self._area_de_treino("voz-travada")
        _envelhecer(alvo, VELHO, self.agora)
        with mock.patch.object(worker_disk, "disk_percent", lambda *_a, **_k: 99.0), \
             mock.patch.object(worker_disk.shutil, "rmtree",
                               side_effect=OSError("disco em pânico")):
            conta = worker_disk.despejar(75.0, agora=self.agora)
        self.assertEqual(conta["falhas"], 1, conta)
        self.assertEqual(conta["removidos"], 0)
        self.assertTrue(alvo.exists())


class JobEmExecucao(DespejoBase):
    def test_area_do_job_EM_EXECUCAO_sobrevive(self):
        """REQUISITO 1. Apagar a área do treino corrente derruba o aluno que
        está treinando AGORA — a falha mais grave possível nesta mudança.

        A área é envelhecida de propósito: um treino leva dezenas de minutos e o
        mtime do diretório fica lá atrás, no começo do job. Ou seja, a folga de
        idade NÃO salva este caso; só a proteção explícita salva. E o disco fica
        em 99% o tempo todo, então o despejo quer levar tudo que puder.
        """
        corrente = self._area_de_treino("voz-treinando-agora")
        velha = self._area_de_treino("voz-de-ontem")
        _envelhecer(corrente, VELHO, self.agora)
        _envelhecer(velha, VELHO + 10, self.agora)

        with worker_disk.area_em_uso(corrente):
            with mock.patch.object(worker_disk, "disk_percent", lambda *_a, **_k: 99.0):
                conta = worker_disk.despejar(75.0, agora=self.agora)

        self.assertTrue(
            corrente.exists(),
            "O DESPEJO APAGOU A ÁREA DO TREINO EM EXECUÇÃO — derrubaria o aluno",
        )
        self.assertTrue((corrente / "dataset" / "sobra.bin").exists(),
                        "a área sobreviveu vazia: o conteúdo do job foi levado")
        self.assertFalse(velha.exists(), "a área VELHA tinha de sair normalmente")
        self.assertEqual(conta["protegidos"], 1, conta)

    def test_protecao_cobre_o_PAI_e_o_FILHO_do_caminho_em_uso(self):
        """Apagar o pai da área ou um pedaço dela derruba o job igual."""
        area = self._area_de_treino("voz-x")
        _envelhecer(area, VELHO, self.agora)
        dataset = area / "dataset"

        # Protege um FILHO: o pai (a área) não pode ser apagado por cima.
        with worker_disk.area_em_uso(dataset):
            with mock.patch.object(worker_disk, "disk_percent", lambda *_a, **_k: 99.0):
                worker_disk.despejar(75.0, agora=self.agora)
        self.assertTrue(dataset.exists(), "apagou o PAI e levou junto o que estava em uso")

        # E protegendo o PAI, o filho segue de pé.
        with worker_disk.area_em_uso(area):
            with mock.patch.object(worker_disk, "disk_percent", lambda *_a, **_k: 99.0):
                worker_disk.despejar(75.0, agora=self.agora)
        self.assertTrue(dataset.exists())

    def test_dois_jobs_na_mesma_LoRA_nao_se_desprotegem(self):
        """Concurrency > 1: o primeiro a sair não pode desproteger o outro."""
        lora = _arquivo(self.loras / "hash_lora.safetensors")
        _envelhecer(lora, VELHO, self.agora)
        with worker_disk.area_em_uso(lora):
            with worker_disk.area_em_uso(lora):
                pass  # job A terminou; job B ainda está usando
            with mock.patch.object(worker_disk, "disk_percent", lambda *_a, **_k: 99.0):
                worker_disk.despejar(75.0, agora=self.agora)
            self.assertTrue(lora.exists(), "o job que saiu levou a proteção do que ficou")
        # Fora dos dois blocos, deixa de ser protegida.
        self.assertEqual(worker_disk.em_uso(), set())

    def test_registro_e_liberado_mesmo_com_excecao(self):
        area = self._area_de_treino("voz-que-explode")
        with self.assertRaises(RuntimeError):
            with worker_disk.area_em_uso(area):
                raise RuntimeError("job estourou")
        self.assertEqual(worker_disk.em_uso(), set(),
                         "job que morreu deixou a área protegida pra sempre")


class FaxinaIntegrada(DespejoBase):
    """A faxina inteira: mesma régua, mesma chamada, sem env nova."""

    def test_abaixo_do_limite_o_despejo_NAO_roda(self):
        area = self._area_de_treino("voz-a")
        _envelhecer(area, VELHO, self.agora)
        with mock.patch.object(worker_disk, "disk_percent", lambda *_a, **_k: 10.0), \
             self._capturar_log():
            worker_disk.faxina("train")
        self.assertTrue(area.exists(), "despejou com o disco vazio — caminho comum pagando")
        self.assertNotIn("disk.despejo", [ev for _n, ev, _k in self.eventos])

    def test_acima_do_limite_despeja_e_declara_que_RESOLVEU(self):
        area = self._area_de_treino("voz-a")
        _envelhecer(area, VELHO, self.agora)
        # antes=90 -> pós purge_dir=90 (ainda cheio) -> despejo -> 30.
        with mock.patch.object(worker_disk, "disk_percent",
                               self._disco([90.0, 90.0, 90.0, 30.0])), \
             mock.patch.object(worker_disk.time, "time", lambda: self.agora), \
             self._capturar_log():
            worker_disk.faxina("train")
        despejos = [kw for _n, ev, kw in self.eventos if ev == "disk.despejo"]
        self.assertEqual(len(despejos), 1, self.eventos)
        self.assertTrue(despejos[0]["resolvido"])
        self.assertEqual(despejos[0]["removidos"], 1)
        self.assertFalse(area.exists())

    def test_despejo_que_NAO_resolveu_e_declarado(self):
        """REQUISITO 4: disco que segue cheio não pode ser reportado resolvido."""
        with mock.patch.object(worker_disk, "disk_percent", lambda *_a, **_k: 97.0), \
             mock.patch.object(worker_disk.time, "time", lambda: self.agora), \
             self._capturar_log():
            worker_disk.faxina("train")
        despejo = [(n, kw) for n, ev, kw in self.eventos if ev == "disk.despejo"]
        self.assertEqual(len(despejo), 1, self.eventos)
        nivel, kw = despejo[0]
        self.assertFalse(kw["resolvido"],
                         "disco cheio reportado como resolvido — é o defeito que o #338 pegou")
        self.assertEqual(nivel, "warn", "despejo que não resolveu é aviso, não informação")

    def test_faxina_NUNCA_derruba_o_job_se_o_despejo_explodir(self):
        """REQUISITO 5: limpeza não pode virar causa de falha."""
        with mock.patch.object(worker_disk, "disk_percent", lambda *_a, **_k: 99.0), \
             mock.patch.object(worker_disk, "despejar",
                               side_effect=OSError("disco em pânico")), \
             self._capturar_log():
            worker_disk.faxina("train")  # não pode levantar
        falhou = [kw for _n, ev, kw in self.eventos if ev == "disk.cleanup_failed"]
        self.assertEqual(len(falhou), 1, "a falha tem de aparecer no log, não sumir")

    def test_despejar_sozinho_nunca_levanta(self):
        with mock.patch.object(worker_disk, "_candidatos",
                               side_effect=OSError("iterdir morreu")), \
             mock.patch.object(worker_disk, "disk_percent", lambda *_a, **_k: 99.0):
            conta = worker_disk.despejar(75.0, agora=self.agora)
        self.assertIn("erro", conta)
        self.assertEqual(conta["removidos"], 0)

    def test_MUTACAO_faxina_ANTIGA_deixa_os_acumuladores_no_disco(self):
        """O comportamento ANTERIOR, no mesmo cenário: limpa temp/cache e deixa
        os três acumuladores intactos. É este o buraco do #32."""
        alvos = [
            self._area_de_treino("voz-a"),
            _arquivo(self.loras / "abc_lora.safetensors"),
            _arquivo(self.workspace / "refs" / "def_ref.wav"),
        ]
        for alvo in alvos:
            _envelhecer(alvo, VELHO, self.agora)
        lixo_temp = _arquivo(self.job_tmp / "temporario.wav")

        def faxina_antiga(job_type: str) -> None:
            """Cópia fiel da faxina de 10/08 (origin/main antes desta mudança)."""
            antes = worker_disk.disk_percent()
            worker_disk.purge_dir(self.job_tmp)
            if antes >= worker_disk.DISK_ALERT_PERCENT:
                worker_disk.purge_dir(self.inductor)

        with mock.patch.object(worker_disk, "disk_percent", lambda *_a, **_k: 95.0):
            faxina_antiga("train")

        self.assertFalse(lixo_temp.exists(), "a faxina antiga limpava o temporário, sim")
        for alvo in alvos:
            self.assertTrue(
                alvo.exists(),
                f"a faxina ANTIGA teria apagado {alvo.name}? então o teste não prova nada",
            )

        # E a NOVA, no mesmo cenário, leva os três.
        with mock.patch.object(worker_disk, "disk_percent", lambda *_a, **_k: 95.0), \
             mock.patch.object(worker_disk.time, "time", lambda: self.agora), \
             self._capturar_log():
            worker_disk.faxina("train")
        for alvo in alvos:
            self.assertFalse(alvo.exists(), f"o despejo não levou {alvo.name}")


if __name__ == "__main__":
    unittest.main()
