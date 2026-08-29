/**
 * Download de arquivos do Google Drive pro onboarding via planilha.
 * Server-only.
 *
 * Os arquivos são tornados "qualquer um com o link – leitor" pelo Apps Script
 * da planilha ANTES do POST no webhook, então aqui basta o endpoint público de
 * download. Usamos drive.usercontent.google.com com confirm=t, que pula o
 * interstício de "arquivo grande demais pra verificação de vírus".
 *
 * ⚠️ Os módulos `node:*` entram por import ESTÁTICO. Com `await import(...)`
 * o bundle de produção devolve o namespace sem os named exports, e
 * `new Transform(...)` explodia como "k is not a constructor" — derrubando
 * justamente o caso mais comum (aluno manda vídeo no lugar da foto).
 * Casos reais 14/08: linhas 346 e 398.
 */
import { createWriteStream } from "node:fs";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

export type DriveFile = {
  bytes: Buffer;
  contentType: string;
  filename: string | null;
};

// ── HTML no lugar do arquivo: TRÊS causas diferentes, não uma ──────────────
// Incidente #184 (29/08). O código tratava QUALQUER `text/html` como "arquivo
// privado" e mandava o aluno arrumar o compartilhamento. Mas o Drive também
// devolve HTML quando estoura a COTA DE DOWNLOAD DO PRÓPRIO ARQUIVO — 2009
// bytes com `<title>Google Drive - Quota exceeded</title>` e "Too many users
// have viewed or downloaded this file recently". Medido na pasta do
// johnathan.ppires@gmail.com: os 4 primeiros arquivos vieram video/mp4 e do 5º
// em diante veio essa página; minutos depois o MESMO id voltou a responder 206
// video/mp4. Ou seja: link certo, permissão certa, limite temporário de rajada
// — e o aluno levava a culpa por isso, parado 2 dias com 0 vozes.

export type TipoHtmlDrive = "quota" | "privado" | "desconhecido";

/** Cota de tráfego do arquivo estourada. Testado ANTES do login: a página de
 *  cota também traz link de "Sign in" no rodapé e casaria com o padrão errado. */
const RE_QUOTA = /quota exceeded|too many users have viewed or downloaded/i;
/** Aí sim é login/privado — o diagnóstico que a mensagem antiga dava a todos. */
const RE_LOGIN = /ServiceLogin|accounts\.google\.com|Sign in/i;

/** Teto de leitura do corpo pra classificar. A página do Drive tem ~2KB; o teto
 *  existe só pra um HTML esquisito não segurar RAM à toa. */
const MAX_HTML_PREVIEW_BYTES = 64 * 1024;

/** Tentativas por arquivo quando a resposta é cota. 3 = 1 original + 2 retentativas. */
const MAX_TENTATIVAS_QUOTA = 3;
/** Espera ENTRE tentativas. Com 3 tentativas só as duas primeiras são usadas (7s). */
const BACKOFF_QUOTA_MS = [2_000, 5_000, 10_000];
/** Teto de espera POR ARQUIVO. A rota /api/v1/onboarding/import tem maxDuration=600. */
const TETO_ESPERA_QUOTA_MS = 30_000;

/** Só a classificação, exposta pra teste. Recebe o corpo já lido. */
export function classificarHtmlDoDrive(corpo: string): TipoHtmlDrive {
  if (RE_QUOTA.test(corpo)) return "quota";
  if (RE_LOGIN.test(corpo)) return "privado";
  return "desconhecido";
}

/**
 * A mensagem que vira o `motivo` — e o `motivo` é o que decide se o ALUNO leva
 * e-mail de culpa (lib/onboarding/erro-dono.ts). Por isso o texto de cada caso
 * é parte da correção, não enfeite:
 *   quota        → NOSSO (as âncoras "limitou temporariamente"/"cota de tráfego"
 *                  estão na regra de erro-dono.ts). O aluno não é incomodado.
 *   privado      → ALUNO. Mantida PALAVRA POR PALAVRA a mensagem antiga: este é
 *                  o único caso em que o diagnóstico original estava certo.
 *   desconhecido → ALUNO, mas SEM afirmar que é permissão. Fica com o aluno de
 *                  propósito: pela regra invertida de 22/08, o que não é
 *                  comprovadamente nosso é avisado — um e-mail a mais custa
 *                  menos que um aluno parado em silêncio.
 */
export function mensagemHtmlDoDrive(tipo: TipoHtmlDrive, fileId: string): string {
  if (tipo === "quota") {
    return (
      `O Google limitou temporariamente o download do arquivo ${fileId} ` +
      `(cota de tráfego do próprio arquivo). O link está correto; costuma liberar em até 24h.`
    );
  }
  if (tipo === "privado") {
    return `Arquivo ${fileId} não está público no Drive (veio página HTML, não o arquivo)`;
  }
  return `O Drive devolveu uma página HTML inesperada no lugar do arquivo ${fileId}`;
}

