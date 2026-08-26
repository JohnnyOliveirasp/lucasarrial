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
 * provado 22/08: sem login, sem CSRF, HTTP 200 direto), Dropbox, OneDrive
 * (API v2.0 anônima com token badger — arquivo E pasta; ver resolverOneDrive)
 * e URL direta de arquivo.
 * QUEM FICA PRA DEPOIS: Google Photos, iCloud, YouTube, Samsung Cloud —
 * exigem sessão ou ferramenta de download; devolvem `{ suportado: false }`
 * com motivo legível, e a régua avisa o aluno do que fazer.
 *
 * Nunca lança por provedor desconhecido: devolve motivo. Lança só em erro
 * de rede/disco, que o chamador já trata.
 */
import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir, open, readdir, stat } from "node:fs/promises";
import { join, extname } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

// Extensão explícita: deixa `node --test` rodar o links.test.ts sem build.
import { ehPaginaWeb, ehZipDeArquivos } from "./audio-tipo.ts";

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

export function linkDiretoSharePoint(link: string): string {
  // SharePoint de EMPRESA (contoso-my.sharepoint.com): baixar com download=1.
  // Sem caso medido quebrando — comportamento de 22/08 mantido.
  const u = new URL(link);
  u.searchParams.set("download", "1");
  return u.toString();
}

/** O link de compartilhamento vira token "u!<base64url>" (doc oficial de shares). */
export function tokenShareOneDrive(link: string): string {
  const b64 = Buffer.from(link.trim()).toString("base64");
  return "u!" + b64.replace(/=+$/, "").replace(/\//g, "_").replace(/\+/g, "-");
}

export type ItemOneDrive = { url: string; filename: string; bytes: number };

// 26/08 (incidente 144): a API legada api.onedrive.com (Vroom) passou a dar
// 401 pra TODO share pessoal — inclusive dois que baixaram de verdade em
// 22/08 (as contas migraram pro SPO: o redirect do 1drv.ms diz
// migratedtospo=true). O caminho que funciona HOJE é o do próprio web app
// anônimo do OneDrive: token "badger" (endpoint público, sem login) + API
// v2.0 de my.microsoftpersonalcontent.com, que devolve @content.downloadUrl.
// Medido em 26/08 nos 5 links reais dos incidentes 144/140 (2 pastas + 3
// arquivos): 200 com content-type e tamanho do ARQUIVO, não HTML.
const ONEDRIVE_API = "https://my.microsoftpersonalcontent.com/_api/v2.0";
// AppId PÚBLICO que a página anônima do OneDrive usa — não é segredo nosso.
const BADGER_APP_ID = "5cbed6ac-a083-4e14-b191-b4ba07653de2";

async function tokenBadger(): Promise<string> {
  const r = await fetch("https://api-badgerp.svc.ms/v1.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": UA },
    body: JSON.stringify({ appId: BADGER_APP_ID }),
  });
  // "(HTTP 5xx)" cai na família NOSSO do classificarErro — aluno não é culpado.
  if (!r.ok) throw new Error(`OneDrive: falha ao obter acesso anônimo (HTTP ${r.status})`);
  const j = (await r.json()) as { token?: string };
  if (!j.token) throw new Error("OneDrive: resposta sem token de acesso anônimo (HTTP 200)");
  return j.token;
}

type NoOneDrive = {
  name?: string; size?: number; folder?: unknown; children?: NoOneDrive[];
  "@content.downloadUrl"?: string; "children@odata.nextLink"?: string;
};

async function apiOneDrive(badger: string, url: string): Promise<NoOneDrive> {
  const r = await fetch(url, {
    headers: { Authorization: `Badger ${badger}`, Prefer: "autoredeem", "User-Agent": UA },
  });
  if (r.status === 404 || r.status === 410) {
    throw new Error("o link do OneDrive não existe mais (o arquivo foi movido ou apagado) — gere um link novo");
  }
  if (r.status === 401 || r.status === 403) {
    // Sem "HTTP 40x" no texto: a família tem que ser ALUNO (ele é avisado pra
    // trocar de serviço) e a mensagem do route.ts admite que pode ser nosso.
    throw new Error(`não conseguimos baixar do OneDrive (respondeu ${r.status} pra gente, mesmo com o link aberto)`);
  }
  if (!r.ok) throw new Error(`OneDrive: erro inesperado (HTTP ${r.status})`);
  return (await r.json()) as NoOneDrive;
}

