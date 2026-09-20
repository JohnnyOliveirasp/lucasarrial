/**
 * Finaliza um treino de voz (chamado pelo webhook do RunPod E pelo polling —
 * quem chegar primeiro ganha). Concentra: transição idempotente do
 * training_job (gate anti-duplicidade), atualização da voz, telemetria
 * (useful_seconds/steps), ESTORNO quando o áudio útil foi insuficiente e a
 * AMOSTRA automática (linha em generations pro usuário ouvir a voz na hora).
 * Server-only.
 */
import { logger } from "@/lib/logger/server";
import { getAdmin } from "@/lib/db/admin";
import { buildAutoReferenceKey } from "@/lib/r2/presigned";
import { addExtraCredits, houveDebitoDeTreino } from "@/lib/credits/service";
import { TRAINING_CREDIT_COST } from "@/lib/credits/config";
import { deveEstornarTreino } from "@/lib/credits/onboarding-cobranca";
import { sendEmail, escapeHtml } from "@/lib/email/resend";
import { bypassesBilling } from "@/lib/credits/access";
import { escalateStuckUser } from "@/lib/support/failure-alert";
import type { VoiceStatus, VoiceUpdate } from "@/lib/db/types";
import { mensagemFalaLimpaInsuficiente } from "@/lib/voices/regua-audio";
import {
  type DesfechoCredito,
  desfechoDoCredito,
  falhaEhNossa,
  mensagemFalhaTecnica,
} from "@/lib/voices/falha-de-treino";
import { abrirChamadoReportado } from "@/lib/incidents/reportar";
import {
  assinaturaDaReferencia,
  avaliarReferencia,
  descricaoDaReferencia,
  tituloDaReferencia,
} from "@/lib/voices/referencia-ausente";
import {
  classifyCause,
  ehChunkDoDatasetInvalido,
  errorSignature,
  incidentTitle,
} from "@/lib/incidents/classify";
import {
  type DiagnosticoTrainer,
  ehCudaOom,
  ehDiscoCheio,
  ehEscritaDeCheckpointFalhou,
  notaDeTransitoriedade,
  notaDiscoCheio,
  notaEscritaCheckpointFalhou,
} from "@/lib/incidents/diagnostico-trainer";

const SUPPORT_EMAIL = "suporte@fastcloner.com";

export type TrainOutput = {
  voice_id?: string;
  lora_uploaded?: boolean;
  reference_uploaded?: boolean;
  reference_transcript?: string | null;
  /**
   * POR QUE a referência não saiu ("no normalized audio to slice the reference
   * from", "reference selection/transcription returned empty"...). O worker
   * manda isto desde sempre (`train.py:_resultado`) e, até 20/09/2026, NENHUM
   * lugar do frontend lia: `training_jobs` não guarda o payload, então a pista
   * morria na memória do processo. Hoje vai inteira para o chamado aberto por
   * `abrirChamadoDeReferenciaAusente` — sem ela o chamado nasce cego.
   */
  reference_error?: string | null;
  /**
   * Pausa natural medida no áudio de quem gravou (worker: voice_pipeline.pacing).
   * Vira o `tts_silence_ms` da voz. `null`/ausente = não deu pra medir com
   * confiança → não gravamos nada e a voz se comporta como antes.
   */
  reference_pause_ms?: number | null;
  /**
   * Velocidade natural de fala (palavras/segundo FALANDO), medida no dataset
   * transcrito do treino (worker: voice_pipeline.pacing.measure_speech_rate_wps).
   * Vira `voices.speech_rate_wps`, a régua do QA de ritmo — incidente #165:
   * a coluna era lida em 3 lugares e escrita por ninguém (1.010/1.012 NULL).
   */
  speech_rate_wps?: number | null;
  /**
   * COMO o `reference_transcript` acima foi produzido — incidente 52.
   * A 2ª passada de whisper no clipe final (a "cura" do caso Negrini #124) cai
   * calada no texto previsto quando o whisper falha ou volta mudo, e depois do
   * fato era impossível dizer qual dos dois aconteceu numa voz. Agora o worker
   * diz:
   *   curado         · a 2ª passada rodou e SUBSTITUIU o previsto
   *   fallback_vazio · whisper voltou vazio → ficou o previsto
   *   fallback_erro  · whisper explodiu    → ficou o previsto (ver `_erro`)
   *   sem_previsto   · não havia nem um nem outro → transcript vazio
   */
  reference_cura_ramo?: string | null;
  /** O texto que o seletor havia previsto, ANTES da cura (par antes/depois). */
  reference_cura_texto_antes?: string | null;
  /** Mensagem da exceção quando o whisper da cura explodiu. */
  reference_cura_erro?: string | null;
  /**
   * Por qual CAMINHO a referência vigente foi cortada — incidente 89473013.
   * Três caminhos de `voice_pipeline/reference.py` cortam por TEMPO seco em vez
   * de fronteira de palavra, e nenhum deixava rastro:
   *   snap_ok          · recortado em fronteira de palavra (o caminho bom)
   *   snap_unavailable · nível 1: whisper de palavras falhou/veio vazio
   *   time_retry       · nível 2: todas as candidatas morreram no snap
   *   fallback         · nível 3: ref_fallback.wav, primeiros N s a partir de 0
   *
   * ⚠️ TELEMETRIA CAUSAL, NÃO detector de voz quebrada: na amostra de 50 vozes
   * medida em 12/09, corte seco → diverge 18 / ok 18 — metade das cortadas a
   * seco está BOA. Não virar alerta, bloqueio, marca de "suspeita" nem gatilho
   * de cura; responde só "por qual caminho essa voz passou".
   */
  reference_cut_mode?: string | null;
  /**
   * Identidade do build do worker que rodou este job ("<branch>@<sha> pod=..."),
   * carimbada na imagem pelo CI. "desconhecida" = build sem o carimbo (local),
   * e é a verdade — nunca um palpite. Responde "esse treino saiu de que build?".
   */
  worker_image?: string | null;
  lora_alpha?: number;
  elapsed_seconds?: number;
  steps?: number;
  trainer_returncode?: number;
  dataset_chunks?: number;
  useful_seconds?: number;
  min_required_seconds?: number;
  sample_uploaded?: boolean;
  sample_seconds?: number | null;
  sample_error?: string | null;
  /** QA anti-eco da amostra (worker): passed | retried_passed | failed. */
  sample_qa?: string | null;
  sample_qa_similarity?: number | null;
  /** Texto realmente falado na amostra (idioma da voz) — worker e3ea664+. */
  sample_text?: string | null;
  /** Idioma detectado no áudio de treino (ISO: pt/es/en...) — worker e3ea664+. */
  language?: string | null;
  error?: string;
  /**
   * Diagnóstico do subprocess do trainer quando ele morre — incidente #11.
   * O worker (jobs/train.py:96-101) manda os DOIS tails junto com
   * `error: "trainer failed"`; até 27/08 o backend declarava os campos aqui e
   * NUNCA os lia, então o traceback morria na porta e a única cópia ficava no
   * RunPod, que purga o job (/status devolve 404 poucas horas depois). Agora
   * `registrarSaidaDoTrainer` os persiste em colunas próprias.
   */
  stdout_tail?: string;
  stderr_tail?: string;
};

