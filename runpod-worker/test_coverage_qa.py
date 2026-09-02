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

O QA vive em tts_qa/ desde 20/08 e a quebra do texto em tts_text.py —
nenhum dos dois precisa mais do handler.

Roda SEM GPU e sem pesos — os módulos pesados são stubados e o whisper é
simulado. Só precisa de numpy:

    cd runpod-worker && python3 test_coverage_qa.py -v
"""
import sys
import types
import unittest
from unittest import mock

# ── Stub do soundfile ANTES de importar tts_qa (o resto do peso saiu junto
# com o QA no refator de 20/08 — este arquivo nao carrega mais o handler).
if "soundfile" not in sys.modules:
    sys.modules["soundfile"] = types.ModuleType("soundfile")
sys.modules["soundfile"].write = lambda *a, **k: None

import numpy as np  # noqa: E402

import tts_text  # noqa: E402
import tts_qa  # noqa: E402
import tts_qa.loop  # noqa: E402

SR = 16000
# Texto no padrão do caso Katia (sintético — mesmo formato/tamanho de chunk).
CHUNK = (
    "Eu sei que existe uma parte de voce que esta cansada de viver no piloto "
    "automatico, esperando o momento perfeito que nunca chega para comecar."
)
CHUNK_WORDS = tts_qa.norm_words(CHUNK)
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
        intrusion_qa_enabled=False,
        intrusion_qa_retries=3,
    )
    base.update(over)
    return base


def fresh_stats() -> dict:
    return {
        "echo_checked": 0, "echo_flagged": 0, "echo_none": 0,
        "coverage_checked": 0, "coverage_flagged": 0, "coverage_none": 0,
        "coverage_exhausted": 0,
        "intrusion_checked": 0, "intrusion_flagged": 0, "intrusion_none": 0,
        "regens": 0, "exhausted": 0,
    }


class ChunkCoverageTest(unittest.TestCase):
    """chunk_coverage: a régua que mede se o áudio contém o texto do chunk."""

    def test_transcricao_completa_da_cobertura_total(self):
        self.assertEqual(tts_qa.chunk_coverage(CHUNK_WORDS, CHUNK), 1.0)

    def test_audio_que_comeca_no_meio_reprova(self):
        cov = tts_qa.chunk_coverage(HALF_WORDS, CHUNK)
        self.assertIsNotNone(cov)
        self.assertLess(cov, 0.85)

    def test_chunk_mudo_e_cobertura_zero(self):
        # Padrão do chunk 3 da Katia: chunk INTEIRO ausente do áudio.
        self.assertEqual(tts_qa.chunk_coverage([], CHUNK), 0.0)

    def test_whisper_falhou_e_inconclusivo(self):
        # None = whisper quebrou — QA é rede de segurança, não bloqueia.
        self.assertIsNone(tts_qa.chunk_coverage(None, CHUNK))

    def test_chunk_sem_palavras_e_inconclusivo(self):
        self.assertIsNone(tts_qa.chunk_coverage(CHUNK_WORDS, "..."))


class RunChunkQATest(unittest.TestCase):
    """run_chunk_qa: o laço reprovar → regenerar → (falhar explícito)."""

    def test_chunk_incompleto_reprova_regenera_e_passa(self):
        # 1a tentativa: áudio começa no meio (cobertura baixa) → regenera.
        # 2a tentativa: áudio completo → passa.
        transcripts = iter([HALF_WORDS, CHUNK_WORDS])
        stats = fresh_stats()
        seg_ruim, seg_bom = make_seg(), make_seg(2.0)
        with mock.patch.object(
            tts_qa.loop, "transcribe_seg", side_effect=lambda *a, **k: next(transcripts)
        ):
            best, cov, _lac, _ti = tts_qa.run_chunk_qa(
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
        with mock.patch.object(tts_qa.loop, "transcribe_seg", transcriber):
            _best, cov, _lac, _ti = tts_qa.run_chunk_qa(
                seg_mudo, 3, CHUNK, regen_fn=lambda: seg_mudo,
                qa_stats=stats, **qa_kwargs(),
            )
        transcriber.assert_not_called()  # mudo = "não ouvi nada", sem whisper
        self.assertEqual(cov, 0.0)
        # 27/08 (#52 reincidente): cobertura ~0 duas vezes seguidas e' chunk
        # ALUCINADO/mudo — repetir a 3a tentativa identica so' gasta GPU. O
        # laco sai cedo (1 regen, nao 2) e entrega ao resgate, que muda de
        # estrategia. `exhausted` fica 0: nao esgotou, DESISTIU de repetir.
        self.assertEqual(stats["regens"], 1)
        self.assertEqual(stats["exhausted"], 0)
        self.assertEqual(stats["coverage_alucinado_saida"], 1)
        self.assertEqual(stats["coverage_alucinado"], 2)
        # O gate do chamador (_handle_inference) com esta cobertura FALHA o job:
        self.assertTrue(cov is not None and cov < 0.85)

    def test_sempre_incompleto_devolve_a_mais_completa(self):
        # Nenhuma tentativa passa: devolve a MELHOR (mais completa), e a
        # cobertura dela continua abaixo do mínimo → chamador falha o job.
        seqs = [HALF_WORDS, CHUNK_WORDS[:3], HALF_WORDS]
        it = iter(seqs)
        stats = fresh_stats()
        with mock.patch.object(
            tts_qa.loop, "transcribe_seg", side_effect=lambda *a, **k: next(it)
        ):
            _best, cov, _lac, _ti = tts_qa.run_chunk_qa(
                make_seg(), 2, CHUNK, regen_fn=make_seg,
                qa_stats=stats, **qa_kwargs(),
            )
        self.assertIsNotNone(cov)
        self.assertLess(cov, 0.85)
        self.assertEqual(cov, tts_qa.chunk_coverage(HALF_WORDS, CHUNK))
        self.assertEqual(stats["exhausted"], 1)

    def test_start_qa_roda_em_chunk_que_nao_e_o_primeiro(self):
        # O `idx == 0` caiu: a 1a palavra é conferida em TODOS os chunks.
        start_ok = mock.Mock(return_value=True)
        with mock.patch.object(tts_qa.loop, "start_word_ok", start_ok), \
             mock.patch.object(tts_qa.loop, "transcribe_seg", return_value=CHUNK_WORDS):
            tts_qa.run_chunk_qa(
                make_seg(), 2, CHUNK, regen_fn=make_seg,
                qa_stats=fresh_stats(), **qa_kwargs(start_qa_enabled=True),
            )
        start_ok.assert_called_once()

    def test_echo_e_coverage_dividem_uma_transcricao_por_tentativa(self):
        # Custo: echo QA + coverage QA = UMA chamada de whisper, não duas.
        prompt = "a raposa marrom pulou sobre o cachorro preguicoso dormindo"
        transcriber = mock.Mock(return_value=CHUNK_WORDS)
        stats = fresh_stats()
        with mock.patch.object(tts_qa.loop, "transcribe_seg", transcriber):
            tts_qa.run_chunk_qa(
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
        with mock.patch.object(tts_qa.loop, "transcribe_seg", return_value=None):
            _best, cov, _lac, _ti = tts_qa.run_chunk_qa(
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
        chunks = tts_text.split_text_for_tts(text, max_chars=160)
        self.assertGreater(len(chunks), 1)
        for c, _ends in chunks:
            words = tts_qa.norm_words(c)
            self.assertTrue(words)
            self.assertEqual(tts_qa.chunk_coverage(words, c), 1.0)


class DigitosViramPalavrasTest(unittest.TestCase):
    """Caso pestanatiago 19/08 (incidentes 2949257c/37bacb68/c4b892e9): o texto
    do TTS chega por extenso ("E trinta e seis") e o whisper devolve dígitos
    ("E36") — a comparação palavra a palavra reprovava áudio PERFEITO
    (coverage_best 0.609 medido em produção, 2 estornos de graça)."""

    CHUNK = ("Estás a pensar comprar um E trinta e seis como primeiro carro? "
             "Eu adoro o E trinta e seis, mas não o recomendo.")
    WHISPER = ("Estás a pensar comprar um E36 como primeiro carro? "
               "Eu adoro o E36, mas não o recomendo.")

    def test_audio_perfeito_com_numero_em_digito_da_cobertura_total(self):
        got = tts_qa.norm_words(self.WHISPER, "pt")
        self.assertEqual(tts_qa.chunk_coverage(got, self.CHUNK, "pt"), 1.0)

    def test_audio_pela_metade_continua_reprovando(self):
        metade = "Estás a pensar comprar um E36 como primeiro carro?"
        got = tts_qa.norm_words(metade, "pt")
        self.assertLess(tts_qa.chunk_coverage(got, self.CHUNK, "pt"), 0.85)

    def test_expansao_por_idioma(self):
        self.assertEqual(tts_qa.digits_to_words("36", "pt"), ["trinta", "e", "seis"])
        self.assertEqual(tts_qa.digits_to_words("42", "en"), ["forty", "two"])
        self.assertEqual(tts_qa.digits_to_words("36", "es"), ["treinta", "y", "seis"])

    def test_letra_colada_no_digito_separa(self):
        # "e36" precisa virar ["e", "trinta", "e", "seis"], não um token opaco
        self.assertEqual(
            tts_qa.norm_words("E36", "pt"), ["e", "trinta", "e", "seis"],
        )

    def test_numero_gigante_soletra_digito_a_digito(self):
        words = tts_qa.digits_to_words("11987654321", "pt")
        self.assertEqual(words[:2], ["um", "um"])
        self.assertIn("nove", words)


class ChunkIntrusionsTest(unittest.TestCase):
    """chunk_intrusions (incidente fb8d29b7): palavra A MAIS ou TROCADA no
    áudio — o inverso do coverage. Fixtures do caso REAL da Katia 19/08: a ref
    da voz termina em "por menos" e o VoxCPM soltava "Menos." nas junções."""

    TEXTO = ("Por isso eu criei o Portal da Morgana para te guiar em uma "
             "jornada profunda de autoconhecimento e despertar")

    def test_audio_limpo_e_zero(self):
        got = tts_qa.norm_words(self.TEXTO)
        self.assertEqual(tts_qa.chunk_intrusions(got, self.TEXTO), 0)

    def test_eco_de_cauda_da_ref_e_intrusao(self):
        # Caso real: "Por menos, por isso eu criei..." (tomada 1 da Katia).
        got = tts_qa.norm_words("Por menos, " + self.TEXTO)
        self.assertGreaterEqual(tts_qa.chunk_intrusions(got, self.TEXTO), 1)

    def test_palavra_inventada_no_meio_e_intrusao(self):
        got = tts_qa.norm_words(
            self.TEXTO.replace("para te guiar", "para menos te guiar"))
        self.assertGreaterEqual(tts_qa.chunk_intrusions(got, self.TEXTO), 1)

    def test_variacao_de_whisper_nao_e_intrusao(self):
        # "quatorze" falado/ouvido "catorze": substituição PARECIDA (ratio
        # >= 0.7) é sotaque/grafia do Whisper, não defeito.
        texto = "ela completou quatorze anos em março"
        got = tts_qa.norm_words("ela completou catorze anos em março")
        self.assertEqual(tts_qa.chunk_intrusions(got, texto), 0)

    def test_substituicao_real_e_intrusao(self):
        # Palavra TROCADA por outra sem parentesco conta.
        texto = "a jornada exige coragem e persistencia"
        got = tts_qa.norm_words("a jornada exige dinheiro e persistencia")
        self.assertGreaterEqual(tts_qa.chunk_intrusions(got, texto), 1)

    def test_palavra_curta_nao_conta(self):
        # "e"/"a"/"o" a mais é ruído de transcrição, não intrusão.
        got = tts_qa.norm_words(self.TEXTO.replace("para te", "para e te"))
        self.assertEqual(tts_qa.chunk_intrusions(got, self.TEXTO), 0)

    def test_inconclusivo_nao_bloqueia(self):
        self.assertIsNone(tts_qa.chunk_intrusions(None, self.TEXTO))
        self.assertIsNone(tts_qa.chunk_intrusions([], self.TEXTO))


class IntrusionLoopTest(unittest.TestCase):
    """O laço com o QA de intrusão: regenera, escolhe a tentativa limpa, e no
    esgotamento NÃO derruba o job (gate macio — coverage devolvida é a boa)."""

    def test_intrusao_regenera_e_escolhe_a_limpa(self):
        suja = tts_qa.norm_words("Por menos, " + CHUNK)
        limpa = CHUNK_WORDS
        it = iter([suja, limpa])
        stats = fresh_stats()
        seg_sujo, seg_limpo = make_seg(), make_seg(2.0)
        with mock.patch.object(
            tts_qa.loop, "transcribe_seg", side_effect=lambda *a, **k: next(it)
        ):
            best, cov, _lac, _ti = tts_qa.run_chunk_qa(
                seg_sujo, 0, CHUNK, regen_fn=lambda: seg_limpo,
                qa_stats=stats, **qa_kwargs(intrusion_qa_enabled=True),
            )
        self.assertEqual(stats["intrusion_flagged"], 1)
        self.assertEqual(stats["regens"], 1)
        self.assertIs(best, seg_limpo)
        # Cobertura da entregue é total — o chamador NÃO falha o job.
        self.assertEqual(cov, 1.0)

    def test_intrusao_persistente_esgota_mas_nao_derruba(self):
        suja = tts_qa.norm_words("Por menos, " + CHUNK)
        stats = fresh_stats()
        with mock.patch.object(tts_qa.loop, "transcribe_seg", return_value=suja):
            _best, cov, _lac, _ti = tts_qa.run_chunk_qa(
                make_seg(), 0, CHUNK, regen_fn=make_seg,
                qa_stats=stats, **qa_kwargs(intrusion_qa_enabled=True),
            )
        self.assertEqual(stats["exhausted"], 1)
        # A transcrição CONTÉM o texto todo (só tem palavra a mais): cobertura
        # segue >= mínimo → o gate do chamador NÃO falha o job. É o desenho:
        # intrusão melhora a escolha, nunca vira estorno em massa.
        self.assertIsNotNone(cov)
        self.assertGreaterEqual(cov, 0.85)


class MaiorLacunaTest(unittest.TestCase):
    """maior_lacuna: a régua que separa DEFEITO de TEXTO-QUE-NAO-SE-FALA.

    A cobertura sozinha reprovava áudio PERFEITO toda vez que o texto tinha
    algo não falado (número por extenso, markdown, emoji, rótulo de locutor) —
    3 variações medidas em 24h, cada uma custando o áudio de um aluno. O que
    diferencia é a FORMA do buraco: defeito real some um trecho CONTÍNUO;
    markup some em palavras SOLTAS."""

    def _lacuna(self, chunk, falado):
        return tts_qa.maior_lacuna(tts_qa.norm_words(falado, "pt"), chunk, "pt")

    # ── áudio BOM (falso negativo antigo): buraco pequeno e espalhado ──
    def test_rotulo_de_dialogo_da_buraco_de_1(self):
        c = "Seres: Freud, me explica uma coisa..."
        self.assertEqual(self._lacuna(c, "Freud, me explica uma coisa..."), 1)

    def test_variacao_de_escrita_do_whisper_da_buraco_pequeno(self):
        c = "Bem-vinda ao seu portal e ao caminho de volta para voce"
        self.assertLessEqual(self._lacuna(c, "Bem vinda ao seu portal e ao caminho de volta pra voce"), 2)

    def test_numero_por_extenso_nao_abre_buraco(self):
        c = "comprar um E trinta e seis como primeiro carro"
        self.assertEqual(self._lacuna(c, "comprar um E36 como primeiro carro"), 0)

    def test_sigla_soletrada_nao_abre_buraco(self):
        # Caso tulliojeronimo REAL (23/08, incidente 37bacb68): o roteiro
        # SOLETRA a sigla e o whisper escreve junto. Sao 7 tokens de 1 letra
        # CONTINUOS -> buraco 7 >= limite 6 -> reprovava audio bom.
        # Ele mesmo provou que o audio estava certo: reescreveu foneticamente
        # ("Be pe ce, loas") e a MESMA geracao saiu [ready] (8959506f, 19:43).
        c = "B P C, L O A S. O que e e quem tem direito."
        self.assertLess(self._lacuna(c, "BPC LOAS. O que e e quem tem direito."), 6)

    def test_buraco_real_que_CONTEM_palavra_de_1_letra_continua_grande(self):
        # Guarda contra afrouxar demais: trecho comido de verdade costuma ter
        # atono no meio ("e", "a", "o"). Desconta-se o atono, mas as palavras
        # de verdade continuam contando — o buraco segue grande.
        c = "o gato subiu no telhado e comeu a racao toda da vizinha"
        self.assertGreaterEqual(self._lacuna(c, "o gato da vizinha"), 6)

    # ── áudio RUIM (defeito real): buraco grande e contínuo ──
    def test_audio_que_comeca_no_meio_da_buraco_grande(self):
        self.assertGreaterEqual(self._lacuna(CHUNK, " ".join(HALF_WORDS)), 6)

    def test_chunk_mudo_e_o_chunk_inteiro(self):
        esperado = len(tts_qa.norm_words(CHUNK))
        self.assertEqual(tts_qa.maior_lacuna([], CHUNK), esperado)

    def test_pedaco_comido_no_meio_da_buraco_grande(self):
        c = "um dois tres quatro cinco seis sete oito nove dez onze doze"
        self.assertGreaterEqual(self._lacuna(c, "um dois tres doze"), 6)

    # ── guardas ──
    def test_whisper_falhou_e_inconclusivo(self):
        self.assertIsNone(tts_qa.maior_lacuna(None, CHUNK))

    def test_chunk_sem_palavras_e_inconclusivo(self):
        self.assertIsNone(tts_qa.maior_lacuna(CHUNK_WORDS, "..."))


class DecisaoDeReprovarTest(unittest.TestCase):
    """A decisão final: só derruba o job com cobertura baixa E buraco contínuo
    grande. Espelha o bloco de _handle_inference (limite = max(6, 20% do
    chunk)) — se mudar lá, muda aqui."""

    GAP_MIN = 6

    def _reprova(self, chunk, falado):
        got = tts_qa.norm_words(falado, "pt")
        cov = tts_qa.chunk_coverage(got, chunk, "pt")
        lac = tts_qa.maior_lacuna(got, chunk, "pt")
        n = len(tts_qa.norm_words(chunk, "pt"))
        limite = max(self.GAP_MIN, int(n * 0.20))
        return cov is not None and cov < 0.85 and (lac is None or lac >= limite)

    def test_audio_bom_com_rotulo_NAO_reprova_mais(self):
        # Caso serescastro6 real: cobertura 0.833 (abaixo do minimo) mas o
        # buraco e 1 palavra -> tem que ENTREGAR.
        c = "Seres: Freud, me explica uma coisa..."
        self.assertFalse(self._reprova(c, "Freud, me explica uma coisa..."))

    def test_audio_bom_com_sigla_soletrada_NAO_reprova_mais(self):
        # O caso que derrubou 2 geracoes do tulliojeronimo em 3 minutos
        # (16c7626a 19:32 e 2b59e898 19:35, ambas com 1.829 creditos
        # debitados e estornados). Antes: buraco contiguo de 7 -> REPROVA.
        c = "B P C, L O A S. O que e e quem tem direito."
        self.assertFalse(self._reprova(c, "BPC LOAS. O que e e quem tem direito."))

    def test_audio_que_comeca_no_meio_CONTINUA_reprovando(self):
        self.assertTrue(self._reprova(CHUNK, " ".join(HALF_WORDS)))

    def test_chunk_mudo_CONTINUA_reprovando(self):
        self.assertTrue(self._reprova(CHUNK, ""))

    def test_chunk_curto_nao_cai_por_buraco_proporcional(self):
        # Chunk de 5 palavras com 1 faltando: 20% de 5 = 1, mas o piso de 6
        # protege — chunk curto nao pode ser derrubado por buraco minusculo.
        c = "hoje eu quero falar disso"
        self.assertFalse(self._reprova(c, "hoje eu quero falar"))


class SegundaOpiniaoIdiomaTest(unittest.TestCase):
    """Texto num idioma != idioma da VOZ (incidente 37bacb68, medido 24/08).

    `qa_language` vem de `voice.language` (generate/route.ts:209), não do texto.
    Aluna com voz em pt que escreve em inglês faz o whisper do QA ser FORÇADO a
    pt — e aí ele TRADUZ em vez de transcrever. Nenhuma palavra bate, o buraco
    vira um bloco contínuo e o gate reprova ÁUDIO BOM, 3 vezes seguidas, sem
    entregar nada. Vítimas reais: janetecasarotto2 (c5eb5cb4, 23/08) e
    johnny.oliveirasp (dd4b98a3).

    Medido com o MESMO áudio lido nos dois idiomas (_Bugs/qa-lang/prova_idioma.py):
      whisper(pt)   -> "A interpretação ao vivo no lugar é brutalmente difícil"
                       cobertura 0.0, lacuna 8  -> REPROVA
      whisper(auto) -> texto exato, cobertura 1.0, lacuna 0 -> PASSA
    """

    EN = "Live interpretation on the spot is brutally hard."
    # o que o whisper devolve quando forçado a pt: TRADUÇÃO, não transcrição
    EN_TRADUZIDO = tts_qa.norm_words(
        "A interpretacao ao vivo no lugar e brutalmente dificil.", "pt"
    )
    EN_CERTO = tts_qa.norm_words(EN, "en")

    def test_idioma_errado_e_resgatado_pela_segunda_opiniao(self):
        stats = fresh_stats()
        seg = make_seg(3.0)
        with mock.patch.object(
            tts_qa.loop, "transcribe_seg", side_effect=lambda *a, **k: self.EN_TRADUZIDO
        ), mock.patch.object(
            tts_qa.loop, "transcribe_seg_autodetect",
            return_value=(self.EN_CERTO, "en", 0.99),
        ) as auto:
            _best, cov, lac, _ti = tts_qa.loop.run_chunk_qa(
                seg, 0, self.EN, regen_fn=lambda: seg,
                qa_stats=stats, **qa_kwargs(),
            )
        auto.assert_called_once()
        self.assertEqual(cov, 1.0)   # a leitura no idioma certo cobre tudo
        self.assertEqual(lac, 0)
        self.assertEqual(stats["coverage_idioma_corrigido"], 1)
        # e o chamador (_handle_inference) NÃO derruba mais o job:
        self.assertGreaterEqual(cov, 0.85)

    def test_chunk_realmente_comido_NAO_e_resgatado(self):
        # A proteção do caso Katia continua de pé: trecho que o modelo comeu
        # continua comido em QUALQUER idioma — a segunda opinião não salva.
        stats = fresh_stats()
        seg = make_seg(3.0)
        with mock.patch.object(
            tts_qa.loop, "transcribe_seg", side_effect=lambda *a, **k: HALF_WORDS
        ), mock.patch.object(
            tts_qa.loop, "transcribe_seg_autodetect",
            return_value=(HALF_WORDS, "pt", 0.99),
        ) as auto:
            _best, cov, _lac, _ti = tts_qa.loop.run_chunk_qa(
                seg, 0, CHUNK, regen_fn=lambda: seg,
                qa_stats=stats, **qa_kwargs(),
            )
        auto.assert_called_once()
        self.assertLess(cov, 0.85)   # segue reprovando
        self.assertEqual(stats.get("coverage_idioma_corrigido", 0), 0)

    def test_audio_aprovado_nao_paga_segunda_opiniao(self):
        # Custo: a 2a transcrição só existe no caminho de reprovação.
        stats = fresh_stats()
        seg = make_seg(3.0)
        with mock.patch.object(
            tts_qa.loop, "transcribe_seg", side_effect=lambda *a, **k: CHUNK_WORDS
        ), mock.patch.object(
            tts_qa.loop, "transcribe_seg_autodetect"
        ) as auto:
            _best, cov, _lac, _ti = tts_qa.loop.run_chunk_qa(
                seg, 0, CHUNK, regen_fn=lambda: seg,
                qa_stats=stats, **qa_kwargs(),
            )
        auto.assert_not_called()
        self.assertEqual(cov, 1.0)

    def test_segunda_opiniao_quebrada_nao_muda_o_veredito(self):
        # whisper falhou na 2a leitura: mantém o veredito da 1a, não inventa.
        stats = fresh_stats()
        seg = make_seg(3.0)
        with mock.patch.object(
            tts_qa.loop, "transcribe_seg", side_effect=lambda *a, **k: HALF_WORDS
        ), mock.patch.object(
            tts_qa.loop, "transcribe_seg_autodetect", return_value=(None, None, 0.0)
        ):
            _best, cov, _lac, _ti = tts_qa.loop.run_chunk_qa(
                seg, 0, CHUNK, regen_fn=lambda: seg,
                qa_stats=stats, **qa_kwargs(),
            )
        self.assertIsNotNone(cov)
        self.assertLess(cov, 0.85)

    def test_pior_leitura_nao_substitui_a_melhor(self):
        # Só adota a 2a opinião quando ela é MELHOR — nunca piora o veredito.
        stats = fresh_stats()
        seg = make_seg(3.0)
        with mock.patch.object(
            tts_qa.loop, "transcribe_seg", side_effect=lambda *a, **k: HALF_WORDS
        ), mock.patch.object(
            tts_qa.loop, "transcribe_seg_autodetect", return_value=([], "en", 0.5)
        ):
            _best, cov, _lac, _ti = tts_qa.loop.run_chunk_qa(
                seg, 0, CHUNK, regen_fn=lambda: seg,
                qa_stats=stats, **qa_kwargs(),
            )
        self.assertGreater(cov, 0.0)  # ficou com a leitura da 1a, não com 0.0


def entregar(stats, coverage):
    """O que o CHAMADOR faz quando decide que aquele audio vira entrega.

    `run_chunk_qa` deliberadamente NAO registra sozinho: o audio que ele
    devolve ainda pode ser descartado pelo resgate por subdivisao. Ver
    `registrar_cobertura`.
    """
    tts_qa.registrar_cobertura(stats, coverage)


class TelemetriaCoberturaEntregueTest(unittest.TestCase):
    """A cobertura do caminho de SUCESSO (26/08, incidente 52).

    Até aqui `coverage_best` só era escrito no payload de FALHA
    (`_resultado_incompleto`). Resultado medido: das 279 gerações ENTREGUES
    desde 24/08 dava pra contar quantas vezes o QA reprovou (222 de 279
    precisaram de ao menos um regen), mas NÃO a que distância da régua
    (`coverage_qa_min`, hoje 0.85) os áudios entregues estavam passando — ou
    seja, ninguém sabia dizer se apertar/afrouxar a régua move a taxa de
    reprovação.

    Estes testes provam que a cobertura do chunk ENTREGUE é registrada, que o
    chunk inconclusivo fica FORA da média (e continua contado em
    `coverage_none`), e que nada disso decide o destino do áudio.
    """

    # Áudio bom, mas não perfeito: o whisper perdeu a última palavra. Passa a
    # régua (>= 0.85) e é ENTREGUE — exatamente o caso que era invisível.
    QUASE = CHUNK_WORDS[:-1]

    def test_entrega_limpa_registra_min_visto_e_media(self):
        stats = fresh_stats()
        seg = make_seg(3.0)
        cov_quase = tts_qa.chunk_coverage(self.QUASE, CHUNK)
        self.assertGreaterEqual(cov_quase, 0.85)  # é entrega, não falha
        self.assertLess(cov_quase, 1.0)
        leituras = [CHUNK_WORDS, self.QUASE]  # chunk 0 perfeito, chunk 1 quase
        for idx, leitura in enumerate(leituras):
            with mock.patch.object(
                tts_qa.loop, "transcribe_seg", side_effect=lambda *a, _l=leitura, **k: _l
            ), mock.patch.object(
                tts_qa.loop, "transcribe_seg_autodetect", return_value=(None, None, 0.0)
            ):
                _b, cov, _l, _ti = tts_qa.loop.run_chunk_qa(
                    seg, idx, CHUNK, regen_fn=lambda: seg,
                    qa_stats=stats, **qa_kwargs(),
                )
            entregar(stats, cov)
        self.assertEqual(stats["coverage_medido_n"], 2)          # o DENOMINADOR
        self.assertEqual(stats["coverage_min_visto"], round(cov_quase, 4))
        self.assertEqual(stats["coverage_medio"], round((1.0 + cov_quase) / 2, 4))
        self.assertEqual(stats["coverage_flagged"], 0)           # nada reprovou
        self.assertEqual(stats["regens"], 0)                     # nada regerou

    def test_elo_fraco_e_o_menor_nao_o_ultimo(self):
        # `coverage_min_visto` é o pior chunk do áudio entregue — não o último
        # medido. Ordem invertida do teste acima, mesmo resultado.
        stats = fresh_stats()
        seg = make_seg(3.0)
        cov_quase = tts_qa.chunk_coverage(self.QUASE, CHUNK)
        for idx, leitura in enumerate([self.QUASE, CHUNK_WORDS]):
            with mock.patch.object(
                tts_qa.loop, "transcribe_seg", side_effect=lambda *a, _l=leitura, **k: _l
            ), mock.patch.object(
                tts_qa.loop, "transcribe_seg_autodetect", return_value=(None, None, 0.0)
            ):
                _b, cov, _l, _ti = tts_qa.loop.run_chunk_qa(
                    seg, idx, CHUNK, regen_fn=lambda: seg,
                    qa_stats=stats, **qa_kwargs(),
                )
            entregar(stats, cov)
        self.assertEqual(stats["coverage_min_visto"], round(cov_quase, 4))

    def test_chunk_inconclusivo_fica_fora_da_media(self):
        # Whisper falhou (None) = não medimos nada — não pode virar 0.0 na
        # média nem sumir do relatório: continua contado em `coverage_none`.
        stats = fresh_stats()
        seg = make_seg(3.0)
        with mock.patch.object(
            tts_qa.loop, "transcribe_seg", side_effect=lambda *a, **k: None
        ), mock.patch.object(
            tts_qa.loop, "transcribe_seg_autodetect", return_value=(None, None, 0.0)
        ) as auto:
            _best, cov, _lac, _ti = tts_qa.loop.run_chunk_qa(
                seg, 0, CHUNK, regen_fn=lambda: seg,
                qa_stats=stats, **qa_kwargs(),
            )
        entregar(stats, cov)
        self.assertIsNone(cov)
        self.assertEqual(stats["coverage_none"], 1)              # continua contado
        self.assertEqual(stats.get("coverage_medido_n", 0), 0)   # fora da média
        self.assertIsNone(stats.get("coverage_min_visto"))
        self.assertIsNone(stats.get("coverage_medio"))
        auto.assert_not_called()                                 # nem paga 2a opinião

    def test_media_ignora_o_inconclusivo_mas_conta_o_medido(self):
        # Mistura: um chunk medido + um inconclusivo. A média é do medido.
        stats = fresh_stats()
        seg = make_seg(3.0)
        for idx, leitura in enumerate([CHUNK_WORDS, None]):
            with mock.patch.object(
                tts_qa.loop, "transcribe_seg", side_effect=lambda *a, _l=leitura, **k: _l
            ), mock.patch.object(
                tts_qa.loop, "transcribe_seg_autodetect", return_value=(None, None, 0.0)
            ):
                _b, cov, _l, _ti = tts_qa.loop.run_chunk_qa(
                    seg, idx, CHUNK, regen_fn=lambda: seg,
                    qa_stats=stats, **qa_kwargs(),
                )
            entregar(stats, cov)
        self.assertEqual(stats["coverage_medido_n"], 1)
        self.assertEqual(stats["coverage_medio"], 1.0)
        self.assertEqual(stats["coverage_min_visto"], 1.0)
        self.assertEqual(stats["coverage_none"], 1)

    def test_chunk_DESCARTADO_pelo_resgate_nao_entra_na_telemetria(self):
        """O chunk que reprova e vai pro resgate NAO e' entrega — nao conta.

        Este e' o defeito que a 1a versao tinha (achado na revisao de 27/08).
        `run_chunk_qa` registrava sozinho, no fim de si mesmo. Mas quando a
        cobertura reprova com buraco CONTINUO o chamador joga aquele audio
        fora e entrega o de `_resgatar_por_subdivisao` — e o numero do audio
        DESCARTADO ficava como `coverage_min_visto` da geracao.

        Medido em producao antes de corrigir: das 294 geracoes com telemetria
        desde 24/08, o resgate ENTREGOU 5 vezes e 4 delas tambem passaram pela
        escotilha de cobertura espalhada. Duas das cinco sao os casos mais
        olhados do chamado 52 — `96a09526` (janetecasarotto2) e `71a68eb6`
        (godoyalessandroadv). Nas duas, a leitura ingenua acenderia alarme
        falso na PRIMEIRA vez que alguem usasse o instrumento novo.
        """
        stats = fresh_stats()
        seg = make_seg(3.0)
        comido = CHUNK_WORDS[:2]        # o modelo comeu o resto: buraco continuo
        cov_ruim = tts_qa.chunk_coverage(comido, CHUNK)
        self.assertLess(cov_ruim, 0.85)  # reprova de verdade

        # 1) chunk original reprova. O chamador NAO registra: vai pro resgate.
        with mock.patch.object(
            tts_qa.loop, "transcribe_seg", side_effect=lambda *a, **k: comido
        ), mock.patch.object(
            tts_qa.loop, "transcribe_seg_autodetect", return_value=(None, None, 0.0)
        ):
            _b, cov, _l, _ti = tts_qa.loop.run_chunk_qa(
                seg, 0, CHUNK, regen_fn=lambda: seg, qa_stats=stats, **qa_kwargs(),
            )
        self.assertEqual(round(cov, 4), round(cov_ruim, 4))
        # o audio reprovado NAO virou telemetria de entrega
        self.assertEqual(stats.get("coverage_medido_n", 0), 0)
        self.assertIsNone(stats.get("coverage_min_visto"))

        # 2) os sub-pedacos do resgate saem limpos — E' ISSO que o aluno recebe.
        for sub in (1, 2):
            with mock.patch.object(
                tts_qa.loop, "transcribe_seg", side_effect=lambda *a, **k: CHUNK_WORDS
            ), mock.patch.object(
                tts_qa.loop, "transcribe_seg_autodetect", return_value=(None, None, 0.0)
            ):
                _b, cov_sub, _l, _ti = tts_qa.loop.run_chunk_qa(
                    seg, sub, CHUNK, regen_fn=lambda: seg, qa_stats=stats, **qa_kwargs(),
                )
            entregar(stats, cov_sub)

        self.assertEqual(stats["coverage_medido_n"], 2)     # so os 2 entregues
        self.assertEqual(stats["coverage_min_visto"], 1.0)  # NAO o cov_ruim
        self.assertEqual(stats["coverage_medio"], 1.0)
        # e a reprovacao do descartado continua visivel no contador que e' dela
        self.assertGreaterEqual(stats["coverage_flagged"], 1)


class TelemetriaSegundaOpiniaoTest(unittest.TestCase):
    """A 2a opinião de idioma tem que deixar rastro MESMO quando não ajuda.

    Antes disso ela só escrevia `coverage_idioma_corrigido`, e só quando
    melhorava. Caso real que ficou sem resposta: geração ed8a5e6b (25/08
    21:44, janetecasarotto2) — texto em INGLÊS numa voz `language='pt'`,
    reprovada com coverage 0.1, com o PR #47 JÁ em produção (merge 9214e86,
    24/08 13h53Z). A `qa` dela não tem a chave, então "rodou e não ajudou" e
    "nem rodou" eram indistinguíveis. Agora não são mais.
    """

    EN = SegundaOpiniaoIdiomaTest.EN
    EN_TRADUZIDO = SegundaOpiniaoIdiomaTest.EN_TRADUZIDO

    def test_rodou_e_nao_melhorou_deixa_rastro(self):
        # Mesmo idioma da voz, leitura igual: não melhora nada. `checked` sobe,
        # `corrigido` NÃO — é isto que torna o caso ed8a5e6b decidível.
        stats = fresh_stats()
        seg = make_seg(3.0)
        with mock.patch.object(
            tts_qa.loop, "transcribe_seg", side_effect=lambda *a, **k: HALF_WORDS
        ), mock.patch.object(
            tts_qa.loop, "transcribe_seg_autodetect", return_value=(HALF_WORDS, "pt", 0.97)
        ) as auto:
            _best, cov, _lac, _ti = tts_qa.loop.run_chunk_qa(
                seg, 0, CHUNK, regen_fn=lambda: seg,
                qa_stats=stats, **qa_kwargs(),
            )
        auto.assert_called_once()
        self.assertLess(cov, 0.85)                                  # veredito intacto
        self.assertEqual(stats["coverage_idioma_checked"], 1)       # rodou
        self.assertEqual(stats.get("coverage_idioma_corrigido", 0), 0)  # e não ajudou
        self.assertEqual(stats.get("coverage_idioma_divergente", 0), 0)  # mesmo idioma
        self.assertEqual(stats["coverage_idioma_detectado"], "pt")
        self.assertEqual(stats["coverage_idioma_prob"], 0.97)

    def test_idioma_divergente_conta_mesmo_sem_melhorar(self):
        # Voz em pt, whisper ouviu inglês, e a 2a leitura NÃO melhorou o
        # veredito. `divergente` sobe assim mesmo — é este contador que
        # responde "quantos alunos escrevem em idioma diferente do da voz".
        stats = fresh_stats()
        seg = make_seg(3.0)
        with mock.patch.object(
            tts_qa.loop, "transcribe_seg", side_effect=lambda *a, **k: HALF_WORDS
        ), mock.patch.object(
            tts_qa.loop, "transcribe_seg_autodetect", return_value=([], "en", 0.88)
        ):
            _best, cov, _lac, _ti = tts_qa.loop.run_chunk_qa(
                seg, 0, CHUNK, regen_fn=lambda: seg,
                qa_stats=stats, **qa_kwargs(),
            )
        self.assertEqual(stats["coverage_idioma_checked"], 1)
        self.assertEqual(stats["coverage_idioma_divergente"], 1)
        self.assertEqual(stats.get("coverage_idioma_corrigido", 0), 0)
        self.assertLess(cov, 0.85)   # e o veredito continua o da 1a leitura

    def test_idioma_divergente_conta_tambem_quando_resgata(self):
        # O caso janetecasarotto original: divergiu E melhorou. Os DOIS
        # contadores sobem — `corrigido` mantém o significado antigo.
        stats = fresh_stats()
        seg = make_seg(3.0)
        with mock.patch.object(
            tts_qa.loop, "transcribe_seg", side_effect=lambda *a, **k: self.EN_TRADUZIDO
        ), mock.patch.object(
            tts_qa.loop, "transcribe_seg_autodetect",
            return_value=(tts_qa.norm_words(self.EN, "en"), "en", 0.99),
        ):
            _best, cov, _lac, _ti = tts_qa.loop.run_chunk_qa(
                seg, 0, self.EN, regen_fn=lambda: seg,
                qa_stats=stats, **qa_kwargs(),
            )
        self.assertEqual(cov, 1.0)
        self.assertEqual(stats["coverage_idioma_checked"], 1)
        self.assertEqual(stats["coverage_idioma_divergente"], 1)
        self.assertEqual(stats["coverage_idioma_corrigido"], 1)
        # Aqui a 2a opiniao SALVOU o audio (1.0 >= régua): o chamador entrega
        # este mesmo `seg`, sem passar pelo resgate por subdivisao. Logo ele
        # registra — e o valor registrado é o veredito DEPOIS da 2a opinião,
        # não o 0.x da 1a leitura.
        entregar(stats, cov)
        self.assertEqual(stats["coverage_min_visto"], 1.0)

    def test_segunda_opiniao_quebrada_ainda_conta_como_rodada(self):
        # Whisper do autodetect falhou (None): "rodou e foi inconclusivo" tem
        # que ser distinguível de "nem rodou".
        stats = fresh_stats()
        seg = make_seg(3.0)
        with mock.patch.object(
            tts_qa.loop, "transcribe_seg", side_effect=lambda *a, **k: HALF_WORDS
        ), mock.patch.object(
            tts_qa.loop, "transcribe_seg_autodetect", return_value=(None, None, 0.0)
        ):
            tts_qa.loop.run_chunk_qa(
                seg, 0, CHUNK, regen_fn=lambda: seg,
                qa_stats=stats, **qa_kwargs(),
            )
        self.assertEqual(stats["coverage_idioma_checked"], 1)
        self.assertNotIn("coverage_idioma_detectado", stats)

    def test_audio_aprovado_nao_conta_como_checado(self):
        # A 2a opinião só existe no caminho de reprovação — o contador não
        # pode inflar com quem passou de primeira.
        stats = fresh_stats()
        seg = make_seg(3.0)
        with mock.patch.object(
            tts_qa.loop, "transcribe_seg", side_effect=lambda *a, **k: CHUNK_WORDS
        ), mock.patch.object(
            tts_qa.loop, "transcribe_seg_autodetect", return_value=(None, None, 0.0)
        ):
            tts_qa.loop.run_chunk_qa(
                seg, 0, CHUNK, regen_fn=lambda: seg,
                qa_stats=stats, **qa_kwargs(),
            )
        self.assertEqual(stats.get("coverage_idioma_checked", 0), 0)



class ChunkAlucinadoTest(unittest.TestCase):
    """#52 (27/08, caso Ronald): entre uma tentativa e outra NADA muda no
    worker (mesmo texto, mesmos parametros, sem seed). Cobertura ~0 duas vezes
    seguidas nao e' "faltou um pedaco", e' audio que nao e' o texto — repetir
    a chamada e' cair no mesmo poco. O laco para e devolve ao chamador."""

    def test_duas_alucinadas_seguidas_param_o_laco(self):
        stats = fresh_stats()
        with mock.patch.object(tts_qa.loop, "transcribe_seg", return_value=CHUNK_WORDS[:1]):
            _b, cov, _l, _ti = tts_qa.run_chunk_qa(
                make_seg(), 0, CHUNK, regen_fn=make_seg,
                qa_stats=stats, **qa_kwargs(coverage_qa_retries=3),
            )
        self.assertLess(cov, 0.3)
        self.assertEqual(stats["regens"], 1)           # 2 tentativas, nao 3
        self.assertEqual(stats["coverage_alucinado_saida"], 1)
        self.assertEqual(stats["exhausted"], 0)

    def test_cobertura_que_se_recupera_zera_o_contador(self):
        # 1a ~0, 2a meia (0,52), 3a ~0: nunca sao DUAS SEGUIDAS -> laco normal.
        seqs = iter([CHUNK_WORDS[:1], HALF_WORDS, CHUNK_WORDS[:1]])
        stats = fresh_stats()
        with mock.patch.object(tts_qa.loop, "transcribe_seg", side_effect=lambda *a, **k: next(seqs)):
            _b, cov, _l, _ti = tts_qa.run_chunk_qa(
                make_seg(), 0, CHUNK, regen_fn=make_seg,
                qa_stats=stats, **qa_kwargs(coverage_qa_retries=3),
            )
        self.assertEqual(stats["regens"], 2)           # gastou as 3
        self.assertEqual(stats["exhausted"], 1)
        self.assertNotIn("coverage_alucinado_saida", stats)
        self.assertEqual(cov, tts_qa.chunk_coverage(HALF_WORDS, CHUNK))  # a melhor

    def test_botao_desligado_volta_ao_comportamento_antigo(self):
        stats = fresh_stats()
        with mock.patch.object(tts_qa.loop, "transcribe_seg", return_value=[]):
            tts_qa.run_chunk_qa(
                make_seg(), 0, CHUNK, regen_fn=make_seg, qa_stats=stats,
                alucinacao_max_seguidas=0, **qa_kwargs(coverage_qa_retries=3),
            )
        self.assertEqual(stats["regens"], 2)
        self.assertEqual(stats["exhausted"], 1)


