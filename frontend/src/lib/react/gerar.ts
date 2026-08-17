/**
 * O motor do Video React: clone → montagem.
 *
 * Fica separado da rota porque são dois momentos distintos — dispara o clone
 * (RunPod, minutos) e depois monta (ffmpeg, no nosso servidor). A rota só
 * chama estas funções.
 */
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { r2, R2_BUCKETS } from "@/lib/r2/client";
import { createPresignedGet } from "@/lib/r2/presigned";
import { CLONE_TIERS, cloneExecutionTimeoutMs } from "@/lib/video-clone/config";
import { buildInfiniteTalkWorkflow } from "@/lib/video-clone/workflow";
import { getInfiniteTalkStatus, runInfiniteTalk } from "@/lib/video-clone/runpod";
import { transcribeWords } from "@/lib/video/transcribe-words";
import type { SubtitlePosition, SubtitleSize } from "@/lib/video/subtitle-presets";
import { estiloTemLegenda, montarAss } from "./legenda";
import { montarReact, type LayoutMontagem } from "./montagem";

const run = promisify(execFile);
/** Os TTFs viajam no deploy (public/assets) — o libass só precisa da pasta. */
const FONTS_DIR = path.join(process.cwd(), "public", "assets", "subtitle-fonts");
/** Padrão 2.0 — o mesmo tier do Vídeo Clone público. */
const TIER = CLONE_TIERS[0];

/**
 * ⚠️ O worker grava no bucket `voices-clone-ai-verse` (BUCKET_NAME do
 * endpoint RunPod), NÃO no de generations. Descoberto na marra em 14/08:
 * procurar o mp4 no bucket errado parece que o job falhou.
 */
const BUCKET_WORKER = "voices-clone-ai-verse";

/**
 * O mp4 do clone já chegou no bucket do worker? Permite retomar um job sem
 * perguntar ao RunPod — o status de lá EXPIRA (~30min) e a retomada de job
 * antigo morria no estadoClone (caso 17/08).
 */
export async function cloneJaNoR2(cloneKey: string): Promise<boolean> {
  try {
    await r2.send(new HeadObjectCommand({ Bucket: BUCKET_WORKER, Key: cloneKey }));
    return true;
  } catch {
    return false;
  }
}

/**
 * URL presignada do NOSSO R2 vence (1h-24h) e o rascunho do wizard pode ser
 * mais velho que isso — caso avatar.png 403 do Johnny 17/08 (foto preparada
 * de manhã, "Gerar" à tarde). Se a URL é do nosso R2, extrai bucket+chave e
 * assina de NOVO na hora de baixar. URL de fora (Kie etc.) passa intacta.
 */
async function renovarSeNosso(url: string): Promise<string> {
  try {
    const u = new URL(url);
    if (!u.hostname.endsWith(".r2.cloudflarestorage.com")) return url;
    const partes = u.pathname.replace(/^\//, "").split("/").map(decodeURIComponent);
    // Virtual-host: bucket no hostname (5+ labels); path-style: bucket no path.
    const vhost = u.hostname.split(".").length >= 5;
    const bucket = vhost ? u.hostname.split(".")[0] : partes[0];
    const key = (vhost ? partes : partes.slice(1)).join("/");
    if (!bucket || !key) return url;
    return await createPresignedGet(bucket, key, 3600);
  } catch {
    return url;
  }
}

/** Traz um arquivo de URL pública pro nosso R2 (a foto sai do Kie e expira). */
export async function trazerParaR2(url: string, key: string, contentType: string): Promise<string> {
  const res = await fetch(await renovarSeNosso(url));
  if (!res.ok) throw new Error(`não consegui baixar ${key} (${res.status})`);
  const bin = Buffer.from(await res.arrayBuffer());
  await r2.send(
    new PutObjectCommand({
      Bucket: R2_BUCKETS.generations,
      Key: key,
      Body: bin,
      ContentType: contentType,
    }),
  );
  return key;
}

/**
 * Quanto tempo o arquivo REALMENTE tem. null = não consegui medir.
 *
 * ⚠️ DECODIFICA o áudio inteiro em vez de ler o cabeçalho: mp3 VBR mente a
 * duração no header (caso 17/08: header dizia 52,25s, a fala ia até 53,94s
 * e o `-t` da montagem degolava o fim do CTA — "para a sua igreja" cortado).
 * O ffprobe de format=duration confia no header; o decode não.
 */
async function duracaoDoArquivo(caminho: string): Promise<number | null> {
  try {
    const { stderr } = await run(
      "ffmpeg",
      ["-v", "info", "-i", caminho, "-f", "null", "-"],
      { timeout: 120_000, maxBuffer: 8 * 1024 * 1024 },
    );
    // A última linha de progresso tem o tempo total decodificado.
    const m = [...String(stderr).matchAll(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/g)].pop();
    if (m) {
      const d = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
      if (Number.isFinite(d) && d > 0) return d;
    }
  } catch {
    /* cai pro ffprobe abaixo */
  }
  try {
    const { stdout } = await run("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=nw=1:nk=1",
      caminho,
    ]);
    const d = Number(String(stdout).trim());
    return Number.isFinite(d) && d > 0 ? d : null;
  } catch {
    return null;
  }
}

/**
 * Duração real de um áudio que ainda está numa URL.
 *
 * ⚠️ Existe porque a conta `palavras ÷ 2,5` MENTE: no 1º React do Johnny
 * (14/08) a fala real passou da estimativa e o vídeo cortou no meio do
 * "se você quer acessar www...". Quem manda no tempo é o áudio, não o texto.
 */
