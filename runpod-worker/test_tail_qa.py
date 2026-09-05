"""QA de FIM ABRUPTO — o defeito que nenhum critério textual enxerga.

Caso real (Carol Crozeta, 26/08): a geração "Olá, eu sou Carol Crozeta, sua
nutricionista." saiu com a última sílaba decepada. O whisper RECONSTRUIU a
palavra inteira, a cobertura deu 100%, e o áudio cortado foi entregue.
Só o envelope denuncia: fala natural decai, fala truncada vai de energia alta
a zero num frame.

Os números aqui são os medidos nos arquivos reais daquele dia:
entrega cortada terminou em RMS 0.056; sete entregas boas do mesmo dia
terminaram entre 0.005 e 0.010.
"""
import unittest

import numpy as np

from tts_qa.metrics import fim_abrupto

SR = 16000


def _fala(dur_s: float = 1.0, amp: float = 0.1) -> np.ndarray:
    return np.ones(int(SR * dur_s), dtype=np.float32) * amp


def _com_decaimento(dur_s: float = 1.0, decai_ms: int = 400, amp: float = 0.1) -> np.ndarray:
    w = _fala(dur_s, amp)
    n = min(int(SR * decai_ms / 1000), w.size)
    w[-n:] *= np.linspace(1.0, 0.0, n, dtype=np.float32)
    return w


class FimAbruptoTest(unittest.TestCase):
    def test_corte_seco_e_flagrado(self):
        """Energia alta até o último sample = decepado."""
        self.assertTrue(fim_abrupto(_fala(), SR))

    def test_decaimento_natural_passa(self):
        """Fala que se apaga sozinha não é corte."""
        self.assertFalse(fim_abrupto(_com_decaimento(), SR))

    def test_silencio_no_fim_nao_engana(self):
        """O bug da 1a versão: medir os últimos 50 ms pegava o silêncio do
        encoder e dava 'ok' pra áudio decepado. A janela é ancorada no último
        ponto COM som."""
        cortado = np.concatenate([_fala(), np.zeros(int(SR * 0.5), dtype=np.float32)])
        self.assertTrue(fim_abrupto(cortado, SR))

    def test_audio_mudo_devolve_none(self):
        self.assertIsNone(fim_abrupto(np.zeros(SR, dtype=np.float32), SR))

    def test_vazio_devolve_none(self):
        self.assertIsNone(fim_abrupto(np.zeros(0, dtype=np.float32), SR))
        self.assertIsNone(fim_abrupto(None, SR))

    def test_curto_demais_devolve_none(self):
        self.assertIsNone(fim_abrupto(np.ones(10, dtype=np.float32) * 0.1, SR))

    def test_limiar_bate_com_os_numeros_reais(self):
        """0.056 (o caso da Carol) reprova; 0.010 (entrega boa) passa."""
        self.assertTrue(fim_abrupto(_fala(amp=0.056), SR))
        self.assertFalse(fim_abrupto(_fala(amp=0.010), SR))