class ExhaustedScoreTest(unittest.TestCase):
    """#226: o score do chunk ENTREGUE quando o QA esgota as tentativas.

    Ate 01/09 so a CONTAGEM (`exhausted`) ia pro banco e o `best_score` morria
    no log do worker — entao "esgotou" nao distinguia "20% rapido demais" de
    "comeu uma palavra". Sem o numero, a flag nao prioriza nada."""

    def test_esgotou_grava_score_e_lista(self):
        # 1a ~0, 2a meia, 3a ~0 -> esgota entregando a MEIA (cobertura ~0,52).
        seqs = iter([CHUNK_WORDS[:1], HALF_WORDS, CHUNK_WORDS[:1]])
        stats = fresh_stats()
        with mock.patch.object(tts_qa.loop, "transcribe_seg", side_effect=lambda *a, **k: next(seqs)):
            tts_qa.run_chunk_qa(
                make_seg(), 0, CHUNK, regen_fn=make_seg,
                qa_stats=stats, **qa_kwargs(coverage_qa_retries=3),
            )
        self.assertEqual(stats["exhausted"], 1)
        # Faixa GRAVE: falta texto, entao o peso de cobertura (100+) tem que
        # aparecer. E' isso que separa este caso de um desvio so de ritmo.
        self.assertGreaterEqual(stats["exhausted_score_max"], 100)
        self.assertEqual(stats["exhausted_scores"], [stats["exhausted_score_max"]])

    def test_sem_esgotar_nao_grava_score(self):
        # Cobertura cheia na 1a tentativa: score 0, sai pelo break limpo.
        stats = fresh_stats()
        with mock.patch.object(tts_qa.loop, "transcribe_seg", return_value=CHUNK_WORDS):
            tts_qa.run_chunk_qa(
                make_seg(), 0, CHUNK, regen_fn=make_seg,
                qa_stats=stats, **qa_kwargs(),
            )
        self.assertEqual(stats["exhausted"], 0)
        # Ausente, nao zero: "nao esgotou" e' diferente de "esgotou com 0".
        self.assertNotIn("exhausted_score_max", stats)
        self.assertNotIn("exhausted_scores", stats)

    def test_score_max_guarda_o_PIOR_entre_chunks(self):
        """O campo e' por GERACAO (o dict de stats atravessa os chunks): tem de
        ficar com o pior chunk, senao o ultimo chunk mascara o estrago."""
        stats = fresh_stats()
        for _ in range(2):
            seqs = iter([CHUNK_WORDS[:1], HALF_WORDS, CHUNK_WORDS[:1]])
            with mock.patch.object(tts_qa.loop, "transcribe_seg", side_effect=lambda *a, **k: next(seqs)):
                tts_qa.run_chunk_qa(
                    make_seg(), 0, CHUNK, regen_fn=make_seg,
                    qa_stats=stats, **qa_kwargs(coverage_qa_retries=3),
                )
        self.assertEqual(stats["exhausted"], 2)
        self.assertEqual(len(stats["exhausted_scores"]), 2)
        self.assertEqual(stats["exhausted_score_max"], max(stats["exhausted_scores"]))