/**
 * Resolve o share (arquivo OU pasta) em links diretos de download. Pasta:
 * lista os filhos (com paginação); subpasta é ignorada com aviso no log —
 * recursão exigiria chamada que não temos caso real pra medir.
 */
export async function resolverOneDrive(link: string): Promise<ItemOneDrive[]> {
  const badger = await tokenBadger();
  const base = `${ONEDRIVE_API}/shares/${tokenShareOneDrive(link)}/driveItem`;
  const raiz = await apiOneDrive(badger, base);

  if (!raiz.folder) {
    if (!raiz["@content.downloadUrl"]) throw new Error("OneDrive: item veio sem link de download (HTTP 200)");
    return [{ url: raiz["@content.downloadUrl"], filename: raiz.name || "arquivo", bytes: raiz.size || 0 }];
  }

  const itens: ItemOneDrive[] = [];
  let pagina: NoOneDrive | null = await apiOneDrive(badger, `${base}?$expand=children`);
  while (pagina) {
    for (const c of pagina.children || []) {
      if (c.folder) {
        console.warn(`[onboarding/links] OneDrive: subpasta "${c.name}" ignorada (só baixamos arquivos da pasta raiz)`);
        continue;
      }
      if (c["@content.downloadUrl"]) {
        itens.push({ url: c["@content.downloadUrl"], filename: c.name || "arquivo", bytes: c.size || 0 });
      }
    }
    const prox: string | undefined = pagina["children@odata.nextLink"];
    pagina = prox ? await apiOneDrive(badger, prox) : null;
  }
  if (itens.length === 0) {
    throw new Error("a pasta do OneDrive não tem arquivos soltos (vazia ou só subpastas) — coloque os arquivos direto nela");
  }
  return itens;
}

// ── Download pro disco + unzip ────────────────────────────────────────────

async function baixarPara(url: string, destino: string, maxBytes: number): Promise<number> {
  const r = await fetch(url, { redirect: "follow", headers: { "User-Agent": UA } });
  if (!r.ok || !r.body) throw new Error(`download respondeu ${r.status}`);
  // 22/08 (OneDrive): página de login chega com HTTP 200 e content-type
  // text/html. Isso NUNCA é o arquivo do aluno — falhar aqui, com a verdade,
  // em vez de gravar HTML no disco com nome de áudio. (O drive.ts já fazia
  // essa checagem no caminho do Drive; este é o gêmeo dela pro caminho de link.)
  const ct = (r.headers.get("content-type") || "").toLowerCase();
  if (ct.startsWith("text/html")) {
    throw new Error(
      "não conseguimos baixar seu arquivo a partir desse link — " +
        "veio uma página da internet (provavelmente pedindo login) no lugar do arquivo",
    );
  }
  const len = Number(r.headers.get("content-length") || 0);
  if (len > maxBytes) throw new Error(`arquivo de ${Math.round(len / 1e6)} MB passa do teto de ${Math.round(maxBytes / 1e6)} MB`);
  await pipeline(Readable.fromWeb(r.body as never), createWriteStream(destino));
  return (await stat(destino)).size;
}