class CuraDoFimTest(unittest.TestCase):
    """A cura gera ALÉM do texto do aluno (frase-isca) e corta no fim da última
    palavra dele, com o tempo vindo do whisper. Medido em 26/08: só ter fala
    depois conserta (0,002); reticências não bastaram (voltou a cortar em prod).
    """

    def _fake(self, gerado, palavras):
        from jobs import inference as ji

        class Fake(ji.InferenceJob):
            ISCA = "Muito obrigada."

            def __init__(self):
                self.sample_rate = SR
                self.qa_stats = {}
                self.cfg = type("C", (), {"echo_qa_model": "small", "qa_language": "pt"})()

            def _gerar(self, chunk, idx):
                self.chunk_pedido = chunk
                return gerado

            def _aparar(self, x, idx):
                return x

        f = Fake()
        ji.palavras_com_tempo = lambda *a, **k: palavras
        return f

    def test_corta_no_fim_da_ultima_palavra_do_aluno(self):
        # fala do aluno decaindo até 0,60s, pausa, depois a isca — é a forma
        # real: entre a frase e a isca existe silêncio, e é nele que o corte cai
        gerado = np.concatenate([
            _com_decaimento(0.60), np.zeros(int(SR * 0.25), dtype=np.float32),
            _com_decaimento(0.40),
        ])
        # a última palavra do aluno acaba em 0,60s e dura o bastante pra ser
        # pronunciável (0,45s / 5 sílabas) — senão a própria cura se reprova
        palavras = [{"word": "nutricionista", "start": 0.15, "end": 0.60},
                    {"word": "Muito", "start": 0.9, "end": 1.05},
                    {"word": "obrigada", "start": 1.05, "end": 1.40}]
        f = self._fake(gerado, palavras)
        curado = f._curar_fim_abrupto(_fala(), 0, "sua nutricionista.")
        self.assertIn("Muito obrigada", f.chunk_pedido)
        self.assertLess(curado.size, gerado.size, "cortou a isca fora")
        self.assertEqual(f.qa_stats.get("tail_healed"), 1)

    def test_sem_palavras_suficientes_mantem_original(self):
        original = _fala(2.0)
        f = self._fake(_fala(1.0), [{"word": "obrigada", "start": 0.1, "end": 0.4}])
        self.assertIs(f._curar_fim_abrupto(original, 0, "sua nutricionista."), original)
        self.assertNotIn("tail_healed", f.qa_stats)

    def test_corte_que_continua_decepado_mantem_original(self):
        original = _fala(2.0)
        palavras = [{"word": "nutricionista", "start": 0.2, "end": 0.60},
                    {"word": "Muito", "start": 0.9, "end": 1.0},
                    {"word": "obrigada", "start": 1.0, "end": 1.15}]
        f = self._fake(_fala(1.5), palavras)  # tudo plano: corte segue abrupto
        self.assertIs(f._curar_fim_abrupto(original, 0, "sua nutricionista."), original)
        self.assertNotIn("tail_healed", f.qa_stats)

    def test_chunk_vazio_nao_gera(self):
        f = self._fake(_fala(), [])
        seg = _fala()
        self.assertIs(f._curar_fim_abrupto(seg, 0, "   "), seg)


class UltimaPalavraTruncadaTest(unittest.TestCase):
    """Números reais medidos em 26/08 com timestamp por palavra (whisper).

    cortadas: "nutricionista" em 0,20s e 0,32s = 0,040 e 0,064 s/sílaba
    boas:     0,100 a 0,340 s/sílaba, sete alunos diferentes
    """

    def _p(self, word, dur):
        return [{"word": word, "start": 1.0, "end": 1.0 + dur}]

    def test_caso_real_cortado_reprova(self):
        from tts_qa.metrics import ultima_palavra_truncada

        self.assertTrue(ultima_palavra_truncada(self._p("nutricionista", 0.20)))
        self.assertTrue(ultima_palavra_truncada(self._p("nutricionista", 0.32)))

    def test_casos_reais_bons_passam(self):
        from tts_qa.metrics import ultima_palavra_truncada

        for word, dur in [("vinda", 0.26), ("Cruzeta", 0.66), ("voz", 0.34),
                          ("vídeos", 0.30), ("querida", 0.46), ("investir", 0.36),
                          ("cabeça", 0.30), ("vendas", 0.46)]:
            self.assertFalse(ultima_palavra_truncada(self._p(word, dur)), word)

    def test_sem_dados_devolve_none(self):
        from tts_qa.metrics import ultima_palavra_truncada

        self.assertIsNone(ultima_palavra_truncada(None))
        self.assertIsNone(ultima_palavra_truncada([]))
        self.assertIsNone(ultima_palavra_truncada([{"word": "oi"}]))

    def test_contagem_de_silabas(self):
        from tts_qa.metrics import contar_silabas

        self.assertEqual(contar_silabas("nutricionista"), 5)
        self.assertEqual(contar_silabas("voz"), 1)
        self.assertEqual(contar_silabas("cabeça"), 3)
        self.assertEqual(contar_silabas(""), 1)

    def test_limiar_apertado_pega_o_que_o_johnny_ouviu(self):
        """0,027 passava no limiar antigo (0,030) e o corte estava lá."""
        self.assertTrue(fim_abrupto(_fala(amp=0.027), SR))
        self.assertFalse(fim_abrupto(_fala(amp=0.010), SR))


