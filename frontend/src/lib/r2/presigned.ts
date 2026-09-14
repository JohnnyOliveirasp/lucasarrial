/**
 * Geração de presigned URLs pra browser fazer upload direto pro R2.
 * Server-only.
 */
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2, R2_BUCKETS } from "./client";

const ALLOWED_AUDIO_MIME = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
  "audio/mp4",
  "audio/x-m4a",
  "audio/m4a",
  "audio/flac",
  "audio/x-flac",
  "audio/ogg",
  "audio/webm",
  // Gravadores de celular salvam AAC em container MP4 e o browser reporta
  // video/mp4 (caso Joana 21/07). O worker extrai o áudio via ffmpeg.
  "video/mp4",
  "audio/aac",
  "audio/x-aac",
  "audio/aacp",
  "audio/opus",
  /**
   * Áudio de WhatsApp é Opus DENTRO de container Ogg. O browser rotula o
   * arquivo pela EXTENSÃO, não pelo conteúdo — então o mesmo `.ogg` chega com
   * MIME diferente dependendo do navegador/SO (incidente #391, 14/09).
   *
   * ⚠️ MEDIDO no fonte do Firefox (`uriloader/exthandler/
   * nsExternalHelperAppService.cpp`): o array `defaultMimeEntries`, cujo
   * comentário é "Default extension->mimetype mappings. These are NOT
   * OVERRIDABLE", contém literalmente:
   *     {VIDEO_OGG, "ogv"},
   *     {APPLICATION_OGG, "ogg"},   // <- linha 503
   *     {AUDIO_OGG, "oga"},
   *     {AUDIO_OGG, "opus"},
   * Ou seja: TODO `.ogg` escolhido no Firefox chega como `application/ogg`.
   * Só `.oga` e `.opus` é que mapeiam pra `audio/ogg`. É por isso que a 1ª voz
   * do aluno passou em agosto e a 2ª não — mudou o navegador, não o arquivo.
   */
  "application/ogg",
  /**
   * Mesmo arquivo, terceiro rótulo possível. `extraMimeEntries`, no MESMO
   * fonte, tem `{VIDEO_OGG, "ogv,ogg", "Ogg Video"}` (linha 612) — a extensão
   * `.ogg` também está amarrada a `video/ogg`. No Linux o `shared-mime-info`
   * repete o conflito: conferi na máquina e `video/ogg` reivindica o glob
   * `*.ogg` junto com `audio/ogg`. E o bug 1240259 do Mozilla ("audio ogg file
   * has type 'video/ogg' instead of 'audio/ogg'") cita explicitamente
   * `<input type="file">` entre os cenários afetados.
   *
   * Incluído por EVIDÊNCIA, não por simetria — mesma justificativa do
   * `video/mp4` acima: é rótulo de container, o áudio está lá dentro e o
   * worker extrai via ffmpeg.
   */
  "video/ogg",
]);

export type UploadSlot = {
  index: number;
  key: string;
  upload_url: string;
  expires_in_seconds: number;
};

export function isAllowedAudioMime(mime: string): boolean {
  return ALLOWED_AUDIO_MIME.has(mime.toLowerCase());
}

const ALLOWED_IMAGE_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

export function isAllowedImageMime(mime: string): boolean {
  return ALLOWED_IMAGE_MIME.has(mime.toLowerCase());
}

/** Chave da imagem de REFERÊNCIA (foto enviada pelo usuário). */
/**
 * Extensões que SÃO JPEG mas quebram no Kie. O `.jfif` é o padrão do Windows
 * ao salvar imagem de alguns navegadores, e do WhatsApp Web — chega direto do
 * computador do aluno sem ele nunca ter escolhido esse formato.
 *
 * ⚠️ MEDIDO (21/08, incidente edc50dc6): a aluna Ketty ficou 3 dias com TODOS
 * os projetos de Vídeo História travados. As 27 cenas, dos 3 projetos, tinham
 * o mesmo erro: `Kie createTask sem taskId (code=500, msg=File type not
 * supported)`. Os arquivos eram `input_apres1.jfif`, `input_3.0.jfif` etc. Li
 * os primeiros bytes no R2: `FFD8FFE0...` — é JPEG de verdade. O Kie recusa
 * pela EXTENSÃO, não pelo conteúdo.
 *
 * Nós aceitávamos no upload (o browser manda `image/jpeg` no MIME, então a
 * validação passava) e o Kie rejeitava depois, na hora de gerar — longe do
 * upload, sem nada na tela ligando uma coisa à outra.
 */