export async function duracaoDeUrl(url: string): Promise<number | null> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "react-dur-"));
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const arq = path.join(dir, "audio.bin");
    await fs.writeFile(arq, Buffer.from(await res.arrayBuffer()));
    return await duracaoDoArquivo(arq);
  } catch {
    return null;
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/** Dispara o clone com a foto de fundo verde + a fala. Devolve o job do RunPod. */
export async function dispararClone(args: {
  fotoKey: string;
  audioKey: string;
  saidaKey: string;
  segundos: number;
}): Promise<string> {
  const [imageUrl, audioUrl] = await Promise.all([
    createPresignedGet(R2_BUCKETS.generations, args.fotoKey, 60 * 60 * 3),
    createPresignedGet(R2_BUCKETS.generations, args.audioKey, 60 * 60 * 3),
  ]);
  const { workflow } = buildInfiniteTalkWorkflow({
    imageUrl,
    audioUrl,
    s3Key: args.saidaKey,
    tier: TIER,
    durationSeconds: args.segundos,
  });
  const { jobId } = await runInfiniteTalk(workflow, {
    executionTimeoutMs: cloneExecutionTimeoutMs(TIER, args.segundos),
  });
  return jobId;
}

export async function estadoClone(jobId: string) {
  return getInfiniteTalkStatus(jobId);
}

async function baixarDoR2(bucket: string, key: string, destino: string): Promise<void> {
  const obj = await r2.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const bytes = await obj.Body!.transformToByteArray();
  await fs.writeFile(destino, Buffer.from(bytes));
}

/**
 * Junta tudo e sobe o mp4 final. Roda quando o clone termina.
 * O áudio sai do próprio clone (ele já vem com a fala embutida) — o que
 * entra separado é o som do viral, abaixado pela montagem.
 */
export async function montarEEnviar(args: {
  viralKey: string;
  cloneKey: string;
  audioKey: string;
  layout: LayoutMontagem;
  segundos: number;
  /** Duração do viral: define onde ele acaba e começa o "só você". */
  viralSegundos: number;
  saidaKey: string;
  /** Preset de legenda (mesmos ids do editor). "none"/vazio = vídeo limpo. */
  legendaEstilo?: string | null;
  legendaPosicao?: SubtitlePosition | null;
  legendaTamanho?: SubtitleSize | null;
  /** Imagem de fundo do trecho "você em tela cheia". null = fundo escuro. */
  fundoKey?: string | null;
}): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "react-"));
  try {
    const viral = path.join(dir, "viral.mp4");
    const clone = path.join(dir, "clone.mp4");
    const audio = path.join(dir, "fala.mp3");
    const saida = path.join(dir, "final.mp4");

    await Promise.all([
      baixarDoR2(R2_BUCKETS.generations, args.viralKey, viral),
      baixarDoR2(BUCKET_WORKER, args.cloneKey, clone),
      baixarDoR2(R2_BUCKETS.generations, args.audioKey, audio),
    ]);

    // Última palavra do dono da verdade: o arquivo. Uma folga curta segura a
    // sílaba final (o corte seco comia o "…ponto com" do CTA).
    const real = await duracaoDoArquivo(audio);
    const segundos = real ? Math.ceil((real + 0.35) * 100) / 100 : args.segundos;

    // Fundo do trecho final, quando a pessoa escolheu um.
    let fundo: string | null = null;
    if (args.fundoKey) {
      try {
        fundo = path.join(dir, "fundo" + path.extname(args.fundoKey).slice(0, 5));
        await baixarDoR2(R2_BUCKETS.generations, args.fundoKey, fundo);
      } catch (e) {
        console.error("[react] fundo ignorado:", e instanceof Error ? e.message : e);
        fundo = null;
      }
    }

    // Legenda: os timestamps saem do Whisper POR PALAVRA e casam 1:1 com o
    // vídeo porque o áudio É o que gerou o clone. Falhou? o vídeo sai sem
    // legenda — não vale perder a montagem inteira por causa do texto.
    let ass: string | null = null;
    if (estiloTemLegenda(args.legendaEstilo)) {
      try {
        const palavras = await transcribeWords(R2_BUCKETS.generations, args.audioKey);
        const corpo = montarAss({
          palavras,
          estilo: args.legendaEstilo as string,
          posicao: args.legendaPosicao ?? null,
          tamanho: args.legendaTamanho ?? null,
        });
        if (corpo) {
          ass = path.join(dir, "legenda.ass");
          await fs.writeFile(ass, corpo, "utf8");
        }
      } catch (e) {
        console.error("[react] legenda pulada:", e instanceof Error ? e.message : e);
        ass = null;
      }
    }

    await montarReact({
      viral,
      avatar: clone,
      audio,
      saida,
      layout: args.layout,
      segundos,
      viralSegundos: args.viralSegundos,
      cena: fundo,
      ass,
      fontsDir: FONTS_DIR,
    });

    // Conferência barata: vídeo vazio não sobe.
    const { stdout } = await run("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=nw=1:nk=1",
      saida,
    ]);
    if (Number(stdout.trim()) < 1) throw new Error("montagem saiu vazia");

    const bin = await fs.readFile(saida);
    await r2.send(
      new PutObjectCommand({
        Bucket: R2_BUCKETS.generations,
        Key: args.saidaKey,
        Body: bin,
        ContentType: "video/mp4",
      }),
    );
    return args.saidaKey;
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