class FimAindaRuimTest(unittest.TestCase):
    """As duas provas juntas. O envelope sozinho deixou passar o caso real:
    0,0143 (abaixo do limiar) com "nutricionista" em 0,38s — truncado."""

    def _job(self, palavras):
        from jobs import inference as ji

        class Fake(ji.InferenceJob):
            def __init__(self):
                self.sample_rate = SR
                self.qa_stats = {}
                self.cfg = type("C", (), {"echo_qa_model": "small", "qa_language": "pt"})()

        ji.palavras_com_tempo = lambda *a, **k: palavras
        return Fake()

    def test_envelope_ok_mas_palavra_impossivel_reprova(self):
        # caso real: envelope aprovava, palavra denunciava
        j = self._job([{"word": "nutricionista", "start": 2.48, "end": 2.86}])
        self.assertTrue(j._fim_ainda_ruim(_com_decaimento()))

    def test_envelope_ok_e_palavra_ok_passa(self):
        j = self._job([{"word": "nutricionista", "start": 2.0, "end": 2.9}])
        self.assertFalse(j._fim_ainda_ruim(_com_decaimento()))

    def test_envelope_reprova_sem_precisar_de_whisper(self):
        chamou = []

        from jobs import inference as ji
        ji.palavras_com_tempo = lambda *a, **k: chamou.append(1) or []
        j = self._job([])
        self.assertTrue(j._fim_ainda_ruim(_fala()))
        self.assertEqual(chamou, [], "envelope ja reprovou: nao gasta whisper")


