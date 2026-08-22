/**
 * Onboarding — ABRE QUALQUER LINK que o aluno colou na planilha.
 *
 * Pedido do Johnny (22/08): "precisa tentar abrir qualquer link, independente
 * de onde seja". Medido na fila de 87 linhas: ~25% NÃO são Google Drive
 * (WeTransfer 8, Dropbox 3, OneDrive 3, Google Photos 3, iCloud 2…). Todas
 * quebravam no Apps Script com "não reconheci o link do Drive" — culpando o
 * aluno por um limite nosso. A linha 4 era um WeTransfer válido, com
 * FOTOS JOÃO.zip de 14 MB, expirando em 14 h.
 *
 * O QUE ESTE MÓDULO FAZ: recebe o link CRU, descobre de onde é, baixa os
 * arquivos pro disco e devolve a lista de caminhos — o mesmo contrato que o
 * Drive já entrega, então `importImages`/`importTrainingAudios` não mudam.
 * Zip é aberto aqui (unzip do Linux, mesmo jeito que o ffmpeg é chamado).
 *
 * QUEM ENTRA NESTE TURNO: WeTransfer (API pública que o próprio site usa —
 * provado 22/08: sem login, sem CSRF, HTTP 200 direto), Dropbox e OneDrive
 * (link direto trocando um parâmetro), e URL direta de arquivo.
 * QUEM FICA PRA DEPOIS: Google Photos, iCloud, YouTube, Samsung Cloud —
 * exigem sessão ou ferramenta de download; devolvem `{ suportado: false }`
 * com motivo legível, e a régua avisa o aluno do que fazer.
 *
 * Nunca lança por provedor desconhecido: devolve motivo. Lança só em erro
 * de rede/disco, que o chamador já trata.
 */
import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir, readdir, stat } from "node:fs/promises";
import { join, extname } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

export type LinkKind = "drive" | "wetransfer" | "dropbox" | "onedrive" | "direto" | "nao_suportado";

export type ArquivoBaixado = {
  path: string;
  filename: string;
  bytes: number;
};

export type ResultadoLink =
  | { ok: true; kind: LinkKind; arquivos: ArquivoBaixado[] }
  | { ok: false; kind: LinkKind; motivo: string; dependeDoAluno: boolean };

const UA = "Mozilla/5.0 (compatible; FastClonerOnboarding/1.0)";