const EXTENSOES_JPEG_PROBLEMATICAS = new Set(["jfif", "jfi", "jif", "jpe"]);

/** Troca a extensão por `.jpg` quando o arquivo já é JPEG por dentro. */
export function normalizarNomeDeImagem(filename: string): string {
  const i = filename.lastIndexOf(".");
  if (i <= 0) return filename;
  const ext = filename.slice(i + 1).toLowerCase();
  if (!EXTENSOES_JPEG_PROBLEMATICAS.has(ext)) return filename;
  return `${filename.slice(0, i)}.jpg`;
}

export function buildInputImageKey(
  userId: string,
  imageId: string,
  filename: string,
): string {
  const safe = normalizarNomeDeImagem(filename)
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(-80);
  return `${userId}/images/${imageId}/input_${safe}`;
}

/** Chave da imagem RESULTANTE (saída do Kie, guardada permanentemente). */
export function buildImageResultKey(
  userId: string,
  imageId: string,
  ext: string,
): string {
  const safeExt = ext.replace(/[^a-z0-9]/gi, "").toLowerCase() || "png";
  return `${userId}/images/${imageId}/result.${safeExt}`;
}

export function buildRawAudioKey(
  userId: string,
  voiceId: string,
  index: number,
  filename: string,
): string {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
  const padded = String(index).padStart(3, "0");
  return `${userId}/${voiceId}/raw/${padded}_${safe}`;
}

export function buildLoraKey(userId: string, voiceId: string): string {
  return `${userId}/${voiceId}/lora.safetensors`;
}

export function buildGenerationKey(userId: string, genId: string): string {
  return `${userId}/${genId}.wav`;
}

/**
 * Chave do áudio ENVIADO pelo usuário pro wizard de vídeo (voz própria).
 * Vive no bucket de generations (mesmo TTL/fluxo dos áudios TTS — o worker de
 * render e o player do projeto já leem desse bucket).
 */
export function buildVideoUploadAudioKey(
  userId: string,
  uploadId: string,
  filename: string,
): string {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-60);
  return `${userId}/video-uploads/${uploadId}_${safe}`;
}

/**
 * Chave DETERMINÍSTICA da referência auto-extraída no treino. Determinística
 * de propósito: o `start-training` cria o presigned PUT com ela e o `webhook`
 * recalcula a mesma chave pra gravar em `voices.reference_audio_path` no fim do
 * treino (sem precisar carregar estado intermediário).
 */
export function buildAutoReferenceKey(userId: string, voiceId: string): string {
  return `${userId}/${voiceId}/ref/auto.wav`;
}

export async function createPresignedPut(
  bucket: string,
  key: string,
  contentType: string,
  expiresIn = 3600,
): Promise<string> {
  const cmd = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(r2, cmd, { expiresIn });
}

export async function createPresignedGet(
  bucket: string,
  key: string,
  expiresIn = 3600,
): Promise<string> {
  const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(r2, cmd, { expiresIn });
}

export async function createUploadSlots(
  userId: string,
  voiceId: string,
  files: Array<{ filename: string; content_type: string }>,
): Promise<UploadSlot[]> {
  // 6h: uploads de treino podem ter centenas de MB (1h de áudio WAV/FLAC) e
  // levar muito tempo em conexões lentas. 1h (3600s) estourava a assinatura no
  // meio do upload e o R2 rejeitava com 403 ("falhou ao subir"). R2 aceita
  // presigned até 7 dias; 6h cobre uploads grandes com folga.
  const expiresIn = 6 * 3600;
  const slots: UploadSlot[] = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const key = buildRawAudioKey(userId, voiceId, i, f.filename);
    const url = await createPresignedPut(
      R2_BUCKETS.voices,
      key,
      f.content_type,
      expiresIn,
    );
    slots.push({
      index: i,
      key,
      upload_url: url,
      expires_in_seconds: expiresIn,
    });
  }
  return slots;
}