class FronteiraInternaTest(unittest.TestCase):
    """#234 (02/09): a fronteira INTERNA passou a ser julgada — em SOMBRA.

    A premissa antiga ("no meio do texto a emenda com o proximo chunk cobre a
    transicao") e' falsa: o chunk interno ja chega decapitado na montagem.
    Medido no _frank/prova/cauda_decepada.jsonl (release_ms <= 35 E
    plato_db > -40): 1.371 fronteiras internas ruins em 623 de 4.258 geracoes
    (14,6%), 244 alunos, 281 vozes.

    O que estes testes travam:
      1. chunk INTERNO decepado e' CONTADO e nao mexe no score (ninguem
         regenera, ninguem falha) — modo sombra, o padrao;
      2. com o modo "reprovando" o mesmo audio pontua e REGENERA;
      3. o ULTIMO chunk continua exatamente como era (sem regressao) e nao
         contamina os contadores novos;
      4. TTS_TAIL_QA_INTERNO=0 desliga o julgamento interno;
      5. a sombra NAO gasta whisper na fronteira interna (o custo era o risco);
      6. o default de env e' sombra — virar a chave e' env, nao deploy.
    """

    def _stats(self) -> dict:
        return {
            "echo_checked": 0, "echo_flagged": 0, "echo_none": 0,
            "coverage_checked": 0, "coverage_flagged": 0, "coverage_none": 0,
            "intrusion_checked": 0, "intrusion_flagged": 0, "intrusion_none": 0,
            "regens": 0, "exhausted": 0,
        }

    def _kwargs(self, **over):
        """So o QA de fim ligado: `coverage_qa_retries=2` existe apenas pra dar
        DUAS voltas no laco (max_attempts) — nenhum whisper roda aqui."""
        base = dict(
            sample_rate=SR, prompt_text=None, qa_language="pt",
            start_qa_enabled=False, start_qa_retries=0, start_qa_model="small",
            echo_qa_enabled=False, echo_qa_retries=0, echo_qa_model="large-v3-turbo",
            coverage_qa_enabled=False, coverage_qa_retries=2, coverage_qa_min=0.85,
            intrusion_qa_enabled=False, intrusion_qa_retries=0,
        )
        base.update(over)
        return base

    def _rodar(self, seg, **over):
        from tts_qa.loop import run_chunk_qa
        stats = self._stats()
        # regen_fn devolve audio BOM: se o laco pontuar, a 2a tentativa passa.
        run_chunk_qa(seg, 0, "sua nutricionista", regen_fn=lambda: _com_decaimento(),
                     qa_stats=stats, **self._kwargs(**over))
        return stats

    def test_chunk_interno_decepado_e_contado_em_sombra(self):
        s = self._rodar(_fala(), eh_ultimo_chunk=False)
        self.assertEqual(s["tail_interno_checked"], 1)
        self.assertEqual(s["tail_interno_flagged"], 1)
        self.assertEqual(s["tail_interno_sombra"], 1)
        # SOMBRA = nao mexe no score: ninguem regenerou, nada esgotou.
        self.assertEqual(s["regens"], 0)
        self.assertEqual(s["exhausted"], 0)
        # e nao encosta no contador historico do fim do arquivo
        self.assertNotIn("tail_flagged", s)

    def test_chunk_interno_bom_passa(self):
        s = self._rodar(_com_decaimento(), eh_ultimo_chunk=False)
        self.assertEqual(s["tail_interno_checked"], 1)
        self.assertEqual(s.get("tail_interno_flagged", 0), 0)
        self.assertEqual(s["regens"], 0)

    def test_modo_reprovando_pontua_e_regenera(self):
        s = self._rodar(_fala(), eh_ultimo_chunk=False,
                        tail_qa_interno_modo="reprovando")
        self.assertEqual(s["tail_interno_flagged"], 1)
        self.assertEqual(s.get("tail_interno_sombra", 0), 0, "reprovando nao e' sombra")
        self.assertEqual(s["regens"], 1, "peso 100 tem que regenerar o chunk")

    def test_ultimo_chunk_nao_mudou(self):
        """Sem regressao: o fim do ARQUIVO continua pontuando como sempre."""
        s = self._rodar(_fala(), eh_ultimo_chunk=True)
        # 2 tentativas (a 1a decepada reprovou e regenerou; a 2a passou), 1 so
        # sinalizada — e' exatamente o comportamento que ja existia.
        self.assertEqual(s["tail_checked"], 2)
        self.assertEqual(s["tail_flagged"], 1)
        self.assertEqual(s["regens"], 1)
        self.assertEqual(s.get("tail_interno_checked", 0), 0,
                         "ultimo chunk nao e' interno")

    def test_desligado_nao_julga_fronteira_interna(self):
        s = self._rodar(_fala(), eh_ultimo_chunk=False, tail_qa_interno_enabled=False)
        self.assertNotIn("tail_interno_checked", s)
        self.assertEqual(s["regens"], 0)

    def test_sombra_nao_gasta_whisper_na_fronteira_interna(self):
        """O custo era o risco: 1 whisper com timestamp por chunk, e nao por
        geracao. A 2a prova (palavra) fica FORA da sombra por padrao."""
        import tts_qa.loop as loop
        chamou = []
        orig = loop.palavras_com_tempo
        loop.palavras_com_tempo = lambda *a, **k: chamou.append(1) or []
        try:
            self._rodar(_com_decaimento(), eh_ultimo_chunk=False)
            self.assertEqual(chamou, [], "sombra nao paga whisper por chunk")
            self._rodar(_com_decaimento(), eh_ultimo_chunk=False,
                        tail_qa_interno_palavra=True)
            self.assertEqual(len(chamou), 1, "com a flag ligada, a 2a prova roda")
        finally:
            loop.palavras_com_tempo = orig

    def _settings(self):
        """Carrega jobs/tts_settings.py SEM passar pelo `jobs/__init__.py` — ele
        importa a inference inteira (torch/huggingface), que nao existe nesta
        maquina de teste. O modulo de config so depende de os/dataclasses."""
        import importlib.util
        import pathlib
        import sys
        p = pathlib.Path(__file__).parent / "jobs" / "tts_settings.py"
        spec = importlib.util.spec_from_file_location("tts_settings_isolado", p)
        mod = importlib.util.module_from_spec(spec)
        # sys.modules ANTES do exec: @dataclass resolve as anotacoes pelo
        # __module__ da classe e quebra se o modulo nao estiver registrado.
        sys.modules[spec.name] = mod
        spec.loader.exec_module(mod)
        return mod.TtsSettings

    def test_default_de_env_e_sombra(self):
        """Virar a chave e' env, nao deploy — e o default NAO reprova ninguem."""
        import os
        TtsSettings = self._settings()
        for k in ("TTS_TAIL_QA_INTERNO", "TTS_TAIL_QA_INTERNO_MODO",
                  "TTS_TAIL_QA_INTERNO_PALAVRA"):
            os.environ.pop(k, None)
        c = TtsSettings.do_job({})
        self.assertTrue(c.tail_qa_interno_enabled)
        self.assertEqual(c.tail_qa_interno_modo, "sombra")
        self.assertFalse(c.tail_qa_interno_palavra)
        os.environ["TTS_TAIL_QA_INTERNO_MODO"] = "reprovando"
        try:
            self.assertEqual(self._settings().do_job({}).tail_qa_interno_modo,
                             "reprovando")
        finally:
            os.environ.pop("TTS_TAIL_QA_INTERNO_MODO", None)


