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
};

export async function runpodSubmitTrain(
  input: unknown,
  opts: SubmitOpts = {},
): Promise<RunpodRunResponse> {
  const body: Record<string, unknown> = { input };
  if (opts.webhook) body.webhook = opts.webhook;
  return postJson<RunpodRunResponse>(`${BASE}/${trainEndpoint()}/run`, body);
}

export async function runpodSubmitInference(
  input: unknown,
  opts: SubmitOpts = {},
): Promise<RunpodRunResponse> {
  const body: Record<string, unknown> = { input };
  if (opts.webhook) body.webhook = opts.webhook;
  return postJson<RunpodRunResponse>(`${BASE}/${inferenceEndpoint()}/run`, body);
}

export async function runpodGetStatus(jobId: string, endpoint?: string): Promise<RunpodStatusResponse> {
  const ep = endpoint || trainEndpoint();
  return getJson<RunpodStatusResponse>(`${BASE}/${ep}/status/${jobId}`);
}

export function webhookUrlFor(path: "training" | "generation"): string | undefined {
  const base = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL;
  if (!base) return undefined;
  // RunPod chama esse URL após o job terminar (mesma rota cobre ambos os tipos)
  return `${base.replace(/\/$/, "")}/api/v1/webhooks/runpod`;
}
