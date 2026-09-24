"""Testes da penalidade de ENCERRAMENTO/meta-gravacao (incidente cfa488b5).

O defeito de classe (medido 24/09): a referencia era recortada do trecho em que
o aluno esta ENCERRANDO a gravacao — falando sobre o arquivo, nao falando — e a
heuristica dava score BOM pra isso (Aline 12,5 · CHRIS 9,0, corte de candidata
ruim = 25). O VoxCPM clona o ESTILO da referencia, entao o modelo da voz virava
a pessoa querendo parar de gravar; retreinar o mesmo audio caia no mesmo trecho
(Aline treinou 5x, 50.000 creditos, 4 vozes iguais).

Estes testes provam que agora:
  1. os 4 transcripts REAIS de producao (3 vozes da Aline + CHRIS 03) pontuam
     ACIMA do corte de 25 DEPOIS do fix — e pontuavam ABAIXO antes (o proprio
     teste desconta o termo novo e confere que sem ele a candidata passava);
  2. NAO-REGRESSAO: os 6 falsos positivos nomeados da auditoria de 24/09
     (5 da regra "cansado" que saiu, 1 do "vou finalizar" solto) NAO ganham a
     penalidade nova;
  3. o termo e ADITIVO: numa frase neutra o score nao muda, e a diferenca com
     vocabulario de encerramento e exatamente _DESPEDIDA_PENALTY;
  4. so pt-BR: em outro idioma o termo nao e aplicado (mesmo bloco dos demais
     bordoes);
  5. bordas do vocabulario: "vou encerrar" SEM a gravacao por perto nao marca,
     "gravata" nao satisfaz a guarda de "grava*", acentos casam.

Roda SEM GPU e sem pesos (funcao pura):

    cd runpod-worker && python3 test_reference_encerramento.py -v
"""
import importlib.util
import sys
import types
import unittest
from pathlib import Path

# ── Stub do soundfile ANTES de importar o módulo (não precisa do binário) ──
if "soundfile" not in sys.modules:
    sys.modules["soundfile"] = types.ModuleType("soundfile")

# Importa reference.py DIRETO do arquivo (sem passar pelo __init__ do pacote,
# que puxa requests/preprocess — dependências que este teste não precisa).
_spec = importlib.util.spec_from_file_location(
    "vp_reference", Path(__file__).resolve().parent / "voice_pipeline" / "reference.py"
)
reference = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(reference)

RUIM = 25.0  # corte de candidata ruim (mesmo valor da ferramenta de 23/09)
PEN = reference._DESPEDIDA_PENALTY
score = reference.score_reference_transcript
encerra = reference._transcript_encerra_gravacao


# ── Os 4 transcripts REAIS de producao (medidos 24/09) ─────────────────────
# As 3 vozes da Aline compartilham a MESMA referencia (mesmo arquivo treinado
# 5x); o CHRIS 03 e o 2o aluno da classe, unico caso que exercita a regra
# "vou encerr + gravacao por perto".
ALINE = (
    "mas e isso. Eu acho que eu vou finalizar, que ja esta dando ate um "
    "pouquinho de enjoo. Acho que ja esta bom. Entao eu fecho aqui, agradeco."
)
CHRIS = (
    "vou encerrar essa gravacao ja se foram 28 minutos, tudo bem eu vou "
    "juntar esses 28 minutos, com os mais os outros 20 e alguma coisinha que "
    "tem la, e nessa mistura de 20 daqui e 20 de la vai dar 40."
)
CASOS_REAIS = {
    "42fe4302 (Aline)": ALINE,
    "b265951f (Aline)": ALINE,
    "d43ba768 (Aline)": ALINE,
    "8225f199 (CHRIS 03)": CHRIS,
}

# ── Os 6 falsos positivos nomeados da auditoria de 24/09 ───────────────────
# (comentario do bloco DESPEDIDA em
#  _frank/ferramentas/2026-09-23_referencia_de_despedida.cjs)
FALSOS_POSITIVOS = {
    "27f22432": "voltou para casa menos cansado",
    "2ec55e46": "cheguei bem cansada em casa",
    "f2496819": "Tem gente que chega cansada",
    "c176dfe5": "voce ja acordou cansado e pensou",
    "8f640ad4": "so fiquei cansada no final",
    "1477c630": "vou finalizar semana que vem com voces, depois do feriado",
}

NEUTRA = (
    "Hoje eu quero falar com voce sobre a importancia de manter uma rotina "
    "de treinos consistente ao longo das semanas."
)


