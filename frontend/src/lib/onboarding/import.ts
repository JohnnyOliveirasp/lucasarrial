/**
 * Importadores do onboarding via planilha (Drive → R2 → banco). Server-only.
 *
 * CORREÇÃO JOHNNY 13/08 (caso Vinicius): as fotos do Drive NÃO são histórico
 * — são matéria-prima de REFERÊNCIA. Fluxo correto:
 * - Fotos → acervo de referência (`image_generations` kie_model="upload";
 *   o card de HISTÓRICO esconde uploads — histórico é só de GERADAS).
 *   A melhor foto (close de rosto FRONTAL, escolhida por visão/Haiku) vira a
 *   referência principal (profiles.image_ref_key); as demais ficam de extras.
 * - Com as fotos, o sistema GERA 2-3 avatares (lib/onboarding/avatares.ts,
 *   COBRADO do aluno) — esses SIM aparecem no histórico (são gerados).
 * - Áudios → voz "Minha Voz" e DISPARA O TREINO na hora (COBRADO do aluno,
 *   lib/onboarding/treino.ts) — o aluno já entra com a voz treinando.
 *   (Correção Johnny 17/08: antes era por conta da casa; sem saldo o item
 *   não roda e o motivo vai na nota da planilha.)
 *
 * Tudo idempotente por fileId do Drive: chave R2 determinística → reprocessar
 * a mesma linha da planilha não duplica nada.
 */
import { randomUUID } from "crypto";
import { HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, VoiceStatus } from "@/lib/db/types";
import { imagesBucket, r2, R2_BUCKETS } from "@/lib/r2/client";
import { buildRawAudioKey, createPresignedGet } from "@/lib/r2/presigned";
import { adotarReferencia } from "@/lib/images/refs";
import { estimateSpeechSeconds } from "@/lib/audio/speech-estimate";
import {
  MIN_TOTAL_SECONDS,
  RX_EXT_AUDIO,
  mensagemCurtoDemais,
} from "@/lib/voices/regua-audio";
import {
  sniffAudio,
  ehPaginaWeb,
  probeAudioDuracaoLocal,
  motivoDownloadVeioPagina,
} from "./audio-tipo";
import { rm } from "node:fs/promises";
import { dirTemporario } from "./tmp";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  downloadDriveFile,
  downloadDriveFileToPath,
  pickExtension,
  ehArquivoLocal,
  type DriveFile,
} from "./drive";
import {
  sniffImagem,
  heicParaJpegViaDrive,
  heicParaJpegLocal,
  trocarExtensao,
  descreverArquivo,
} from "./imagem-tipo";
import { extrairFramesDeArquivo } from "./video-frames";
import { extrairAudioDeArquivo } from "./video-audio";
import { escolherReferenciaFrontal } from "./referencia";
import { dispararTreinoOnboarding } from "./treino";
import { decidirVozOnboarding, type VozOnboarding } from "./veredito-audio";
import { decidirResgate } from "./resgate-audio";

type Admin = SupabaseClient<Database>;

const MAX_IMAGE_BYTES = 30 * 1024 * 1024; // 30MB por foto
// Lote 1 (14/08): "fotos" do aluno = 1 VÍDEO dele (165-304MB). Baixamos o
// vídeo com teto próprio e extraímos 3 frames que viram as fotos.
const MAX_VIDEO_BYTES = 2 * 1024 * 1024 * 1024; // streaming pra disco — tamanho quase não importa (A248: 878MB)
const MAX_AUDIO_BYTES = 400 * 1024 * 1024; // 400MB por take (1h WAV cabe)
// O aluno mandou VÍDEO como fonte de voz e o vídeo passa do teto acima. O que
// não cabe é o VÍDEO, não a voz dele: streaming pro disco + ffmpeg tira a
// faixa de áudio, que tem dezenas de MB. Espelha o que o lado das FOTOS já faz
// desde 14/08 (`importarFramesDoVideo`) e que o lado do ÁUDIO nunca teve.
// Medido no caso Johnathan (#180, 29/08): 8 dos 15 arquivos morriam aqui, entre
// eles um de 490MB com 28min22s de fala que SOZINHO abriria a porta de 20min.
// Os 7 que cabiam somavam 19min15s — ele era reprovado por 45 SEGUNDOS e lia
// "seu áudio é curto, grave mais": culpado por um teto NOSSO.
const MAX_AUDIO_SOURCE_BYTES = 4 * 1024 * 1024 * 1024; // 4GB EM DISCO, nunca em Buffer
// Teto de TEMPO, não de tamanho: a rota tem `maxDuration` de 600s e cada vídeo
// desses leva minutos pra baixar. Três resolvem o caso real; o que passar disso
// segue contando como descartado — e agora o descarte APARECE na mensagem.
const MAX_AUDIO_STREAM_FILES = 3;
const MAX_IMAGES = 20;
const MAX_AUDIOS = 20; // mesmo teto do MAX_FILES_PER_VOICE
/* A régua de 20min brutos vive em @/lib/voices/regua-audio (importada acima). */
/** Nome da voz criada pelo onboarding — âncora da idempotência. */
export const ONBOARDING_VOICE_NAME = "Minha Voz";

