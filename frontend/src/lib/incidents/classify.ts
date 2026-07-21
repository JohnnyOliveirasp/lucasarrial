/**
 * Classificação automática de falhas → incidentes (aba Falhas do /admin).
 * Regras determinísticas em cima do texto do erro: causa + assinatura de
 * dedup (mesma causa raiz = mesmo incidente, mesmo com uuids/urls diferentes).
 */

export type IncidentCause =
  | "user_dataset"
  | "infra_gpu"
  | "infra_storage"
  | "capacity"
  | "bug"
  | "reported"
  | "unknown";

export const CAUSE_LABELS: Record<IncidentCause, string> = {
  user_dataset: "Áudio do usuário",
  infra_gpu: "Infra GPU",
  infra_storage: "Infra armazenamento",
  capacity: "Capacidade/timeout",
  bug: "Bug",
  reported: "Reportado",
  unknown: "Desconhecida",
};

export const KIND_LABELS: Record<string, string> = {
  training: "Treino de voz",
  voice: "Treino de voz",
  generation: "Geração de áudio",
  reported: "Reportado",
};

export function classifyCause(error: string): IncidentCause {
  const e = (error || "").toLowerCase();
  if (!e) return "unknown";
  if (e.includes("insufficient_audio") || e.includes("no usable speech")) {
    return "user_dataset";
  }
  if (e.includes("out of memory") || e.includes("outofmemoryerror") || e.includes("cuda")) {
    return "infra_gpu";
  }
  if (
    e.includes("cloudflarestorage") ||
    e.includes("r2 upload failed") ||
    e.includes("502 bad gateway") ||
    e.includes("read timed out") ||
    e.includes("failed to download")
  ) {
    return "infra_storage";
  }
  if (e.includes("executiontimeout") || e.includes("timed_out")) {
    return "capacity";
  }
  if (e.includes("trainer failed") || e.includes("traceback") || e.includes("no module named")) {
    return "bug";
  }
  return "unknown";
}

/** Assinatura estável da causa raiz: tira uuids, urls, números e paths. */
export function errorSignature(kind: string, error: string): string {
  const cause = classifyCause(error);
  const head = (error || "")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, "<url>")
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, "<id>")
    .replace(/[0-9a-f]{16,}/g, "<hex>")
    .replace(/\d+/g, "#")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  // "voice" e "training" são a MESMA falha vista de duas tabelas — unifica.
  const k = kind === "voice" ? "training" : kind;
  return `${k}:${cause}:${head}`;
}

export function incidentTitle(kind: string, error: string): string {
  const cause = classifyCause(error);
  const k = KIND_LABELS[kind] ?? kind;
  const detail = (error || "").split("\n")[0].slice(0, 80);
  if (cause === "user_dataset") return `${k}: áudio insuficiente/sem fala limpa`;
  if (cause === "infra_gpu") return `${k}: GPU sem memória (OOM)`;
  if (cause === "infra_storage") return `${k}: falha de armazenamento (R2)`;
  if (cause === "capacity") return `${k}: tempo de execução estourado`;
  return `${k}: ${detail || "erro desconhecido"}`;
}
