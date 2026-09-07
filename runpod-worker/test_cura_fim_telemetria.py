"""Telemetria da CURA DO FIM ABRUPTO (#234) — as cinco saídas silenciosas.

POR QUE ESTE ARQUIVO EXISTE (medido na ronda de 06/09):
a cura `_curar_fim_abrupto` só entrega resultado em 9 de 154 gerações que
tiveram a fronteira final reprovada desde 26/08 — 5,8%. Nos outros 94% ela sai
por uma de CINCO portas que faziam `return seg` sem registrar absolutamente
nada. Só o sucesso (`tail_healed`) tinha contador.

O custo disso: era impossível distinguir

  "a cura nem foi chamada"        (o gate de entrada não disparou)
  "o whisper não achou a palavra" (a isca não foi reconhecida)
  "curou e continuou ruim"        (o corte não resolveu)

e cada um desses é um conserto DIFERENTE. Ficamos 11 dias escolhendo no escuro.

O QUE ESTES TESTES TRAVAM:
  1. cada uma das cinco saídas incrementa o SEU contador, e só ele;
  2. o contador de chamada (`tail_cura_tentada`) sobe na ENTRADA — sem ele o
     primeiro galho da árvore de diagnóstico não existe;
  3. a CONTA FECHA: tentada = soma dos 5 bails + tail_healed;
  4. os campos NASCEM EM ZERO junto com os irmãos (campo ausente é
     indistinguível de "mediu e deu zero" — a armadilha já documentada em
     `registrar_tail_interno`);
  5. a telemetria é PURA: não muda áudio entregue nem decisão nenhuma.

    cd runpod-worker && python test_cura_fim_telemetria.py -v
"""
import os
import sys
import tempfile
import types
import unittest
from pathlib import Path

import numpy as np

# -- Ambiente ANTES de importar (worker_config lê env no import) -------------
_TMP = Path(tempfile.mkdtemp(prefix="cura_telemetria_"))
os.environ.setdefault("WORKSPACE_DIR", str(_TMP / "jobs"))
os.environ.setdefault("JOB_TMP_DIR", str(_TMP / "tmp"))
os.environ.setdefault("LORA_CACHE_DIR", str(_TMP / "loras"))
os.environ.setdefault("VOXCPM_MODEL_DIR", str(_TMP / "model"))


def _stub_se_faltar(nome: str, fabrica) -> None:
    """Só stuba o que NÃO existe.

    Na imagem real do worker estas libs existem e devem ser as de verdade; na
    máquina de teste (sem GPU, sem huggingface) elas faltam e não têm nenhum
    papel neste teste — o alvo aqui é aritmética de contador, não modelo.
    """
    try:
        __import__(nome)
    except ImportError:
        sys.modules[nome] = fabrica()


def _hf():
    m = types.ModuleType("huggingface_hub")
    m.snapshot_download = lambda *a, **k: None
    return m


def _soundfile():
    m = types.ModuleType("soundfile")
    m.write = lambda *a, **k: None
    return m


def _runpod():
    m = types.ModuleType("runpod")
    m.serverless = types.SimpleNamespace(start=lambda *a, **k: None)
    return m


_stub_se_faltar("huggingface_hub", _hf)
_stub_se_faltar("soundfile", _soundfile)
_stub_se_faltar("runpod", _runpod)

from jobs import inference as ji  # noqa: E402

SR = 16000

# Os seis desfechos possíveis da cura, na ordem em que aparecem na função.
BAILS = ("tail_cura_bail_sem_alvo", "tail_cura_bail_sem_palavra",
         "tail_cura_bail_sem_fim", "tail_cura_bail_corte_invalido",
         "tail_cura_bail_ainda_ruim")


def _fala(dur_s: float = 1.0, amp: float = 0.1) -> np.ndarray:
    """Áudio plano: energia alta até o último sample = decepado."""
    return np.ones(int(SR * dur_s), dtype=np.float32) * amp


def _com_decaimento(dur_s: float = 1.0, decai_ms: int = 400,
                    amp: float = 0.1) -> np.ndarray:
    """Fala que se apaga sozinha — o fim que o QA aprova."""
    w = _fala(dur_s, amp)
    n = min(int(SR * decai_ms / 1000), w.size)
    w[-n:] *= np.linspace(1.0, 0.0, n, dtype=np.float32)
    return w


