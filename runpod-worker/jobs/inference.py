"""Job de INFERENCIA: texto -> audio na voz do aluno.

Este e' o caminho quente do produto: toda geracao de todo aluno passa aqui.
O trabalho esta dividido em tres arquivos:

  tts_settings.py     os ~30 botoes (env var + override por request)
  inference_setup.py  LoRA, referencia e carga do modelo
  inference.py        o laco de geracao chunk a chunk (este)

Testes: test_refactor_smoke.py roda o caminho inteiro com o VoxCPM stubado.
"""
from __future__ import annotations

import time

import numpy as np
import soundfile as sf

from audio_ops import crossfade_concat, trim_silence, wav_to_base64
from tts_qa.rate import measure_file_rate, measure_seg_rate, stretch
from model_loader import free_cuda
from tts_qa import norm_words, registrar_cobertura, run_chunk_qa
from tts_qa.metrics import fim_abrupto, ultima_palavra_truncada
from tts_qa.loop import palavras_com_tempo
from tts_text import split_text_for_tts, split_below_sentence
from worker_config import WORKSPACE
from worker_log import log as _log, phase as _phase

from .inference_setup import baixar_lora, carregar_modelo, preparar_referencia
from .tts_settings import TtsSettings


def handle_inference(inp: dict) -> dict:
    text = inp.get("text")
    if not text:
        return {"error": "missing 'text'"}
    if inp.get("prompt_text") and not inp.get("prompt_wav_url"):
        return {"error": "prompt_text provided without prompt_wav_url"}
    return InferenceJob(inp, text).run()


