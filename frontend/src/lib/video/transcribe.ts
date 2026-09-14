/**
 * Transcrição (Whisper API) de um áudio ENVIADO pelo usuário pro wizard de
 * vídeo. Server-only. Devolve o texto (vira `script_text` — as cenas nascem
 * dele) e a DURAÇÃO REAL medida pelo Whisper — validação server-side do teto
 * de 90s (o browser já valida antes do upload, mas aqui é à prova de burla).
 */
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { r2, R2_BUCKETS } from "@/lib/r2/client";

export type Transcription = { text: string; durationSeconds: number };

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
  if (/Whisper API 413/.test(erro) || /Maximum content size/i.test(erro)) {
    return (
      `${Esse} ${rotulo} passou do tamanho que a transcrição aceita (o limite é 25 MB). ` +
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
 * Whisper `verbose_json` traz `duration` (segundos) + `text`.
 * Mesmo padrão do worker de render (render/subtitles.mjs).
 */
export async function transcribeUploadedAudio(key: string): Promise<Transcription> {
  const bytes = await downloadAudio(key);
  return transcribeAudioBuffer(bytes, key.split("/").pop() || "audio.mp3");
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