class SplitBelowSentenceTest(unittest.TestCase):
    """split_below_sentence: o nivel 2 do resgate parte ABAIXO da frase —
    o split por frase nunca desce disso e deixava 'frase_unica' sem saida."""

    FRASE = ("Boa tarde a todos, e uma honra dividir esse momento com um publico "
             "que entende na pratica o que e construir um negocio do zero com as "
             "proprias maos e sem nenhum apoio externo")

    def test_pedacos_respeitam_o_limite_e_nao_cortam_palavra(self):
        partes = tts_text.split_below_sentence(self.FRASE, 70)
        self.assertGreaterEqual(len(partes), 3)
        for pz in partes:
            self.assertLessEqual(len(pz), 71)          # +1 do terminal
            self.assertTrue(pz.endswith("."))          # borda limpa
        # Nenhuma palavra foi partida: juntando tudo, todas as palavras voltam.
        originais = self.FRASE.replace(",", "").split()
        obtidas = " ".join(partes).replace(",", "").replace(".", "").split()
        self.assertEqual(obtidas, originais)

    def test_corta_na_virgula_antes_de_cortar_por_palavra(self):
        partes = tts_text.split_below_sentence("Ola pessoal, tudo bem com voces, vamos comecar", 40)
        self.assertEqual(partes[0], "Ola pessoal, tudo bem com voces.")

    def test_frase_curta_volta_inteira(self):
        self.assertEqual(tts_text.split_below_sentence("Oi gente.", 70), ["Oi gente."])

    def test_vazio(self):
        self.assertEqual(tts_text.split_below_sentence("   ", 70), [])


if __name__ == "__main__":
    unittest.main(verbosity=2)
