/**
 * A voz nasceu PRONTA mas SEM a referência que a clonagem usa. Módulo PURO:
 * decide a classe do defeito e o texto do chamado — sem Supabase, sem rede.
 *
 * ── O que é a referência e por que a falta dela machuca ─────────────────────
 * O VoxCPM gera em modo CONTINUATION: recebe um par (áudio curto, transcrição)
 * e continua aquela fala. O par sai do treino (`train_reference.escolher_e_subir`)
 * e fica gravado em `voices.reference_audio_path` + `voices.reference_transcript`.
 * Na geração, `voices/[id]/generate/route.ts` só manda `prompt_wav_url` quando
 * há caminho de áudio, e só manda `prompt_text` quando há transcrição.
 *
 * Sem o par, `jobs/inference.py:_gerar_bruto` chama o modelo com
 * `prompt_wav_path=None` e `prompt_text=None`: o stop-predictor fica sem
 * âncora e DISPARA CEDO. Não é teoria — é o bug que a casa já mediu e
 * consertou uma vez (commit cf98124f, 27/05/2026, "resolve audio cortado em
 * 16s": "a rota mandava so o audio sem o texto, e o stop-predictor do VoxCPM
 * disparava cedo"). Medido de novo em 20/09/2026 na voz Aluno2
 * (0728c9bc-df4f-48f1-af5d-e3ffeb516c74), mesma voz e MESMO DIA, antes e
 * depois de a referência existir:
 *
 *   28/05 12:16–12:28 UTC · SEM referência   1378 ch → 50,4s | 1142 ch → 30,1s | 1197 ch → 45,8s
 *   28/05 13:13–15:25 UTC · COM referência   1390 ch → 70,0s | 1195 ch → 63,4s | 1197 ch → 56,1s
 *
 * Mesmo texto de 1197 chars: 45,8s sem referência contra 56,1s com. Separação
 * perfeita — a mais rápida COM referência (21,4 ch/s) ainda é mais lenta que a
 * mais lenta SEM (26,2 ch/s). Texto CURTO não mostra o defeito: a amostra
 * pós-treino da Miriam (97 chars, 8,3s) caiu dentro da faixa normal das 87
 * amostras de controle. Quem paga é o roteiro longo do aluno.
 *
 * ── Por que ALERTA e não RECUSA ─────────────────────────────────────────────
 * Reprovar o treino (status `failed`) por referência ausente seria trocar um
 * defeito por outro pior: a LoRA saiu BOA — o trainer rodou até o fim, o
 * arquivo subiu — e reprovar queimaria os 10.000 créditos do aluno num ciclo
 * de estorno + retreino de dezenas de minutos de GPU, para consertar algo que
 * `_frank/ferramentas/fabricar_referencia.cjs` resolve SEM GPU a partir das
 * gravações brutas que continuam no R2. Então a voz continua `ready` (o aluno
 * usa) e a casa fica SABENDO — exatamente a mesma conduta já adotada para o QA
 * da amostra reprovado em `finalize-training.ts`.
 *
 * O que não existia era o SABER: o worker já devolvia `reference_error` e
 * `reference_uploaded: false`, e nenhum lugar do frontend lia nem um nem
 * outro. A voz da Miriam A S Zeppe (d1ff6f1a, 19/09/2026) passou por aí em
 * silêncio e só apareceu porque uma varredura manual olhou o
 * `reference_cut_mode` nulo.
 */

/** O que o worker devolve sobre a referência. Subconjunto de `TrainOutput`. */
export type SaidaDaReferencia = {
  reference_uploaded?: boolean;
  reference_transcript?: string | null;
  reference_error?: string | null;
  reference_cura_ramo?: string | null;
  reference_cura_erro?: string | null;
  reference_cut_mode?: string | null;
};

/**
 * Classes de defeito, da mais grave para a menos:
 *
 *   `sem_referencia`    nem áudio nem texto. A geração roda com
 *                       `prompt_wav_path=None` — é o caso da Miriam, e o que
 *                       a medição acima cronometrou.
 *   `transcript_vazio`  o áudio subiu, o texto não. A rota manda o áudio SEM
 *                       `prompt_text` e o worker cai no Whisper a cada geração
 *                       (`inference_setup.preparar_referencia`, "Caminho A"):
 *                       funciona, mas re-transcreve toda vez e é o meio-estado
 *                       que o commit cf98124f jurou não produzir mais. Seis
 *                       vozes `ready` estavam assim em 20/09 — cinco delas
 *                       criadas DEPOIS do backfill de 27/05, que foi rodado
 *                       uma vez e nunca mais.
 */
export type ClasseDeReferencia = "sem_referencia" | "transcript_vazio";

export type VereditoDaReferencia =
  | { ok: true }
  | { ok: false; classe: ClasseDeReferencia; resumo: string };

/**
 * Só se pronuncia sobre treino que DEU CERTO. Num treino falho a voz já vai
 * para `failed` com estorno e chamado próprios, e um segundo chamado dizendo
 * "ficou sem referência" seria ruído em cima de uma falha já registrada.
 */
