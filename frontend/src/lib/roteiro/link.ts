/**
 * Gerador de Roteiro — entrada por LINK (Fase 6). Server-only.
 *
 * O aluno cola um link de Reels/Shorts/YouTube, a gente pega SÓ O ÁUDIO,
 * transcreve e usa como BASE DE IDEIA — nunca cópia. O roteiro sai novo, com
 * a estrutura da casa; o vídeo de referência serve pra dizer "é disso que eu
 * quero falar".
 *
 * ⚠️ O gargalo aqui nunca foi custo (um Reel de 60s custa R$0,03 de Whisper):
 * é BAIXAR. O YouTube costuma deixar; o Instagram normalmente exige sessão
 * logada, e sem cookie a maioria dos links dele falha. Por isso o erro é
 * traduzido pro aluno em vez de estourar cru na tela.
 *
 * SEGURANÇA — quatro camadas, porque aqui o servidor busca uma URL que um
 * desconhecido escolheu:
 *  1. `assertPublicUrl` recusa esquema estranho e host que resolva pra IP
 *     privado/loopback/metadados da nuvem (169.254.169.254). Sem isso, o campo
 *     vira porta de entrada pra ler credencial da máquina.
 *     (portado de openshorts/security_utils.py, MIT)
 *  2. `execFile` com lista de argumentos — nunca shell, nunca string montada.
 *  3. `childEnv()` — o filho recebe um ambiente MÍNIMO, não o `.env` do Next.
 *  4. tetos de duração, tamanho e tempo, e a pasta temporária some no fim.
 */
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { transcribeAudioBuffer } from "@/lib/video/transcribe";

const run = promisify(execFile);

/** Binário do yt-dlp (venv no servidor). Sem ele, o recurso avisa e não quebra. */
const YTDLP = () => process.env.YTDLP_BIN || "yt-dlp";
/** cookies.txt opcional — é o que faz link de Instagram funcionar. */
const COOKIES = () => process.env.YTDLP_COOKIES || "";

/**
 * Proxy opcional, aplicado SÓ nesta chamada do yt-dlp (`--proxy`), nunca no
 * sistema. Nada mais da máquina (n8n, ResumePro, Zayit, nginx) é afetado — e o
 * `childEnv()` abaixo garante que ele nem herda um HTTP_PROXY global por
 * acidente.
 *
 * Pra que serve: medido em 10/08, o YouTube responde "Sign in to confirm you're
 * not a bot" pro IP do Hetzner porque é datacenter. Um proxy **residencial ou
 * móvel** resolve; proxy de DATACENTER não resolve (é o mesmo problema com
 * outro endereço). Formato: `http://usuario:senha@host:porta`.
 *
 * O tráfego é minúsculo porque baixamos só o ÁUDIO: um Reel de 3 min dá ~3 MB.
 */
const PROXY = () => process.env.YTDLP_PROXY || "";

/**
 * Ambiente MÍNIMO do processo filho — a 4ª camada de segurança.
 *
 * `execFile` sem `env` faz o filho herdar o `process.env` INTEIRO do Next, e o
 * Next carrega o `.env.local` dentro dele: chave da DeepSeek, service role do
 * Supabase, R2, RunPod. O yt-dlp não lê nada disso (conferido no fonte: lê só
 * HOME/XDG_CONFIG_HOME/PATH/TERM e flags próprias) — mas não existe razão pra
 * entregar. Aqui vai só o que ele PRECISA: PATH pra achar o ffmpeg, HOME/TMPDIR
 * pra config e escrita. O resto do ambiente simplesmente não existe pra ele.
 */
function childEnv(): NodeJS.ProcessEnv {
  const e = process.env;
  const tmp = os.tmpdir();
  return {
    // Exigido pelo tipo do projeto; não é segredo (vale "production"/"development").
    NODE_ENV: e.NODE_ENV,
    PATH: e.PATH ?? "/usr/local/bin:/usr/bin:/bin",
    HOME: e.HOME ?? tmp,
    TMPDIR: e.TMPDIR ?? tmp,
    NO_COLOR: "1",
    // Windows não sobe processo nenhum sem estes (só o dev local usa).
    ...(e.SystemRoot ? { SystemRoot: e.SystemRoot } : {}),
    ...(e.ComSpec ? { ComSpec: e.ComSpec } : {}),
    ...(e.PATHEXT ? { PATHEXT: e.PATHEXT } : {}),
  };
}

