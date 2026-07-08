/**
 * Cliente do endpoint serverless do InfiniteTalk (Vídeo Clone). Server-only.
 * Env: RUNPOD_API_KEY + RUNPOD_ENDPOINT_INFINITETALK_ID.
 */
const BASE = "https://api.runpod.ai/v2";

function apiKey(): string {
  const k = process.env.RUNPOD_API_KEY;
  if (!k) throw new Error("Missing RUNPOD_API_KEY");
  return k;
}

function endpointId(): string {
  const id = process.env.RUNPOD_ENDPOINT_INFINITETALK_ID;
  if (!id) throw new Error("Missing RUNPOD_ENDPOINT_INFINITETALK_ID");
  return id;
}

export type CloneJobStatus =
  | "IN_QUEUE"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED"
  | "TIMED_OUT";

export async function runInfiniteTalk(workflow: unknown): Promise<{ jobId: string }> {
  const res = await fetch(`${BASE}/${endpointId()}/run`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ input: { workflow } }),
  });
  if (!res.ok) {
    throw new Error(`RunPod run ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const json = (await res.json()) as { id?: string };
  if (!json.id) throw new Error("RunPod run sem job id");
  return { jobId: json.id };
}

export async function getInfiniteTalkStatus(jobId: string): Promise<{
  status: CloneJobStatus;
  error: string | null;
}> {
  const res = await fetch(`${BASE}/${endpointId()}/status/${jobId}`, {
    headers: { Authorization: `Bearer ${apiKey()}` },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`RunPod status ${res.status}`);
  }
  const json = (await res.json()) as {
    status?: CloneJobStatus;
    error?: string;
    output?: { details?: string[] };
  };
  const detail = Array.isArray(json.output?.details) ? json.output.details.join(" ") : "";
  return {
    status: json.status ?? "IN_QUEUE",
    error: json.error ? `${json.error}${detail ? ` — ${detail.slice(0, 300)}` : ""}` : null,
  };
}
