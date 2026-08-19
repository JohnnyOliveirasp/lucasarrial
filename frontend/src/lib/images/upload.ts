/**
 * PUT presigned pro R2 com retry — o upload vai do browser DIRETO pro bucket,
 * então o backend nunca vê a falha (não vira log nem incidente). Falha
 * transitória (rede saturada, 5xx do R2) merece nova tentativa; 4xx real
 * (formato, tamanho, link vencido) falha na hora.
 *
 * Incidente 5bb774b8: aluno com link de subida saturado via as fotos falharem
 * "às vezes na 1ª, às vezes da 2ª em diante" sem retry e sem mensagem útil.
 */

/** Erro de upload classificado: rede/CORS (sem resposta) ou HTTP com status. */
export class UploadError extends Error {
  readonly kind: "network" | "http";
  readonly status: number | null;

  constructor(kind: "network" | "http", status: number | null = null) {
    super(kind === "network" ? "upload network error" : `upload failed with HTTP ${status}`);
    this.name = "UploadError";
    this.kind = kind;
    this.status = status;
  }
}

const BACKOFF_MS = [400, 1200];
const MAX_ATTEMPTS = 3;

/** 408/429/5xx valem retry; qualquer outro 4xx é definitivo (400/403/413/415…). */
function isTransientStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * PUT do arquivo na URL presigned. Até 3 tentativas (backoff 400ms / 1200ms)
 * APENAS em falha transitória: erro de rede/CORS (fetch rejeita sem resposta),
 * HTTP 408, 429 ou 5xx. 4xx real falha na hora, sem retry.
 * Sempre lança UploadError — o caller traduz com uploadErrorText().
 */
export async function putToR2(url: string, file: Blob, contentType: string): Promise<Response> {
  let lastError: UploadError = new UploadError("network");
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) await sleep(BACKOFF_MS[attempt - 1]);
    let res: Response;
    try {
      res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: file,
      });
    } catch {
      // fetch rejeita sem resposta: queda de rede, CORS, link saturado.
      lastError = new UploadError("network");
      continue;
    }
    if (res.ok) return res;
    const err = new UploadError("http", res.status);
    if (!isTransientStatus(res.status)) throw err;
    lastError = err;
  }
  throw lastError;
}

/** Assinatura mínima do t() do next-intl (useTranslations("uploadErrors")). */
type Translate = (key: string, values?: Record<string, string | number>) => string;

/**
 * Mensagem traduzida com o NOME DO ARQUIVO e o MOTIVO — o suporte precisa
 * separar "400 de formato" de "falha de rede", e saber QUAL foto falhou.
 * `t` deve vir de useTranslations("uploadErrors").
 */
export function uploadErrorText(err: unknown, file: File, t: Translate): string {
  const name = file.name;
  if (err instanceof UploadError) {
    if (err.kind === "network") return t("network", { file: name });
    const status = err.status ?? 0;
    if (status === 413) return t("tooLarge", { file: name });
    if (status === 400 || status === 415) return t("badFormat", { file: name, status });
    if (status === 403) return t("linkExpired", { file: name });
    if (isTransientStatus(status)) return t("server", { file: name, status });
    return t("rejected", { file: name, status });
  }
  return t("unknown", { file: name });
}