export type ImportResult = {
  imported: number;
  skipped: number;
  failed: Array<{ id: string; error: string }>;
  /** Lote 1 (13/08): aluno joga VÍDEO/arquivo gigante na pasta de fotos —
   *  não pode derrubar a linha. Não-imagem/acima do teto vira "ignorado". */
  ignored?: Array<{ id: string; reason: string }>;
};

/** Chave R2 determinística da foto importada (idempotência por fileId). */
function imageDestKey(userId: string, fileId: string, ext: string): string {
  const safe = fileId.replace(/[^a-zA-Z0-9_-]/g, "");
  return `${userId}/uploads/onboarding_${safe}.${ext}`;
}

/**
 * Das chaves que o BANCO diz existir, quais estão MESMO no R2 (caso Ricardo
 * 17/08). Linha órfã é pior que linha ausente: ela some da reimportação e
 * ainda é oferecida ao Kie, que falha ao baixar.
 */
async function filtrarExistentesNoR2(chaves: string[]): Promise<string[]> {
  const vivas = await Promise.all(
    chaves.map(async (key) => {
      try {
        await r2.send(new HeadObjectCommand({ Bucket: imagesBucket(), Key: key }));
        return key;
      } catch {
        console.error(`[onboarding/import] foto fantasma (linha sem objeto no R2): ${key}`);
        return null;
      }
    }),
  );
  return vivas.filter((k): k is string => k !== null);
}

/**
 * Aluno mandou VÍDEO no lugar de foto: baixa com teto maior, extrai 3 frames
 * (15/45/75% da duração) e sobe cada um como foto do acervo. Chaves com o
 * prefixo `onboarding_<fileId>.` — a mesma sonda de idempotência das fotos
 * normais encontra os frames num reprocesso. Devolve quantos frames entraram.
 */