/** Texto fixo da amostra — TEM que bater com DEFAULT_SAMPLE_TEXT do worker
 * (`runpod-worker/sample_gen.py`). Só é usado como FALLBACK de rótulo: quem
 * escolhe o que a amostra realmente FALA é o worker. Divergir daqui não muda
 * o áudio, muda o texto que o aluno lê no histórico — que é pior, porque a
 * legenda passa a mentir sobre o áudio. `test_amostra_pt_e_neutra` (worker)
 * lê esta constante e falha se as duas saírem de sincronia.
 * ⚠️ Neutro entre PT-BR e PT-PT de propósito — incidente #380. */
const SAMPLE_TEXT =
  "Olá. Esta é a minha voz clonada. Se o som está claro e natural, o resultado final vai soar assim.";

/** Erros de dataset inútil → o usuário não recebeu nada; devolvemos os créditos.
 * Checa também o erro CRU: quando o worker devolve {"error": ...}, o RunPod
 * marca o job FAILED e o texto chega via runpodError (out.error vazio) — sem
 * isso o usuário via "problema técnico, tente de novo" e re-tentava o MESMO
 * arquivo ruim em loop (visto 3× em prod 21/07). */
function isDatasetError(error: string | null | undefined): boolean {
  if (!error) return false;
  return (
    error.includes("insufficient_audio") ||
    error.includes("no usable speech segments")
  );
}

/** Arquivo enviado corrompido/incompleto (caso Carla 29/07: MP4 sem moov atom
 * = upload interrompido). Problema do ARQUIVO do usuário, não nosso: mensagem
 * acionável ("reenvie") em vez de "problema técnico" + sem pager pro suporte.
 *
 * ⚠️ 19/09 (#475): mídia ilegível cujo caminho é `/dataset/` NÃO é arquivo do
 * aluno — aquele chunk foi escrito pelo NOSSO worker. Sem esta guarda,
 * `falhaEhNossa()` devolvia false, NENHUM chamado era aberto, e a mensagem
 * mandava a aluna "enviar o arquivo de novo (ou gravar novamente)" — 23 minutos
 * de regravação por um arquivo que ela nunca enviou. A regra mora em
 * `lib/incidents/classify.ts` e é IMPORTADA, não copiada: predicado duplicado
 * que diverge do irmão foi exatamente como nasceu o vão do #351. */
function isCorruptFileError(error: string | null | undefined): boolean {
  if (!error) return false;
  const e = error.toLowerCase();
  if (ehChunkDoDatasetInvalido(e)) return false;
  return (
    e.includes("moov atom not found") ||
    e.includes("invalid data found when processing input") ||
    e.includes("could not find codec parameters") ||
    // Caso Erica 31/07 (inc. 57d360e4): arquivo SEM trilha de áudio nenhuma
    // (vídeo mudo ou upload quebrado) — ffmpeg não tem o que converter.
    e.includes("does not contain any stream")
  );
}

/**
 * Mensagem do ALUNO. O ramo técnico não mora mais aqui: ele depende de
 * desfechos que só existem depois de olhar o extrato e abrir o chamado, e
 * texto que afirma estorno/equipe sem esses dados foi exatamente o defeito de
 * 15/09 (ver `falha-de-treino.ts`). Quem chama passa o ramo técnico pronto em
 * `mensagemTecnica`.
 *
 * ⚠️ O ramo de ARQUIVO CORROMPIDO abaixo tem o MESMO defeito ("Seus créditos
 * foram devolvidos" é fixo, e é falso pra quem veio do SGP), e NÃO foi
 * consertado aqui de propósito. Diferente do técnico, esta mensagem não é
 * filtrada pelo `ingest.ts`: ela é ingerida pela tabela `voices` e a
 * assinatura do incidente sai de `errorSignature`, cujo `head` são os
 * primeiros 120 caracteres normalizados — e a frase do crédito começa no
 * caractere ~103, ou seja, DENTRO do head. Qualquer redação nova quebraria a
 * assinatura e abriria um guarda-chuva novo, deixando o antigo órfão. Fica
 * relatado, não remendado às cegas.
 */
function friendlyTrainError(
  out: TrainOutput,
  rawError: string,
  mensagemTecnica: string,
): string {
  if (isCorruptFileError(out.error) || isCorruptFileError(rawError)) {
    return (
      "Um dos arquivos enviados chegou corrompido ou incompleto — o envio pode ter sido " +
      "interrompido no meio. Seus créditos foram devolvidos. Envie o arquivo de novo " +
      "(ou grave novamente) e tente outra vez."
    );
  }
  if (isDatasetError(out.error) || isDatasetError(rawError)) {
    // ⚠️ 07745f61 + acf8acd6: esta mensagem citava SÓ o mínimo do TREINO (10min
    // de fala limpa) e mandava "tente de novo" — quem obedecia gravava 12–15min
    // e batia na PORTA do upload, que exige 20min BRUTOS. E arredondava com
    // `Math.round` nos dois lados, produzindo a frase impossível
    // "apenas ~10min serviram (mínimo: 10min)" pra quem parou a 1,5s do corte.
    // As duas regras (arredondar pra baixo, dizer o alvo da porta) moram na
    // régua, não aqui — era a duplicação que deixava os dois lados divergirem.
    return mensagemFalaLimpaInsuficiente(out.useful_seconds, out.min_required_seconds);
  }
  // Falha técnica: culpa NOSSA. O texto vem pronto de quem apurou o desfecho.
  return mensagemTecnica;
}