class FronteiraInternaEntregaTest(unittest.TestCase):
    """A metrica de ENTREGA da fronteira interna (conserto de 02/09).

    O DEFEITO QUE ISTO TRAVA: os contadores `tail_interno_*` sobem DENTRO do
    laco de tentativas, entao contam tentativa DESCARTADA. Prova em producao:
    a geracao 97464f01 tem regens=19 e tail_interno_checked=37 — 37 checagens
    pra um numero de chunks muito menor. Lido como "fronteiras entregues",
    aquele 37 reportaria um alcance varias vezes maior que o real.

    E' o MESMO defeito ja diagnosticado em 26/08 na cobertura (leia o aviso em
    `registrar_cobertura`), e a correcao e' a mesma: o laco devolve o veredito
    da tentativa VENCEDORA e o CHAMADOR registra, porque so ele sabe qual audio
    virou entrega.

    Os contadores por tentativa CONTINUAM existindo com o nome de sempre: eles
    medem PRESSAO DE REGEN (quantas tentativas ganhariam +100 se a chave
    virasse). O que faltava era a metrica de ENTREGA ao lado.
    """

    def _stats(self) -> dict:
        return {
            "echo_checked": 0, "echo_flagged": 0, "echo_none": 0,
            "coverage_checked": 0, "coverage_flagged": 0, "coverage_none": 0,
            "intrusion_checked": 0, "intrusion_flagged": 0, "intrusion_none": 0,
            "regens": 0, "exhausted": 0,
        }

    def _kwargs(self, **over):
        base = dict(
            sample_rate=SR, prompt_text=None, qa_language="pt",
            start_qa_enabled=False, start_qa_retries=0, start_qa_model="small",
            echo_qa_enabled=False, echo_qa_retries=0, echo_qa_model="large-v3-turbo",
            coverage_qa_enabled=False, coverage_qa_retries=2, coverage_qa_min=0.85,
            intrusion_qa_enabled=False, intrusion_qa_retries=0,
        )
        base.update(over)
        return base

    def _rodar(self, seg, regen=None, **over):
        """Devolve (stats, veredito_de_fronteira_interna_da_ENTREGA)."""
        from tts_qa.loop import run_chunk_qa
        stats = self._stats()
        _seg, _cov, _lac, tail_interno, _falt = run_chunk_qa(
            seg, 0, "sua nutricionista",
            regen_fn=(regen or (lambda: _com_decaimento())),
            qa_stats=stats, **self._kwargs(**over))
        return stats, tail_interno

    # (a) tentativa DESCARTADA com a flag interna NAO conta na entrega ────────
    def test_tentativa_descartada_nao_conta_na_entrega(self):
        """O caso 97464f01 em miniatura: a 1a tentativa sai decepada e e'
        JOGADA FORA; a 2a, boa, e' a que o aluno recebe."""
        from tts_qa.loop import registrar_tail_interno
        s, entregue = self._rodar(_fala(), eh_ultimo_chunk=False,
                                  tail_qa_interno_modo="reprovando")
        # por TENTATIVA: a decepada foi vista e cobrada com regen
        self.assertEqual(s["tail_interno_checked"], 2)
        self.assertEqual(s["tail_interno_flagged"], 1)
        self.assertEqual(s["regens"], 1)
        # na ENTREGA: quem ficou foi a tentativa BOA
        self.assertIs(entregue, False)
        registrar_tail_interno(s, entregue)
        self.assertEqual(s["tail_interno_entregue"], 0, "a descartada vazou")
        self.assertEqual(s["tail_interno_entregue_n"], 1)

    def test_descartada_em_SOMBRA_tambem_fica_de_fora(self):
        """Em sombra a flag interna nao derruba tentativa nenhuma — mas OUTRO
        eixo derruba, e ai a decepada tambem e' descartada. Aqui a 1a palavra
        reprova na 1a tentativa (peso 100) e passa na 2a."""
        import tts_qa.loop as loop
        from tts_qa.loop import registrar_tail_interno
        respostas = [False, True]
        orig = loop.start_word_ok
        loop.start_word_ok = lambda *a, **k: respostas.pop(0)
        try:
            s, entregue = self._rodar(_fala(), eh_ultimo_chunk=False,
                                      start_qa_enabled=True, start_qa_retries=2)
        finally:
            loop.start_word_ok = orig
        self.assertEqual(s["regens"], 1, "quem regenerou foi a 1a palavra")
        self.assertEqual(s["tail_interno_flagged"], 1)
        self.assertEqual(s["tail_interno_sombra"], 1, "segue sem pontuar")
        self.assertIs(entregue, False)
        registrar_tail_interno(s, entregue)
        self.assertEqual(s["tail_interno_entregue"], 0)
        self.assertEqual(s["tail_interno_entregue_n"], 1)

    # (b) tentativa VENCEDORA com a flag interna CONTA ───────────────────────
    def test_tentativa_vencedora_com_flag_conta_na_entrega(self):
        """Sombra: a decepada NAO regenera (de proposito) e e' entregue. E'
        exatamente este pedaco que o #234 descreve chegando no aluno."""
        from tts_qa.loop import registrar_tail_interno
        s, entregue = self._rodar(_fala(), eh_ultimo_chunk=False)
        self.assertEqual(s["regens"], 0, "sombra nao regenera")
        self.assertIs(entregue, True)
        registrar_tail_interno(s, entregue)
        self.assertEqual(s["tail_interno_entregue"], 1)
        self.assertEqual(s["tail_interno_entregue_n"], 1)

    # (c) o modo "reprovando" segue pontuando ────────────────────────────────
    def test_modo_reprovando_segue_pontuando_e_a_entrega_e_honesta(self):
        """Regen nao e' garantia de conserto: quando TODA tentativa sai
        decepada, o audio entregue continua decepado — e a metrica de entrega
        tem que dizer isso, nao esconder atras do regen."""
        from tts_qa.loop import registrar_tail_interno
        s, entregue = self._rodar(_fala(), regen=lambda: _fala(),
                                  eh_ultimo_chunk=False,
                                  tail_qa_interno_modo="reprovando")
        self.assertEqual(s["regens"], 1, "peso 100 tem que regenerar")
        self.assertEqual(s["exhausted"], 1)
        self.assertEqual(s["tail_interno_flagged"], 2, "as duas sairam ruins")
        self.assertIs(entregue, True)
        registrar_tail_interno(s, entregue)
        self.assertEqual(s["tail_interno_entregue"], 1)
        self.assertEqual(s["tail_interno_entregue_n"], 1)

    # (d) o ULTIMO chunk nao regride ─────────────────────────────────────────
    def test_ultimo_chunk_nao_regride_e_nao_tem_veredito_interno(self):
        """O fim do ARQUIVO continua pontuando como sempre pontuou, e NAO
        entra na metrica de fronteira interna (nao e' fronteira interna)."""
        from tts_qa.loop import registrar_tail_interno
        s, entregue = self._rodar(_fala(), eh_ultimo_chunk=True)
        self.assertEqual(s["tail_checked"], 2)
        self.assertEqual(s["tail_flagged"], 1)
        self.assertEqual(s["regens"], 1)
        self.assertEqual(s.get("tail_interno_checked", 0), 0)
        self.assertIsNone(entregue)
        registrar_tail_interno(s, entregue)
        self.assertNotIn("tail_interno_entregue_n", s)
        self.assertEqual(s["tail_interno_entregue_sem_veredito"], 1)

    def test_julgamento_desligado_nao_tem_veredito(self):
        s, entregue = self._rodar(_fala(), eh_ultimo_chunk=False,
                                  tail_qa_interno_enabled=False)
        self.assertNotIn("tail_interno_checked", s)
        self.assertIsNone(entregue)

    def test_audio_mudo_e_inconclusivo_nao_vira_veredito(self):
        """`fim_abrupto` devolve None em audio mudo: inconclusivo NAO e' "ok".
        Fica fora do denominador e aparece em `_sem_veredito`."""
        from tts_qa.loop import registrar_tail_interno
        s, entregue = self._rodar(np.zeros(SR, dtype=np.float32),
                                  eh_ultimo_chunk=False)
        self.assertEqual(s["tail_interno_checked"], 1)
        self.assertEqual(s["tail_interno_none"], 1)
        self.assertIsNone(entregue)
        registrar_tail_interno(s, entregue)
        self.assertNotIn("tail_interno_entregue_n", s)
        self.assertEqual(s["tail_interno_entregue_sem_veredito"], 1)