class _CuraBase(unittest.TestCase):
    """Monta o job com o gerador e o whisper sob controle.

    `palavras_com_tempo` é módulo-global em `jobs.inference`; trocamos e
    RESTAURAMOS no tearDown — os testes antigos deste repo trocavam sem
    restaurar e o vazamento contaminava quem rodasse depois.
    """

    def setUp(self):
        self._orig_palavras = ji.palavras_com_tempo

    def tearDown(self):
        ji.palavras_com_tempo = self._orig_palavras

    def _job(self, gerado, palavras, qa_stats=None):
        class Fake(ji.InferenceJob):
            ISCA = "Muito obrigada."

            def __init__(self):
                self.sample_rate = SR
                # dict VAZIO de propósito: o acumulador não pode depender da
                # inicialização do __init__ real pra não estourar KeyError.
                self.qa_stats = {} if qa_stats is None else qa_stats
                self.cfg = type("C", (), {"echo_qa_model": "small",
                                          "qa_language": "pt"})()

            def _gerar(self, chunk, idx):
                self.chunk_pedido = chunk
                return gerado

            def _aparar(self, x, idx):
                return x

        ji.palavras_com_tempo = lambda *a, **k: palavras
        return Fake()

    def _assert_so_contou(self, stats: dict, esperado: str):
        """O desfecho esperado vale 1; os outros cinco continuam zerados."""
        self.assertEqual(stats.get("tail_cura_tentada"), 1,
                         "a chamada tem que ser contada na ENTRADA")
        self.assertEqual(stats.get(esperado), 1, f"{esperado} não foi contado")
        outros = [b for b in BAILS if b != esperado]
        for b in outros:
            self.assertEqual(stats.get(b, 0), 0, f"{b} contou indevidamente")
        if esperado != "tail_healed":
            self.assertEqual(stats.get("tail_healed", 0), 0,
                             "bail não pode contar como cura")


class CincoSaidasSilenciosasTest(_CuraBase):
    """Uma classe por porta: cada `return seg` do 94% agora deixa rastro."""

    # (1) :308  `if not alvo:` — chunk vazio, nem chega a gerar ─────────────
    def test_chunk_vazio_conta_sem_alvo(self):
        job = self._job(_fala(), [])
        seg = _fala()
        self.assertIs(job._curar_fim_abrupto(seg, 0, "   "), seg,
                      "telemetria não pode mudar o áudio devolvido")
        self._assert_so_contou(job.qa_stats, "tail_cura_bail_sem_alvo")

    # (2) :316  `len(palavras) <= n_isca` — whisper não viu palavra além da isca
    def test_whisper_so_viu_a_isca_conta_sem_palavra(self):
        job = self._job(_fala(1.0), [{"word": "Muito", "start": 0.1, "end": 0.3},
                                     {"word": "obrigada", "start": 0.3, "end": 0.7}])
        original = _fala(2.0)
        self.assertIs(job._curar_fim_abrupto(original, 0, "sua nutricionista."),
                      original)
        self._assert_so_contou(job.qa_stats, "tail_cura_bail_sem_palavra")

    # (3) :321  `if fim_s is None:` — palavra sem timestamp de fim ──────────
    def test_palavra_sem_timestamp_conta_sem_fim(self):
        # a palavra do aluno (a antepenúltima) não tem "end"
        palavras = [{"word": "nutricionista", "start": 0.15},
                    {"word": "Muito", "start": 0.9, "end": 1.05},
                    {"word": "obrigada", "start": 1.05, "end": 1.40}]
        job = self._job(_com_decaimento(1.5), palavras)
        original = _fala(2.0)
        self.assertIs(job._curar_fim_abrupto(original, 0, "sua nutricionista."),
                      original)
        self._assert_so_contou(job.qa_stats, "tail_cura_bail_sem_fim")

    # (4) :325  `if corte <= 0:` — corte calculado inválido ─────────────────
    def test_audio_gerado_vazio_conta_corte_invalido(self):
        """`corte` é limitado por `bruto.size`: geração vazia zera o corte.

        É o caso real de uma geração que volta sem amostra nenhuma — o corte
        cai pra 0 e cortar ali entregaria silêncio.
        """
        palavras = [{"word": "nutricionista", "start": 0.15, "end": 0.60},
                    {"word": "Muito", "start": 0.9, "end": 1.05},
                    {"word": "obrigada", "start": 1.05, "end": 1.40}]
        job = self._job(np.zeros(0, dtype=np.float32), palavras)
        original = _fala(2.0)
        self.assertIs(job._curar_fim_abrupto(original, 0, "sua nutricionista."),
                      original)
        self._assert_so_contou(job.qa_stats, "tail_cura_bail_corte_invalido")

    def test_timestamp_negativo_tambem_conta_corte_invalido(self):
        """Whisper devolvendo fim negativo: `int((-0.5+0.12)*SR)` é negativo."""
        palavras = [{"word": "nutricionista", "start": -0.9, "end": -0.5},
                    {"word": "Muito", "start": 0.9, "end": 1.05},
                    {"word": "obrigada", "start": 1.05, "end": 1.40}]
        job = self._job(_com_decaimento(1.5), palavras)
        original = _fala(2.0)
        self.assertIs(job._curar_fim_abrupto(original, 0, "sua nutricionista."),
                      original)
        self._assert_so_contou(job.qa_stats, "tail_cura_bail_corte_invalido")

    # (5) :328  `if self._fim_ainda_ruim(candidato):` — curou e continuou ruim
    def test_corte_que_continua_decepado_conta_ainda_ruim(self):
        """Tudo plano: o corte sai tão decepado quanto entrou."""
        palavras = [{"word": "nutricionista", "start": 0.2, "end": 0.60},
                    {"word": "Muito", "start": 0.9, "end": 1.0},
                    {"word": "obrigada", "start": 1.0, "end": 1.15}]
        job = self._job(_fala(1.5), palavras)
        original = _fala(2.0)
        self.assertIs(job._curar_fim_abrupto(original, 0, "sua nutricionista."),
                      original)
        self._assert_so_contou(job.qa_stats, "tail_cura_bail_ainda_ruim")

    # (6) o SUCESSO continua contando como sempre contou ────────────────────
    def test_sucesso_conta_healed_e_nenhum_bail(self):
        gerado = np.concatenate([
            _com_decaimento(0.60), np.zeros(int(SR * 0.25), dtype=np.float32),
            _com_decaimento(0.40),
        ])
        palavras = [{"word": "nutricionista", "start": 0.15, "end": 0.60},
                    {"word": "Muito", "start": 0.9, "end": 1.05},
                    {"word": "obrigada", "start": 1.05, "end": 1.40}]
        job = self._job(gerado, palavras)
        curado = job._curar_fim_abrupto(_fala(), 0, "sua nutricionista.")
        self.assertLess(curado.size, gerado.size, "cortou a isca fora")
        self._assert_so_contou(job.qa_stats, "tail_healed")


