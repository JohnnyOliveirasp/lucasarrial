/**
 * Worker de MONTAGEM do vídeo final (Fase 5). Consome a fila `render_jobs`:
 * baixa os clipes das cenas (ordem idx) + o áudio do R2, normaliza cada clipe
 * pra 9:16 720p, concatena, muxa o áudio e CORTA no tamanho do áudio (o áudio
 * manda), sobe o mp4 final pro R2 e marca o projeto como `done`.
 *
 * NÃO usa dependência nova: ffmpeg/ffprobe do sistema + @aws-sdk/@supabase já
 * instalados no frontend. Rode a partir de `frontend/`:
 *
 *   npm run render:worker
 *
 * É o MESMO código que roda no servidor (pm2, ecosystem.config.cjs). Server-only.
 */
import { spawn } from "node:child_process";
import { createWriteStream, readFileSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getWordTimings, buildAss } from "./subtitles.mjs";

// Carrega o .env.local do cwd por conta própria (igual o `next start` faz).
// Motivo: `--env-file` só existe no Node 20.6+ e o servidor roda Node 18.
// Vars já presentes no ambiente NÃO são sobrescritas.
try {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!(m[1] in process.env)) process.env[m[1]] = v;
  }
} catch {
  /* sem .env.local — usa o ambiente do processo */
}

// ── Config ──────────────────────────────────────────────────────────────────
const POLL_MS = 3000;
const OUT_W = 720;
const OUT_H = 1280;
const FPS = 30;
// Duração de cada cena/clipe (espelha SECONDS_PER_SCENE em lib/video/config.ts).
// Cada clipe é CORTADO nesse tamanho na normalização — se o modelo devolver
// mais longo, o excesso é descartado (senão as cenas atrasam vs. a narração).
const CLIP_SECONDS = 4;

// Supabase via REST puro (PostgREST) — SEM supabase-js: a lib nova crasha no
// Node 18 do servidor (exige WebSocket nativo pro Realtime, que não usamos).
// fetch existe no Node 18+; zero dependência, imune a upgrade de lib.
const SB_URL = () => process.env.NEXT_PUBLIC_SUPABASE_URL;
const SB_KEY = () => process.env.SUPABASE_SERVICE_ROLE_KEY;