async function importarFramesDoVideo(
  admin: Admin,
  userId: string,
  fileId: string,
  allKeys: string[],
): Promise<number> {
  // STREAMING pra disco (A248: 878MB — nada de Buffer gigante na RAM).
  // Sem filtro de content-type: o Drive serve .mp4/.mov como octet-stream;
  // o ffprobe decide — se não for vídeo, a extração lança e vira "ignorado".
  const dir = await dirTemporario("onbdl-");
  let frames: Buffer[];
  try {
    const src = join(dir, "video.bin");
    await downloadDriveFileToPath(fileId, src, MAX_VIDEO_BYTES);
    frames = await extrairFramesDeArquivo(src);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
  const safe = fileId.replace(/[^a-zA-Z0-9_-]/g, "");
  let n = 0;
  for (let i = 0; i < frames.length; i++) {
    const destKey = `${userId}/uploads/onboarding_${safe}.frame${i}.jpg`;
    await r2.send(
      new PutObjectCommand({
        Bucket: imagesBucket(),
        Key: destKey,
        Body: frames[i],
        ContentType: "image/jpeg",
      }),
    );
    const { error: insertErr } = await admin.from("image_generations").insert({
      id: randomUUID(),
      user_id: userId,
      name: `Foto do vídeo (${i + 1})`,
      prompt: "",
      input_image_path: "",
      aspect_ratio: "auto",
      resolution: "original",
      credits_cost: 0,
      image_path: destKey,
      status: "ready",
      kie_model: "upload",
    });
    if (insertErr) throw new Error(insertErr.message);
    allKeys.push(destKey);
    n++;
  }
  return n;
}

/**
 * Foto tirada do THUMBNAIL do Drive — sem baixar o arquivo original.
 *
 * 22/08: o aluno manda um vídeo de 2,3GB na pasta de fotos. Baixar pra extrair
 * frames estoura o teto (e antes ainda enchia o /tmp, que é RAM). Mas o Drive
 * já tem um frame pronto e entrega em JPEG por /thumbnail — 437KB em vez de
 * 2,3GB. Casos reais: linhas 373, 376, 388.
 *
 * Vale pra vídeo e pra foto: é a mesma porta que converte HEIC.
 */
async function importarThumbnailDoDrive(
  admin: Admin,
  userId: string,
  fileId: string,
  allKeys: string[],
): Promise<number> {
  const bytes = await heicParaJpegViaDrive(fileId, MAX_IMAGE_BYTES);
  const safe = fileId.replace(/[^a-zA-Z0-9_-]/g, "");
  const destKey = `${userId}/uploads/onboarding_${safe}.jpg`;

  await r2.send(
    new PutObjectCommand({
      Bucket: imagesBucket(),
      Key: destKey,
      Body: bytes,
      ContentType: "image/jpeg",
    }),
  );
  const { error: insertErr } = await admin.from("image_generations").insert({
    id: randomUUID(),
    user_id: userId,
    name: "Foto do arquivo enviado",
    prompt: "",
    input_image_path: "",
    aspect_ratio: "auto",
    resolution: "original",
    credits_cost: 0,
    image_path: destKey,
    status: "ready",
    kie_model: "upload",
  });
  if (insertErr) throw new Error(insertErr.message);
  allKeys.push(destKey);
  return 1;
}

/**
 * Importa as fotos do Drive pro acervo do aluno e define a referência do
 * clone se ainda não houver (profiles.image_ref_key).
 */
export async function importImages(
  admin: Admin,
  userId: string,
  fileIds: string[],
  opts: { forceReference?: boolean } = {},
): Promise<ImportResult & { reference_key: string | null; all_keys: string[] }> {
  const result: ImportResult = { imported: 0, skipped: 0, failed: [], ignored: [] };
  const allKeys: string[] = [];

  for (const fileId of fileIds.slice(0, MAX_IMAGES)) {
    try {
      // Idempotência: o acervo já tem foto(s) com esse fileId? (um vídeo
      // vira até 3 frames, todos com o mesmo prefixo — pega todos.)
      // ⚠️ CONFERE NO R2 (caso Ricardo 17/08): existia linha no banco cujo
      // objeto NÃO estava no R2; a foto fantasma era pulada aqui, virava a
      // referência do avatar e o Kie falhava com "Error while downloading" —
      // 3 avatares perdidos (cobrados e estornados). Linha sem arquivo não
      // conta como importada: reimporta.
      const probe = imageDestKey(userId, fileId, "");
      const { data: existingRows } = await admin
        .from("image_generations")
        .select("id, image_path")
        .eq("user_id", userId)
        .like("image_path", `${probe}%`)
        .limit(5);
      const existentesNoR2 = await filtrarExistentesNoR2(
        (existingRows ?? []).map((ex) => ex.image_path as string),
      );
      if (existentesNoR2.length > 0) {
        result.skipped++;
        allKeys.push(...existentesNoR2);
        continue;
      }

      const file = await downloadDriveFile(fileId, MAX_IMAGE_BYTES);
      // 22/08: quem decide é o CONTEÚDO, não o content-type. O Drive serve
      // .HEIC do iPhone como application/octet-stream, e confiar no rótulo
      // mandava 15 linhas da planilha pro caminho de vídeo (ffprobe: "moov
      // atom not found") com a pasta cheia de foto boa. Ver imagem-tipo.ts.
      const tipo = sniffImagem(file.bytes);
      if (!tipo) {
        // 22/08 (gêmeo do caso OneDrive no áudio): página de login/erro no
        // lugar da foto é DOWNLOAD que falhou, não "arquivo errado do aluno".
        // Sem isto, a mensagem virava "é uma página da internet, não uma
        // foto" + "Precisamos de uma FOTO sua" — culpando quem mandou certo.
        if (ehPaginaWeb(file.bytes)) {
          throw new Error(motivoDownloadVeioPagina("foto"));
        }
        // Diz O QUE é, não só "não é imagem": a linha 24 mandou um PDF e leu
        // "não é imagem (application/octet-stream); frames: vídeo sem duração
        // legível" — nada que ajudasse a consertar.
        const oQueE = descreverArquivo(file.bytes);
        throw new Error(
          oQueE
            ? `é ${oQueE}, não uma foto`
            : `não é imagem (${file.contentType})`,
        );
      }

      let bytes = file.bytes;
      let contentType = tipo.mime;
      let filename = file.filename;
      let ext = tipo.ext;
      if (tipo.heic) {
        // Nada no resto do sistema (R2, Kie, avatares) abre HEIC.
        // Arquivo que veio de WeTransfer/Dropbox NUNCA esteve no Drive: pedir
        // a conversão de lá devolvia HTTP 400 e derrubava a linha (caso 97).
        bytes = ehArquivoLocal(fileId)
          ? await heicParaJpegLocal(bytes)
          : await heicParaJpegViaDrive(fileId, MAX_IMAGE_BYTES);
        contentType = "image/jpeg";
        ext = "jpg";
        filename = trocarExtensao(filename, "jpg");
      }
      const destKey = imageDestKey(userId, fileId, ext);

      await r2.send(
        new PutObjectCommand({
          Bucket: imagesBucket(),
          Key: destKey,
          Body: bytes,
          ContentType: contentType,
        }),
      );

      // Mesmo shape do /api/v1/images/import (upload próprio no acervo).
      const { error: insertErr } = await admin.from("image_generations").insert({
        id: randomUUID(),
        user_id: userId,
        name: filename?.replace(/\.[a-zA-Z0-9]{1,5}$/, "") || "Foto enviada",
        prompt: "",
        input_image_path: "",
        aspect_ratio: "auto",
        resolution: "original",
        credits_cost: 0,
        image_path: destKey,
        status: "ready",
        kie_model: "upload",
      });
      if (insertErr) throw new Error(insertErr.message);

      result.imported++;
      allKeys.push(destKey);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Vídeo (ou arquivo grande) no lugar de foto: tenta extrair 3 frames
      // do vídeo — é o que o time fazia na mão (print do vídeo do aluno).
      // "não uma foto" entra aqui porque a mensagem passou a dizer O QUE é o
      // arquivo ("é um vídeo, não uma foto"). Sem isso, o caso MAIS COMUM — o
      // aluno que manda vídeo no lugar da foto — deixaria de tentar os frames.
      if (/teto \d+MB|não é imagem|não uma foto/.test(msg)) {
        try {
          const n = await importarFramesDoVideo(admin, userId, fileId, allKeys);
          if (n > 0) {
            result.imported++;
            continue;
          }
          result.ignored!.push({ id: fileId, reason: msg });
        } catch (e2) {
          // ÚLTIMO RECURSO (22/08): baixar o vídeo falhou — grande demais pro
          // teto, ou o disco encheu. O Drive já tem um frame pronto e serve em
          // JPEG por /thumbnail, SEM baixar o arquivo. Resolve os vídeos de
          // 2,3GB das linhas 373/376/388 e qualquer tamanho daqui pra frente:
          // a régua do Johnny é "basta PELO MENOS 1 imagem".
          const eSoTamanho = /teto|passou de|ENOSPC|no space left/i.test(
            e2 instanceof Error ? e2.message : String(e2),
          ) || /teto \d+MB/.test(msg);
          // Arquivo de WeTransfer/Dropbox não está no Drive: pedir o thumbnail
          // de lá só devolve HTTP 400 (mesma pedra do caso 97).
          if (eSoTamanho && !ehArquivoLocal(fileId)) {
            try {
              const n = await importarThumbnailDoDrive(admin, userId, fileId, allKeys);
              if (n > 0) {
                result.imported++;
                continue;
              }
            } catch {
              /* nem o thumbnail veio — cai no ignorado abaixo */
            }
          }
          result.ignored!.push({
            id: fileId,
            reason: `${msg}; frames: ${e2 instanceof Error ? e2.message : String(e2)}`,
          });
        }
      } else {
        result.failed.push({ id: fileId, error: msg });
      }
    }
  }

  // Tinha arquivos mas nenhum aproveitável → isso SIM é erro da linha.
  if (fileIds.length > 0 && allKeys.length === 0 && result.failed.length === 0) {
    const motivos = result.ignored!.map((x) => x.reason).join("; ").slice(0, 180);
    result.failed.push({
      id: "fotos",
      error: `nenhuma foto aproveitável (${result.ignored!.length} ignorado(s): ${motivos || "?"})`,
    });
  }

  // Referência principal (Johnny 13/08): a foto de CLOSE DE ROSTO FRONTAL,
  // escolhida por visão (Haiku) — não mais aleatória. Só define se não
  // existe (não sobrescreve escolha do aluno), salvo forceReference (usado
  // na correção de contas importadas no modelo antigo).
  let referenceKey: string | null = null;
  if (allKeys.length > 0) {
    const { data: prof } = await admin
      .from("profiles")
      .select("image_ref_key")
      .eq("id", userId)
      .maybeSingle();
    if (prof && (!prof.image_ref_key || opts.forceReference)) {
      let idx = 0;
      try {
        const urls = await Promise.all(
          allKeys.map((k) => createPresignedGet(imagesBucket(), k, 3600)),
        );
        idx = await escolherReferenciaFrontal(urls);
      } catch {
        /* visão falhou → primeira foto */
      }
      referenceKey = allKeys[idx] ?? allKeys[0];
      // Adota já no nascimento (19/08): a chave crua aponta pra dentro de uma
      // geração — se o aluno apagar aquela linha do histórico, a referência
      // morre. Em refs/ ela sobrevive ao histórico inteiro.
      try {
        referenceKey = await adotarReferencia(userId, referenceKey);
      } catch { /* adoção falhou: fica a crua, o ref-default adota depois */ }
      await admin.from("profiles").update({ image_ref_key: referenceKey }).eq("id", userId);
    } else {
      referenceKey = (prof?.image_ref_key as string | null) ?? null;
    }
  }

  return { ...result, reference_key: referenceKey, all_keys: allKeys };
}

export type AudioImportResult = ImportResult & {
  voice_id: string | null;
  voice_status: string | null;
  training: string | null;
};

/**
 * Arquivo grande demais pro Buffer: baixa por STREAMING pro disco e devolve só
 * a FAIXA DE ÁUDIO. Serve tanto pro Drive quanto pro arquivo local vindo de
 * `abrirLink` (zip/WeTransfer/Dropbox) — `downloadDriveFileToPath` trata os
 * dois. O nome sintético carrega a extensão real da faixa, que é o que o
 * `pickExtension` e a régua de extensões leem depois.
 */
async function audioDeVideoGrande(fileId: string): Promise<DriveFile> {
  const dir = await dirTemporario("onbaudsrc-");
  try {
    const src = join(dir, "fonte.bin");
    await downloadDriveFileToPath(fileId, src, MAX_AUDIO_SOURCE_BYTES);
    const faixa = await extrairAudioDeArquivo(src);
    const safe = fileId.replace(/[^a-zA-Z0-9_-]/g, "");
    return {
      bytes: faixa.bytes,
      contentType: faixa.mime,
      filename: `${safe}.${faixa.ext}`,
    };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/** Tenta disparar o treino (cobrado do aluno); nunca derruba o import. */
async function tentarTreino(
  admin: Admin,
  userId: string,
  voiceId: string,
): Promise<{ status: string | null; nota: string }> {
  try {
    const r = await dispararTreinoOnboarding(admin, userId, voiceId);
    return r.ok
      ? { status: "training", nota: "treino disparado" }
      : { status: null, nota: `treino não disparado: ${r.reason}` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[onboarding/import] treino:", msg);
    return { status: null, nota: `treino falhou: ${msg}` };
  }
}

/**
 * Importa os áudios do Drive e DISPARA O TREINO (correção Johnny 13/08 —
 * antes ficava parado em awaiting_training esperando o aluno pagar).
 */
export async function importTrainingAudios(
  admin: Admin,
  userId: string,
  fileIds: string[],
): Promise<AudioImportResult> {
  // `ignored` PRECISA nascer aqui: a linha que empurra não-áudio faz
  // `result.ignored!.push(...)`, e o `!` só engana o TypeScript — em runtime
  // dava "Cannot read properties of undefined (reading 'push')" e derrubava o
  // import inteiro. Justo no caso mais comum: o aluno joga foto e áudio na
  // MESMA pasta do Drive. Casos reais 22/08: linhas 327 e 328.
  const result: ImportResult = { imported: 0, skipped: 0, failed: [], ignored: [] };
  if (fileIds.length === 0) {
    return { ...result, voice_id: null, voice_status: null, training: null };
  }

  // Idempotência da voz do onboarding — INCIDENTE 146 (26/08).
  //
  // A guarda antiga era `created_at ASC limit 1` + "qualquer status !=
  // 'uploading' já está pronto". Isso fazia duas coisas erradas ao mesmo tempo:
  // estado TERMINAL DE FALHA virava "pronto" (material NOVO era pulado sem
  // download e sem medição, e o veredito velho voltava pro chamador, que o
  // mandava por e-mail), e a voz escolhida era a MAIS ANTIGA (rafaelleitemacedo,
  // voz `ready` desde 16/08, foi recusado em 22/08 pela voz reprovada de 13/08).
  //
  // Agora quem decide é `decidirVozOnboarding` (lógica pura + testes em
  // veredito-audio.ts): voz em estado bom manda; falha terminal com o MESMO
  // material continua pulando (é o que evita o e-mail duplicado — robson levou
  // 3, itabenke 3, isabella 3); falha terminal com fileId NOVO volta pro fluxo
  // normal de importação, porque aí o aluno reenviou e o material PRECISA ser
  // medido. A régua (MIN_TOTAL_SECONDS) não mudou: o portão passa a RODAR, não
  // a afrouxar.
  //
  // ⚠️ COBRANÇA: o fluxo de importação termina em `tentarTreino`, que cobra
  // TRAINING_CREDIT_COST (treino.ts, `debitCreditsOnboarding`). Por isso o
  // caminho "importar" só é liberado quando existe fileId NOVO — ou seja, o
  // aluno mandou material novo e está pedindo o treino. Re-execução da planilha
  // com o mesmo material NÃO cria cobrança nova.
  const { data: vozes } = await admin
    .from("voices")
    .select("id, status, raw_audio_paths, created_at")
    .eq("user_id", userId)
    .eq("name", ONBOARDING_VOICE_NAME)
    .order("created_at", { ascending: false })
    .limit(20);

  const decisao = decidirVozOnboarding((vozes ?? []) as VozOnboarding[], fileIds);

  if (decisao.acao === "reusar" || decisao.acao === "pular") {
    const voz = decisao.voz;
    result.skipped = fileIds.length;
    // Reprocesso de conta importada no modelo antigo: voz parada esperando
    // o aluno pagar → dispara o treino agora (idempotente: training/ready
    // não entram aqui).
    let training: string | null = null;
    if (voz.status === "awaiting_training") {
      const t = await tentarTreino(admin, userId, voz.id);
      training = t.nota;
      if (t.status) {
        return { ...result, voice_id: voz.id, voice_status: t.status, training };
      }
    }
    return {
      ...result,
      voice_id: voz.id,
      voice_status: voz.status,
      training,
    };
  }

  // "retomar" = importação anterior morreu no meio (voz em "uploading").
  // "importar" = sem voz, ou falha terminal com material novo → voz nova, para
  // que as chaves R2 (que levam o voiceId) forcem download e medição de tudo.
  let voiceId = decisao.acao === "retomar" ? decisao.voz.id : undefined;
  if (!voiceId) {
    const { data: voice, error } = await admin
      .from("voices")
      .insert({ user_id: userId, name: ONBOARDING_VOICE_NAME, status: "uploading" })
      .select("id")
      .single();
    if (error || !voice) throw new Error(`criar voice falhou: ${error?.message}`);
    voiceId = voice.id as string;
  }

  const uploadedKeys: string[] = [];
  let streamsRestantes = MAX_AUDIO_STREAM_FILES;
  // Teto de RELÓGIO, não só de contagem — medido no próprio caso Johnathan
  // (29/08): os 3 arquivos que o resgate pegaria somam **4,77 GB**. A 24 MB/s
  // (throughput real medido contra o Drive) dá ~200s só de download, dentro do
  // `maxDuration = 600` da rota — mas essa folga é do TAMANHO DA PASTA DELE,
  // não uma garantia. Uma pasta pior, ou um dia de rede ruim, estoura os 600s
  // e aí o import inteiro morre: o aluno não recebe recusa, recebe NADA — pior
  // que a mensagem errada que este commit veio consertar. Com o relógio, o que
  // não coube vira descarte declarado, e a mensagem agora conta o descarte.
  const RESGATE_DEADLINE = Date.now() + 300_000;
  for (let i = 0; i < Math.min(fileIds.length, MAX_AUDIOS); i++) {
    const fileId = fileIds[i];
    try {
      let file: DriveFile;
      try {
        file = await downloadDriveFile(fileId, MAX_AUDIO_BYTES);
      } catch (eDown) {
        const msgDown = eDown instanceof Error ? eDown.message : String(eDown);
        // SÓ tamanho entra no resgate, e só quando o arquivo CABE no teto do
        // próprio resgate. Arquivo privado, HTML de login e id inválido
        // continuam falhando igual: ali o problema não é o teto e fingir que é
        // esconderia o defeito de verdade.
        //
        // #194 (29/08): a vaga era debitada ANTES de saber se o arquivo cabia,
        // então os dois .mp4 de 10,9GB e 9,4GB que abrem a pasta do Johnathan
        // queimavam duas das três vagas sem entregar byte nenhum — e o de
        // 490MB, que sozinho tem os 28min22s que abrem a porta de 20min, ficava
        // sem vaga. A decisão virou função pura e testada, e só `resgatar: true`
        // gasta vaga.
        const decisao = decidirResgate({
          msgErro: msgDown,
          streamsRestantes,
          agoraMs: Date.now(),
          deadlineMs: RESGATE_DEADLINE,
          tetoResgateBytes: MAX_AUDIO_SOURCE_BYTES,
        });
        if (!decisao.resgatar) throw eDown;
        streamsRestantes--;
        file = await audioDeVideoGrande(fileId);
      }
      // 22/08: quem decide é o CONTEÚDO, não o rótulo — a versão de áudio da
      // regra que o sniffImagem já aplica nas fotos. O caso que forçou isso:
      // link do OneDrive devolvia a página de LOGIN da Microsoft (HTML de
      // ~300KB), o nome não tinha extensão, o content-type era octet-stream, e
      // o fallback "mp3" do pickExtension fazia o HTML passar no filtro e
      // subir pro R2 como áudio. O worker não achava fala e o aluno lia
      // "grave num ambiente silencioso" — culpado por um download NOSSO que
      // falhou (marlonwsmuniz/voz 0e2f5726, lazevedo/voz 3d3c4da8).
      if (ehPaginaWeb(file.bytes)) {
        // Página de login/erro NUNCA é o arquivo do aluno: é download que
        // falhou. Vai pra `failed` (não `ignored`) — a linha tem que virar
        // Erro e o aluno tem que saber a verdade, não "grave de novo".
        result.failed.push({ id: fileId, error: motivoDownloadVeioPagina("áudio") });
        continue;
      }
      // Só ÁUDIO entra na lista do treino (incidente 910ea757, 20/08): a pasta
      // do Drive do aluno costuma misturar as FOTOS com os áudios, e todo
      // arquivo virava `raw_audio_paths`. No treino, o ffmpeg de conversão
      // topava um .jpg e devolvia "Output file #0 does not contain any
      // stream" — o job inteiro falhava e o aluno recebia "seu arquivo chegou
      // corrompido, envie de novo" (mensagem falsa: ele nunca enviou nada,
      // veio da planilha). Medido: 4 vozes travadas, uma delas com 9 de 9
      // arquivos sendo foto. Não-áudio agora é "ignorado", não derruba a voz.
      const tipo = sniffAudio(file.bytes);
      let ehAudio = tipo !== null;
      if (!ehAudio) {
        // Assinatura desconhecida mas o RÓTULO insiste que é áudio (ex.: mp3
        // com lixo antes do primeiro frame): o ffprobe LOCAL dá o veredito —
        // faixa de áudio com duração > 0. Sem o fallback "mp3" na conta: era
        // ele que deixava qualquer conteúdo sem nome nem tipo passar por mp3.
        const rotuloDizAudio =
          (file.contentType || "").toLowerCase().startsWith("audio/") ||
          RX_EXT_AUDIO.test(file.filename ?? "");
        if (rotuloDizAudio) {
          ehAudio = (await probeAudioDuracaoLocal(file.bytes)) !== null;
        }
      }
      // A lista vem da régua (fonte única). Manter cópia aqui já custou caro:
      // este filtro aceitava `mov|mkv|wma|amr` e a régua não, então o arquivo
      // era gravado e depois descartado por ela — a casa perdia o áudio do
      // aluno e o recusava por "áudio insuficiente" (medido em 21/08).
      // O fallback do pickExtension agora é o que o CONTEÚDO diz (tipo?.ext),
      // não mais "mp3" às cegas.
      const ext = pickExtension(file.filename, file.contentType, tipo?.ext ?? "mp3");
      if (!ehAudio) {
        // Diz O QUE é, quando dá (mesma cortesia do caminho das fotos).
        const oQueE = descreverArquivo(file.bytes);
        result.ignored!.push({
          id: fileId,
          reason: oQueE
            ? `não é áudio (é ${oQueE}) — provavelmente foto ou documento na pasta`
            : `não é áudio (${file.contentType || ext}) — provavelmente foto na pasta do Drive`,
        });
        continue;
      }
      const safeId = fileId.replace(/[^a-zA-Z0-9_-]/g, "");
      // Chave determinística por fileId — re-rodar sobrescreve o mesmo objeto.
      const key = buildRawAudioKey(userId, voiceId, i, `onboarding_${safeId}.${ext}`);
      await r2.send(
        new PutObjectCommand({
          Bucket: R2_BUCKETS.voices,
          Key: key,
          Body: file.bytes,
          ContentType: file.contentType,
        }),
      );
      uploadedKeys.push(key);
      result.imported++;
    } catch (e) {
      result.failed.push({ id: fileId, error: e instanceof Error ? e.message : String(e) });
    }
  }

  if (uploadedKeys.length === 0) {
    // Nada subiu — deixa a voz em "uploading" pra próxima tentativa retomar.
    return { ...result, voice_id: voiceId, voice_status: "uploading", training: null };
  }

  // Duração via ffmpeg (mesma régua do uploads-complete: <20min brutos rejeita).
  const urls = await Promise.all(
    uploadedKeys.map((k) => createPresignedGet(R2_BUCKETS.voices, k, 3600)),
  );
  const estimate = await estimateSpeechSeconds(urls);
  const totalSec = estimate.reliable ? estimate.totalSeconds : 0;

  let nextStatus: VoiceStatus;
  let errorMessage: string | null = null;
  if (!estimate.reliable) {
    // Medição falhou — não bloqueia: o start-training re-mede antes de cobrar.
    nextStatus = "awaiting_training";
  } else if (totalSec < MIN_TOTAL_SECONDS) {
    nextStatus = "rejected_too_short";
    errorMessage = mensagemCurtoDemais(totalSec);
  } else {
    nextStatus = "awaiting_training";
  }

  const { error: updErr } = await admin
    .from("voices")
    .update({
      raw_audio_paths: uploadedKeys,
      duration_seconds: totalSec > 0 ? Math.round(totalSec) : null,
      status: nextStatus,
      error_message: errorMessage,
    })
    .eq("id", voiceId);
  if (updErr) throw new Error(`atualizar voice falhou: ${updErr.message}`);

  // Johnny 13/08: áudio importado → treino JÁ dispara (cobrado, 17/08).
  let training: string | null = null;
  let finalStatus: string = nextStatus;
  if (nextStatus === "awaiting_training") {
    const t = await tentarTreino(admin, userId, voiceId);
    training = t.nota;
    if (t.status) finalStatus = t.status;
  }

  return { ...result, voice_id: voiceId, voice_status: finalStatus, training };
}