/**
 * Falha TÉCNICA vira CHAMADO de verdade, não só e-mail.
 *
 * Por que isto existe (15/09, caso ricardoolito): a mensagem dizia "nossa
 * equipe já foi notificada" e o único aviso era o `sendEmail` best-effort
 * logo abaixo. E-mail que falha em silêncio não deixa NADA para trás, e
 * ninguém ficava sabendo. Agora a frase só pode ser dita se este chamado
 * existir — e quem decide isso é o número que esta função devolve.
 *
 * ⚠️ A ASSINATURA É DE PROPÓSITO A MESMA QUE O `ingest.ts` DARIA.
 * A varredura de falhas já transforma este mesmo treino (visto por
 * `training_jobs`) num incidente `errorSignature("training", erro)`. Abrir
 * aqui com chave própria — por voz ou por job — significaria DOIS chamados
 * para uma falha só, e foi o tipo de racha que o #410 acabou de curar. Com a
 * chave idêntica, quem chegar depois soma ocorrência no mesmo chamado. Pelo
 * mesmo motivo o `kind`/`cause` vão explícitos: o registro precisa ser
 * indistinguível do que a varredura escreveria.
 *
 * ⚠️ ONDE MORA O TRACEBACK, e isto vai na descrição porque quase se perdeu:
 * `training_jobs.trainer_stderr` (migration 97, aplicada) — NÃO é em `voices`
 * e NÃO se chama `stdout_tail`. No caso medido o job do RunPod já devolvia 404
 * quando fomos olhar (o RunPod purga em horas); sem essa coluna a causa raiz
 * (`torch.OutOfMemoryError: CUDA out of memory`, GPU disputada com outro
 * processo) teria sumido.
 *
 * ⚠️ O DIAGNÓSTICO ENTRA NA CLASSIFICAÇÃO (16/09, conserto do #11).
 * Até aqui as três chamadas abaixo recebiam só `rawError`, que nesta falha é
 * literalmente a string `trainer failed`. Resultado medido no banco vivo: a
 * assinatura saía `training:bug:trainer failed`, que é o incidente #11 —
 * aberto em 21/07, "investigating" há 56 dias, `last_seen_at` já carimbado
 * pela própria falha de GPU de 15/09. O chamado nascia correto e morria
 * invisível dentro de um guarda-chuva parado, e um OOM de INFRAESTRUTURA ia
 * para o quadro carimbado como BUG NOSSO.
 *
 * O stderr NÃO precisa de ida ao banco aqui: ele já está em memória em
 * `out.stderr_tail`, é a MESMA string que `registrarSaidaDoTrainer` (logo
 * acima, na ordem de execução) grava em `training_jobs.trainer_stderr`. Ler de
 * volta só criaria uma corrida com a própria escrita e um modo de falha novo.
 */