/** Primeiros bytes de um arquivo no disco (pro sniff de conteúdo, sem ler tudo). */
async function lerInicio(path: string, tamanho = 2048): Promise<Buffer> {
  const fd = await open(path, "r");
  try {
    const buf = Buffer.alloc(tamanho);
    const { bytesRead } = await fd.read(buf, 0, tamanho, 0);
    return buf.subarray(0, bytesRead);
  } finally {
    await fd.close();
  }
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
  let itensOneDrive: ItemOneDrive[] | null = null;
  try {
    if (kind === "wetransfer") ({ url, filename } = await linkDiretoWeTransfer(url));
    else if (kind === "dropbox") url = linkDiretoDropbox(url);
    else if (kind === "onedrive") {
      if (/sharepoint\.com/i.test(url)) url = linkDiretoSharePoint(url);
      // Pessoal (1drv.ms / onedrive.live.com): resolve arquivo OU pasta.
      else itensOneDrive = await resolverOneDrive(url);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const doAluno = /expirou|apagado|não reconheço|conseguimos baixar|não existe mais|pasta do OneDrive/i.test(msg);
    return { ok: false, kind, motivo: msg, dependeDoAluno: doAluno };
  }

  try {
    // Pasta do OneDrive: N arquivos, cada um pelo MESMO funil (sniff de HTML,
    // teto de bytes, zip) do caminho de arquivo único.
    if (itensOneDrive) {
      const arquivos: ArquivoBaixado[] = [];
      for (const it of itensOneDrive) arquivos.push(...(await receberArquivo(it.url, it.filename, workDir, maxBytes)));
      return { ok: true, kind, arquivos };
    }
    const nomeBase = filename || decodeURIComponent((url.split("?")[0].split("/").pop() || "arquivo").trim()) || "arquivo";
    return { ok: true, kind, arquivos: await receberArquivo(url, nomeBase, workDir, maxBytes) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const doAluno = /teto|passa do|página da internet|conseguimos baixar|zip/i.test(msg);
    return { ok: false, kind, motivo: msg, dependeDoAluno: doAluno };
  }
}

/**
 * Baixa UMA url pro disco, recusa HTML disfarçado e extrai zip. Lança Error
 * com motivo legível — quem chama traduz em ResultadoLink. É o antigo miolo
 * do abrirLink, extraído pra servir também à pasta do OneDrive (N arquivos).
 */
async function receberArquivo(url: string, nome: string, workDir: string, maxBytes: number): Promise<ArquivoBaixado[]> {
  const nomeBase = nome.replace(/[/\\]/g, "_") || "arquivo";
  const destino = join(workDir, nomeBase);
  await baixarPara(url, destino, maxBytes);

  // 22/08: página de login também chega MENTINDO no content-type (200 +
  // octet-stream). Os primeiros bytes não mentem: se o que baixou é HTML,
  // o download FALHOU — dizer isso, e não deixar o arquivo seguir pra virar
  // ".mp3" no R2 ou "zip corrompido" na mensagem (as duas culpavam o aluno).
  const inicioBaixado = await lerInicio(destino);
  if (ehPaginaWeb(inicioBaixado)) {
    throw new Error(
      "não conseguimos baixar seu arquivo a partir desse link — " +
        "veio uma página da internet (provavelmente pedindo login) no lugar do arquivo",
    );
  }

  // 22/08: quem decide se é pacote é o CONTEÚDO, não a extensão. O link do
  // fb_teixeira baixou como token sem extensão, o `extname` deu "" e o unzip
  // não rodou — 18MB de ZIP viraram ".mp3" no R2 e ele foi acusado de gravar
  // mal. O `Audio IA.ogg` estava lá dentro o tempo todo.
  if (extname(destino).toLowerCase() === ".zip" || ehZipDeArquivos(inicioBaixado)) {
    // Sufixo por arquivo: dois zips na mesma pasta não se atropelam.
    const pasta = join(workDir, `unzip_${nomeBase.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40)}`);
    await mkdir(pasta, { recursive: true });
    try {
      await run("unzip", ["-o", "-q", destino, "-d", pasta]);
    } catch (e) {
      throw new Error(`zip corrompido ou incompleto (${e instanceof Error ? e.message : e})`);
    }
    const arquivos = await listarArquivos(pasta);
    if (arquivos.length === 0) throw new Error("o zip veio vazio");
    return arquivos;
  }

  return [{ path: destino, filename: nomeBase, bytes: (await stat(destino)).size }];
}
