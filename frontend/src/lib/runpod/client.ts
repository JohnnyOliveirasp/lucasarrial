/**
 * Cliente HTTP minimalista pro RunPod Serverless.
 * Server-only.
 *
 * Env vars necessárias:
 *   RUNPOD_API_KEY
 *   RUNPOD_ENDPOINT_TRAIN_ID
 *   RUNPOD_ENDPOINT_INFERENCE_ID (opcional, default = TRAIN_ID)
 */

const BASE = "https://api.runpod.ai/v2";

function key() {
  const k = process.env.RUNPOD_API_KEY;
  if (!k) throw new Error("Missing RUNPOD_API_KEY");
  return k;
}

function trainEndpoint() {
  const id = process.env.RUNPOD_ENDPOINT_TRAIN_ID;
  if (!id) throw new Error("Missing RUNPOD_ENDPOINT_TRAIN_ID");
  return id;
}

export function inferenceEndpoint() {
  return process.env.RUNPOD_ENDPOINT_INFERENCE_ID || trainEndpoint();
}

/** Endpoint B (transbordo): clone do worker de voz criado 07/08 pro caso
 *  de workers do principal THROTTLED/cheios (5 timeouts em 06/08). Vazio =
 *  feature desligada. */
function inferenceEndpointB(): string | null {
  return process.env.RUNPOD_ENDPOINT_INFERENCE_B_ID || null;
}

type EndpointHealth = {
  jobs?: { inQueue?: number; inProgress?: number };
  workers?: { idle?: number; ready?: number; running?: number; throttled?: number };
};

// Cache curto do health por endpoint (10s): o pico de gerações não martelar
// a API do RunPod.
const healthCache = new Map<string, { at: number; health: EndpointHealth | null }>();

async function endpointHealth(ep: string): Promise<EndpointHealth | null> {
  const cached = healthCache.get(ep);
  if (cached && Date.now() - cached.at < 10_000) return cached.health;
  let health: EndpointHealth | null = null;
  try {
    health = await getJson<EndpointHealth>(`${BASE}/${ep}/health`);
  } catch {
    health = null;
  }
  healthCache.set(ep, { at: Date.now(), health });
  return health;
}

/**
 * BALANCEAMENTO (pedido Johnny 07/08): a geração vai pro endpoint de voz
 * MENOS CARREGADO entre A (principal) e B. Carga = fila×2 + rodando −
 * workers livres (fila pesa mais: é ela que vira espera pro aluno). Empate
 * ou health indisponível → A. Sem env do B → comportamento antigo (só A).
 */
async function pickInferenceEndpoint(): Promise<string> {
  const a = inferenceEndpoint();
  const b = inferenceEndpointB();
  if (!b) return a;
  const [ha, hb] = await Promise.all([endpointHealth(a), endpointHealth(b)]);
  if (!ha && !hb) return a;
  if (!ha) return b;
  if (!hb) return a;
  const load = (h: EndpointHealth) => {
    const w = h.workers ?? {};
    const free = (w.idle ?? 0) + (w.ready ?? 0);
    return (h.jobs?.inQueue ?? 0) * 2 + (h.jobs?.inProgress ?? 0) - free;
  };
  return load(hb) < load(ha) ? b : a;
}

export type RunpodRunResponse = {
  id: string;
  status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | "CANCELLED" | "TIMED_OUT";
};

export type RunpodStatusResponse = {
  id: string;
  status: RunpodRunResponse["status"];
  output?: unknown;
  error?: string;
  delayTime?: number;
  executionTime?: number;
};

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`RunPod ${res.status}: ${text.slice(0, 400)}`);
  }
  return (await res.json()) as T;
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { "Authorization": `Bearer ${key()}` },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`RunPod ${res.status}: ${text.slice(0, 400)}`);
  }
  return (await res.json()) as T;
}

type SubmitOpts = {
  webhook?: string;
  /** policy.executionTimeout do job — SEM isso vale o default do endpoint
   *  (20min desde 22/07; era 10min e matava treino em GPU lenta/worker frio). */
  executionTimeoutMs?: number;
};

function submitBody(input: unknown, opts: SubmitOpts): Record<string, unknown> {
  const body: Record<string, unknown> = { input };
  if (opts.webhook) body.webhook = opts.webhook;
  if (opts.executionTimeoutMs) body.policy = { executionTimeout: opts.executionTimeoutMs };
  return body;
}

export async function runpodSubmitTrain(
  input: unknown,
  opts: SubmitOpts = {},
): Promise<RunpodRunResponse> {
  return postJson<RunpodRunResponse>(`${BASE}/${trainEndpoint()}/run`, submitBody(input, opts));
}

export async function runpodSubmitInference(
  input: unknown,
  opts: SubmitOpts = {},
): Promise<RunpodRunResponse> {
  const ep = await pickInferenceEndpoint();
  return postJson<RunpodRunResponse>(`${BASE}/${ep}/run`, submitBody(input, opts));
}

/**
 * Status do job. Com o transbordo, o job pode morar no endpoint B — se o
 * endpoint consultado não conhecer o id, tenta o B (e vice-versa) antes de
 * propagar o erro. Sem B configurado, comportamento idêntico ao antigo.
 */
export async function runpodGetStatus(jobId: string, endpoint?: string): Promise<RunpodStatusResponse> {
  const ep = endpoint || trainEndpoint();
  try {
    return await getJson<RunpodStatusResponse>(`${BASE}/${ep}/status/${jobId}`);
  } catch (e) {
    const b = inferenceEndpointB();
    if (b && b !== ep) {
      try {
        return await getJson<RunpodStatusResponse>(`${BASE}/${b}/status/${jobId}`);
      } catch {
        /* propaga o erro original abaixo */
      }
    }
    throw e;
  }
}

export function webhookUrlFor(path: "training" | "generation"): string | undefined {
  const base = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL;
  if (!base) return undefined;
  // RunPod chama esse URL após o job terminar (mesma rota cobre ambos os tipos)
  return `${base.replace(/\/$/, "")}/api/v1/webhooks/runpod`;
}