async function sb(path, { method = "GET", body, headers = {} } = {}) {
  const res = await fetch(`${SB_URL()}/rest/v1${path}`, {
    method,
    headers: {
      apikey: SB_KEY(),
      Authorization: `Bearer ${SB_KEY()}`,
      "Content-Type": "application/json",
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`supabase ${res.status}: ${text.slice(0, 300)}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

/** RPC (POST /rpc/fn). Devolve o que a função retornar. */
const sbRpc = (fn) => sb(`/rpc/${fn}`, { method: "POST", body: {} });
/** SELECT — query string PostgREST (ex.: `?id=eq.X&select=a,b`). */
const sbSelect = (table, query) => sb(`/${table}${query}`);
/** UPDATE (PATCH) nas linhas que casarem com a query. */
const sbUpdate = (table, query, patch) =>
  sb(`/${table}${query}`, { method: "PATCH", body: patch });

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET_MEDIA = process.env.R2_BUCKET_IMAGES || process.env.R2_BUCKET_VOICES; // clipes + final
const BUCKET_AUDIO = process.env.R2_BUCKET_GENERATIONS; // áudio TTS

// Fontes das legendas viajam com o código (não instala nada no SO): o filtro
// `ass` recebe fontsdir=. Worker roda a partir de `frontend/` (local e pm2).
const FONTS_DIR = resolve(process.cwd(), "public/assets/subtitle-fonts");

/** Escapa um path pra dentro de um filtro ffmpeg: barra normal + `\:` e o
 *  valor entre aspas simples (escape de DOIS níveis do parser de filtros). */
function filterPath(p) {
  return `'${p.replace(/\\/g, "/").replace(/:/g, "\\:")}'`;
}

// ── Helpers ───────────────────────────────────────────────────────────────
function run(bin, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(bin, args, opts);
    let stderr = "";
    p.stderr.on("data", (d) => (stderr += d.toString()));
    p.on("error", reject);
    p.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`${bin} saiu ${code}: ${stderr.slice(-500)}`)),
    );
  });
}

/**
 * Duração REAL do áudio decodificando (o format=duration do ffprobe sub-reporta
 * MP3 VBR e corta os últimos segundos). Lê o último `time=` do ffmpeg.
 */
function audioDuration(file) {
  return new Promise((resolve) => {
    const p = spawn("ffmpeg", ["-hide_banner", "-i", file, "-map", "0:a:0", "-f", "null", "-"]);
    let err = "";
    p.stderr.on("data", (d) => (err += d.toString()));
    p.on("error", () => resolve(0));
    p.on("close", () => {
      const m = [...err.matchAll(/time=(\d+):(\d+):([\d.]+)/g)].pop();
      resolve(m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + parseFloat(m[3]) : 0);
    });
  });
}

async function download(bucket, key, dest) {
  const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  await pipeline(res.Body, createWriteStream(dest));
}

async function upload(bucket, key, file, contentType) {
  const { readFile } = await import("node:fs/promises");
  const Body = await readFile(file);
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body, ContentType: contentType }));
}

// ── Montagem de um projeto ────────────────────────────────────────────────
async function renderProject(projectId, userId) {
  const projects = await sbSelect(
    "video_projects",
    `?id=eq.${projectId}&select=id,audio_path,script_text,subtitle_style,subtitle_position,subtitle_size&limit=1`,
  );
  const project = projects?.[0];
  if (!project) throw new Error("projeto não encontrado");
  if (!project.audio_path) throw new Error("projeto sem áudio");

  const scenes = await sbSelect(
    "video_scenes",
    `?video_project_id=eq.${projectId}&select=idx,video_path,video_status&order=idx.asc`,
  );
  const clips = (scenes ?? []).filter((s) => s.video_status === "ready" && s.video_path);
  if (clips.length === 0) throw new Error("nenhum clipe pronto");

  const dir = await mkdtemp(join(tmpdir(), `render-${projectId.slice(0, 8)}-`));
  try {
    // 1) Baixa áudio + clipes.
    const audioFile = join(dir, "audio.mp3");
    await download(BUCKET_AUDIO, project.audio_path, audioFile);

    const normalized = [];
    for (let i = 0; i < clips.length; i++) {
      const raw = join(dir, `clip_${i}.mp4`);
      await download(BUCKET_MEDIA, clips[i].video_path, raw);
      // 2) Normaliza pra 9:16 720p, 30fps, yuv420p, SEM áudio (usamos o TTS)
      //    e CORTA em CLIP_SECONDS (cena = 4s; clipe mais longo desalinharia).
      const norm = join(dir, `norm_${i}.mp4`);
      await run("ffmpeg", [
        "-y", "-i", raw,
        "-vf",
        `scale=${OUT_W}:${OUT_H}:force_original_aspect_ratio=decrease,pad=${OUT_W}:${OUT_H}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${FPS}`,
        "-t", String(CLIP_SECONDS),
        "-an",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
        norm,
      ]);
      normalized.push(norm);
    }

    // 3) Concatena (demuxer, sem re-encode — todos já uniformes).
    const listFile = join(dir, "list.txt");
    await writeFile(listFile, normalized.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join("\n"));
    const concat = join(dir, "concat.mp4");
    await run("ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", listFile, "-c", "copy", concat]);

    // 4) Legenda: cronometra as palavras (Whisper/​proporcional) e gera um
    //    subs.ass NO diretório temp (nome simples → sem dor de escape no ffmpeg).
    const audioDur = await audioDuration(audioFile);
    let assName = null;
    try {
      const words = await getWordTimings(audioFile, project.script_text || "", audioDur);
      const ass = buildAss(words, project.subtitle_style, {
        position: project.subtitle_position,
        size: project.subtitle_size,
      });
      if (ass) {
        assName = "subs.ass";
        await writeFile(join(dir, assName), ass, "utf8");
        console.log(`[worker] legenda "${project.subtitle_style || "karaoke"}": ${words.length} palavras, áudio ${audioDur.toFixed(1)}s`);
      }
    } catch (e) {
      console.warn("[worker] legenda falhou, seguindo sem:", e.message);
    }

    // 5) Muxa o áudio e QUEIMA a legenda. O ÁUDIO MANDA: paddeia o vídeo com folga
    //    (congela o último frame) e usa -shortest → termina quando o ÁUDIO acaba,
    //    sem depender da duração reportada (que sub-reporta e cortava o fim).
    //    cwd=dir + nomes simples pra o filtro `ass=` não precisar escapar path.
    const filters = ["tpad=stop_mode=clone:stop_duration=30"];
    if (assName) filters.push(`ass=${assName}:fontsdir=${filterPath(FONTS_DIR)}`);

    const args = [
      "-y", "-i", "concat.mp4", "-i", "audio.mp3",
      "-filter_complex", `[0:v]${filters.join(",")}[v]`,
      "-map", "[v]", "-map", "1:a",
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", "-r", String(FPS),
      "-c:a", "aac", "-b:a", "128k",
      "-shortest",
      "-movflags", "+faststart",
      "final.mp4",
    ];
    await run("ffmpeg", args, { cwd: dir });
    const finalFile = join(dir, "final.mp4");

    // 6) Sobe pro R2 e marca done.
    const key = `${userId}/videos/${projectId}/final.mp4`;
    await upload(BUCKET_MEDIA, key, finalFile, "video/mp4");
    await sbUpdate("video_projects", `?id=eq.${projectId}`, {
      final_video_path: key,
      status: "done",
      error_message: null,
    });

    return key;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

// ── Loop da fila ──────────────────────────────────────────────────────────
async function tick() {
  let job;
  try {
    job = await sbRpc("claim_render_job");
  } catch (e) {
    console.error("[worker] claim erro:", e instanceof Error ? e.message : e);
    return;
  }
  if (Array.isArray(job)) job = job[0]; // RETURNS TABLE → PostgREST devolve array
  if (!job || !job.id) return; // fila vazia (o RPC pode devolver linha com campos nulos)

  console.log(`[worker] job ${job.id} → projeto ${job.video_project_id}`);
  try {
    const key = await renderProject(job.video_project_id, job.user_id);
    await sbUpdate("render_jobs", `?id=eq.${job.id}`, {
      status: "done",
      updated_at: new Date().toISOString(),
    });
    console.log(`[worker] ✅ job ${job.id} pronto → ${key}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[worker] ❌ job ${job.id} falhou:`, msg);
    await sbUpdate("render_jobs", `?id=eq.${job.id}`, {
      status: "failed",
      error: msg.slice(0, 800),
      updated_at: new Date().toISOString(),
    }).catch(() => {});
    await sbUpdate("video_projects", `?id=eq.${job.video_project_id}`, {
      status: "failed",
      error_message: msg.slice(0, 500),
    }).catch(() => {});
  }
}

async function main() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Faltam envs do Supabase (.env.local no cwd). Rode de frontend/: npm run render:worker");
    process.exit(1);
  }
  console.log("[worker] montagem de vídeo ON. Ctrl+C pra sair.");
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      await tick();
    } catch (e) {
      console.error("[worker] tick erro:", e);
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

main();