/** De onde é o link. Drive fica com o caminho antigo (Apps Script resolve os fileIds). */
export function classificarLink(link: string): LinkKind {
  const u = link.trim().toLowerCase();
  if (!u) return "nao_suportado";
  if (/drive\.google\.com|docs\.google\.com/.test(u)) return "drive";
  if (/wetransfer\.com|(^|\/\/)we\.tl\//.test(u)) return "wetransfer";
  if (/dropbox\.com/.test(u)) return "dropbox";
  if (/1drv\.ms|onedrive\.live\.com|sharepoint\.com/.test(u)) return "onedrive";
  if (/photos\.app\.goo\.gl|photos\.google\.com|icloud\.com|youtu\.be|youtube\.com|samsungcloud|elevenlabs\.io/.test(u)) {
    return "nao_suportado";
  }
  if (/^https?:\/\/\S+\.(zip|jpe?g|png|webp|heic|mp3|wav|m4a|aac|ogg|flac|mp4|mov)(\?|$)/i.test(u)) return "direto";
  return "nao_suportado";
}

// ── WeTransfer ────────────────────────────────────────────────────────────

/** Resolve we.tl (encurtador) e devolve a URL longa. */
async function expandirWeTl(link: string): Promise<string> {
  if (!/we\.tl\//i.test(link)) return link;
  const r = await fetch(link, { redirect: "manual", headers: { "User-Agent": UA } });
  const loc = r.headers.get("location");
  if (!loc) throw new Error("we.tl não redirecionou");
  return loc;
}

/**
 * Pede ao WeTransfer o link direto do pacote inteiro. É a mesma chamada que o
 * botão "Download" do site faz. Precisa do cookie da página (sessão anônima).
 */
async function linkDiretoWeTransfer(link: string): Promise<{ url: string; filename: string | null }> {
  const longo = await expandirWeTl(link);
  const m = longo.match(/wetransfer\.com\/downloads\/([0-9a-f]+)\/(?:([0-9a-f]+)\/)?([0-9a-f]+)/i);
  if (!m) throw new Error("link do WeTransfer em formato que não reconheço");
  const [, transferId, recipientId, securityHash] = m;

  // 22/08: a PRÓPRIA URL diz quando vence (t_exp, unix). Medido em 6 linhas da
  // planilha: o transfer já tinha vencido e a API devolvia 403 "No download
  // access to this Transfer" — que a gente traduzia como erro genérico de
  // link, mandando o aluno "conferir se está aberto". Não estava aberto:
  // estava VENCIDO, e a única saída é ele mandar um link novo.
  const exp = Number((longo.match(/[?&]t_exp=(\d+)/) || [])[1]);
  if (exp && Date.now() / 1000 > exp) {
    throw new Error(
      `o link do WeTransfer expirou em ${new Date(exp * 1000).toLocaleDateString("pt-BR")} — ` +
        `os links gratuitos duram poucos dias`,
    );
  }

  const page = await fetch(longo, { headers: { "User-Agent": UA } });
  if (page.status === 404 || page.status === 410) {
    throw new Error("o link do WeTransfer expirou ou foi apagado");
  }
  const cookie = (page.headers.get("set-cookie") || "")
    .split(/,(?=[^ ])/)
    .map((s) => s.split(";")[0].trim())
    .filter(Boolean)
    .join("; ");

  const body: Record<string, string> = { intent: "entire_transfer", security_hash: securityHash };
  if (recipientId) body.recipient_id = recipientId;
  const r = await fetch(`https://wetransfer.com/api/v4/transfers/${transferId}/download`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": UA,
      "x-requested-with": "XMLHttpRequest",
      Cookie: cookie,
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    if (r.status === 403 || r.status === 404 || r.status === 410) {
      // 403 "No download access to this Transfer" = vencido, na prática.
      throw new Error("o link do WeTransfer expirou — peça ao aluno um link novo");
    }
    throw new Error(`WeTransfer respondeu ${r.status}`);
  }
  const j = (await r.json()) as { direct_link?: string };
  if (!j.direct_link) throw new Error("WeTransfer não devolveu o link do arquivo");
  const nome = decodeURIComponent((j.direct_link.split("?")[0].split("/").pop() || "").trim()) || null;
  return { url: j.direct_link, filename: nome };
}

// ── Dropbox / OneDrive / direto ───────────────────────────────────────────

function linkDiretoDropbox(link: string): string {
  // dl=0 (página) → dl=1 (arquivo). Pasta compartilhada vem como zip.
  const u = new URL(link);
  u.searchParams.set("dl", "1");
  return u.toString();
}

function linkDiretoOneDrive(link: string): string {
  // 1drv.ms redireciona pra onedrive.live.com/...; trocar /redir por /download
  // é o contorno documentado. Se já for onedrive.live.com, idem.
  return link.replace(/\/redir\?/i, "/download?").replace(/\/view\.aspx\?/i, "/download.aspx?");
}

// ── Download pro disco + unzip ────────────────────────────────────────────

async function baixarPara(url: string, destino: string, maxBytes: number): Promise<number> {
  const r = await fetch(url, { redirect: "follow", headers: { "User-Agent": UA } });
  if (!r.ok || !r.body) throw new Error(`download respondeu ${r.status}`);
  const len = Number(r.headers.get("content-length") || 0);
  if (len > maxBytes) throw new Error(`arquivo de ${Math.round(len / 1e6)} MB passa do teto de ${Math.round(maxBytes / 1e6)} MB`);
  await pipeline(Readable.fromWeb(r.body as never), createWriteStream(destino));
  return (await stat(destino)).size;
}

function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args);
    let err = "";
    p.stderr.on("data", (d) => (err += d));
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exit ${code}: ${err.slice(0, 200)}`))));
    p.on("error", reject);
  });
}

/** Lista recursiva de arquivos (ignora pastas e lixo de sistema). */
async function listarArquivos(dir: string): Promise<ArquivoBaixado[]> {
  const out: ArquivoBaixado[] = [];
  for (const nome of await readdir(dir)) {
    if (nome.startsWith(".") || nome === "__MACOSX" || nome === "Thumbs.db") continue;
    const p = join(dir, nome);
    const s = await stat(p);
    if (s.isDirectory()) out.push(...(await listarArquivos(p)));
    else out.push({ path: p, filename: nome, bytes: s.size });
  }
  return out;
}

/**
 * Abre o link e deixa os arquivos em `workDir`. Zip é extraído. Devolve a
 * lista de arquivos soltos — quem chama decide o que é imagem, vídeo ou áudio.
 */
export async function abrirLink(
  link: string,
  workDir: string,
  maxBytes: number,
): Promise<ResultadoLink> {
  const kind = classificarLink(link);
  await mkdir(workDir, { recursive: true });

  if (kind === "drive") {
    return { ok: false, kind, motivo: "link do Drive vai pelo caminho dos fileIds (Apps Script)", dependeDoAluno: false };
  }
  if (kind === "nao_suportado") {
    return {
      ok: false,
      kind,
      motivo: "ainda não abrimos esse tipo de link automaticamente",
      dependeDoAluno: true,
    };
  }

  let url = link.trim();
  let filename: string | null = null;
  try {
    if (kind === "wetransfer") ({ url, filename } = await linkDiretoWeTransfer(url));
    else if (kind === "dropbox") url = linkDiretoDropbox(url);
    else if (kind === "onedrive") url = linkDiretoOneDrive(url);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, kind, motivo: msg, dependeDoAluno: /expirou|apagado|não reconheço/i.test(msg) };
  }

  const nomeBase = filename || decodeURIComponent((url.split("?")[0].split("/").pop() || "arquivo").trim()) || "arquivo";
  const destino = join(workDir, nomeBase);
  try {
    await baixarPara(url, destino, maxBytes);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, kind, motivo: msg, dependeDoAluno: /teto|passa do/i.test(msg) };
  }

  if (extname(destino).toLowerCase() === ".zip") {
    const pasta = join(workDir, "unzip");
    await mkdir(pasta, { recursive: true });
    try {
      await run("unzip", ["-o", "-q", destino, "-d", pasta]);
    } catch (e) {
      return { ok: false, kind, motivo: `zip corrompido ou incompleto (${e instanceof Error ? e.message : e})`, dependeDoAluno: true };
    }
    const arquivos = await listarArquivos(pasta);
    if (arquivos.length === 0) return { ok: false, kind, motivo: "o zip veio vazio", dependeDoAluno: true };
    return { ok: true, kind, arquivos };
  }

  return { ok: true, kind, arquivos: [{ path: destino, filename: nomeBase, bytes: (await stat(destino)).size }] };
}