/** Lê no máximo `maxBytes` do corpo e cancela o resto — não usa res.text(),
 *  que leria a resposta inteira se ela viesse grande por acidente. */
async function lerPrefixo(res: Response, maxBytes = MAX_HTML_PREVIEW_BYTES): Promise<string> {
  if (!res.body) {
    try {
      return (await res.text()).slice(0, maxBytes);
    } catch {
      return "";
    }
  }
  const reader = res.body.getReader();
  const partes: Uint8Array[] = [];
  let total = 0;
  try {
    while (total < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        partes.push(value);
        total += value.length;
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return Buffer.concat(partes).subarray(0, maxBytes).toString("utf8");
}

const dormir = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Injeção só pra teste: sem isto o teste do retry gastaria 7s de sono real e
 *  precisaria de rede. Os chamadores de produção não passam nada. */
export type DriveDeps = {
  fetchImpl?: typeof fetch;
  esperar?: (ms: number) => Promise<void>;
};

/**
 * Abre o arquivo no Drive e devolve uma Response que NÃO é HTML — o corpo sai
 * intacto pra quem chamou (buffer ou stream, tanto faz). Único ponto de fetch:
 * antes o trecho estava duplicado nos dois downloaders e só um teria sido
 * corrigido.
 *
 * Na cota, retenta com backoff em vez de recusar: hoje um throttle de segundos
 * vira recusa definitiva do arquivo, e o aluno fica parado por causa de um
 * limite que passa sozinho. Requeue do import inteiro NÃO é feito aqui — é
 * decisão de produto, fora deste conserto.
 */
async function abrirNoDriveSemHtml(fileId: string, deps: DriveDeps): Promise<Response> {
  const doFetch = deps.fetchImpl ?? fetch;
  const esperar = deps.esperar ?? dormir;
  const url =
    `https://drive.usercontent.google.com/download?id=${encodeURIComponent(fileId)}` +
    `&export=download&confirm=t`;

  let esperaAcumulada = 0;
  for (let tentativa = 1; ; tentativa++) {
    const res = await doFetch(url, {
      redirect: "follow",
      // 22/08: SEM o header Range o Drive devolve HTML pra arquivo grande, MESMO
      // com confirm=t — e o código lia isso como "arquivo não está público",
      // diagnóstico falso que mandava o aluno "liberar" um link já liberado
      // (caso 527: 8,9GB, público, respondendo 206 com Range e HTML sem ele).
      headers: { Range: "bytes=0-" },
    });
    if (!res.ok) {
      throw new Error(`Drive respondeu ${res.status} pro arquivo ${fileId}`);
    }

    const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
    if (!contentType.startsWith("text/html")) return res;

    // HTML: agora o CORPO decide o diagnóstico, não o content-type sozinho.
    const tipo = classificarHtmlDoDrive(await lerPrefixo(res));
    const espera =
      BACKOFF_QUOTA_MS[tentativa - 1] ?? BACKOFF_QUOTA_MS[BACKOFF_QUOTA_MS.length - 1] ?? 2_000;
    if (
      tipo === "quota" &&
      tentativa < MAX_TENTATIVAS_QUOTA &&
      esperaAcumulada + espera <= TETO_ESPERA_QUOTA_MS
    ) {
      esperaAcumulada += espera;
      await esperar(espera);
      continue;
    }
    throw new Error(mensagemHtmlDoDrive(tipo, fileId));
  }
}

/** Extrai o filename do Content-Disposition (filename* UTF-8 ou filename=""). */
function parseFilename(disposition: string | null): string | null {
  if (!disposition) return null;
  const star = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (star) {
    try {
      return decodeURIComponent(star[1]).trim();
    } catch {
      /* cai pro filename simples */
    }
  }
  const plain = disposition.match(/filename="?([^";]+)"?/i);
  return plain ? plain[1].trim() : null;
}

/**
 * Baixa um arquivo do Drive pelo fileId. Lança Error com mensagem legível
 * (vai pro writeback de "Erro" na planilha) se o arquivo não for público,
 * não existir ou passar do teto de tamanho.
 */
// ── Arquivos que NÃO vieram do Drive (WeTransfer, Dropbox, OneDrive…) ──────
// lib/onboarding/links.ts já baixou pro disco. Registrar aqui faz os dois
// downloaders abaixo servirem do disco quando o "fileId" for um id local —
// e o importador (import.ts) não precisa saber de onde veio. O id local tem
// prefixo `lk_` + hash do link + nome, determinístico: a chave R2 continua
// idempotente e reprocessar não duplica.
const locais = new Map<string, { path: string; filename: string }>();

export function registrarArquivoLocal(id: string, path: string, filename: string): void {
  locais.set(id, { path, filename });
}

export function ehArquivoLocal(id: string): boolean {
  return locais.has(id);
}

/** MIME pelo nome — suficiente pra imagem/áudio/vídeo; o ffprobe decide o resto. */
function mimeDoNome(filename: string): string {
  const ext = filename.toLowerCase().split(".").pop() || "";
  const tabela: Record<string, string> = {
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", heic: "image/heic", gif: "image/gif",
    mp3: "audio/mpeg", wav: "audio/wav", m4a: "audio/mp4", aac: "audio/aac", ogg: "audio/ogg", flac: "audio/flac", opus: "audio/opus",
    mp4: "video/mp4", mov: "video/quicktime", mkv: "video/x-matroska", webm: "video/webm",
  };
  return tabela[ext] || "application/octet-stream";
}

export async function downloadDriveFile(
  fileId: string,
  maxBytes: number,
  deps: DriveDeps = {},
): Promise<DriveFile> {
  const local = locais.get(fileId);
  if (local) {
    const { readFile, stat } = await import("node:fs/promises");
    const size = (await stat(local.path)).size;
    if (size > maxBytes) throw new Error(`arquivo ${local.filename} de ${Math.round(size / 1e6)} MB passa do teto`);
    return { bytes: await readFile(local.path), contentType: mimeDoNome(local.filename), filename: local.filename };
  }

  // Já vem sem HTML: cota retentada, privado/desconhecido viraram erro com o
  // dono certo (ver abrirNoDriveSemHtml).
  const res = await abrirNoDriveSemHtml(fileId, deps);
  const contentType = (res.headers.get("content-type") ?? "").toLowerCase();

  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > maxBytes) {
    throw new Error(
      `Arquivo ${fileId} tem ${Math.round(declared / 1e6)}MB (teto ${Math.round(maxBytes / 1e6)}MB)`,
    );
  }

  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length === 0) throw new Error(`Arquivo ${fileId} veio vazio do Drive`);
  if (bytes.length > maxBytes) {
    throw new Error(
      `Arquivo ${fileId} tem ${Math.round(bytes.length / 1e6)}MB (teto ${Math.round(maxBytes / 1e6)}MB)`,
    );
  }

  return {
    bytes,
    contentType: contentType.split(";")[0] || "application/octet-stream",
    filename: parseFilename(res.headers.get("content-disposition")),
  };
}


