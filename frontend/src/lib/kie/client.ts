/**
 * Cliente HTTP minimalista pro Kie (jobs API). Server-only.
 *
 * Fluxo assíncrono (igual ao RunPod): cria a task -> Kie processa ->
 * notifica via callBackUrl E/OU a gente consulta `recordInfo` (poll).
 *
 * Env vars:
 *   KIE_API_KEY          (obrigatória)
 *   NEXT_PUBLIC_SITE_URL (ou SITE_URL) — pra montar o callback público
 *
 * Usa fetch direto (sem SDK) — sem dependência nova.
 */
import { KIE_IMAGE_MODEL } from "./config";

const BASE = "https://api.kie.ai/api/v1/jobs";

function key(): string {
  const k = process.env.KIE_API_KEY;
  if (!k) throw new Error("Missing KIE_API_KEY");
  return k;
}

/** URL pública que o Kie chama quando a task termina (igual ao webhook RunPod). */
export function kieCallbackUrl(): string | undefined {
  const base = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL;
  if (!base) return undefined;
  return `${base.replace(/\/$/, "")}/api/v1/webhooks/kie`;
}

export type KieCreateInput = {
  prompt: string;
  input_urls: string[];
  aspect_ratio: string;
  resolution: string;
};

/** Cria uma task de geração e retorna o taskId. */
export async function kieCreateImageTask(
  input: KieCreateInput,
  opts: { callBackUrl?: string } = {},
): Promise<{ taskId: string }> {
  const body: Record<string, unknown> = {
    model: KIE_IMAGE_MODEL,
    input,
  };
  if (opts.callBackUrl) body.callBackUrl = opts.callBackUrl;

  const res = await fetch(`${BASE}/createTask`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Kie ${res.status}: ${text.slice(0, 400)}`);
  }
  const json = (await res.json()) as { code?: number; msg?: string; data?: { taskId?: string } };
  const taskId = json.data?.taskId;
  if (!taskId) {
    throw new Error(`Kie createTask sem taskId (code=${json.code}, msg=${json.msg ?? ""})`);
  }
  return { taskId };
}

export type KieState = "waiting" | "queuing" | "generating" | "success" | "fail";

export type KieTaskInfo = {
  taskId: string;
  state: KieState;
  resultUrls: string[];
  failCode: string | null;
  failMsg: string | null;
};

/** Consulta o estado/resultado de uma task (poll). */
export async function kieGetTask(taskId: string): Promise<KieTaskInfo> {
  const res = await fetch(`${BASE}/recordInfo?taskId=${encodeURIComponent(taskId)}`, {
    headers: { Authorization: `Bearer ${key()}` },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Kie ${res.status}: ${text.slice(0, 400)}`);
  }
  const json = (await res.json()) as {
    data?: {
      taskId?: string;
      state?: KieState;
      resultJson?: string;
      failCode?: string;
      failMsg?: string;
    };
  };
  const d = json.data ?? {};

  // resultJson é uma STRING JSON; só existe quando state==="success".
  let resultUrls: string[] = [];
  if (d.resultJson) {
    try {
      const parsed = JSON.parse(d.resultJson) as { resultUrls?: unknown };
      if (Array.isArray(parsed.resultUrls)) {
        resultUrls = parsed.resultUrls.filter((u): u is string => typeof u === "string");
      }
    } catch {
      // resultJson malformado — trata como sem resultado
    }
  }

  return {
    taskId: d.taskId ?? taskId,
    state: (d.state ?? "waiting") as KieState,
    resultUrls,
    failCode: d.failCode || null,
    failMsg: d.failMsg || null,
  };
}
