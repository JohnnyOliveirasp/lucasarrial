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

/** Arquivo do usuário corrompido/incompleto (caso Carla 29/07: moov atom).
 * Cobre o erro CRU do ffmpeg e a mensagem amigável do finalize-training. */
export function isCorruptFile(error: string): boolean {
  const e = (error || "").toLowerCase();
  return (
    e.includes("moov atom") ||
    e.includes("invalid data found when processing input") ||
    e.includes("could not find codec parameters") ||
    e.includes("corrompido ou incompleto") ||
    // Caso Erica 31/07 (inc. 57d360e4): arquivo SEM trilha de áudio nenhuma
    // (vídeo mudo ou upload quebrado) — ffmpeg não tem o que converter.
    e.includes("does not contain any stream")
  );
}

/**
 * Tira o invólucro "RunPod <STATUS>: " que UM dos dois caminhos de falha
 * coloca na frente do erro real.
 *
 * A MESMA falha chega ao banco escrita de duas formas, e quem escreve depende
 * de uma CORRIDA, não da causa:
 *   - webhook (`webhooks/runpod/route.ts`) grava o erro CRU:
 *       "executionTimeout exceeded"
 *   - polling da tela do aluno (`generations/[id]/route.ts`) embrulha:
 *       "RunPod FAILED: executionTimeout exceeded"
 *
 * Sem tirar o invólucro, o head da assinatura muda e a mesma causa raiz vira
 * DOIS incidentes. Medido em 24/08 no `d3d8d1b2` (nº 15, 12 alunos, o mais
 * antigo do quadro): ele acumulava só a forma crua, então a falha da Janete de
 * 23/08 23:41 (a mesma `executionTimeout`) não incrementou nada e o
 * `last_seen_at` ficou congelado em 18/08 — o incidente parecia dormente
 * enquanto a classe seguia derrubando aluno. Foi o que sustentou, por 11
 * rondas, o "detector cego" que ninguém conseguia explicar.
 *
 * Só desembrulha quando sobra conteúdo: "RunPod FAILED: " sozinho (resp.error
 * nulo) não vira string vazia, senão falhas sem detalhe nenhum desabariam
 * todas num único `unknown`.
 */
export function stripRunpodWrapper(error: string): string {
  // `[\s\S]+` em vez de `.+` com flag `s`: o target do projeto é anterior a
  // es2018 e não aceita dotall. Sem isso, erro com traceback (multi-linha)
  // não casaria e continuaria embrulhado.
  const m = /^\s*runpod\s+(failed|cancelled|timed_out)\s*:\s*([\s\S]+)$/i.exec(error || "");
  return m && m[2].trim() ? m[2].trim() : error || "";
}

/**
 * Remove o sufixo de telemetria "[fase: ...]" que `errorMessageComFase`
 * (lib/generations/fase-telemetria.ts) concatena no error_message de falha por
 * executionTimeout (incidente d3d8d1b2, #15). O nome da fase VARIA
 * (geracao.chunk × qa.whisper × model.load...) e não é normalizado pelas regras
 * numéricas abaixo — sem este strip, cada fase pendurada viraria um incidente
 * NOVO e a mesma causa raiz se estilhaçaria (a patologia do "detector cego"
 * medida em 24/08 no próprio d3d8d1b2). Mudou o formato do sufixo lá, muda o
 * regex aqui — são gêmeos.
 */
export function stripFaseSuffix(error: string): string {
  return (error || "").replace(/\s*\[fase:[^\]]*\]/gi, "").trim();
}

export function classifyCause(error: string): IncidentCause {
  const e = stripRunpodWrapper(stripFaseSuffix(error)).toLowerCase();
  if (!e) return "unknown";
  if (
    e.includes("insufficient_audio") ||
    e.includes("no usable speech") ||
    // Desde fdcc75c o voices.error_message guarda a MENSAGEM AMIGÁVEL pro
    // usuário, não o código do worker — sem estes padrões o incidente caía em
    // "unknown" (gap achado pelo Vigia na 1ª execução, incidente 4eed0e0d).
    e.includes("fala limpa") ||
    e.includes("serviram para o treino") ||
    // Arquivo corrompido = problema do INPUT do usuário (caía em unknown e
    // engordava o guarda-chuva genérico — caso Carla 29/07, inc. 49df7b4a).
    isCorruptFile(error)
  ) {
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
  // "voice" e "training" são a MESMA falha vista de duas tabelas — unifica.
  const k = kind === "voice" ? "training" : kind;
  // user_dataset: a CAUSA já é a raiz — o texto varia (erro cru do worker ×
  // mensagem amigável do voices.error_message desde fdcc75c) e duplicava o
  // incidente (acf8acd6 × 014bb108, gap achado pelo Vigia 23/07). Demais
  // causas mantêm o head: dentro de infra/bug o texto distingue problemas.
  // Arquivo corrompido é raiz DIFERENTE de "gravação sem fala limpa" — não
  // mistura no incidente canônico de dataset.
  if (cause === "user_dataset") {
    return isCorruptFile(error) ? `${k}:${cause}:corrupt` : `${k}:${cause}`;
  }
  const head = stripRunpodWrapper(stripFaseSuffix(error))
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, "<url>")
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, "<id>")
    .replace(/[0-9a-f]{16,}/g, "<hex>")
    .replace(/\d+/g, "#")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return `${k}:${cause}:${head}`;
}

export function incidentTitle(kind: string, error: string): string {
  const cause = classifyCause(error);
  const k = KIND_LABELS[kind] ?? kind;
  const detail = stripRunpodWrapper(stripFaseSuffix(error)).split("\n")[0].slice(0, 80);
  if (cause === "user_dataset") {
    return isCorruptFile(error)
      ? `${k}: arquivo enviado corrompido/incompleto`
      : `${k}: áudio insuficiente/sem fala limpa`;
  }
  if (cause === "infra_gpu") return `${k}: GPU sem memória (OOM)`;
  if (cause === "infra_storage") return `${k}: falha de armazenamento (R2)`;
  if (cause === "capacity") return `${k}: tempo de execução estourado`;
  return `${k}: ${detail || "erro desconhecido"}`;
}