/**
 * Teto de 3 minutos — e é ECONÔMICO, não técnico. O Whisper cobra por minuto
 * (US$0,006), e o roteiro custa 100 cr ≈ R$0,097 no total: um vídeo de 3min
 * empata, um de 15min daria R$0,39 de PREJUÍZO por roteiro. 3 minutos também
 * é exatamente o formato que o recurso serve (Reels e Shorts).
 * 👉 Pra subir esse teto: chave da Groq (Whisper 9x mais barato, US$0,00067/min,
 * o que levaria o empate pra ~27 minutos) ou preço maior quando tem link.
 */
export const LINK_MAX_SECONDS = 180;
const MAX_FILESIZE = "30M";
const TIMEOUT_MS = 180_000;

export class LinkError extends Error {
  constructor(
    message: string,
    /** Código pra UI traduzir; a mensagem já vem pronta em pt-BR. */
    readonly code: "unsafe_url" | "unsupported" | "login_required" | "too_long" | "no_tool" | "failed",
  ) {
    super(message);
  }
}

function isPrivateIp(ip: string): boolean {
  if (ip === "::1" || ip.startsWith("fe80:") || ip.startsWith("fc") || ip.startsWith("fd")) return true;
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => Number.isNaN(n))) return false;
  const [a, b] = p;
  return (
    a === 0 || a === 10 || a === 127 ||
    (a === 169 && b === 254) ||          // link-local + metadados da nuvem
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224                              // multicast/reservado
  );
}

/** Recusa a URL se não for http(s) público. Lança LinkError. */
export async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new LinkError("Esse link não parece válido. Cole o endereço completo do vídeo.", "unsafe_url");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new LinkError("Só aceito link que comece com http ou https.", "unsafe_url");
  }
  const host = url.hostname;
  if (isIP(host)) {
    if (isPrivateIp(host)) throw new LinkError("Esse endereço não é público.", "unsafe_url");
    return url;
  }
  let addrs: { address: string }[];
  try {
    addrs = await lookup(host, { all: true });
  } catch {
    throw new LinkError("Não consegui encontrar esse endereço.", "unsafe_url");
  }
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) {
    throw new LinkError("Esse endereço não é público.", "unsafe_url");
  }
  return url;
}

/** Traduz o erro cru do yt-dlp em algo que o aluno entende. */
function translateYtdlpError(stderr: string): LinkError {
  const s = stderr.toLowerCase();
  if (s.includes("enoent") || s.includes("not found")) {
    return new LinkError("A leitura de link ainda não está disponível aqui.", "no_tool");
  }
  // ⚠️ MEDIDO EM PRODUÇÃO (10/08): o YouTube responde "Sign in to confirm
  // you're not a bot" pro IP do Hetzner — é datacenter, e o Google barra. O
  // MESMO link funciona de um IP residencial. Não é bug nosso; some quando
  // houver `YTDLP_COOKIES` (cookies de uma sessão logada) ou proxy residencial.
  if (s.includes("not a bot") || s.includes("sign in to confirm")) {
    return new LinkError(
      "A leitura de link está indisponível no momento (o YouTube está pedindo verificação ao nosso servidor). Descreva a ideia com suas palavras — nada foi cobrado.",
      "login_required",
    );
  }
  if (s.includes("login") || s.includes("cookies") || s.includes("rate-limit") || s.includes("private")) {
    return new LinkError(
      "Esse vídeo pede login pra ser aberto (o Instagram costuma fazer isso). Descreva a ideia com suas palavras — nada foi cobrado.",
      "login_required",
    );
  }
  if (s.includes("unsupported url") || s.includes("no video")) {
    return new LinkError("Não reconheci esse link como vídeo.", "unsupported");
  }
  if (s.includes("does not pass filter") || s.includes("duration")) {
    return new LinkError(`Esse vídeo é longo demais. O limite é de ${LINK_MAX_SECONDS / 60} minutos.`, "too_long");
  }
  return new LinkError("Não consegui abrir esse vídeo. Tente outro link ou escreva a ideia.", "failed");
}