/**
 * Variante STREAMING: baixa direto pra um arquivo em disco (vídeos de
 * centenas de MB — caso A248: 878MB — sem Buffer gigante na RAM do app).
 */
export async function downloadDriveFileToPath(
  fileId: string,
  destPath: string,
  maxBytes: number,
  deps: DriveDeps = {},
): Promise<{ contentType: string; bytes: number }> {
  const local = locais.get(fileId);
  if (local) {
    const { copyFile, stat } = await import("node:fs/promises");
    const size = (await stat(local.path)).size;
    if (size > maxBytes) throw new Error(`arquivo ${local.filename} de ${Math.round(size / 1e6)} MB passa do teto`);
    await copyFile(local.path, destPath);
    return { contentType: mimeDoNome(local.filename), bytes: size };
  }

  // Já vem sem HTML: cota retentada, privado/desconhecido viraram erro com o
  // dono certo (ver abrirNoDriveSemHtml).
  const res = await abrirNoDriveSemHtml(fileId, deps);
  if (!res.body) {
    throw new Error(`Drive respondeu ${res.status} pro arquivo ${fileId}`);
  }
  const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > maxBytes) {
    throw new Error(
      `Arquivo ${fileId} tem ${Math.round(declared / 1e6)}MB (teto ${Math.round(maxBytes / 1e6)}MB)`,
    );
  }
  let total = 0;
  const contador = new Transform({
    transform(chunk: Buffer, _enc, cb) {
      total += chunk.length;
      if (total > maxBytes) {
        cb(new Error(`Arquivo ${fileId} passou de ${Math.round(maxBytes / 1e6)}MB no download`));
        return;
      }
      cb(null, chunk);
    },
  });
  await pipeline(Readable.fromWeb(res.body as never), contador, createWriteStream(destPath));
  if (total === 0) throw new Error(`Arquivo ${fileId} veio vazio do Drive`);
  return { contentType: contentType.split(";")[0] || "application/octet-stream", bytes: total };
}

/** Extensão a partir do filename OU do content-type (fallback). */
export function pickExtension(
  filename: string | null,
  contentType: string,
  fallback: string,
): string {
  const fromName = filename?.match(/\.([a-zA-Z0-9]{1,5})$/)?.[1]?.toLowerCase();
  if (fromName) return fromName;
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/mp4": "m4a",
    "audio/x-m4a": "m4a",
    "audio/flac": "flac",
    "audio/ogg": "ogg",
    "video/mp4": "mp4",
  };
  return map[contentType] ?? fallback;
}