async function abrirChamadoDaFalhaTecnica(args: {
  userId: string;
  userEmail: string | null;
  voiceId: string;
  runpodJobId: string;
  runpodStatus: string;
  rawError: string;
  /** `out.stderr_tail` / `out.trainer_returncode`, ambos podem faltar. */
  diag: DiagnosticoTrainer;
}): Promise<number | null> {
  // Uma causa só, arbitrada num lugar só. Perguntar `ehCudaOom` direto aqui
  // repetiria a precedência que `classifyCause` já resolve (material do aluno
  // ganha do diagnóstico) e deixaria a conduta do chamado divergir da causa.
  const cause = classifyCause(args.rawError, args.diag);
  const oom = cause === "infra_gpu" && ehCudaOom(args.diag.stderr);
  const discoCheio = cause === "infra_disk" && ehDiscoCheio(args.diag.stderr);
  // ⚠️ O `!discoCheio` NÃO é redundante, e este é o único ponto do PR onde a
  // exclusão precisa ser escrita à mão. `errorSignature` e `incidentTitle`
  // desempatam sozinhos porque são cadeias de `if/return`; aqui os parágrafos
  // são SOMADOS numa lista, e duas classes agora dividem a mesma `cause`
  // (`infra_disk`). Sem esta guarda, um stderr com os dois textos carregaria os
  // dois parágrafos no mesmo chamado — um afirmando ENOSPC provado e o outro
  // dizendo que ninguém viu errno. A ordem é a mesma das outras duas funções:
  // ENOSPC provado ganha de ENOSPC inferido.
  const escritaTruncada =
    cause === "infra_disk" && !discoCheio && ehEscritaDeCheckpointFalhou(args.diag.stderr);
  try {
    return await abrirChamadoReportado({
      signature: errorSignature("training", args.rawError, args.diag),
      kind: "training",
      cause,
      categoria: "tecnico",
      title: incidentTitle("training", args.rawError, args.diag),
      description: [
        `Treino de voz falhou por erro TÉCNICO (não é material do aluno).`,
        ``,
        `voice_id: ${args.voiceId}`,
        `user_id: ${args.userId}`,
        `e-mail: ${args.userEmail ?? "(não encontrado em profiles)"}`,
        `runpod_job_id: ${args.runpodJobId} (${args.runpodStatus})`,
        ``,
        // Só quando o stderr PROVA o OOM. Sem prova, nada de conduta: falha
        // cega não vira "tente de novo" por palpite.
        ...(oom ? [notaDeTransitoriedade(args.diag), ``] : []),
        // Idem: só quando o stderr PROVA o ENOSPC. A exclusividade entre as
        // três condutas é garantida acima (uma `cause` só + o `!discoCheio` do
        // caso de escrita truncada), então o chamado nunca carrega dois
        // parágrafos.
        ...(discoCheio ? [notaDiscoCheio(args.diag), ``] : []),
        // Escrita truncada: mesma disciplina, mas aqui a nota diz por escrito
        // que disco cheio é a leitura PROVÁVEL e não uma confissão do sistema
        // de arquivos — o torch engole o errno.
        ...(escritaTruncada ? [notaEscritaCheckpointFalhou(args.diag), ``] : []),
        `Traceback completo: training_jobs.trainer_stderr / trainer_stdout,`,
        `pelo runpod_job_id acima. O job do RunPod expira em poucas horas —`,
        `depois disso essas colunas são a única cópia.`,
      ].join("\n"),
      reportedBy: "treino-falho",
      affectedEmails: args.userEmail ? [args.userEmail] : [],
      sampleError: args.rawError,
    });
  } catch (e) {
    // Chamado é registro: não pode derrubar a finalização do treino. Mas o
    // aluno também não pode ouvir "equipe acionada" por causa disto — por
    // isso devolvemos null, e a mensagem se ajusta sozinha.
    logger.warn("api", "voice.train.chamado_nao_abriu", {
      voiceId: args.voiceId,
      runpodJobId: args.runpodJobId,
      erro: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
}

/** Alerta interno: falha TÉCNICA de treino vai pro suporte na hora. Best-effort. */
async function alertSupportTrainFailure(args: {
  userId: string;
  userEmail: string | null;
  voiceId: string;
  runpodJobId: string;
  runpodStatus: string;
  rawError: string;
  /** O MESMO desfecho que decidiu a mensagem do aluno — nada de booleano. */
  credito: DesfechoCredito;
  chamado: number | null;
  mensagemAoAluno: string;
}): Promise<void> {
  const userEmail = args.userEmail ?? "(sem e-mail)";
  // ⚠️ O e-mail mentia pro suporte pelo mesmo motivo que a tela mentia pro
  // aluno: `refunded` nascia `!billed`, então "não foi cobrado" chegava aqui
  // como "estorno aplicado automaticamente" — e o suporte lia que 10.000
  // créditos tinham voltado para alguém que nunca pagou nada.
  const linhaCredito: Record<DesfechoCredito, string> = {
    nao_cobrado:
      "não houve cobrança para esta voz (SGP ou equipe) — nada a estornar, e nada foi creditado",
    estornado: `${TRAINING_CREDIT_COST.toLocaleString("pt-BR")} créditos devolvidos automaticamente`,
    estorno_falhou: `FALHOU — aplicar ${TRAINING_CREDIT_COST.toLocaleString("pt-BR")} créditos manualmente!`,
  };
  await sendEmail({
    to: SUPPORT_EMAIL,
    subject: `⚠️ Falha técnica no treino de voz — ${userEmail}`,
    html:
      `<p>Um treino de voz falhou por erro <strong>técnico</strong> (não é erro de dataset do usuário).</p>` +
      `<ul>` +
      `<li><strong>Usuário:</strong> ${escapeHtml(userEmail)} (${args.userId})</li>` +
      `<li><strong>Voz:</strong> ${args.voiceId}</li>` +
      `<li><strong>Job RunPod:</strong> ${args.runpodJobId} (${escapeHtml(args.runpodStatus)})</li>` +
      `<li><strong>Erro:</strong> <code>${escapeHtml(args.rawError.slice(0, 500))}</code></li>` +
      `<li><strong>Crédito:</strong> ${escapeHtml(linhaCredito[args.credito])}</li>` +
      `<li><strong>Chamado:</strong> ${args.chamado !== null ? `#${args.chamado}` : "NÃO ABRIU — este e-mail é o único registro"}</li>` +
      `</ul>` +
      `<p>Traceback completo em <code>training_jobs.trainer_stderr</code> pelo runpod_job_id acima ` +
      `(o job do RunPod expira em poucas horas; depois disso a coluna é a única cópia).</p>` +
      `<p>O aluno leu exatamente isto: <em>${escapeHtml(args.mensagemAoAluno)}</em></p>`,
  });
}

/**
 * Registra COMO o transcript da referência saiu e QUE build do worker rodou.
 *
 * Incidente 52 (qa_coverage): a cura do transcript decide calada dentro do
 * treino, e cada ronda re-investigava do zero se ela tinha rodado numa voz.
 * Agora o worker diz o ramo; aqui a gente guarda.
 *
 * ⚠️ Duas decisões de propósito:
 *  1. Vai num UPDATE SEPARADO, depois do gate idempotente — nunca junto com o
 *     claim. A DDL (scripts/96) ainda NÃO foi aplicada, e coluna inexistente
 *     dentro do claim derrubaria a finalização INTEIRA do treino (voz nunca
 *     ficaria `ready`). Observabilidade não pode quebrar o produto.
 *  2. O `logger.info` roda SEMPRE, antes e independente do banco: enquanto a
 *     DDL não é aplicada, o dado já existe no log — que é o que resolve a
 *     pergunta na próxima ronda.
 */
async function registrarCuraEBuild(
  runpodJobId: string,
  voiceId: string,
  out: TrainOutput,
): Promise<void> {
  const ramo = out.reference_cura_ramo ?? null;
  const textoAntes = out.reference_cura_texto_antes ?? null;
  const curaErro = out.reference_cura_erro ?? null;
  const workerImage = out.worker_image ?? null;
  if (!ramo && !workerImage) return; // worker antigo, sem os campos novos

  logger.info("api", "voice.train.transcript_cura", {
    voiceId,
    runpodJobId,
    ramo,
    workerImage,
    curaErro,
    lenAntes: textoAntes?.length ?? 0,
    lenDepois: out.reference_transcript?.length ?? 0,
  });

  try {
    const { error } = await getAdmin()
      .from("training_jobs")
      .update({
        reference_cura_ramo: ramo,
        reference_cura_texto_antes: textoAntes,
        reference_cura_erro: curaErro,
        worker_image: workerImage,
      } as never)
      .eq("runpod_job_id", runpodJobId);
    if (error) throw new Error(error.message);
  } catch (e) {
    // Esperado até a DDL de scripts/96 ser aplicada. O log acima já guardou o
    // dado; falhar aqui não pode afetar o treino.
    logger.warn("api", "voice.train.transcript_cura_nao_persistida", {
      voiceId,
      runpodJobId,
      motivo: e instanceof Error ? e.message : String(e),
    });
  }
}

/**
 * Registra POR QUAL CAMINHO a referência da voz foi cortada (incidente 89473013).
 *
 * Três caminhos de `voice_pipeline/reference.py` cortam por TEMPO seco em vez de
 * fronteira de palavra e, até aqui, nenhum deixava rastro: depois do treino era
 * impossível dizer qual deles a voz tinha tomado.
 *
 * ⚠️ TELEMETRIA CAUSAL, NÃO detector de defeito. Amostra de 50 vozes medida em
 * 12/09: corte seco → diverge 18 / ok 18. Metade das cortadas a seco está BOA,
 * então este campo NÃO prediz voz ruim — não pendurar alerta, bloqueio, marca de
 * "suspeita" nem cura automática nele.
 *
 * Mesmas duas decisões da `registrarCuraEBuild` (mig 96), pelos mesmos motivos:
 *  1. UPDATE SEPARADO, depois do gate idempotente e FORA do update da voz — a
 *     DDL (scripts/108) pode ainda não estar aplicada, e coluna inexistente
 *     dentro do update principal derrubaria a finalização INTEIRA do treino (a
 *     voz nunca ficaria `ready`). Observabilidade não pode quebrar o produto.
 *  2. O `logger.info` roda SEMPRE, antes e independente do banco: enquanto a DDL
 *     não sobe, o dado já existe no log.
 *
 * Escreve o modo mesmo quando ele vem nulo NO TREINO NOVO: o campo descreve a
 * referência VIGENTE, e a referência acabou de ser substituída no R2 — deixar o
 * valor do treino anterior faria a coluna descrever um áudio que não existe
 * mais. Nulo aqui é "este worker não soube dizer", que é a verdade.
 */
async function registrarModoDeCorte(
  runpodJobId: string,
  voiceId: string,
  out: TrainOutput,
): Promise<void> {
  const cutMode = out.reference_cut_mode ?? null;

  logger.info("api", "voice.train.cut_mode", { voiceId, runpodJobId, cutMode });

  try {
    const { error } = await getAdmin()
      .from("voices")
      .update({ reference_cut_mode: cutMode } as never)
      .eq("id", voiceId);
    if (error) throw new Error(error.message);
  } catch (e) {
    // Esperado até a DDL de scripts/108 ser aplicada. O log acima já guardou o
    // dado; falhar aqui não pode afetar o treino.
    logger.warn("api", "voice.train.cut_mode_nao_persistido", {
      voiceId,
      runpodJobId,
      motivo: e instanceof Error ? e.message : String(e),
    });
  }
}

/**
 * Treino DEU CERTO mas a voz ficou sem referência usável → chamado TÉCNICO.
 *
 * A decisão (é defeito? qual classe? o que escrever?) mora inteira no módulo
 * PURO `referencia-ausente.ts`, que tem teste de verdade. Aqui fica só o I/O.
 *
 * Best-effort, como todo o resto da finalização depois do UPDATE da voz: a voz
 * já está `ready` e o aluno já pode usar; um chamado que não abre não pode
 * derrubar a amostra automática nem o retorno do webhook. Mas deixa rastro —
 * o silêncio de antes é justamente o defeito que isto conserta.
 */
async function abrirChamadoDeReferenciaAusente(args: {
  voiceId: string;
  userId: string;
  runpodJobId: string;
  out: TrainOutput;
}): Promise<void> {
  const veredito = avaliarReferencia(true, args.out);
  if (veredito.ok) return;

  logger.warn("api", "voice.train.referencia_ausente", {
    voiceId: args.voiceId,
    runpodJobId: args.runpodJobId,
    classe: veredito.classe,
    referenceError: args.out.reference_error ?? null,
    curaRamo: args.out.reference_cura_ramo ?? null,
  });

  // O e-mail só é lido AQUI, depois do veredito: no caminho de sucesso o
  // `userEmail` do finalize fica null (só o ramo de falha o carrega), e medido
  // em 20/09 este chamado nasce em ~0,5% dos treinos (7 vozes em 1.330 ready).
  // Buscar antes seria uma consulta a mais em 99,5% dos treinos para nada.
  let userEmail: string | null = null;
  try {
    const { data: profile } = await getAdmin()
      .from("profiles")
      .select("email")
      .eq("id", args.userId)
      .maybeSingle();
    userEmail = (profile as { email?: string } | null)?.email ?? null;
  } catch {
    // Chamado sem e-mail ainda serve (tem voice_id e user_id); chamado
    // NENHUM não serve. O campo se assume desconhecido, não se inventa.
  }

  try {
    await abrirChamadoReportado({
      signature: assinaturaDaReferencia(veredito.classe, args.voiceId),
      // Família própria, no formato dos kinds escritos à mão (`voice:reference_stale`,
      // `video_clone:identity_drift`). NÃO é `training`: o treino DEU CERTO, e
      // cair no kind de treino jogaria isto dentro do guarda-chuva do #11.
      kind: "voice:referencia_ausente",
      cause: veredito.classe,
      categoria: "tecnico",
      title: tituloDaReferencia(veredito.classe),
      description: descricaoDaReferencia(veredito.classe, {
        voiceId: args.voiceId,
        userId: args.userId,
        userEmail,
        runpodJobId: args.runpodJobId,
        out: args.out,
      }),
      reportedBy: "treino-sem-referencia",
      affectedEmails: userEmail ? [userEmail] : [],
      sampleError: args.out.reference_error ?? null,
    });
  } catch (e) {
    logger.warn("api", "voice.train.referencia_ausente_chamado_nao_abriu", {
      voiceId: args.voiceId,
      runpodJobId: args.runpodJobId,
      motivo: e instanceof Error ? e.message : String(e),
    });
  }
}

/**
 * Teto de cada log do trainer no banco. O worker já manda tails curtos
 * (stdout 4000 / stderr 2000 chars, voice_pipeline/training.py:324-325); o teto
 * maior aqui é folga pra não ter que mexer nas duas pontas se a janela do
 * worker crescer.
 */
const MAX_TRAINER_LOG_CHARS = 8000;

/**
 * Guarda o stderr/stdout do subprocess do trainer quando ele morre.
 *
 * Incidente #11 ("trainer failed"): aberto desde 21/07, 3 ocorrências, NUNCA
 * diagnosticado. O worker sempre mandou o diagnóstico (jobs/train.py:96-101) e
 * o backend jogava fora — `stdout_tail`/`stderr_tail` estavam declarados no
 * type e nunca eram lidos. A única cópia vivia no RunPod, e o RunPod PURGA: o
 * /status do job devolve 404 "job not found" ~9h depois da falha, então toda
 * ronda que ia investigar chegava depois da purga.
 *
 * ⚠️ Três decisões de propósito:
 *  1. Colunas próprias, NUNCA `training_jobs.error_message`. Esse campo vira o
 *     `error` de admin_failures() e alimenta errorSignature() (incidents/
 *     classify.ts): para cause='bug' a assinatura de dedup são os primeiros 120
 *     chars do texto. Traceback varia a cada ocorrência → cada falha viraria um
 *     incidente NOVO e o #11 se estilhaçaria. error_message continua sendo
 *     exatamente "trainer failed" (travado por teste em classify.test.ts).
 *  2. UPDATE SEPARADO, depois do gate idempotente — nunca junto com o claim. A
 *     DDL (scripts/97) ainda NÃO foi aplicada, e coluna inexistente dentro do
 *     claim derrubaria a finalização INTEIRA: a voz nunca iria pra `failed` e o
 *     ESTORNO do aluno nunca rodaria. Observabilidade não pode quebrar o
 *     produto — muito menos o estorno.
 *  3. O `logger.error` roda ANTES do UPDATE, mas DENTRO do mesmo try/catch:
 *     enquanto a DDL não é aplicada, o traceback já fica no log, que é o que
 *     responde a pergunta na próxima ronda — e mesmo assim ele não pode
 *     escapar. Esta função é chamada na JANELA entre o claim idempotente e o
 *     ESTORNO do aluno: exceção que suba daqui deixa o claim já consumido e o
 *     estorno sem rodar, ou seja, crédito perdido e sem retry. Hoje o logger
 *     não teria como lançar (o `meta` vem só de JSON.parse do webhook/RunPod,
 *     então o JSON.stringify de logger/server.ts não quebra), mas o ramo de
 *     console do writeEntry é o único trecho desprotegido de lá e roda TAMBÉM
 *     em produção quando level === 'error'. Nesta janela, "provavelmente
 *     vazia" não serve: nada de observabilidade fica fora do try.
 *
 * Caminho feliz não grava nada: o worker devolve `trainer_returncode: 0` sem
 * tails, e "o treino deu certo" já está em `training_jobs.status`. Escrever aí
 * seria um UPDATE a mais por treino sem informação nova.
 */
async function registrarSaidaDoTrainer(
  runpodJobId: string,
  voiceId: string,
  out: TrainOutput,
): Promise<void> {
  const rc = typeof out.trainer_returncode === "number" ? out.trainer_returncode : null;
  const stderr = typeof out.stderr_tail === "string" ? out.stderr_tail : null;
  const stdout = typeof out.stdout_tail === "string" ? out.stdout_tail : null;
  // Nada a diagnosticar: worker antigo (sem os campos) ou caminho feliz (rc 0
  // e sem tails). Ver decisão 3 acima.
  if (stderr === null && stdout === null && (rc === null || rc === 0)) return;

  // Tail, não head: o traceback que interessa está no FIM da saída — cortar
  // pelo começo guardaria o download do modelo e perderia a exceção.
  const patch: Record<string, unknown> = { trainer_returncode: rc };
  if (stderr !== null) patch.trainer_stderr = stderr.slice(-MAX_TRAINER_LOG_CHARS);
  if (stdout !== null) patch.trainer_stdout = stdout.slice(-MAX_TRAINER_LOG_CHARS);

  try {
    logger.error("api", "voice.train.trainer_failed", {
      voiceId,
      runpodJobId,
      trainerReturncode: rc,
      workerImage: out.worker_image ?? null,
      stderrTail: patch.trainer_stderr ?? null,
      stdoutTail: patch.trainer_stdout ?? null,
    });

    const { error } = await getAdmin()
      .from("training_jobs")
      .update(patch as never)
      .eq("runpod_job_id", runpodJobId);
    if (error) throw new Error(error.message);
  } catch (e) {
    // Esperado até a DDL de scripts/97 ser aplicada — nesse caso o logger.error
    // acima JÁ guardou o diagnóstico e só o UPDATE falhou. O catch cobre também
    // o próprio logger.error (ver decisão 3): se fosse ele a lançar, o warn
    // abaixo é seguro em produção, porque writeEntry só cai no ramo de console
    // para level 'error'/'fatal' e a escrita em arquivo tem try/catch próprio.
    // Em qualquer dos casos: falhar aqui não pode afetar o treino nem o estorno.
    logger.warn("api", "voice.train.trainer_failed_nao_persistido", {
      voiceId,
      runpodJobId,
      motivo: e instanceof Error ? e.message : String(e),
    });
  }
}

export async function finalizeTraining(args: {
  voiceId: string;
  userId: string;
  runpodJobId: string;
  runpodStatus: string; // COMPLETED | FAILED | CANCELLED | TIMED_OUT
  output: TrainOutput;
  runpodError?: string | null;
}): Promise<{ applied: boolean; status: VoiceStatus }> {
  const { voiceId, userId, runpodJobId, runpodStatus, output: out } = args;
  const admin = getAdmin();

  const success = runpodStatus === "COMPLETED" && !out.error && out.trainer_returncode === 0;
  const nextStatus: VoiceStatus = success ? "ready" : "failed";
  const rawError = out.error || args.runpodError || `RunPod ${runpodStatus}`;
  // Admin vê o erro CRU (diagnóstico); o usuário vê a versão amigável.
  const adminError = success ? null : rawError.slice(0, 500);

  // ── Gate idempotente: só UM caminho (webhook OU poll) finaliza ──────────
  const { data: claimed } = await admin
    .from("training_jobs")
    .update({
      status: success ? "completed" : "failed",
      elapsed_seconds: Math.round(out.elapsed_seconds ?? 0),
      steps: out.steps ?? null,
      useful_seconds: out.useful_seconds ?? null,
      error_message: adminError,
      finished_at: new Date().toISOString(),
    } as never)
    .eq("runpod_job_id", runpodJobId)
    .in("status", ["queued", "running"])
    .select("id");
  if (!claimed || claimed.length === 0) {
    return { applied: false, status: nextStatus };
  }

  // ── Observabilidade da cura do transcript + build do worker (incidente 52) ─
  await registrarCuraEBuild(runpodJobId, voiceId, out);

  // ── stderr/stdout do trainer quando o subprocess morre (incidente #11) ────
  await registrarSaidaDoTrainer(runpodJobId, voiceId, out);

  /**
   * ── DESFECHO DA FALHA, ANTES DE ESCREVER A MENSAGEM ──────────────────────
   *
   * Vem aqui, e não depois do update da voz, por um motivo só: a mensagem que
   * o aluno lê PRECISA depender do que realmente aconteceu com o dinheiro e
   * com o chamado. Enquanto o texto era fixo, a ordem não importava — e era
   * exatamente por isso que ele podia mentir (caso ricardoolito, 15/09:
   * "seus créditos foram devolvidos" numa voz sem uma única linha de débito).
   *
   * O estorno continua sendo decidido pelo EXTRATO (`houveDebitoDeTreino` por
   * ref_id/ref_type), não por inferência sobre quem é o aluno — a simetria de
   * 17/08 documentada em `onboarding-cobranca.ts` segue intacta.
   *
   * ⚠️ `escalateStuckUser` continua DEPOIS de tudo, de propósito: ele conta
   * `credit_transactions` com ref_type `voice_train_refund` na janela, então
   * precisa do estorno desta falha já gravado para a régua de rajada fechar.
   */
  let userEmail: string | null = null;
  let credito: DesfechoCredito = "nao_cobrado";
  let chamado: number | null = null;
  let falhaNossa = false;

  if (!success) {
    const { data: profile } = await admin
      .from("profiles")
      .select("email")
      .eq("id", userId)
      .maybeSingle();
    userEmail = (profile as { email?: string } | null)?.email ?? null;

    const temDebito = await houveDebitoDeTreino(userId, voiceId);
    const billed = deveEstornarTreino({
      bypass: bypassesBilling(userEmail),
      temDebito,
    });

    let estornoOk = false;
    if (billed) {
      const r = await addExtraCredits({
        userId,
        amount: TRAINING_CREDIT_COST,
        refType: "voice_train_refund",
        refId: voiceId,
      });
      estornoOk = r.ok;
    }
    credito = desfechoDoCredito({ billed, estornoOk });

    falhaNossa = falhaEhNossa({
      erroDeDataset: isDatasetError(out.error) || isDatasetError(rawError),
      arquivoCorrompido: isCorruptFileError(out.error) || isCorruptFileError(rawError),
    });

    // O chamado nasce ANTES da mensagem porque é ele que dá à frase "nossa
    // equipe já está com ele" o direito de existir.
    if (falhaNossa) {
      chamado = await abrirChamadoDaFalhaTecnica({
        userId,
        userEmail,
        voiceId,
        runpodJobId,
        runpodStatus,
        rawError,
        // Mesmíssima fonte que `registrarSaidaDoTrainer` acabou de persistir em
        // `training_jobs` — em memória, sem ida de volta ao banco.
        diag: {
          stderr: typeof out.stderr_tail === "string" ? out.stderr_tail : null,
          returncode:
            typeof out.trainer_returncode === "number" ? out.trainer_returncode : null,
        },
      });
    }
  }

  const errorMessage = success
    ? null
    : friendlyTrainError(
        out,
        rawError,
        mensagemFalhaTecnica({ credito, chamado, custoCreditos: TRAINING_CREDIT_COST }),
      );

  // ── Voz ─────────────────────────────────────────────────────────────────
  const update: VoiceUpdate = {
    status: nextStatus,
    error_message: errorMessage,
    trained_at: success ? new Date().toISOString() : null,
  };
  if (success && out.reference_uploaded) {
    update.reference_audio_path = buildAutoReferenceKey(userId, voiceId);
    update.reference_transcript = out.reference_transcript ?? null;
  }
  if (success && typeof out.lora_alpha === "number") {
    update.lora_alpha = out.lora_alpha;
  }
  // ── Ritmo: a voz nasce com a pausa de quem gravou ────────────────────────
  // O worker monta o áudio inserindo `tts_silence_ms` entre os pedaços; sem
  // valor ele cai no default 0 = nenhuma pausa, e a fala sai emendada. Era a
  // queixa "áudio muito corrido", e atingia 749 das 750 vozes prontas (todas
  // com o campo NULO). Gravar aqui faz a voz nova já sair no ritmo certo, em
  // vez de depender de alguém notar e ajustar na mão — como foi o caso Katia.
  // ⚠️ SÓ vozes novas, por decisão do dono (21/08): as antigas não são tocadas.
  //
  // ⛔ DESLIGADO 24/08 (ordem do Johnny, caso Kessuly): gravar pausa + crossfade 0
  // no treino deixou a voz "horrível, muito pior" — com crossfade 0 e 1,5-1,9s
  // de silêncio inserido, cada borda suja de pedaço (respiro, sílaba extra,
  // chiado) fica exposta sozinha no ar; com crossfade 60 ela é mascarada pelo
  // pedaço seguinte. Medido no mesmo texto: 85s/27 pausas (antiga) contra
  // 115s/41 pausas de 0,7s (nova); a montagem antiga sobre a mesma voz voltou a
  // 88s e o Johnny aprovou de ouvido. 93 vozes treinadas desde 21/08 tinham
  // isso e foram zeradas (backup em _Bugs/chamado_108_referencias/). O worker
  // continua MEDINDO `reference_pause_ms` (fica no output/telemetria); só não
  // vira configuração da voz. Ver memória debug-retreino-kessuly-piorou.
  if (success && typeof out.reference_pause_ms === "number") {
    logger.info("api", "voice.train.pacing_measured_not_applied", {
      voiceId, referencePauseMs: out.reference_pause_ms,
    });
  }
  // Régua do QA de ritmo (#165): só grava valor plausível (1–5 pal/s). Sem
  // ela a geração cai no fallback (articulação da própria referência), que no
  // caso Ellen mediu 2,83 contra 1,7–2,2 de fala real — o clone saía acelerado
  // e o QA aprovava. Retreino sobrescreve: a medida nova é do material atual.
  if (
    success &&
    typeof out.speech_rate_wps === "number" &&
    Number.isFinite(out.speech_rate_wps) &&
    out.speech_rate_wps >= 1 &&
    out.speech_rate_wps <= 5
  ) {
    (update as Record<string, unknown>).speech_rate_wps = out.speech_rate_wps;
  }
  if (success && typeof out.language === "string" && out.language) {
    // Idioma detectado no treino — a geração/QA passam a rodar no idioma certo.
    (update as Record<string, unknown>).language = out.language;
  }
  await admin.from("voices").update(update).eq("id", voiceId);

  // ── Por qual caminho a referência foi cortada (incidente 89473013) ────────
  // DEPOIS do update da voz, e SÓ quando a referência foi de fato substituída:
  // o campo descreve a referência VIGENTE, então tocá-lo num treino que não
  // mexeu na referência apagaria o modo do clipe que continua no ar.
  if (success && out.reference_uploaded) {
    await registrarModoDeCorte(runpodJobId, voiceId, out);
  }

  // ── Voz pronta SEM referência usável → chamado técnico ───────────────────
  // Espelho do alerta de `sample_qa === "failed"` logo abaixo: a voz continua
  // `ready` (a LoRA está boa, reprovar queimaria os créditos do aluno), mas a
  // casa PASSA A SABER. Até 20/09/2026 não sabia: `reference_uploaded: false` e
  // `reference_error` chegavam do worker e ninguém lia — a voz d1ff6f1a saiu
  // assim em 19/09 e só apareceu numa varredura manual, quatro dias depois,
  // com o acesso da aluna vencendo.
  //
  // DEPOIS do UPDATE da voz, de propósito: o chamado manda "rode
  // fabricar_referencia.cjs nesta voz", e a voz precisa estar gravada.
  if (success) {
    await abrirChamadoDeReferenciaAusente({ voiceId, userId, runpodJobId, out });
  }

  // ── Avisos da falha ──────────────────────────────────────────────────────
  // O ESTORNO e o CHAMADO já rodaram lá em cima (a mensagem do aluno depende
  // dos dois). Aqui sobra só o que é aviso, e que por isso pode — e deve —
  // acontecer depois da voz já estar gravada como `failed`.
  if (!success) {
    // Falha técnica → alerta imediato pro suporte (best-effort). Erro de
    // dataset/arquivo do usuário não é pager — o incidente da aba Falhas cobre.
    if (falhaNossa) {
      await alertSupportTrainFailure({
        userId,
        userEmail,
        voiceId,
        runpodJobId,
        runpodStatus,
        rawError,
        credito,
        chamado,
        mensagemAoAluno: errorMessage ?? "",
      });
    } else {
      // Erro "do usuário" NÃO é pager na 1ª vez — mas quem repete e continua
      // SEM VOZ está travado no funil, e aí vira problema nosso (foi o caso
      // do bug do chunking 08/08: 8 alunos, 20 tentativas, ninguém avisado).
      await escalateStuckUser({
        userId,
        userEmail,
        feature: "Treino de voz",
        refundRefType: "voice_train_refund",
        rawError: rawError || out.error || "erro de dataset",
      });
    }
  }

  // ── QA da amostra reprovou mesmo após retries → alerta o suporte ────────
  // A voz continua ready (o aluno pode usar), mas alguém deve OUVIR a amostra
  // e, se preciso, trocar a referência (caso "me levantar" 2026-07-16).
  if (success && out.sample_qa === "failed") {
    try {
      const { data: profile } = await admin
        .from("profiles").select("email").eq("id", userId).maybeSingle();
      const email = (profile as { email?: string } | null)?.email ?? "(sem e-mail)";
      await sendEmail({
        to: SUPPORT_EMAIL,
        subject: `⚠️ QA da amostra reprovou — voz ${voiceId} — ${email}`,
        html:
          `<p>O treino terminou OK, mas a amostra automática saiu DIFERENTE do texto esperado ` +
          `mesmo após trocar a referência (similaridade: ${out.sample_qa_similarity ?? "?"}). ` +
          `Provável eco da referência na geração.</p>` +
          `<ul><li><strong>Usuário:</strong> ${escapeHtml(email)}</li>` +
          `<li><strong>Voz:</strong> ${voiceId}</li></ul>` +
          `<p>Ação: ouvir a amostra no /admin e, se confirmar eco, trocar a referência da voz.</p>`,
      });
    } catch {
      /* alerta é best-effort */
    }
  }

  // ── Amostra automática → linha ready em generations (player do histórico) ─
  if (success && out.sample_uploaded) {
    const sampleKey = `${userId}/${voiceId}/sample.wav`;
    // Re-treino sobrescreve o wav no R2; remove a linha antiga pra não duplicar.
    await admin
      .from("generations")
      .delete()
      .eq("voice_id", voiceId)
      .eq("name", "Amostra automática");
    await admin.from("generations").insert({
      user_id: userId,
      voice_id: voiceId,
      name: "Amostra automática",
      text_raw: out.sample_text || SAMPLE_TEXT,
      audio_path: sampleKey,
      duration_seconds: out.sample_seconds ?? null,
      status: "ready",
    } as never);
  }

  return { applied: true, status: nextStatus };
}
