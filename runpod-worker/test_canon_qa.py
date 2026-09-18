"""Testes da CANONICALIZAÇÃO dos dois lados do comparador de QA (18/09).

O DEFEITO, medido — não suposto. Contei as palavras de `qa->faltantes_amostra`
na tabela `generations` inteira (5.485 gerações, 571 com amostra, 1.035
ocorrências). O topo:

    pra 65 · por 50 · cento 43 · um 22 · em 13 · de 13 · para 11 ·
    skydivethru 11 · zero 11 · esta 9 · esse 9 · ce 8 · naldy 8 ·
    cestaro 8 · virgula 7 · reais 7

Três famílias, e NENHUMA delas é áudio faltando:

 (a) CONTRAÇÃO ORAL. O texto normalizado guarda a forma plena — a guarda de
     mandato do normalizador REVERTE "pra"->"para" de propósito (`PROTEGIDAS`
     em frontend/src/lib/llm/mandato-normalizacao.ts) — e o modelo fala como
     brasileiro fala. O Whisper escreve o que ouviu.
 (b) EXPANSÃO DE NÚMERO/MOEDA/%. O texto vai pro TTS por extenso ("cinco por
     cento", "noventa e sete reais") e o Whisper devolve símbolo ("5%",
     "R$ 97"). O `norm_words` jogava "%", "R$" e a vírgula no lixo junto com o
     resto da pontuação, e a palavra falada virava "faltante".
 (c) NOME PRÓPRIO grafado diferente. Essa NÃO é tratada por canonicalização —
     é separada em `divergencias_de_grafia` (ver `DivergenciaDeGrafiaTest`).

TODOS os casos deste arquivo são TEXTO REAL de produção, com o id da geração
ao lado. Nenhum foi inventado pra fazer a régua passar.

⚠️ O ARQUIVO INTEIRO É PURO: sem GPU, sem whisper, sem rede, sem Supabase. A
transcrição do Whisper é construída com o MESMO `norm_words` que o worker usa,
a partir do texto que o Whisper escreveria — que é o que a régua compara.

    cd runpod-worker && python3 test_canon_qa.py -v
"""
import sys
import types
import unittest

# Stub do soundfile ANTES de importar tts_qa, igual ao test_coverage_qa.
if "soundfile" not in sys.modules:
    sys.modules["soundfile"] = types.ModuleType("soundfile")
sys.modules["soundfile"].write = lambda *a, **k: None

import numpy as np  # noqa: E402
from unittest import mock  # noqa: E402

import tts_qa  # noqa: E402
import tts_qa.loop  # noqa: E402
from tts_qa.canon import canonizar_contracoes, expandir_falado  # noqa: E402
from tts_qa.metrics import divergencias_de_grafia  # noqa: E402

SR = 16000


def ouvido(texto: str, language: str = "pt") -> list:
    """O que o Whisper ENTREGA pro QA, dado o que ele escreveria.

    `transcribe_seg` passa a saída do whisper por `norm_words` antes de
    devolver (loop.py:32) — então é exatamente isto que as réguas recebem.
    """
    return tts_qa.norm_words(texto, language)


def make_seg(seconds: float = 1.0) -> np.ndarray:
    return np.ones(int(SR * seconds), dtype=np.float32) * 0.1


