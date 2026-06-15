/**
 * Saúde REAL do RunPod serverless (treino + inferência). Server-only.
 *
 * Usa o endpoint /health da API do RunPod, que devolve contagem de workers
 * (idle/running/ready…) e de jobs (na fila / em progresso). Daí derivamos
 * "Running / Idle / Offline" e a profundidade da fila.
 */
const BASE = "https://api.runpod.ai/v2";

export type RunpodState = "running" | "idle" | "offline";

export type RunpodHealth = {
  label: string;
  endpoint: string;
  state: RunpodState;
  latencyMs: number | null;
  workers: { idle: number; running: number; ready: number; throttled: number; unhealthy: number };
  jobs: { inQueue: number; inProgress: number; completed: number; failed: number };
};

type HealthPayload = {
  workers?: Partial<RunpodHealth["workers"]> & { initializing?: number };
  jobs?: Partial<RunpodHealth["jobs"]>;
};

async function fetchHealth(label: string, endpoint: string): Promise<RunpodHealth> {
  const base: RunpodHealth = {
    label,
    endpoint,
    state: "offline",
    latencyMs: null,
    workers: { idle: 0, running: 0, ready: 0, throttled: 0, unhealthy: 0 },
    jobs: { inQueue: 0, inProgress: 0, completed: 0, failed: 0 },
  };

  const key = process.env.RUNPOD_API_KEY;
  if (!key || !endpoint) return base;

  const t0 = Date.now();
  try {
    const res = await fetch(`${BASE}/${endpoint}/health`, {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    const latencyMs = Date.now() - t0;
    if (!res.ok) return { ...base, latencyMs };

    const data = (await res.json()) as HealthPayload;
    const workers = {
      idle: data.workers?.idle ?? 0,
      running: data.workers?.running ?? 0,
      ready: data.workers?.ready ?? 0,
      throttled: data.workers?.throttled ?? 0,
      unhealthy: data.workers?.unhealthy ?? 0,
    };
    const jobs = {
      inQueue: data.jobs?.inQueue ?? 0,
      inProgress: data.jobs?.inProgress ?? 0,
      completed: data.jobs?.completed ?? 0,
      failed: data.jobs?.failed ?? 0,
    };
    const state: RunpodState =
      workers.running > 0 || jobs.inProgress > 0 || jobs.inQueue > 0 ? "running" : "idle";

    return { ...base, state, latencyMs, workers, jobs };
  } catch {
    return { ...base, latencyMs: Date.now() - t0 };
  }
}

/** Saúde de todos os endpoints únicos (treino + inferência, deduplicados). */
export async function getRunpodHealth(): Promise<RunpodHealth[]> {
  const train = process.env.RUNPOD_ENDPOINT_TRAIN_ID || "";
  const infer = process.env.RUNPOD_ENDPOINT_INFERENCE_ID || train;

  if (train && infer && train === infer) {
    const h = await fetchHealth("GPU", train);
    return [h];
  }
  return Promise.all([
    fetchHealth("Treino", train),
    fetchHealth("Inferência", infer),
  ]);
}