class RegistrarTailInternoTest(unittest.TestCase):
    """O acumulador em si: numerador, denominador e a conta que fecha."""

    def test_acumula_numerador_e_denominador(self):
        from tts_qa.loop import registrar_tail_interno
        s = {}
        for v in (True, False, False, True, False):
            registrar_tail_interno(s, v)
        self.assertEqual(s["tail_interno_entregue"], 2)
        self.assertEqual(s["tail_interno_entregue_n"], 5)

    def test_numerador_nasce_em_zero_com_o_denominador(self):
        """Campo ausente com denominador presente seria de novo "nao mediu"
        indistinguivel de "mediu e deu zero" — a armadilha do coverage_medido_n.
        """
        from tts_qa.loop import registrar_tail_interno
        s = {}
        registrar_tail_interno(s, False)
        self.assertEqual(s["tail_interno_entregue"], 0)
        self.assertEqual(s["tail_interno_entregue_n"], 1)

    def test_sem_veredito_fecha_a_conta_de_pedacos_entregues(self):
        from tts_qa.loop import registrar_tail_interno
        s = {}
        for v in (True, None, False, None):
            registrar_tail_interno(s, v)
        self.assertEqual(s["tail_interno_entregue_n"], 2)
        self.assertEqual(s["tail_interno_entregue_sem_veredito"], 2)
        self.assertEqual(
            s["tail_interno_entregue_n"] + s["tail_interno_entregue_sem_veredito"],
            4, "entregues = com veredito + sem veredito")

    def test_none_nao_cria_denominador(self):
        from tts_qa.loop import registrar_tail_interno
        s = {}
        registrar_tail_interno(s, None)
        self.assertNotIn("tail_interno_entregue_n", s)
        self.assertNotIn("tail_interno_entregue", s)


# ⚠️ Fica no FIM do arquivo de proposito: ate 02/09 este `unittest.main()`
# estava no meio (logo apos FimAbruptoTest) e, rodando o arquivo direto
# (`python3 test_tail_qa.py`), as classes definidas DEPOIS nem existiam ainda —
# CuraDoFimTest e UltimaPalavraTruncadaTest nunca rodavam por esse caminho.
if __name__ == "__main__":
    unittest.main()