class InferenceJob:
    """Uma geracao, do texto ao wav.

    Chunking por frase + trim + crossfade: cada chunk e' UMA chamada de generate
    independente, com a MESMA referencia (re-ancora -> mata drift + gradual
    speed-up). Tira silencio das pontas de cada chunk e junta com crossfade pra
    eliminar costuras audiveis. Recomendado em discussao oficial:
    https://github.com/OpenBMB/VoxCPM/issues/302
    Doc base: https://voxcpm.readthedocs.io/en/latest/usage_guide.html
    """

    def __init__(self, inp: dict, text: str):
        self.inp = inp
        self.text = text
        self.cfg = TtsSettings.do_job(inp)
        self.output_upload_url = inp.get("output_upload_url")
        self.prompt_text = inp.get("prompt_text")
        self.prompt_wav_local: str | None = None
        self.model = None
        self.sample_rate = 0
        self.t0 = 0.0
        # Observabilidade do QA (29/07): devolvida no output do job — tira a
        # adivinhacao por timing na hora de validar se o QA esta mesmo agindo.
        # coverage_* (19/08): mede se o remedio do caso Katia esta pegando.
        # coverage_min_visto/medio/medido_n (26/08): a cobertura MEDIDA tambem
        # no caminho de SUCESSO — antes so existia no payload de falha, e sem
        # ela nao dava pra saber a que distancia da regua os audios entregues
        # passam. coverage_idioma_* (26/08): a 2a opiniao de idioma deixa
        # rastro mesmo quando roda e NAO melhora. Inicializados de proposito:
        # chave ausente nao distingue "nao rodou" de "rodou e deu zero".
        self.qa_stats = {
            "echo_checked": 0, "echo_flagged": 0, "echo_none": 0,
            "coverage_checked": 0, "coverage_flagged": 0, "coverage_none": 0,
            "coverage_exhausted": 0,
            "coverage_min_visto": None, "coverage_medio": None,
            "coverage_soma": 0.0, "coverage_medido_n": 0,
            "coverage_idioma_checked": 0, "coverage_idioma_divergente": 0,
            "coverage_idioma_corrigido": 0,
            "intrusion_checked": 0, "intrusion_flagged": 0, "intrusion_none": 0,
            "regens": 0, "exhausted": 0,
            # #226: severidade do que foi ENTREGUE com o QA reprovando. O
            # `exhausted` sozinho e' so contagem — nao separa "20% rapido
            # demais" de "comeu uma palavra". Faixas documentadas em
            # tts_qa/loop.py, no ponto que grava estes campos.
            "exhausted_score_max": None, "exhausted_scores": [],
            "tail_checked": 0, "tail_flagged": 0, "tail_none": 0, "tail_healed": 0,
            "tail_word_flagged": 0,
        }
        # Instrumentação d3d8d1b2: tentativa POR CHUNK (1 = geração original,
        # 2+ = regen do QA) — sem isso o heartbeat não distingue os dois.
        self._chunk_attempts: dict[int, int] = {}

    # ── Orquestracao ───────────────────────────────────────────────────────
    def run(self) -> dict:
        lora_path = baixar_lora(self.inp.get("lora_url"))
        self.prompt_wav_local, self.prompt_text = preparar_referencia(
            self.inp, self.inp.get("prompt_wav_url"), self.prompt_text,
            self.cfg.ref_tail_silence_ms,
        )
        self.model, self.sample_rate = carregar_modelo(self.inp, lora_path)
        self._medir_em_amostras()
        self._definir_regua_de_ritmo()

        chunks = split_text_for_tts(self.text, max_chars=self.cfg.chunk_max) or [(self.text, False)]
        _log(
            "info", "inference.start", text_len=len(self.text), chunks=len(chunks),
            chunk_max=self.cfg.chunk_max, silence_ms=self.cfg.silence_ms,
            crossfade_ms=self.cfg.crossfade_ms, trim=self.cfg.trim_enabled,
            trim_thresh=self.cfg.trim_threshold,
            has_clone=bool(self.prompt_wav_local), has_lora=bool(lora_path),
            timesteps=self.cfg.inference_timesteps,
        )
        self.t0 = time.monotonic()

        pieces, falha = self._gerar_todos_os_chunks(chunks)
        if falha is not None:
            return self._resultado_incompleto(falha)

        wav = self._ajustar_ritmo_global(self._montar(pieces))
        elapsed = time.monotonic() - self.t0
        _log("info", "inference.done", elapsed_s=round(elapsed, 2),
             samples=len(wav), chunks=len(chunks))
        # Modelo nao e' mais necessario (wav pronto) — solta a VRAM ANTES do
        # upload pra o proximo job deste worker (inclusive um treino) nascer
        # com GPU limpa.
        self._soltar_modelo()
        return self._entregar(wav, elapsed)

    def _medir_em_amostras(self) -> None:
        """Os tempos em ms viram nº de amostras (dependem do sample_rate)."""
        c = self.cfg
        self.silence_samples = c.amostras(c.silence_ms, self.sample_rate)
        self.crossfade_samples = c.amostras(c.crossfade_ms, self.sample_rate)
        self.trim_pad_samples = c.amostras(c.trim_pad_ms, self.sample_rate)
        self.par_pause_samples = c.amostras(c.par_pause_ms, self.sample_rate)

    def _definir_regua_de_ritmo(self) -> None:
        """Regua do QA de ritmo: `speech_rate_wps` da voz; sem ela, a articulacao
        da referencia (uma medida por job). Sem referencia nao ha QA de ritmo."""
        self.target_wps = None
        c = self.cfg
        if not c.rate_qa_enabled or not self.prompt_wav_local:
            return
        origem = "voz"
        alvo = c.target_wps
        if not alvo:
            alvo = measure_file_rate(self.prompt_wav_local, c.rate_qa_model, c.qa_language)
            origem = "referencia"
        if alvo and c.speech_rate_factor != 1.0:
            alvo = round(alvo * c.speech_rate_factor, 2)  # escolha do aluno na tela
        self.target_wps = alvo
        _log("info", "inference.rate_qa.regua", alvo=alvo, origem=origem,
             fator=c.speech_rate_factor,
             tolerancia=c.rate_qa_tolerance, max_stretch=c.rate_qa_max_stretch)

    def _ajustar_ritmo_global(self, wav: np.ndarray) -> np.ndarray:
        """Depois da montagem: UM ajuste uniforme e suave no audio inteiro
        (caso Johnny 25/08: esticar cada chunk com fator proprio ate 0,75 soou
        'bebado' e criou o lento->rapido). Aqui o fator e' unico, limitado a
        max_stretch (0,85 = no maximo 18% mais longo; era 0,90) e simetrico (tambem
        acelera se ficou lento demais). Sem regua ou sem medida: nao toca."""
        if not self.target_wps or wav is None or wav.size < self.sample_rate:
            return wav
        c = self.cfg
        with _phase("inference.rate_global"):
            medido = measure_seg_rate(wav, self.sample_rate, c.rate_qa_model, c.qa_language)
        if not medido:
            return wav
        desvio = medido / self.target_wps - 1.0
        fator = 1.0
        if desvio > c.rate_qa_tolerance:
            fator = max(c.rate_qa_max_stretch, self.target_wps / medido)
        elif desvio < -c.rate_qa_tolerance:
            fator = min(1.0 / c.rate_qa_max_stretch, self.target_wps / medido)
        _log("info", "inference.rate_global", medido=medido, alvo=self.target_wps,
             desvio=round(desvio, 3), fator=round(fator, 3))
        self.qa_stats["rate_global_wps"] = medido
        if fator != 1.0:
            self.qa_stats["rate_stretched"] = self.qa_stats.get("rate_stretched", 0) + 1
            self.qa_stats["rate_global_fator"] = round(fator, 3)
            return stretch(wav, self.sample_rate, fator)
        return wav

    def _soltar_modelo(self) -> None:
        self.model = None
        free_cuda()

    # ── Geracao ────────────────────────────────────────────────────────────
    def _gerar(self, chunk_text: str, chunk_idx: int = -1,
               cfg_value: "float | None" = None) -> np.ndarray:
        """Chamada 1:1 com o desktop (VoiceLoraStudio/core.py:841-853).
        `cfg_value` so e passado pelo resgate nivel 2 (#52): e a unica
        alavanca que muda a geracao entre tentativas."""
        attempt = self._chunk_attempts.get(chunk_idx, 0) + 1
        self._chunk_attempts[chunk_idx] = attempt
        with _phase("inference.chunk.generate", chunk=chunk_idx, attempt=attempt,
                    chars=len(chunk_text), cfg=cfg_value):
            return self._gerar_bruto(chunk_text, cfg_value=cfg_value)

    def _gerar_bruto(self, chunk_text: str, cfg_value: "float | None" = None) -> np.ndarray:
        # README oficial (Ultimate Cloning): "For maximum cloning similarity,
        # pass the same reference clip to BOTH reference_wav_path and
        # prompt_wav_path". So passavamos o prompt (25/08). Desligavel por env.
        ref_kw = (
            {"reference_wav_path": self.prompt_wav_local}
            if self.cfg.reference_wav_too and self.prompt_wav_local else {}
        )
        seg = self.model.generate(
            text=chunk_text,
            prompt_wav_path=self.prompt_wav_local,
            prompt_text=self.prompt_text,
            **ref_kw,
            cfg_value=self.cfg.cfg_value if cfg_value is None else cfg_value,
            inference_timesteps=self.cfg.inference_timesteps,
            max_len=4096,
            normalize=self.cfg.normalize,
            denoise=False,
            retry_badcase=True,
            retry_badcase_max_times=self.cfg.retry_max,
            retry_badcase_ratio_threshold=self.cfg.retry_ratio,
        )
        return np.asarray(seg, dtype=np.float32)

    def _aparar(self, s: np.ndarray, idx: int) -> np.ndarray:
        if not self.cfg.trim_enabled:
            return s
        # 1o chunk ganha pad maior na borda pra nao comer consoante fraca de
        # abertura (o "h" de "hoje" fica abaixo do threshold de -46dB).
        pad = (max(self.trim_pad_samples, int(self.sample_rate * 0.06))
               if idx == 0 else self.trim_pad_samples)
        return trim_silence(s, threshold=self.cfg.trim_threshold, pad_samples=pad)

    # Frase-isca: some do áudio entregue, existe só pra dar ao modelo um
    # "depois" — é no fecho do último trecho que ele decepa.
    ISCA = "Muito obrigada."

    def _fim_ainda_ruim(self, seg) -> bool:
        """As DUAS provas, não só o envelope.

        Erro que custou uma rodada de build (26/08): a cura só era chamada
        quando o ENVELOPE acusava. O áudio da Carol saiu com envelope 0,0143 —
        passou raspando no limiar 0,015 — mas com "nutricionista" em 0,38s e
        "sua" em 0,00s: truncado na cara, e a cura nunca foi chamada.
        O envelope é barato e pega o corte grosseiro; a duração da palavra pega
        o corte fino. Uma só das duas deixa passar.
        """
        if fim_abrupto(seg, self.sample_rate):
            return True
        return bool(ultima_palavra_truncada(
            palavras_com_tempo(seg, self.sample_rate, self.cfg.echo_qa_model, self.cfg.qa_language)
        ))

    def _curar_fim_abrupto(self, seg, idx: int, chunk: str):
        """Cura o fim decepado GERANDO ALÉM e cortando no lugar certo.

        Histórico honesto (caso Carol, 26/08), tudo medido na mesma voz:
          "…sua nutricionista."     -> 0,071 / 0,062 / 0,096  cortado SEMPRE
          "…sua nutricionista..."   -> 0,014                  melhorou, mas
             na 2ª rodada em prod voltou a cortar: reticências não bastam.
          "…nutricionista. Seja bem-vinda." -> 0,002           ÍNTEGRO
        Ou seja: o que conserta não é a pontuação, é existir fala DEPOIS. Então
        geramos com uma frase-isca no fim e cortamos o áudio no fim da última
        palavra do texto do aluno — o tempo vem do whisper, não de chute.

        Se qualquer etapa não fechar, devolve o áudio original: nunca entrega
        algo pior nem corta no escuro.
        """
        alvo = chunk.rstrip()
        if not alvo:
            return seg
        bruto = self._aparar(self._gerar(f"{alvo} {self.ISCA}", idx), idx)
        palavras = palavras_com_tempo(
            bruto, self.sample_rate, self.cfg.echo_qa_model, self.cfg.qa_language
        )
        n_isca = len([w for w in self.ISCA.split() if w])
        if len(palavras) <= n_isca:
            return seg
        ultima = palavras[-(n_isca + 1)]
        fim_s = getattr(ultima, "end", None)
        if fim_s is None and isinstance(ultima, dict):
            fim_s = ultima.get("end")
        if fim_s is None:
            return seg
        # +120 ms: deixa a consoante final respirar antes do corte.
        corte = min(int((float(fim_s) + 0.12) * self.sample_rate), bruto.size)
        if corte <= 0:
            return seg
        candidato = bruto[:corte]
        if self._fim_ainda_ruim(candidato):
            return seg
        self.qa_stats["tail_healed"] = self.qa_stats.get("tail_healed", 0) + 1
        _log("info", "inference.tail_qa.curado", idx=idx,
             corte_s=round(float(fim_s) + 0.12, 2), palavras=len(palavras))
        return candidato

    def _rodar_qa(self, seg, idx: int, chunk: str, eh_ultimo: bool = False,
                  cfg_value: "float | None" = None):
        c = self.cfg
        return run_chunk_qa(
            seg, idx, chunk,
            regen_fn=lambda: self._aparar(self._gerar(chunk, idx, cfg_value=cfg_value), idx),
            alucinacao_min=c.qa_alucinacao_min,
            alucinacao_max_seguidas=c.qa_alucinacao_max_seguidas,
            sample_rate=self.sample_rate,
            prompt_text=self.prompt_text,
            qa_language=c.qa_language,
            start_qa_enabled=c.start_qa_enabled,
            start_qa_retries=c.start_qa_retries,
            start_qa_model=c.start_qa_model,
            echo_qa_enabled=c.echo_qa_enabled,
            echo_qa_retries=c.echo_qa_retries,
            echo_qa_model=c.echo_qa_model,
            coverage_qa_enabled=c.coverage_qa_enabled,
            coverage_qa_retries=c.coverage_qa_retries,
            coverage_qa_min=c.coverage_qa_min,
            intrusion_qa_enabled=c.intrusion_qa_enabled,
            intrusion_qa_retries=c.intrusion_qa_retries,
            qa_stats=self.qa_stats,
            rate_target=self.target_wps,
            rate_tolerance=c.rate_qa_tolerance,
            rate_retries=c.rate_qa_retries,
            rate_model=c.rate_qa_model,
            eh_ultimo_chunk=eh_ultimo,
        )

    def _entregar_mesmo_com_cobertura_baixa(self, idx, chunk, coverage, lacuna) -> bool:
        """DUAS CONDICOES pra derrubar o job (mudanca de 20/08):
          (1) cobertura abaixo do minimo, E
          (2) o que falta e' um TRECHO CONTINUO grande.

        Antes bastava a (1) — e isso reprovava AUDIO PERFEITO toda vez que o
        texto do aluno tinha algo que nao se fala (numero por extenso,
        **markdown**, emoji, rotulo de locutor num roteiro de dialogo). Foram 3
        variacoes medidas em 24h, cada uma custando o audio de um aluno, e
        sempre nascia uma nova: lista de excecao e' corrida perdida.

        O defeito de VERDADE (caso Katia) tem forma diferente: o modelo pula um
        pedacao — chunk mudo ou audio comecando no meio —, entao some um trecho
        CONTINUO. Markup some em palavras SOLTAS. Medir a forma do buraco separa
        os dois sem precisar saber quais simbolos existem no mundo. Teto: o
        maior entre COVERAGE_QA_GAP_MIN palavras e 20% do chunk (chunk curto nao
        pode ser derrubado por um buraco de 6 palavras que e' metade dele).

        True = ENTREGA assim mesmo. False = o job cai.
        """
        palavras_chunk = len(norm_words(chunk, self.cfg.qa_language))
        limite_lacuna = max(self.cfg.coverage_qa_gap_min, int(palavras_chunk * 0.20))
        if lacuna is None or lacuna >= limite_lacuna:
            return False
        # Cobertura baixa MAS espalhada: e' texto que nao se fala, nao fala que
        # sumiu. ENTREGA — e deixa o rastro no log pra medir se essa decisao
        # esta certa na pratica.
        self.qa_stats["coverage_espalhada"] = self.qa_stats.get("coverage_espalhada", 0) + 1
        _log(
            "info", "inference.coverage.espalhada", idx=idx,
            coverage=coverage, maior_lacuna=lacuna,
            limite=limite_lacuna, palavras=palavras_chunk,
        )
        return True

    def _gerar_todos_os_chunks(self, chunks):
        """Devolve (pedacos_de_audio, falha_de_cobertura_ou_None)."""
        pieces: list[np.ndarray] = []
        for idx, (chunk, ends_paragraph) in enumerate(chunks):
            ct0 = time.monotonic()
            seg = self._gerar(chunk, idx)
            raw_samples = int(seg.size)   # ANTES do trim (o log compara os dois)
            seg = self._aparar(seg, idx)

            if self.prompt_wav_local and self.cfg.algum_qa_ligado:
                # Fase "pai" do QA do chunk: os whispers rodam aqui dentro e um
                # regen empilha inference.chunk.generate por cima.
                with _phase("inference.chunk.qa", chunk=idx):
                    seg, coverage, lacuna = self._rodar_qa(
                        seg, idx, chunk, eh_ultimo=(idx == len(chunks) - 1))
                if idx == len(chunks) - 1 and self._fim_ainda_ruim(seg):
                    seg = self._curar_fim_abrupto(seg, idx, chunk)
                if (self.cfg.coverage_qa_enabled and coverage is not None
                        and coverage < self.cfg.coverage_qa_min
                        and not self._entregar_mesmo_com_cobertura_baixa(
                            idx, chunk, coverage, lacuna)):
                    # Buraco continuo grande: o modelo comeu um pedaco mesmo.
                    resgate = self._resgatar_por_subdivisao(chunk, idx)
                    if resgate is None:
                        self.qa_stats["coverage_exhausted"] += 1
                        return pieces, {"chunk_idx": idx, "coverage": coverage,
                                        "maior_lacuna": lacuna}
                    # ENTREGA E' O RESGATE, nao este `seg`. A cobertura deste
                    # chunk NAO entra na telemetria: quem registra sao os
                    # sub-pedacos, dentro de _resgatar_por_subdivisao.
                    seg = resgate
                else:
                    # Este audio e' o que vai pro aluno (aprovado ou entregue
                    # pela escotilha de lacuna espalhada): registra.
                    registrar_cobertura(self.qa_stats, coverage)

            _log(
                "info", "inference.chunk", idx=idx, total=len(chunks),
                chars=len(chunk), samples_raw=raw_samples, samples_trim=int(seg.size),
                elapsed_s=round(time.monotonic() - ct0, 2),
            )
            # Pausa de paragrafo: silencio anexado ao proprio segmento (sobrevive
            # ao crossfade — o fade desliza pra dentro do silencio).
            if ends_paragraph and self.par_pause_samples > 0 and idx < len(chunks) - 1:
                seg = np.concatenate([seg, np.zeros(self.par_pause_samples, dtype=np.float32)])
            pieces.append(seg)
            # Silencio entre chunks (default 0). Aplicado SOMENTE quando o
            # crossfade esta desligado — senao o silencio dentro do overlap se
            # autodestroi.
            if self.silence_samples > 0 and self.crossfade_samples == 0 and idx < len(chunks) - 1:
                pieces.append(np.zeros(self.silence_samples, dtype=np.float32))
        return pieces, None

    def _resgatar_por_subdivisao(self, chunk: str, idx: int):
        """Chunk esgotou o QA com buraco CONTINUO -> muda de ESTRATEGIA.

        Nivel 1 (24/08): parte nas FRASES e gera cada uma com o mesmo QA.
        Medido em 36h: 7 de 129 geracoes (5,4%) morriam aqui — chunks onde
        varias frases foram coladas ate 160 chars e o modelo pulou uma.

        Nivel 2 (27/08, #52 reincidente): quando o nivel 1 nao da (frase
        unica) ou um pedaco dele TAMBEM vem alucinado, parte o pedaco ABAIXO
        da frase (virgula/palavras, `rescue_word_chars`) e gera com
        `cfg_value + rescue_cfg_delta`. Por que: entre uma tentativa e outra
        NADA mudava (mesmo texto, mesmos parametros, sem seed) — o Ronald teve
        6 falhas seguidas no mesmo texto, coverage_best 0-0,1, com o nivel 1
        rodando e caindo no mesmo poco. O nivel 2 e a primeira coisa que de
        fato muda a geracao. Deixa de ser tudo-ou-nada: so o pedaco ruim
        desce de nivel; os bons ficam.

        Devolve o audio concatenado, ou None se mesmo no nivel 2 um pedaco
        vier comido — ai o job cai como antes.
        """
        partes = [c for c, _ in split_text_for_tts(chunk, max_chars=1)]
        nivel1 = len(partes) >= 2
        if not nivel1:
            _log("info", "inference.coverage.rescue.frase_unica", idx=idx)
            partes = [chunk]  # nivel 1 nao tem o que partir: vai direto ao 2
        self.qa_stats["coverage_rescue"] = self.qa_stats.get("coverage_rescue", 0) + 1
        _log("info", "inference.coverage.rescue", idx=idx, partes=len(partes))
        pedacos: list[np.ndarray] = []
        for j, parte in enumerate(partes):
            sub_idx = idx * 100 + j + 1  # rotulo unico no log/heartbeat
            if nivel1:
                seg = self._aparar(self._gerar(parte, sub_idx), idx)
                seg, cov, lacuna = self._rodar_qa(seg, sub_idx, parte)
                ok = not (cov is not None and cov < self.cfg.coverage_qa_min
                          and not self._entregar_mesmo_com_cobertura_baixa(sub_idx, parte, cov, lacuna))
                if ok:
                    # Este sub-pedaco entra no audio final: e ELE que o aluno
                    # recebe, nao o chunk original que reprovou.
                    registrar_cobertura(self.qa_stats, cov)
                    pedacos.append(seg)
                    continue
                _log("warn", "inference.coverage.rescue.nivel1_falhou", idx=idx, parte=j,
                     coverage=cov, maior_lacuna=lacuna)
            seg2 = self._resgatar_nivel_2(parte, sub_idx)
            if seg2 is None:
                _log("error", "inference.coverage.rescue.failed", idx=idx, parte=j)
                self.qa_stats["coverage_rescue_failed"] = self.qa_stats.get("coverage_rescue_failed", 0) + 1
                return None
            pedacos.append(seg2)
        self.qa_stats["coverage_rescued"] = self.qa_stats.get("coverage_rescued", 0) + 1
        _log("info", "inference.coverage.rescued", idx=idx, partes=len(partes))
        return np.concatenate(pedacos)

    def _resgatar_nivel_2(self, texto: str, base_idx: int):
        """Parte ABAIXO da frase e gera com cfg mais alto. None se algum
        pedaco ainda vier comido."""
        c = self.cfg
        pedacos_txt = split_below_sentence(texto, max_chars=c.rescue_word_chars)
        if not pedacos_txt:
            return None
        cfg2 = min(2.5, c.cfg_value + c.rescue_cfg_delta)
        self.qa_stats["coverage_rescue_nivel2"] = self.qa_stats.get("coverage_rescue_nivel2", 0) + 1
        _log("info", "inference.coverage.rescue.nivel2", idx=base_idx,
             pedacos=len(pedacos_txt), cfg=cfg2)
        out: list[np.ndarray] = []
        for k, pz in enumerate(pedacos_txt):
            sub = base_idx * 10 + k + 1
            seg = self._aparar(self._gerar(pz, sub, cfg_value=cfg2), base_idx)
            seg, cov, lacuna = self._rodar_qa(seg, sub, pz, cfg_value=cfg2)
            if (cov is not None and cov < c.coverage_qa_min
                    and not self._entregar_mesmo_com_cobertura_baixa(sub, pz, cov, lacuna)):
                _log("error", "inference.coverage.rescue.nivel2_falhou", idx=base_idx,
                     pedaco=k, coverage=cov, maior_lacuna=lacuna)
                return None
            registrar_cobertura(self.qa_stats, cov)
            out.append(seg)
        return np.concatenate(out)

    # ── Saida ──────────────────────────────────────────────────────────────
    def _montar(self, pieces) -> np.ndarray:
        # Concat: com crossfade quando ativo (default), senao concatena plano.
        if self.crossfade_samples > 0 and len(pieces) > 1:
            wav = crossfade_concat(pieces, self.crossfade_samples)
        else:
            wav = np.concatenate(pieces) if pieces else np.zeros(0, dtype=np.float32)
        # Micro fade-in: mata o chirp/click residual do 1o patch do VoxCPM
        # (issue #272) sem comer fonema — 8ms e' inaudivel como fade.
        fade_n = int(self.sample_rate * self.cfg.fade_ms / 1000)
        if fade_n > 0 and wav.size > fade_n:
            wav = wav.copy()
            wav[:fade_n] *= np.linspace(0.0, 1.0, fade_n, dtype=np.float32)
        return wav

    def _resultado_incompleto(self, falha: dict) -> dict:
        """Falha explicita (caso Katia 19/08): NAO sobe audio, devolve `error`.

        O webhook (handleGenerationWebhook) so finaliza como ready quando
        `!out.error && out.uploaded` — com `error` presente ele marca failed e
        estorna via handleTechFailure. Texto do erro ESTAVEL, sem numero/ID no
        meio: a assinatura do incidente e' derivada do texto do erro
        (lib/incidents/classify.ts) — os detalhes vao em campos proprios.
        """
        self._soltar_modelo()
        _log(
            "error", "inference.coverage.failed",
            chunk_idx=falha["chunk_idx"], coverage=falha["coverage"],
            min_required=self.cfg.coverage_qa_min, qa=self.qa_stats,
        )
        return {
            "error": "qa_coverage: audio gerado nao contem o texto completo apos esgotar regeneracoes",
            "coverage_failed_chunk": falha["chunk_idx"],
            "coverage_best": falha["coverage"],
            "coverage_min": self.cfg.coverage_qa_min,
            "elapsed_s": round(time.monotonic() - self.t0, 2),
            "qa": self.qa_stats,
        }

    def _entregar(self, wav: np.ndarray, elapsed: float) -> dict:
        comum = {
            "sample_rate": self.sample_rate,
            "duration_s": round(len(wav) / self.sample_rate, 3),
            "elapsed_s": round(elapsed, 2),
            # A REGUA vai junto na entrega (26/08), mesmo campo que ja existia
            # no payload de falha: `qa.coverage_min_visto` medido sem o limiar
            # ao lado nao responde "passou por quanto".
            "coverage_min": self.cfg.coverage_qa_min,
            "qa": self.qa_stats,
        }
        if not self.output_upload_url:
            return {"audio_base64": wav_to_base64(wav, self.sample_rate), **comum}

        from voice_pipeline import upload_file_to_presigned_url

        out_path = WORKSPACE / f"gen_{int(time.time() * 1000)}.wav"
        out_path.parent.mkdir(parents=True, exist_ok=True)
        sf.write(str(out_path), wav, self.sample_rate)
        with _phase("inference.upload"):
            upload_file_to_presigned_url(out_path, self.output_upload_url, content_type="audio/wav")
        return {"uploaded": True, **comum}