export type LinkSource = { transcript: string; title: string | null; durationSeconds: number };

/**
 * Baixa só o áudio do link e devolve a transcrição. Lança LinkError.
 */
export async function transcribeFromLink(rawUrl: string): Promise<LinkSource> {
  const url = await assertPublicUrl(rawUrl);
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "roteiro-"));

  try {
    const args = [
      "--no-playlist",
      "--no-warnings",
      "--no-progress",
      "--restrict-filenames",              // some com nome de arquivo criativo (CVE-2026-50023)
      // ⚠️ O `?` depois do operador aceita o item quando o campo NÃO EXISTE.
      // MEDIDO em produção (21/08): o Instagram devolve `duration = NA` em
      // post de Reel — `duration < 180` então DESCARTA o vídeo antes de
      // baixar, e o aluno via "pode ser maior que 3 minutos ou exigir login",
      // que eram as duas causas erradas. O vídeo abria normalmente: cookie
      // bom, post público, 44s de duração real.
      // Sem duração conhecida a porta fica aberta, e quem a fecha é o
      // `--max-filesize` aqui embaixo (download) + a checagem de
      // `durationSeconds` DEPOIS da transcrição, que usa a duração real do
      // áudio em vez da que o site diz ter.
      "--match-filter", `duration<?${LINK_MAX_SECONDS}`,
      "--max-filesize", MAX_FILESIZE,
      "-f", "bestaudio/best",
      "-x", "--audio-format", "mp3",
      "--print-to-file", "%(title)s", path.join(dir, "title.txt"),
      "-o", path.join(dir, "audio.%(ext)s"),
      url.toString(),
    ];
    const cookies = COOKIES();
    if (cookies) args.unshift("--cookies", cookies);
    const proxy = PROXY();
    if (proxy) args.unshift("--proxy", proxy);

    try {
      await run(YTDLP(), args, {
        timeout: TIMEOUT_MS,
        maxBuffer: 8 * 1024 * 1024,
        env: childEnv(),
      });
    } catch (e) {
      const err = e as { stderr?: string; message?: string; code?: string };
      if (err.code === "ENOENT") {
        throw new LinkError("A leitura de link ainda não está disponível aqui.", "no_tool");
      }
      throw translateYtdlpError(`${err.stderr ?? ""} ${err.message ?? ""}`);
    }

    const mp3 = path.join(dir, "audio.mp3");
    let bytes: Buffer;
    try {
      bytes = await fs.readFile(mp3);
    } catch {
      // Sem arquivo e sem erro do yt-dlp: o filtro barrou antes de baixar.
      // ⚠️ NÃO chute a causa aqui. A mensagem antiga dizia "pode ser maior que
      // 3 minutos ou exigir login" e, no caso que motivou este comentário
      // (21/08), as DUAS estavam erradas — o vídeo tinha 44s, era público e o
      // cookie estava bom. Culpar o aluno por um filtro nosso é o mesmo modo
      // de falha do "áudio insuficiente" no treino de voz.
      throw new LinkError(
        "Não consegui ler esse vídeo. Tente outro link, ou descreva a ideia com suas palavras — nada foi cobrado.",
        "failed",
      );
    }

    const title = await fs
      .readFile(path.join(dir, "title.txt"), "utf8")
      .then((t) => t.trim().slice(0, 200) || null)
      .catch(() => null);

    const { text, durationSeconds } = await transcribeAudioBuffer(bytes, "audio.mp3");

    // O teto de duração de verdade mora AQUI, não no --match-filter. Quando o
    // site não informa `duration` (o Instagram não informa), o filtro deixa
    // passar de propósito e a duração REAL só aparece depois de transcrever.
    // Sem esta checagem, o `?` lá em cima viraria um buraco por onde entra
    // vídeo de qualquer tamanho que caiba em 30 MB.
    if (durationSeconds && durationSeconds > LINK_MAX_SECONDS) {
      throw new LinkError(
        `Esse vídeo é longo demais. O limite é de ${LINK_MAX_SECONDS / 60} minutos.`,
        "too_long",
      );
    }
    if (text.length < 20) {
      throw new LinkError("Esse vídeo quase não tem fala pra eu aproveitar como ideia.", "failed");
    }
    return { transcript: text, title, durationSeconds };
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
