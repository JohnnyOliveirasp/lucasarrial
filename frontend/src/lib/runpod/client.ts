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

// Cache curto do health (10s): o pico de gerações não martelar a API do RunPod.
let healthCache: { at: number; health: EndpointHealth | null } = { at: 0, health: null };

async function primaryHealth(): Promise<EndpointHealth | null> {
  if (Date.now() - healthCache.at < 10_000) return healthCache.health;
  try {
    const h = await getJson<EndpointHealth>(`${BASE}/${inferenceEndpoint()}/health`);
    healthCache = { at: Date.now(), health: h };
    return h;
  } catch {
    healthCache = { at: Date.now(), health: null };
    return null;
  }
}

/**
 * Escolhe o endpoint da geração: principal por padrão; TRANSBORDA pro B
 * quando o principal está sem worker disponível (idle+ready+running = 0,
 * típico de throttle geral) OU já tem fila formada. Health indisponível →
 * principal (comportamento de sempre).
 */
async function pickInferenceEndpoint(): Promise<string> {
  const b = inferenceEndpointB();
  if (!b) return inferenceEndpoint();
  const h = await primaryHealth();
  if (!h) return inferenceEndpoint();
  const w = h.workers ?? {};
  const available = (w.idle ?? 0) + (w.ready ?? 0) + (w.running ?? 0);
  const queued = h.jobs?.inQueue ?? 0;
  if (available === 0 || queued > 0) return b;
  return inferenceEndpoint();
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
