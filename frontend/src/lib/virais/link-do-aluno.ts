/**
 * Vídeos Virais 1.0 — o aluno cola um LINK e a casa lê os dados dele.
 *
 * Por que `yt-dlp` e não o Apify (decisão 21/09): o Apify cobra por vídeo
 * (US$ 0,0037) e só serve TikTok. O yt-dlp já está no servidor, já é o que
 * BAIXA o mp4 hoje, custa zero por envio e entende Instagram e TikTok com a
 * mesma chamada. Um envio = um `--dump-json`, sem gastar centavo.
 *
 * ⚠️ IP de datacenter é barrado. MEDIDO em 21/09 no nosso Hetzner: TikTok
 * devolve "Unexpected response" e o YouTube diz "Sign in to confirm you're not
 * a bot" — o mesmo achado de 10/08 que motivou o proxy residencial. Por isso
 * toda chamada daqui sai por `YTDLP_PROXY` (DataImpulse, pay-as-you-go),
 * aplicado SÓ nesta execução (`--proxy`), nunca no sistema.
 *
 * ⚠️ Instagram normalmente exige sessão: usamos `YTDLP_COOKIES` (o mesmo
 * arquivo do Gerador de Roteiros) e, se não houver, montamos um cookies.txt a
 * partir de `INSTAGRAM_WEB_COOKIES`, que a busca por hashtag já usa.
 */
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const YTDLP = () => process.env.YTDLP_BIN || "yt-dlp";
/** Proxy residencial (assinado 10/08): sem ele, TikTok e YouTube barram o IP. */
const PROXY = () => process.env.YTDLP_PROXY || "";
/** cookies.txt já existente no servidor — vale pra Instagram e TikTok. */
const COOKIES_ARQUIVO = () => process.env.YTDLP_COOKIES || "";
const TIMEOUT_MS = 90_000;

export type PlataformaViral = "instagram" | "tiktok";

export type LinkViral = {
  plataforma: PlataformaViral;
  /** Id do post na plataforma — é ele que impede o mesmo viral entrar duas vezes. */
  videoId: string;
  /** URL canônica (sem parâmetros de rastreio, que mudam a cada compartilhamento). */
  url: string;
};

/**
 * Lê a URL colada. Aceita as formas que o aluno realmente cola: share do app,
 * link com `?igsh=`/`?utm_source=`, `vm.tiktok.com` encurtado, com ou sem
 * barra no fim.
 */
export function lerLink(bruto: string): LinkViral | null {
  const texto = (bruto ?? "").trim();
  if (!texto) return null;

  let u: URL;
  try {
    u = new URL(texto.startsWith("http") ? texto : `https://${texto}`);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./, "").toLowerCase();

  if (host.endsWith("instagram.com")) {
    // /reel/ABC, /p/ABC, /tv/ABC — e /usuario/reel/ABC, que o app também gera.
    const m = u.pathname.match(/\/(?:reel|reels|p|tv)\/([A-Za-z0-9_-]+)/);
    if (!m) return null;
    return { plataforma: "instagram", videoId: m[1], url: `https://www.instagram.com/reel/${m[1]}/` };
  }

  if (host.endsWith("tiktok.com")) {
    const m = u.pathname.match(/\/video\/(\d+)/);
    if (m) {
      return { plataforma: "tiktok", videoId: m[1], url: `https://www.tiktok.com${u.pathname}` };
    }
    // Encurtado (vm./vt.): o id só aparece depois do redirecionamento, então
    // guardamos a própria URL como identidade até o yt-dlp resolver.
    if (/^(vm|vt|m)\./.test(u.hostname) || u.pathname.startsWith("/t/")) {
      return { plataforma: "tiktok", videoId: "", url: u.toString() };
    }
    return null;
  }

  return null;
}

export class LinkViralError extends Error {
  constructor(
    message: string,
    readonly code: "sem_ferramenta" | "privado" | "fora_do_ar" | "sem_login" | "falhou",
  ) {
    super(message);
  }
}

export type DadosDoLink = {
  videoId: string;
  url: string;
  autor: string | null;
  legenda: string | null;
  likes: number | null;
  views: number | null;
  comentarios: number | null;
  duracaoSeg: number | null;
  thumbUrl: string | null;
  hashtags: string[];
  publicadoEm: string | null;
};

/** Ambiente mínimo do processo filho — o yt-dlp não precisa ver nossas chaves. */
function childEnv(): NodeJS.ProcessEnv {
  const e = process.env;
  const tmp = os.tmpdir();
  return {
    NODE_ENV: e.NODE_ENV,
    PATH: e.PATH ?? "/usr/local/bin:/usr/bin:/bin",
    HOME: e.HOME ?? tmp,
    TMPDIR: e.TMPDIR ?? tmp,
    NO_COLOR: "1",
    ...(e.SystemRoot ? { SystemRoot: e.SystemRoot } : {}),
    ...(e.ComSpec ? { ComSpec: e.ComSpec } : {}),
    ...(e.PATHEXT ? { PATHEXT: e.PATHEXT } : {}),
  };
}