export function avaliarReferencia(
  sucesso: boolean,
  out: SaidaDaReferencia,
): VereditoDaReferencia {
  if (!sucesso) return { ok: true };

  if (!out.reference_uploaded) {
    return {
      ok: false,
      classe: "sem_referencia",
      resumo:
        "a voz ficou pronta sem NENHUMA referência (nem áudio nem transcrição): " +
        "toda geração vai rodar sem âncora de continuation",
    };
  }

  // `?? ""` e não `|| ""`: `reference_transcript` pode chegar `null` (o worker
  // manda o campo explicitamente nulo) e também ausente. Os dois são "não tem".
  if ((out.reference_transcript ?? "").trim() === "") {
    return {
      ok: false,
      classe: "transcript_vazio",
      resumo:
        "o áudio de referência subiu mas ficou SEM transcrição: a geração manda " +
        "o áudio sem prompt_text e o worker re-transcreve a cada geração",
    };
  }

  return { ok: true };
}

/**
 * Assinatura do chamado. Inclui o `voiceId` DE PROPÓSITO: ao contrário de uma
 * falha de infra (onde vozes diferentes com o mesmo stderr são o MESMO
 * problema e têm que somar ocorrência), aqui cada voz é um conserto separado —
 * alguém precisa rodar `fabricar_referencia.cjs` naquela voz específica.
 * Assinar só pela classe fundiria todas num chamado eterno que nunca fecha.
 *
 * Inclui a CLASSE também: se a mesma voz for retreinada e piorar de
 * `transcript_vazio` para `sem_referencia`, isso é um chamado novo, não uma
 * ocorrência do antigo — a conduta de conserto é a mesma, mas o estado do
 * aluno mudou e o chamado velho pode já estar fechado.
 */
export function assinaturaDaReferencia(
  classe: ClasseDeReferencia,
  voiceId: string,
): string {
  return `voice-reference:${classe}:${voiceId}`;
}

export function tituloDaReferencia(classe: ClasseDeReferencia): string {
  return classe === "sem_referencia"
    ? "Voz pronta SEM referência (gerações saem cortadas)"
    : "Voz pronta com referência SEM transcrição (meio-estado)";
}

export type ContextoDoChamado = {
  voiceId: string;
  userId: string;
  userEmail?: string | null;
  runpodJobId: string;
  out: SaidaDaReferencia;
};

/**
 * Corpo do chamado. Carrega os campos que o worker manda e que até aqui
 * morriam na memória do processo — `reference_error` acima de tudo, que é a
 * ÚNICA pista de por que a referência não saiu (o `training_jobs` não guarda o
 * payload do worker, então depois do fato não há de onde tirar).
 */
export function descricaoDaReferencia(
  classe: ClasseDeReferencia,
  ctx: ContextoDoChamado,
): string {
  const { out } = ctx;
  const veredito = avaliarReferencia(true, out);
  const resumo = veredito.ok ? "" : veredito.resumo;
  return [
    `Treino terminou OK (LoRA subiu, voz está ready) mas ${resumo}.`,
    ``,
    `voice_id: ${ctx.voiceId}`,
    `user_id: ${ctx.userId}`,
    `e-mail: ${ctx.userEmail ?? "(não encontrado em profiles)"}`,
    `runpod_job_id: ${ctx.runpodJobId}`,
    ``,
    `reference_uploaded: ${out.reference_uploaded === true}`,
    `reference_transcript: ${
      (out.reference_transcript ?? "").trim() === ""
        ? "(vazio)"
        : `${(out.reference_transcript ?? "").length} chars`
    }`,
    `reference_error: ${out.reference_error ?? "(o worker não disse)"}`,
    `reference_cura_ramo: ${out.reference_cura_ramo ?? "(sem cura)"}`,
    `reference_cura_erro: ${out.reference_cura_erro ?? "(nenhum)"}`,
    `reference_cut_mode: ${out.reference_cut_mode ?? "(nulo — sem clipe, sem modo)"}`,
    ``,
    `CONDUTA — não retreinar (a LoRA está boa e retreino queima 10.000 créditos`,
    `e dezenas de minutos de GPU). A referência se fabrica das gravações brutas`,
    `que continuam no R2, sem GPU:`,
    ``,
    `  node _frank/ferramentas/listar_arquivos_da_voz.cjs ${ctx.voiceId}`,
    `  node _frank/ferramentas/fabricar_referencia.cjs ${ctx.voiceId}`,
    `  node _frank/ferramentas/fabricar_referencia.cjs ${ctx.voiceId} --confirmar`,
    ``,
    `POR QUE CORRE: sem o par (áudio, texto) o stop-predictor do VoxCPM dispara`,
    `cedo e o áudio sai CURTO. Medido na voz 0728c9bc em 28/05/2026, mesmo dia,`,
    `mesmo texto de 1197 chars: 45,8s sem referência contra 56,1s com. Texto`,
    `curto não denuncia o defeito — o roteiro longo do aluno sim.`,
  ].join("\n");
}
