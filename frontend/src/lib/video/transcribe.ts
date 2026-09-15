/**
 * Transcrição (Whisper API) de um áudio ENVIADO pelo usuário pro wizard de
 * vídeo. Server-only. Devolve o texto (vira `script_text` — as cenas nascem
 * dele) e a DURAÇÃO REAL medida pelo Whisper — validação server-side do teto
 * de 90s (o browser já valida antes do upload, mas aqui é à prova de burla).
 */
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { r2, R2_BUCKETS } from "@/lib/r2/client";
import { objectHead } from "@/lib/r2/exists";
import { duracaoLegivel } from "./audio-eligibility";

export type Transcription = { text: string; durationSeconds: number };

/**
 * O teto de UPLOAD da Whisper API (25 MB). ÚNICO lugar onde esse número mora:
 * a frase do `falhaDeAudio` e a recusa antecipada do `transcribeUploadedAudio`
 * leem daqui. Não reescreva o literal em lugar nenhum — foi assim que o contato
 * do #414 divergiu do código.
 *
 * ⚠️ TAMANHO NÃO É DURAÇÃO. O teto do PRODUTO é 90s (`CLONE_MAX_AUDIO_SECONDS`);
 * este aqui é só o da ferramenta. Um MP3 de 20min em bitrate baixo cabe nos
 * 25 MB e continua violando os 90s — por isso a checagem de duração CONTINUA
 * depois da transcrição, em todas as rotas. Esta guarda não substitui aquela:
 * ela só evita gastar o upload inteiro à toa (caso valdirtrentotrg, 15/09 —
 * MP4 de 60 minutos baixado do R2 e empurrado pro Whisper pra voltar 413).
 */
export const WHISPER_MAX_BYTES = 25 * 1024 * 1024;

/** "25 MB" — derivado da constante, pra frase nunca divergir do corte. */
const WHISPER_MAX_MB = Math.round(WHISPER_MAX_BYTES / (1024 * 1024));

/**
 * Marca do erro que ESTE módulo levanta ao recusar por tamanho antes de subir.
 * `falhaDeAudio` reconhece a marca e devolve a MESMA frase do 413 da Whisper —
 * o aluno não tem que saber se quem recusou fomos nós ou a OpenAI.
 */
const MARCA_GRANDE_DEMAIS = "audio-grande-demais-pre-upload";

/**
 * O erro REAL da transcrição: registrado do lado da casa e traduzido pro aluno.
 *
 * Por que existe (#cacca8a1, 14/09): os 5 pontos que chamam
 * `transcribeUploadedAudio` engoliam a exceção num `catch {}` VAZIO e devolviam
 * sempre a mesma frase — "Não conseguimos processar esse áudio. Tente
 * novamente." A exceção jogada fora era a única coisa no sistema que dizia POR
 * QUE (Whisper 413 = acima de 25 MB, 400 = formato que ela não decodifica, R2
 * fora do ar, chave ausente): nenhuma linha em `video_clones`, nenhum débito,
 * nenhum contador, nenhum log. A casa só descobria o caso se o aluno abrisse
 * chat — e, quando abria, não havia o que investigar.
 *
 * Foi o que deixou o `#1dd204f5` 10 dias em "investigating" sem uma pista, e o
 * que fez a Ernanda (`#cacca8a1`) acreditar que tinha sido cobrada por um clone
 * que nunca chegou a existir.
 *
 * CONFERIDO em 14/09, nos 5 pontos de chamada: a transcrição roda ANTES de
 * qualquer cobrança, então "Nenhum crédito foi cobrado" é verdade em todos —
 * não repita a frase em ponto novo sem reconferir.
 *
 * Só mapeia o que sabe distinguir: 413 (tamanho) e 400 (formato) são culpa do
 * arquivo e o aluno resolve; 401/429/500 são NOSSOS e caem no texto genérico de
 * propósito — dizer "seu arquivo está corrompido" quando a chave da OpenAI
 * venceu é mandar o aluno caçar um defeito que é da casa.
 */
export function falhaDeAudio(
  e: unknown,
  ctx: Record<string, unknown>,
  /**
   * `feminino` existe porque a primeira versão montava "Esse ${rotulo}" e o
   * import-take manda "gravação": saía **"Esse gravação"** pro aluno. Pego pela
   * prova (`_frank/rascunhos/2026-09-14_provar_falha_de_audio.cjs`), não pela
   * leitura. Rótulo novo no feminino entra com `feminino: true`.
   */
  opts: { rotulo?: string; feminino?: boolean } = {},
): string {
  const rotulo = opts.rotulo ?? "áudio";
  const esse = opts.feminino ? "essa" : "esse";
  const Esse = opts.feminino ? "Essa" : "Esse";
  const erro = e instanceof Error ? e.message : String(e);
  console.error("[video/transcribe] falhou", JSON.stringify({ ...ctx, erro }));

  const NAO_COBRADO = " Nenhum crédito foi cobrado.";
  if (
    /Whisper API 413/.test(erro) ||
    /Maximum content size/i.test(erro) ||
    // recusado AQUI pelo HEAD, antes de baixar/subir: mesma causa, mesma frase
    erro.includes(MARCA_GRANDE_DEMAIS)
  ) {
    return (
      `${Esse} ${rotulo} passou do tamanho que a transcrição aceita (o limite é ${WHISPER_MAX_MB} MB). ` +
      `Exporte em MP3 — ou mande só o trecho que você vai usar — e tente de novo.${NAO_COBRADO}`
    );
  }
  if (/Whisper API 400/.test(erro)) {
    return (
      `Não conseguimos abrir ${esse} ${rotulo}: o formato não é aceito ou o arquivo veio corrompido. ` +
      `Tente enviar em MP3 ou M4A.${NAO_COBRADO}`
    );
  }
  return `Não conseguimos processar ${esse} ${rotulo}. Tente novamente.${NAO_COBRADO}`;
}