class TestCasosReais(unittest.TestCase):
    """1. Os 4 casos reais pontuam ACIMA de 25 depois do fix, abaixo antes."""

    def test_depois_do_fix_pontuam_acima_do_corte(self):
        for voz, texto in CASOS_REAIS.items():
            with self.subTest(voz=voz):
                self.assertTrue(encerra(texto.lower()), f"{voz}: detector nao marcou")
                self.assertGreater(score(texto), RUIM, f"{voz}: nao passou do corte")

    def test_antes_do_fix_pontuavam_abaixo_do_corte(self):
        # O termo e ADITIVO e e o UNICO acrescimo deste fix: descontar a
        # penalidade reproduz o score de antes. E ele que empurra a candidata
        # pra cima do corte — sem ele, as duas referencias eram "boas"
        # (producao mediu 12,5 e 9,0).
        for voz, texto in CASOS_REAIS.items():
            with self.subTest(voz=voz):
                self.assertLess(score(texto) - PEN, RUIM,
                                f"{voz}: sem o termo novo ja estava acima do corte — "
                                "o teste nao prova nada sobre o fix")


class TestNaoRegressao(unittest.TestCase):
    """2. Os 6 falsos positivos da auditoria NAO ganham a penalidade nova."""

    def test_falsos_positivos_nao_marcam(self):
        for voz, texto in FALSOS_POSITIVOS.items():
            with self.subTest(voz=voz):
                self.assertFalse(encerra(texto.lower()),
                                 f"{voz}: '{texto}' voltou a marcar — a marca inflou de novo")

    def test_falsos_positivos_nao_ganham_a_penalidade_no_score(self):
        # Mesmo quando o fragmento pontua alto por OUTRO motivo (sem pontuacao
        # final etc.), o acrescimo do termo novo tem que ser zero: embrulhar o
        # fragmento numa frase neutra terminada em ponto nao pode somar PEN.
        for voz, texto in FALSOS_POSITIVOS.items():
            with self.subTest(voz=voz):
                com = f"Ele contou que {texto} naquele dia. {NEUTRA}"
                sem = f"Ele contou que estava em casa naquele dia. {NEUTRA}"
                delta = score(com) - score(sem)
                self.assertLess(abs(delta), PEN,
                                f"{voz}: delta {delta} sugere que a penalidade entrou")


class TestTermoAditivo(unittest.TestCase):
    """3. O termo e aditivo e vale exatamente _DESPEDIDA_PENALTY."""

    def test_frase_neutra_nao_muda(self):
        self.assertFalse(encerra(NEUTRA.lower()))

    def test_delta_e_exatamente_a_penalidade(self):
        com = NEUTRA + " Entao eu fecho aqui, agradeco."
        sem = NEUTRA + " Entao eu sigo daqui, agradeco."
        self.assertAlmostEqual(score(com) - score(sem), PEN, places=1)

    def test_penalidade_sozinha_passa_do_corte(self):
        self.assertGreater(PEN, RUIM)


class TestSoPtBr(unittest.TestCase):
    """4. Em outro idioma o termo nao e aplicado."""

    def test_ingles_nao_ganha_a_penalidade(self):
        # Mesmo texto da Aline com language="en": o bloco pt-BR inteiro e
        # pulado, entao o score fica bem abaixo de corte+penalidade.
        self.assertLess(score(ALINE, language="en"), score(ALINE, language="pt"))
        self.assertLess(score(ALINE, language="en"), PEN)


class TestBordasDoVocabulario(unittest.TestCase):
    """5. As exigencias medidas na auditoria de 24/09 estao de pe."""

    def test_vou_encerrar_sem_gravacao_por_perto_nao_marca(self):
        self.assertFalse(encerra("vou encerrar o contrato com o fornecedor amanha"))

    def test_vou_encerrar_com_gravacao_por_perto_marca(self):
        self.assertTrue(encerra("vou encerrar essa gravacao ja se foram 28 minutos"))
        self.assertTrue(encerra("vou encerrar essa gravação, já se foram 28 minutos"))

    def test_gravata_nao_satisfaz_a_guarda(self):
        self.assertFalse(encerra("vou encerrar o no da gravata antes da foto"))

    def test_aquilo_nao_satisfaz_a_guarda_de_aqui(self):
        self.assertFalse(encerra("vou finalizar aquilo tudo que combinamos"))

    def test_acentos_casam(self):
        self.assertTrue(encerra("acho que já está bom"))
        self.assertTrue(encerra("essa é a última gravação de hoje"))
        self.assertTrue(encerra("por hoje é só pessoal"))

    def test_cansado_saiu_do_vocabulario(self):
        self.assertFalse(encerra("estou muito cansada hoje"))


if __name__ == "__main__":
    unittest.main(verbosity=2)
