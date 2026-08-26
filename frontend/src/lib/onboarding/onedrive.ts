/**
 * OneDrive anônimo depois da migração pro SharePoint Online (incidente 144).
 *
 * 26/08: a API legada "Vroom" (api.onedrive.com/v1.0/shares/u!<token>) passou
 * a devolver 401 pra TODO link 1drv.ms — inclusive os que funcionavam em
 * 22/08. Medido em /root, /root/children e /root/content. O motivo: o direito
 * anônimo do share deixou de ser resolvível por token na URL e passou a ser
 * materializado como COOKIE FedAuth, emitido pela CADEIA DE REDIRECT do
 * 1drv.ms. Ir direto na API é chegar sem grant nenhum.
 *
 * O caminho que funciona (todo medido em _Bugs/onedrive_144/, 26/08):
 *   1. GET no 1drv.ms seguindo os redirects COM cookie jar. A cadeia termina
 *      em onedrive.live.com/...&migratedtospo=true e emite o FedAuth.
 *   2. Da URL final saem `cid` e `resid` (às vezes o resid vem como `id=`).
 *   3. PASTA:   GET onedrive.live.com/_api/v2.0/drives/<cid>/items/<resid>/children
 *      ARQUIVO: GET .../items/<resid>
 *      — com o cookie, os dois respondem JSON com `@content.downloadUrl`.
 *      O MESMO caminho serve pra pasta e pra arquivo (hipótese pasta-vs-
 *      arquivo foi refutada com medição).
 *   4. Baixar pelo @content.downloadUrl com o MESMO cookie jar.
 *
 * Provas: pasta /f/ → JPEG de 175.603 bytes = size anunciado (magic ffd8ffe0);
 * arquivo /u/ → m4a de 46.127.898 bytes = size anunciado (ISO Media MP4 v2).
 *
 * ⚠️ 200 NÃO É SUCESSO: a página do OneDrive responde 200 text/html com
 * centenas de KB. Sempre validar content-type e o tamanho baixado contra o
 * `size` anunciado no JSON — uma medição de 26/08 10h18 se enganou assim.
 *
 * CRITÉRIO DE CULPA (a parte que importa pro aluno): se a cadeia NÃO emitir
 * FedAuth, o share realmente não concede acesso anônimo e é legítimo pedir um
 * link novo (erro do lado do aluno). Se emitir e mesmo assim falhar, o
 * problema é NOSSO — a mensagem carrega "não conseguimos baixar", que o
 * route.ts traduz na orientação honesta ("pode ser do nosso lado"), em vez de
 * acusar o link do aluno (caso Luzielia: 4 voltas na madrugada por isso).
 */
import { createWriteStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const UA = "Mozilla/5.0 (compatible; FastClonerOnboarding/1.0)";
const NOSSO_PREFIXO = "não conseguimos baixar seu arquivo a partir desse link — ";

export type ItemOneDrive = { nome: string; size: number; downloadUrl: string };

export type OneDriveResolvido =
  | { ok: true; itens: ItemOneDrive[]; cookie: string }
  | { ok: false; motivo: string; dependeDoAluno: boolean };

type JarCookies = Map<string, string>;

function cookieHeader(jar: JarCookies): string {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

/** `cid`/`resid` da URL final da cadeia (o resid às vezes vem como `id=`). */
export function extrairIdsDaUrl(url: string): { cid: string | null; resid: string | null } {
  try {
    const u = new URL(url);
    const cid = u.searchParams.get("cid");
    const resid = u.searchParams.get("resid") || u.searchParams.get("id");
    return { cid, resid };
  } catch {
    return { cid: null, resid: null };
  }
}

/** Fallback: os mesmos ids garimpados do HTML da página final. */
export function extrairIdsDaPagina(html: string): { cid: string | null; resid: string | null } {
  const resid =
    html.match(/[?&]resid=([0-9A-Fa-f]+(?:%21|!)[A-Za-z0-9]+)/)?.[1] ??
    html.match(/"id"\s*:\s*"([0-9A-Fa-f]+![A-Za-z0-9]+)"/)?.[1] ??
    null;
  const residLimpo = resid ? decodeURIComponent(resid) : null;
  const cid = html.match(/"cid"\s*:\s*"([0-9A-Fa-f]+)"/)?.[1] ?? (residLimpo ? residLimpo.split("!")[0] : null);
  return { cid, resid: residLimpo };
}

/** O `!` do resid vai como %21 no path da API (formato medido nos probes). */
export function residNoPath(resid: string): string {
  return decodeURIComponent(resid).replace(/!/g, "%21");
}

/** Segue a cadeia de redirect do 1drv.ms juntando os cookies (o FedAuth nasce aqui). */
async function seguirCadeia(link: string): Promise<{ finalUrl: string; html: string; jar: JarCookies }> {
  const jar: JarCookies = new Map();
  let url = link.trim();
  let r: Response | null = null;
  for (let salto = 0; salto < 12; salto++) {
    r = await fetch(url, {
      redirect: "manual",
      headers: { "User-Agent": UA, ...(jar.size > 0 ? { Cookie: cookieHeader(jar) } : {}) },
    });
    for (const sc of r.headers.getSetCookie()) {
      const par = sc.split(";")[0];
      const eq = par.indexOf("=");
      if (eq > 0) jar.set(par.slice(0, eq).trim(), par.slice(eq + 1).trim());
    }
    const loc = r.status >= 300 && r.status < 400 ? r.headers.get("location") : null;
    if (!loc) break;
    await r.body?.cancel().catch(() => {});
    url = new URL(loc, url).toString();
  }
  const html = r ? await r.text().catch(() => "") : "";
  return { finalUrl: url, html, jar };
}

/** GET na _api/v2.0 exigindo JSON de verdade (200 text/html aqui é FALHA). */
async function apiJson(url: string, cookie: string): Promise<{ status: number; json: Record<string, unknown> | null }> {
  const r = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json", Cookie: cookie },
  });
  const ct = (r.headers.get("content-type") || "").toLowerCase();
  if (!r.ok || !ct.includes("json")) return { status: r.status, json: null };
  try {
    return { status: r.status, json: (await r.json()) as Record<string, unknown> };
  } catch {
    return { status: r.status, json: null };
  }
}

function comoItem(j: Record<string, unknown>): ItemOneDrive | null {
  const downloadUrl = j["@content.downloadUrl"];
  if (typeof downloadUrl !== "string" || !downloadUrl) return null;
  return {
    nome: typeof j.name === "string" ? j.name : "",
    size: typeof j.size === "number" ? j.size : 0,
    downloadUrl,
  };
}

/** Lista os filhos de uma pasta (paginação + 1 nível de subpasta). */
async function listarPasta(base: string, resid: string, cookie: string, fundura: number): Promise<ItemOneDrive[]> {
  const itens: ItemOneDrive[] = [];
  let url: string | null = `${base}/items/${residNoPath(resid)}/children`;
  for (let pagina = 0; url && pagina < 10; pagina++) {
    const r = await apiJson(url, cookie);
    if (!r.json) throw new Error(`${NOSSO_PREFIXO}a listagem da pasta no OneDrive respondeu ${r.status} sem JSON`);
    const filhos = Array.isArray(r.json.value) ? (r.json.value as Record<string, unknown>[]) : [];
    for (const f of filhos) {
      const item = comoItem(f);
      if (item) itens.push(item);
      else if (f.folder && typeof f.id === "string" && fundura > 0) {
        itens.push(...(await listarPasta(base, f.id, cookie, fundura - 1)));
      }
    }
    url = typeof r.json["@odata.nextLink"] === "string" ? (r.json["@odata.nextLink"] as string) : null;
  }
  return itens;
}

/**
 * Resolve um link 1drv.ms/onedrive.live.com em itens baixáveis. Não baixa —
 * devolve nome/size/downloadUrl de cada arquivo + o cookie pra baixar.
 */