/** Baixa o objeto do bucket de generations e devolve os bytes. */
async function downloadAudio(key: string): Promise<Uint8Array> {
  const res = await r2.send(
    new GetObjectCommand({ Bucket: R2_BUCKETS.generations, Key: key }),
  );
  if (!res.Body) throw new Error("Audio object has no body");
  return res.Body.transformToByteArray();
}

/**
 * A REGRA, pura e testável: este objeto é grande demais pra transcrição?
 *
 * FAIL-OPEN por decisão: `bytes: null` (HEAD falhou por erro transitório, ou o
 * R2 não devolveu ContentLength) NÃO recusa. Um falso positivo aqui é pior que
 * o defeito — barraria um áudio bom por causa de um 5xx passageiro do R2 —, e o
 * caminho antigo continua intacto: quem estiver mesmo acima do teto leva o 413
 * da Whisper e cai na MESMA frase. Só bytes MEDIDOS e acima do teto recusam.
 */
export function acimaDoTetoDaTranscricao(
  bytes: number | null,
  max: number = WHISPER_MAX_BYTES,
): boolean {
  return typeof bytes === "number" && Number.isFinite(bytes) && bytes > max;
}

/**
 * A OUTRA regra, que a guarda de tamanho NÃO substitui: o teto de DURAÇÃO.
 *
 * Vive aqui, pura, porque tamanho e duração são coisas diferentes e alguém vai
 * confundir de novo: um MP3 de 20min em bitrate baixo passa folgado nos 25 MB e
 * continua violando os 90s. Esta checagem roda DEPOIS da transcrição (é o
 * Whisper quem mede a duração real) e continua sendo a palavra final.
 *
 * Devolve a frase da recusa, ou `null` quando está tudo certo. As frases são
 * literalmente as que a rota já devolvia — extraí pra cá pra poder TESTAR a
 * regra de verdade, não uma cópia dela.
 */
export function recusaPorDuracao(durationSeconds: number, maxSeconds: number): string | null {
  if (!(durationSeconds > 0)) return "Não conseguimos ler a duração desse áudio.";
  // tolerância de 0,5s: o Whisper devolve fracionado e 90,2s é um áudio de 90s
  if (durationSeconds > maxSeconds + 0.5) {
    return `O áudio tem ${Math.round(durationSeconds)}s — o máximo é ${maxSeconds}s (${duracaoLegivel(maxSeconds)}).`;
  }
  return null;
}

/** Só pro teste injetar o HEAD e a chamada da Whisper sem tocar na rede. */
type DepsTranscricao = {
  head: (bucket: string, key: string) => Promise<{ bytes: number | null }>;
  baixar: (key: string) => Promise<Uint8Array>;
  transcrever: (bytes: Uint8Array, filename: string) => Promise<Transcription>;
};

const DEPS_REAIS: DepsTranscricao = {
  head: (bucket, key) => objectHead(bucket, key),
  baixar: (key) => downloadAudio(key),
  transcrever: (bytes, filename) => transcribeAudioBuffer(bytes, filename),
};

/**
 * Whisper `verbose_json` traz `duration` (segundos) + `text`.
 * Mesmo padrão do worker de render (render/subtitles.mjs).
 *
 * Antes de baixar o objeto do R2 e empurrar os bytes pra OpenAI, pergunta o
 * TAMANHO por HEAD (barato, sem baixar) e recusa ali se já estiver acima do
 * teto. O caso valdirtrentotrg (15/09) era um MP4 de 60 minutos: o arquivo
 * inteiro era baixado e enviado só pra voltar 413. A mensagem pro aluno é a
 * mesma de antes — muda só QUANDO a gente descobre, não O QUE ele lê.
 */
export async function transcribeUploadedAudio(
  key: string,
  deps: DepsTranscricao = DEPS_REAIS,
): Promise<Transcription> {
  const { bytes: tamanho } = await deps.head(R2_BUCKETS.generations, key);
  if (acimaDoTetoDaTranscricao(tamanho)) {
    throw new Error(
      `${MARCA_GRANDE_DEMAIS}: ${tamanho} bytes no R2, teto ${WHISPER_MAX_BYTES} (key=${key})`,
    );
  }

  const bytes = await deps.baixar(key);
  return deps.transcrever(bytes, key.split("/").pop() || "audio.mp3");
}

/** Transcreve bytes de áudio direto (usado também pelo agente de suporte). */
export async function transcribeAudioBuffer(
  bytes: Uint8Array,
  filename: string,
  /** ISO-639-1 ("pt" | "es" | "en"...) — default pt, comportamento inalterado. */
  language = "pt",
): Promise<Transcription> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

  const form = new FormData();
  form.append("file", new Blob([Buffer.from(bytes)]), filename);
  form.append("model", "whisper-1");
  form.append("response_format", "verbose_json");
  form.append("language", language);

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!res.ok) {
    throw new Error(`Whisper API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const json = (await res.json()) as { text?: string; duration?: number };

  return {
    text: (json.text ?? "").trim(),
    durationSeconds: Number.isFinite(json.duration) ? Number(json.duration) : 0,
  };
}