class ContaFechaTest(_CuraBase):
    """tentada = soma dos 5 bails + tail_healed. É o que torna a série legível:
    se a conta não fechar, existe uma saída sem rastro que ninguém mapeou."""

    def _todos_os_desfechos(self, stats: dict) -> None:
        """Roda os SEIS desfechos acumulando no MESMO qa_stats."""
        # (1) sem alvo
        self._job(_fala(), [], stats)._curar_fim_abrupto(_fala(), 0, "  ")
        # (2) sem palavra
        self._job(_fala(1.0), [{"word": "Muito", "start": 0.1, "end": 0.3},
                               {"word": "obrigada", "start": 0.3, "end": 0.7}],
                  stats)._curar_fim_abrupto(_fala(2.0), 0, "sua nutricionista.")
        # (3) sem fim
        self._job(_com_decaimento(1.5),
                  [{"word": "nutricionista", "start": 0.15},
                   {"word": "Muito", "start": 0.9, "end": 1.05},
                   {"word": "obrigada", "start": 1.05, "end": 1.40}],
                  stats)._curar_fim_abrupto(_fala(2.0), 0, "sua nutricionista.")
        # (4) corte inválido
        self._job(np.zeros(0, dtype=np.float32),
                  [{"word": "nutricionista", "start": 0.15, "end": 0.60},
                   {"word": "Muito", "start": 0.9, "end": 1.05},
                   {"word": "obrigada", "start": 1.05, "end": 1.40}],
                  stats)._curar_fim_abrupto(_fala(2.0), 0, "sua nutricionista.")
        # (5) ainda ruim
        self._job(_fala(1.5),
                  [{"word": "nutricionista", "start": 0.2, "end": 0.60},
                   {"word": "Muito", "start": 0.9, "end": 1.0},
                   {"word": "obrigada", "start": 1.0, "end": 1.15}],
                  stats)._curar_fim_abrupto(_fala(2.0), 0, "sua nutricionista.")
        # (6) sucesso
        gerado = np.concatenate([
            _com_decaimento(0.60), np.zeros(int(SR * 0.25), dtype=np.float32),
            _com_decaimento(0.40),
        ])
        self._job(gerado,
                  [{"word": "nutricionista", "start": 0.15, "end": 0.60},
                   {"word": "Muito", "start": 0.9, "end": 1.05},
                   {"word": "obrigada", "start": 1.05, "end": 1.40}],
                  stats)._curar_fim_abrupto(_fala(), 0, "sua nutricionista.")

    def test_soma_dos_desfechos_bate_com_as_chamadas(self):
        stats: dict = {}
        self._todos_os_desfechos(stats)
        self.assertEqual(stats["tail_cura_tentada"], 6, "seis chamadas")
        soma_bails = sum(stats.get(b, 0) for b in BAILS)
        self.assertEqual(soma_bails, 5, "cinco saídas silenciosas, uma cada")
        self.assertEqual(stats.get("tail_healed", 0), 1)
        self.assertEqual(stats["tail_cura_tentada"],
                         soma_bails + stats.get("tail_healed", 0),
                         "tentada = bails + healed; sobra = saída sem rastro")

    def test_cada_bail_aparece_exatamente_uma_vez(self):
        stats: dict = {}
        self._todos_os_desfechos(stats)
        for b in BAILS:
            self.assertEqual(stats.get(b, 0), 1, b)

    def test_conta_fecha_tambem_repetindo_o_mesmo_desfecho(self):
        """O acumulador soma, não sobrescreve."""
        stats: dict = {}
        for _ in range(3):
            self._job(_fala(), [], stats)._curar_fim_abrupto(_fala(), 0, "  ")
        self.assertEqual(stats["tail_cura_tentada"], 3)
        self.assertEqual(stats["tail_cura_bail_sem_alvo"], 3)
        self.assertEqual(stats["tail_cura_tentada"],
                         sum(stats.get(b, 0) for b in BAILS)
                         + stats.get("tail_healed", 0))