export async function resolverOneDrive(link: string): Promise<OneDriveResolvido> {
  const { finalUrl, html, jar } = await seguirCadeia(link);

  if (!jar.has("FedAuth")) {
    // Sem FedAuth o share NÃO concede acesso anônimo: aí sim o problema é o
    // link (fechado, apagado ou vencido) e pedir um novo é legítimo.
    return {
      ok: false,
      dependeDoAluno: true,
      motivo:
        'o link do OneDrive não está aberto para "qualquer pessoa com o link" — ' +
        "a Microsoft pediu login em vez de liberar o acesso anônimo (o arquivo pode também ter sido apagado)",
    };
  }

  const cookie = cookieHeader(jar);
  let { cid, resid } = extrairIdsDaUrl(finalUrl);
  if (!cid || !resid) {
    const daPagina = extrairIdsDaPagina(html);
    cid = cid || daPagina.cid;
    resid = resid || daPagina.resid;
  }
  if (!cid || !resid) {
    return { ok: false, dependeDoAluno: false, motivo: `${NOSSO_PREFIXO}o OneDrive liberou o acesso mas não achamos o identificador do arquivo (defeito nosso, não do link)` };
  }

  const base = `https://onedrive.live.com/_api/v2.0/drives/${cid}`;
  const item = await apiJson(`${base}/items/${residNoPath(resid)}`, cookie);
  if (!item.json) {
    return { ok: false, dependeDoAluno: false, motivo: `${NOSSO_PREFIXO}a consulta do item no OneDrive respondeu ${item.status} sem JSON (o acesso foi emitido, o defeito é nosso)` };
  }

  const unico = comoItem(item.json);
  if (unico) return { ok: true, itens: [unico], cookie };

  if (item.json.folder) {
    try {
      const itens = await listarPasta(base, decodeURIComponent(resid), cookie, 2);
      if (itens.length === 0) return { ok: false, dependeDoAluno: true, motivo: "a pasta do OneDrive veio vazia" };
      return { ok: true, itens, cookie };
    } catch (e) {
      return { ok: false, dependeDoAluno: false, motivo: e instanceof Error ? e.message : String(e) };
    }
  }

  return { ok: false, dependeDoAluno: false, motivo: `${NOSSO_PREFIXO}o item do OneDrive veio sem @content.downloadUrl e sem cara de pasta (defeito nosso)` };
}

/**
 * Baixa um item pro disco validando de verdade: content-type não pode ser
 * HTML e o tamanho baixado tem que BATER com o `size` anunciado no JSON.
 */
export async function baixarItemOneDrive(item: ItemOneDrive, cookie: string, destino: string, maxBytes: number): Promise<number> {
  const nome = item.nome || "arquivo";
  if (item.size > maxBytes) {
    throw new Error(`arquivo de ${Math.round(item.size / 1e6)} MB passa do teto de ${Math.round(maxBytes / 1e6)} MB`);
  }
  const r = await fetch(item.downloadUrl, {
    redirect: "follow",
    headers: { "User-Agent": UA, Cookie: cookie },
  });
  if (!r.ok || !r.body) throw new Error(`${NOSSO_PREFIXO}o download de "${nome}" respondeu ${r.status}`);
  const ct = (r.headers.get("content-type") || "").toLowerCase();
  if (ct.startsWith("text/html")) {
    throw new Error(`${NOSSO_PREFIXO}veio uma página da internet no lugar do arquivo "${nome}"`);
  }
  await pipeline(Readable.fromWeb(r.body as never), createWriteStream(destino));
  const baixado = (await stat(destino)).size;
  if (item.size > 0 && baixado !== item.size) {
    throw new Error(`${NOSSO_PREFIXO}o download de "${nome}" veio incompleto (${baixado} de ${item.size} bytes)`);
  }
  if (baixado > maxBytes) {
    throw new Error(`arquivo de ${Math.round(baixado / 1e6)} MB passa do teto de ${Math.round(maxBytes / 1e6)} MB`);
  }
  return baixado;
}