def qa_kwargs(**over):
    base = dict(
        sample_rate=SR, prompt_text=None, qa_language="pt",
        start_qa_enabled=False, start_qa_retries=2, start_qa_model="small",
        echo_qa_enabled=False, echo_qa_retries=3, echo_qa_model="large-v3-turbo",
        coverage_qa_enabled=True, coverage_qa_retries=3, coverage_qa_min=0.85,
        intrusion_qa_enabled=False, intrusion_qa_retries=3,
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


# ── (b) símbolo que se fala ───────────────────────────────────────────────
class ExpandirFaladoTest(unittest.TestCase):
    """`expandir_falado`: função PURA, texto entra, texto sai."""

    def test_porcentagem(self):
        self.assertEqual(expandir_falado("5%").split(), ["5", "por", "cento"])
        self.assertEqual(expandir_falado("5 %").split(), ["5", "por", "cento"])

    def test_moeda_sem_centavos(self):
        self.assertEqual(expandir_falado("r$ 97").split(), ["97", "reais"])

    def test_moeda_com_centavos(self):
        # A ORDEM é o ponto: o símbolo vem antes do número no texto e a palavra
        # vem depois na fala. Trocar "r$" por "reais" no lugar não bastaria.
        self.assertEqual(
            expandir_falado("r$10,03").split(), ["10", "reais", "e", "03", "centavos"])

    def test_moeda_de_um_real_fica_no_singular(self):
        self.assertEqual(expandir_falado("r$ 1").split(), ["1", "real"])
        self.assertEqual(
            expandir_falado("r$ 5,01").split(), ["5", "reais", "e", "01", "centavo"])

    def test_decimal_fala_o_zero_da_esquerda(self):
        # "zero vírgula zero vinte e cinco" é o que o normalizador escreve.
        self.assertEqual(
            expandir_falado("0,025").split(), ["0", "virgula", "zero", "25"])
        self.assertEqual(
            expandir_falado("0,05").split(), ["0", "virgula", "zero", "5"])

    def test_separador_de_milhar_some(self):
        self.assertEqual(expandir_falado("1.000").strip(), "1000")

    def test_ponto_final_nao_e_separador_de_milhar(self):
        # "1.0000" tem 4 dígitos depois do ponto: não é milhar.
        self.assertEqual(expandir_falado("1.0000").strip(), "1.0000")

    def test_idempotente(self):
        uma = expandir_falado("r$ 12,50 e 5%")
        self.assertEqual(expandir_falado(uma), uma)

    def test_so_pt(self):
        # Sem caso medido em en/es, chutar convenção estrangeira seria inventar
        # régua. As duas funções devolvem a entrada intacta.
        self.assertEqual(expandir_falado("5%", "en"), "5%")
        self.assertEqual(canonizar_contracoes(["pra"], "en"), ["pra"])


class NumeroMoedaPorcentagemTest(unittest.TestCase):
    """Os casos de produção da família (b), conferidos um a um no `text_raw`."""

    def test_porcento_geracao_31e26482(self):
        # text_raw: "cerca de 5 porcento das mulheres" — faltantes gravados:
        # ["por","cento"]. O normalizador escreve "cinco por cento"; o Whisper
        # escreve "5%".
        texto = "cerca de cinco por cento das mulheres"
        self.assertEqual(tts_qa.chunk_coverage(ouvido("cerca de 5% das mulheres"), texto), 1.0)
        self.assertEqual(
            tts_qa.palavras_faltantes(ouvido("cerca de 5% das mulheres"), texto), [])

    def test_porcento_junto_do_aluno(self):
        # Se o normalizador não rodar, o texto cru chega com "porcento" colado.
        self.assertEqual(
            tts_qa.chunk_coverage(ouvido("cerca de 5% das mulheres"),
                                  "cerca de 5 porcento das mulheres"), 1.0)

    def test_moeda_geracao_8101e36a(self):
        # text_raw: "R$ 97 à vista ou 12x de R$10,03" — faltantes gravados:
        # ["reais","reais","centavos"].
        texto = "o valor e de noventa e sete reais a vista"
        self.assertEqual(tts_qa.chunk_coverage(ouvido("o valor é de R$ 97 à vista"), texto), 1.0)
    def test_moeda_conserta_o_centavo_mas_x_de_parcela_NAO_esta_coberto(self):
        # MESMA geração 8101e36a, segunda metade: "12x de R$10,03". O centavo
        # passa a casar; o "x" de parcela (que o normalizador lê "doze vezes")
        # NÃO — abreviação é outra família, não está neste PR, e este teste
        # existe pra travar o limite em vez de deixá-lo implícito.
        texto = "doze vezes de dez reais e tres centavos"
        got = ouvido("12x de R$10,03")
        self.assertEqual(tts_qa.palavras_faltantes(got, texto), ["vezes"])
        self.assertEqual(tts_qa.chunk_coverage(got, texto), 0.875)  # 7 de 8

    def test_decimal_com_porcentagem_geracao_0a0c9413(self):
        # text_raw: "0,025% ou à 0,05%" — faltantes gravados, DUAS vezes:
        # ["virgula","zero","por","cento"].
        texto = ("o retinol de entrada zero virgula zero vinte e cinco por cento "
                 "ou zero virgula zero cinco por cento")
        got = ouvido("o retinol de entrada 0,025% ou 0,05%")
        self.assertEqual(tts_qa.chunk_coverage(got, texto), 1.0)
        self.assertEqual(tts_qa.palavras_faltantes(got, texto), [])

    def test_antes_da_correcao_esses_casos_perdiam_palavra(self):
        # A prova de que o teste acima não é tautologia: sem `expandir_falado`,
        # os MESMOS dois lados perdem exatamente as palavras que o banco
        # registrou. Reproduz a régua velha com a nova desligada.
        with mock.patch.object(tts_qa.text, "expandir_falado", lambda s, lang="pt": s):
            texto = "cerca de cinco por cento das mulheres"
            velho = tts_qa.palavras_faltantes(
                tts_qa.norm_words("cerca de 5% das mulheres"), texto)
            self.assertEqual(velho, ["por", "cento"])


# ── (a) contração oral ────────────────────────────────────────────────────
class ContracaoOralTest(unittest.TestCase):

    def test_caso_katia_019c58d1_provado_pelo_ouvido(self):
        # Geração 019c58d1-5eb9-410f-aa0a-66b4dcc399d8 (16/09). O áudio foi
        # OUVIDO e transcrito com carimbo de tempo: ÍNTEGRO, nada suprimido —
        # o modelo disse "tá". `faltantes_amostra` gravado: ["esta","esta"],
        # e `coverage_min_visto=0.75` fecha a conta sozinho (o chunk tem 8
        # palavras e 6 casaram: 6/8 = 0,75).
        texto = "Eu sei que está doendo, que está difícil"
        got = ouvido("Eu sei que tá doendo, que tá difícil")
        self.assertEqual(tts_qa.chunk_coverage(got, texto), 1.0)
        self.assertEqual(tts_qa.palavras_faltantes(got, texto), [])

    def test_caso_katia_a_regua_velha_dava_exatamente_0_75(self):
        # Ancora o número do banco: sem a canonicalização, a cobertura do
        # chunk 1 da Katia é 0.75 e os faltantes são ["esta","esta"].
        with mock.patch.object(tts_qa.text, "canonizar_contracoes",
                               lambda p, lang="pt": p):
            texto = "Eu sei que está doendo, que está difícil"
            got = tts_qa.norm_words("Eu sei que tá doendo, que tá difícil")
            self.assertEqual(tts_qa.chunk_coverage(got, texto), 0.75)
            self.assertEqual(tts_qa.palavras_faltantes(got, texto), ["esta", "esta"])

    def test_pra_para_nos_dois_sentidos(self):
        # "pra" é o faltante nº 1 (65) e "para" aparece 11 vezes — o MESMO
        # defeito visto dos dois lados, porque o texto às vezes tem a forma
        # plena e às vezes a falada.
        self.assertEqual(tts_qa.chunk_coverage(ouvido("vim pra ficar"), "vim para ficar"), 1.0)
        self.assertEqual(tts_qa.chunk_coverage(ouvido("vim para ficar"), "vim pra ficar"), 1.0)

    def test_pro_carrega_o_artigo(self):
        self.assertEqual(canonizar_contracoes(["pro"]), ["para", "o"])
        self.assertEqual(canonizar_contracoes(["pros"]), ["para", "os"])
        self.assertEqual(tts_qa.chunk_coverage(ouvido("olha pro lado"), "olha para o lado"), 1.0)

    def test_ce_e_voce(self):
        self.assertEqual(tts_qa.chunk_coverage(ouvido("cê vai gostar"), "você vai gostar"), 1.0)

    def test_formas_do_verbo_estar(self):
        self.assertEqual(tts_qa.chunk_coverage(ouvido("eu tô aqui"), "eu estou aqui"), 1.0)
        self.assertEqual(tts_qa.chunk_coverage(ouvido("tava frio"), "estava frio"), 1.0)

    def test_idempotente(self):
        uma = canonizar_contracoes(["pra", "ta", "ce"])
        self.assertEqual(canonizar_contracoes(uma), uma)


class OQueEuRecuseiFazerTest(unittest.TestCase):
    """As equivalências que o cartão pedia e eu NÃO fiz — com o motivo travado.

    Um teste que prova uma AUSÊNCIA vale tanto quanto um que prova presença:
    sem ele, a próxima pessoa "conserta" o que está faltando aqui sem saber que
    foi deixado de fora de propósito.
    """

    def test_num_NAO_vira_nao(self):
        # "num" é as duas coisas em português: "num vou" (não vou) e "num dia"
        # (em um dia). Casar "num" com "não" faria um "não" de verdade, COMIDO
        # pelo modelo, aparecer como presente — e "não" é literalmente o
        # exemplo que o docstring de `palavras_faltantes` usa pra "o modelo
        # comeu palavra do aluno". O erro cairia pro lado perigoso.
        self.assertEqual(canonizar_contracoes(["num", "dia"]), ["num", "dia"])
        # e a consequência que isto protege: "não" comido continua faltante.
        self.assertEqual(
            tts_qa.palavras_faltantes(ouvido("eu num vou"), "eu não vou"), ["nao"])

    def test_tao_NAO_vira_estao(self):
        # "tão bonito" é advérbio. Sem acento, "tão" e "tao" são o mesmo token
        # e não há como separar os dois usos.
        self.assertEqual(canonizar_contracoes(["tao", "bonito"]), ["tao", "bonito"])

    def test_ce_nao_invade_sigla_soletrada(self):
        # "ce" é contração de "você" E nome da letra C. Expandir no meio de uma
        # soletração inventaria um "você" onde há uma letra — e soletração já
        # MATOU job no incidente #52.
        self.assertEqual(
            canonizar_contracoes(["ce", "be", "esse"]), ["ce", "be", "esse"])
        self.assertEqual(canonizar_contracoes(["ola", "ce", "vai"]), ["ola", "voce", "vai"])


# ── (c) nome próprio: separado, não perdoado ──────────────────────────────
class DivergenciaDeGrafiaTest(unittest.TestCase):
    """A família (c) NÃO é afrouxada: ganha classe própria e fica contável."""

    def test_cestaro_geracao_b90bcbe0(self):
        # text_raw: "Oi, sou João Cestaro terapeuta". "cestaro" aparece 8 vezes
        # entre os faltantes — o áudio diz o nome, o Whisper grafa diferente.
        texto = "sou joao sestaro terapeuta"
        got = ouvido("sou joão cestaro terapeuta")
        self.assertEqual(divergencias_de_grafia(got, texto), ["sestaro>cestaro"])
        self.assertEqual(tts_qa.palavras_faltantes(got, texto), [])
        self.assertEqual(tts_qa.chunk_coverage(got, texto), 1.0)

    def test_naldy_geracao_a7130d7e(self):
        texto = "eu sou henrique naldy"
        got = ouvido("eu sou henrique naldi")
        self.assertEqual(divergencias_de_grafia(got, texto), ["naldy>naldi"])
        self.assertEqual(tts_qa.palavras_faltantes(got, texto), [])

    def test_skydivethru_geracao_7f928a1d_whisper_separa(self):
        # O Whisper parte o nome em duas palavras; o critério de prefixo
        # (o mesmo de `chunk_intrusions`) reconhece o pedaço.
        texto = "a skydivethru e uma escola"
        got = ouvido("a skydive thru é uma escola")
        self.assertEqual(divergencias_de_grafia(got, texto), ["skydivethru>skydive"])
        self.assertEqual(tts_qa.palavras_faltantes(got, texto), [])

    def test_contrato_none_igual_ao_da_cobertura(self):
        self.assertIsNone(divergencias_de_grafia(None, "qualquer texto"))
        self.assertIsNone(divergencias_de_grafia(["a"], "..."))
        self.assertEqual(divergencias_de_grafia(ouvido("ola mundo"), "ola mundo"), [])

    def test_a_conta_fecha(self):
        # casadas + grafias + faltantes == len(expected). É o que torna a
        # separação auditável em vez de opinião.
        texto = "sou joao sestaro terapeuta do rio"
        got = ouvido("sou joão cestaro do rio")
        expected = tts_qa.norm_words(texto)
        d = tts_qa.metrics._diagnostico(expected, got)
        self.assertEqual(
            d.casadas + len(d.grafias) + len(d.faltantes_i), len(expected))


# ── CONTROLE NEGATIVO: a régua nova ainda REPROVA defeito de verdade ──────
class ControleNegativoTest(unittest.TestCase):
    """Régua que não reprova nada é pior que a atual. Estes provam que reprova.

    O ponto estrutural: grafia só nasce de opcode `replace`, onde o Whisper
    OUVIU alguma coisa. O defeito que este QA existe pra pegar (caso Katia
    19/08: o modelo pula um pedação, chunk mudo, áudio que começa no meio) vira
    opcode `delete`, onde não há palavra ouvida pra parear — e ali NADA é
    perdoado.
    """

    TEXTO = ("sou joao sestaro terapeuta e estou aqui para te acompanhar "
             "em um processo de mudanca profunda")

    def test_palavra_realmente_comida_continua_faltante(self):
        got = ouvido("sou joao sestaro e estou aqui para te acompanhar "
                     "em um processo de mudanca profunda")
        self.assertIn("terapeuta", tts_qa.palavras_faltantes(got, self.TEXTO))
        self.assertLess(tts_qa.chunk_coverage(got, self.TEXTO), 1.0)

    def test_trecho_continuo_comido_continua_reprovando(self):
        # Metade final do texto ausente — o padrão do caso Katia.
        palavras = tts_qa.norm_words(self.TEXTO)
        got = palavras[: len(palavras) // 2]
        cov = tts_qa.chunk_coverage(got, self.TEXTO)
        self.assertLess(cov, 0.85)                       # abaixo da régua
        self.assertGreater(tts_qa.maior_lacuna(got, self.TEXTO), 5)
        self.assertEqual(divergencias_de_grafia(got, self.TEXTO), [])

    def test_chunk_mudo_continua_cobertura_zero(self):
        self.assertEqual(tts_qa.chunk_coverage([], self.TEXTO), 0.0)
        self.assertEqual(divergencias_de_grafia([], self.TEXTO), [])

    def test_palavra_trocada_por_outra_diferente_continua_faltante(self):
        # "profunda" -> "amarela": ratio 0.29, longe dos 0.7. Não é grafia.
        got = ouvido(self.TEXTO.replace("profunda", "amarela"))
        self.assertIn("profunda", tts_qa.palavras_faltantes(got, self.TEXTO))
        self.assertEqual(divergencias_de_grafia(got, self.TEXTO), [])

    def test_uma_palavra_ouvida_nao_absolve_tres_no_texto(self):
        # Sem consumir a palavra ouvida, um único "casa" absolveria
        # "casa casa casa" — e um trecho repetido comido passaria limpo.
        texto = "a casa casa casa fica ali"
        got = ouvido("a casa fica ali")
        self.assertEqual(tts_qa.palavras_faltantes(got, texto), ["casa", "casa"])

    def test_no_laco_inteiro_o_defeito_ainda_regenera(self):
        # A prova que vale mais: o LAÇO de verdade, com o gate ligado. 1a
        # tentativa comida → reprova e regenera; 2a íntegra → passa.
        palavras = tts_qa.norm_words(self.TEXTO)
        transcripts = iter([palavras[: len(palavras) // 2], palavras])
        stats = fresh_stats()
        seg_ruim, seg_bom = make_seg(), make_seg(2.0)
        with mock.patch.object(tts_qa.loop, "transcribe_seg",
                               side_effect=lambda *a, **k: next(transcripts)):
            best, cov, _lac, _ti, falt, graf = tts_qa.run_chunk_qa(
                seg_ruim, 1, self.TEXTO, regen_fn=lambda: seg_bom,
                qa_stats=stats, **qa_kwargs())
        self.assertEqual(stats["coverage_flagged"], 1)
        self.assertEqual(stats["regens"], 1)
        self.assertEqual(cov, 1.0)
        self.assertIs(best, seg_bom)
        self.assertEqual(falt, [])
        self.assertEqual(graf, [])

    def test_no_laco_inteiro_grafia_NAO_gasta_regeneracao(self):
        # O outro lado da mesma prova: nome próprio grafado diferente entrega
        # na 1a tentativa, sem regen. É aqui que o relógio deixa de ser
        # queimado com fantasma.
        got = ouvido("sou joão cestaro terapeuta e estou aqui para te "
                     "acompanhar em um processo de mudança profunda")
        stats = fresh_stats()
        seg = make_seg()
        with mock.patch.object(tts_qa.loop, "transcribe_seg",
                               side_effect=lambda *a, **k: got):
            _b, cov, _lac, _ti, falt, graf = tts_qa.run_chunk_qa(
                seg, 0, self.TEXTO, regen_fn=lambda: seg,
                qa_stats=stats, **qa_kwargs())
        self.assertEqual(stats["regens"], 0)
        self.assertEqual(stats["coverage_flagged"], 0)
        self.assertEqual(stats["exhausted"], 0)
        self.assertEqual(cov, 1.0)
        self.assertEqual(falt, [])
        self.assertEqual(graf, ["sestaro>cestaro"])


# ── telemetria da classe nova ─────────────────────────────────────────────
class RegistrarGrafiasTest(unittest.TestCase):
    """`registrar_grafias`: espelho exato de `registrar_faltantes`."""

    def test_acumula_total_e_denominador(self):
        st = {}
        tts_qa.registrar_grafias(st, ["a>b"])
        tts_qa.registrar_grafias(st, ["c>d", "e>f"])
        self.assertEqual(st["grafia_total"], 3)
        self.assertEqual(st["grafia_medido_n"], 2)
        self.assertEqual(st["grafia_pior_n"], 2)
        self.assertEqual(st["grafia_amostra"], ["c>d", "e>f"])

    def test_sem_veredito_fecha_a_conta(self):
        st = {}
        tts_qa.registrar_grafias(st, None)
        tts_qa.registrar_grafias(st, [])
        self.assertEqual(st["grafia_sem_veredito"], 1)
        self.assertEqual(st["grafia_medido_n"], 1)
        # entregues = medido_n + sem_veredito
        self.assertEqual(st["grafia_medido_n"] + st["grafia_sem_veredito"], 2)

    def test_campos_nascem_no_primeiro_medido_mesmo_com_zero(self):
        # Mesma armadilha que o resto do arquivo evita: campo AUSENTE ao lado
        # de um denominador presente é "não mediu" indistinguível de "mediu e
        # deu zero".
        st = {}
        tts_qa.registrar_grafias(st, [])
        self.assertEqual(st["grafia_total"], 0)
        self.assertEqual(st["grafia_pior_n"], 0)
        self.assertEqual(st["grafia_amostra"], [])

    def test_teto_da_amostra(self):
        st = {}
        tts_qa.registrar_grafias(st, [f"a{i}>b{i}" for i in range(50)], amostra_max=3)
        self.assertEqual(len(st["grafia_amostra"]), 3)
        self.assertEqual(st["grafia_pior_n"], 50)  # denuncia o corte

    def test_amostra_zero_desliga_so_a_amostra(self):
        st = {}
        tts_qa.registrar_grafias(st, ["a>b", "c>d"], amostra_max=0)
        self.assertEqual(st["grafia_amostra"], [])
        self.assertEqual(st["grafia_total"], 2)


if __name__ == "__main__":
    unittest.main(verbosity=2)