class NascemEmZeroTest(unittest.TestCase):
    """Campo AUSENTE é indistinguível de "mediu e deu zero".

    Esse erro exato já foi cometido neste arquivo e está documentado em
    `registrar_tail_interno` (tts_qa/loop.py). Os contadores da cura têm que
    nascer junto com `tail_checked`/`tail_flagged`/`tail_none`/`tail_healed`.
    """

    def _stats_de_job_novo(self) -> dict:
        job = ji.InferenceJob.__new__(ji.InferenceJob)
        # Só o trecho que inicializa qa_stats interessa; o __init__ real puxa
        # config/modelo. Reaproveita a MESMA fonte, sem duplicar a lista aqui.
        ji.InferenceJob.__init__(job, {"text": "oi"}, "oi")
        return job.qa_stats

    def test_contadores_da_cura_nascem_em_zero(self):
        stats = self._stats_de_job_novo()
        for campo in ("tail_cura_tentada",) + BAILS:
            self.assertIn(campo, stats, f"{campo} não nasce: ausente != zero")
            self.assertEqual(stats[campo], 0, campo)

    def test_irmaos_antigos_continuam_nascendo(self):
        """Sem regressão: o que já nascia continua nascendo."""
        stats = self._stats_de_job_novo()
        for campo in ("tail_checked", "tail_flagged", "tail_none", "tail_healed"):
            self.assertEqual(stats[campo], 0, campo)


class TelemetriaPuraTest(_CuraBase):
    """Contrato de `registrar_faltantes`: ninguém lê estes campos pra decidir.

    O risco real de instrumentar o caminho quente é a instrumentação derrubar a
    geração de um aluno. Estes dois testes travam isso.
    """

    def test_qa_stats_vazio_nao_estoura(self):
        """Job construído sem os campos inicializados: `.get` segura o KeyError."""
        job = self._job(_fala(), [])
        seg = _fala()
        self.assertIs(job._curar_fim_abrupto(seg, 0, "  "), seg)
        self.assertEqual(job.qa_stats["tail_cura_bail_sem_alvo"], 1)

    def test_audio_entregue_e_identico_ao_de_antes(self):
        """A cura devolve exatamente o mesmo objeto/valor de antes da mudança:
        bail devolve o original, sucesso devolve o cortado."""
        original = _fala(2.0)
        job = self._job(_fala(1.5),
                        [{"word": "nutricionista", "start": 0.2, "end": 0.60},
                         {"word": "Muito", "start": 0.9, "end": 1.0},
                         {"word": "obrigada", "start": 1.0, "end": 1.15}])
        self.assertIs(job._curar_fim_abrupto(original, 0, "sua nutricionista."),
                      original, "bail tem que devolver o áudio original intacto")


if __name__ == "__main__":
    unittest.main()