/** Escreve o cookie do Instagram no formato que o yt-dlp lê. Devolve o caminho. */
async function arquivoDeCookies(dir: string): Promise<string | null> {
  const cru = process.env.INSTAGRAM_WEB_COOKIES?.trim();
  if (!cru) return null;
  const pares = cru
    .split(";")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const i = p.indexOf("=");
      return i > 0 ? [p.slice(0, i).trim(), p.slice(i + 1).trim()] : null;
    })
    .filter((x): x is string[] => !!x);
  if (pares.length === 0) return null;

  const linhas = pares.map(
    ([nome, valor]) => `.instagram.com\tTRUE\t/\tTRUE\t0\t${nome}\t${valor}`,
  );
  const alvo = path.join(dir, "cookies.txt");
  await fs.writeFile(alvo, `# Netscape HTTP Cookie File\n${linhas.join("\n")}\n`, "utf8");
  return alvo;
}

function traduzir(cru: string): LinkViralError {
  const s = cru.toLowerCase();
  if (s.includes("enoent") || s.includes("is not recognized")) {
    return new LinkViralError("Ferramenta de leitura indisponível no servidor.", "sem_ferramenta");
  }
  if (s.includes("not a bot") || s.includes("unexpected response")) {
    return new LinkViralError(
      "A rede bloqueou a leitura a partir do nosso servidor. Já avisamos o suporte — tente de novo em alguns minutos.",
      "sem_login",
    );
  }
  if (s.includes("login required") || s.includes("rate-limit") || s.includes("empty media response")) {
    return new LinkViralError(
      "O Instagram pediu login pra abrir esse post. Tente outro link ou avise o suporte.",
      "sem_login",
    );
  }
  if (s.includes("private") || s.includes("not available") || s.includes("removed") || s.includes("404")) {
    return new LinkViralError("Esse post está privado ou saiu do ar.", "fora_do_ar");
  }
  return new LinkViralError("Não consegui ler esse link agora. Confira e tente de novo.", "falhou");
}

const hashtagsDe = (texto: string | null) =>
  texto ? Array.from(new Set(texto.match(/#[\p{L}\p{N}_]+/gu) ?? [])).slice(0, 30) : [];

const numero = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? Math.round(v) : null;

/** Data do post: o yt-dlp devolve `timestamp` (epoch) ou `upload_date` (AAAAMMDD). */
function dataDoPost(j: Record<string, unknown>): string | null {
  const ts = numero(j.timestamp);
  if (ts) return new Date(ts * 1000).toISOString();
  const d = typeof j.upload_date === "string" ? j.upload_date : null;
  if (d && /^\d{8}$/.test(d)) return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T12:00:00Z`;
  return null;
}

/** Lê os dados do post SEM baixar o vídeo (`--dump-json`). */
export async function lerDadosDoLink(link: LinkViral): Promise<DadosDoLink> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "viral-link-"));
  try {
    const args = ["--no-warnings", "--no-playlist", "--dump-json", "--skip-download"];
    const proxy = PROXY();
    if (proxy) args.unshift("--proxy", proxy);
    const cookies = COOKIES_ARQUIVO() || (await arquivoDeCookies(dir));
    if (cookies) args.unshift("--cookies", cookies);
    args.push(link.url);

    let stdout: string;
    try {
      const r = await run(YTDLP(), args, {
        timeout: TIMEOUT_MS,
        env: childEnv(),
        maxBuffer: 16 * 1024 * 1024,
      });
      stdout = r.stdout;
    } catch (e) {
      const cru = e instanceof Error ? `${e.message}` : String(e);
      throw traduzir(cru);
    }

    // `--dump-json` imprime um JSON por linha; pegamos o primeiro.
    const linha = stdout.split("\n").find((l) => l.trim().startsWith("{"));
    if (!linha) throw new LinkViralError("O link não devolveu dados de vídeo.", "falhou");
    const j = JSON.parse(linha) as Record<string, unknown>;

    const legenda =
      (typeof j.description === "string" && j.description) ||
      (typeof j.title === "string" && j.title) ||
      null;

    return {
      videoId: String(j.id ?? link.videoId ?? "").trim() || link.videoId,
      url: typeof j.webpage_url === "string" ? j.webpage_url : link.url,
      autor:
        (typeof j.uploader_id === "string" && j.uploader_id) ||
        (typeof j.uploader === "string" && j.uploader) ||
        (typeof j.channel === "string" && j.channel) ||
        null,
      legenda,
      likes: numero(j.like_count),
      views: numero(j.view_count),
      comentarios: numero(j.comment_count),
      duracaoSeg: numero(j.duration),
      thumbUrl: typeof j.thumbnail === "string" ? j.thumbnail : null,
      hashtags: hashtagsDe(legenda),
      publicadoEm: dataDoPost(j),
    };
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
