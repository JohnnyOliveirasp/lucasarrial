/**
 * Guardrails dos Trial Reels (Instagram) — decisão PURA de "pode enviar?".
 *
 * Estas regras existem porque o Instagram JÁ restringiu uma conta real por
 * excesso de Reels de teste. São 5, nenhuma pode ser afrouxada:
 *   1. Máximo 6 Trial Reels por dia, POR CONTA (janela deslizante de 24h —
 *      a conta do IG é o que a Meta pune, não o usuário da plataforma).
 *   2. Espaçamento mínimo de 2h30 entre dois Trial Reels da MESMA conta.
 *   3. Circuit breaker de 24h: um Trial Reel FALHOU → pausa SÓ os trials
 *      daquela conta por 24h. Reel NORMAL continua publicando (cortar o
 *      normal junto puniria o aluno por defeito nosso) — por isso o
 *      publisher só chama esta decisão quando is_trial está ligado.
 *   4. Dedupe: o MESMO vídeo (media_url) já enviado como trial naquela
 *      conta → recusa permanente (o aluno escolhe outro vídeo).
 *   5. Retry com backoff SOMENTE em HTTP 429. Erro de restrição NUNCA é
 *      retentado — retentar restrição é o que transforma um aviso da Meta
 *      em bloqueio (decidirRetryTrial).
 *
 * A checagem que VALE mora no ENVIO (publisher.startPublication, antes do
 * createContainer): publicação AGENDADA passa pela rota na criação e só vai
 * pro ar pelo sweep do Hetzner horas depois — se a regra morasse só na rota,
 * o aluno agendaria 10 pra mesma hora e todas passariam. A rota
 * /api/v1/social/publish TAMBÉM checa, mas só pra dar erro amigável na hora.
 *
 * SEM migration e SEM estado extra: tudo é derivado da própria tabela
 * publications (created_at, updated_at, status, media_url,
 * platform_options->>'is_trial'). O momento do envio fica em
 * platform_options.trial_sent_at (gravado pelo publisher ao criar o
 * container); o breaker é derivado dos trials failed nas últimas 24h,
 * EXCLUINDO os que nós mesmos barramos por guardrail
 * (platform_options.guardrail_block) — bloqueio nosso não é falha da Meta
 * e não pode abrir o breaker.
 *
 * Módulo PURO de propósito (zero imports, zero alias @/, zero Date.now):
 * roda direto no `node --test` e é a ÚNICA fonte das constantes — publisher
 * e rota consomem daqui, ninguém duplica número de regra.
 */

export const LIMITE_TRIALS_POR_DIA = 6;
export const JANELA_DIARIA_MS = 24 * 60 * 60 * 1000;
export const ESPACAMENTO_MINIMO_MS = 2.5 * 60 * 60 * 1000; // 2h30
export const BREAKER_MS = 24 * 60 * 60 * 1000;
/** Mesmo teto do publisher (MAX_ATTEMPTS): 3 tentativas no total. */
export const MAX_TENTATIVAS_TRIAL = 3;
export const BACKOFF_429_BASE_MS = 15 * 60 * 1000; // 15min, dobra a cada tentativa
export const BACKOFF_429_MAX_MS = 2 * 60 * 60 * 1000; // teto 2h

/** Uma publicação de trial ANTERIOR da mesma conta (linha de publications). */
export type TrialAnterior = {
  mediaUrl: string;
  status: "ready" | "processing" | "published" | "failed";
  /** created_at ISO. */
  criadaEm: string;
  /** platform_options.trial_sent_at ISO — momento em que o container foi criado na Meta. */
  enviadaEm?: string | null;
  /** updated_at ISO — proxy do momento da falha (linha failed não é mais re-patchada). */
  atualizadaEm: string;
  /** platform_options.guardrail_block presente → falha NOSSA (dedupe), não da Meta. */
  bloqueadaPorGuardrail?: boolean;
};

export type RegraGuardrail = "dedupe" | "circuit_breaker" | "limite_diario" | "espacamento";

export type DecisaoTrial =
  | { permitido: true }
  | {
      permitido: false;
      regra: RegraGuardrail;
      /** Frase legível pro aluno (vai em publications.error). */
      erro: string;
      /** ISO de quando poderá sair; null = nunca (dedupe é permanente). */
      liberadoEm: string | null;
    };

/**
 * Dedupe compara a MÍDIA, não a string crua: a limpeza de 7 dias reescreve
 * r2:// → r2-cleaned:// na linha antiga, e o mesmo vídeo re-enviado chegaria
 * com r2:// de novo — sem normalizar, o dedupe deixaria passar a duplicata.
 */
export function chaveDedupe(mediaUrl: string): string {
  return mediaUrl.replace(/^r2-cleaned:\/\//, "r2://");
}

/**
 * Momento em que o trial FOI enviado pra Meta (container criado).
 * trial_sent_at é a fonte; linhas antigas (antes do campo existir) usam
 * created_at como proxy SE o container chegou a existir (processing/
 * published). Linha failed sem trial_sent_at falhou ANTES do envio
 * (guardrail ou exceção no create) — não conta pra janela nem pro espaçamento.
 */
export function momentoEnvio(t: TrialAnterior): number | null {
  if (t.enviadaEm) {
    const ms = Date.parse(t.enviadaEm);
    return Number.isNaN(ms) ? null : ms;
  }
  if (t.status === "processing" || t.status === "published") {
    const ms = Date.parse(t.criadaEm);
    return Number.isNaN(ms) ? null : ms;
  }
  return null;
}

/** "23/09 18:45 (horário de Brasília)" — pro aluno saber QUANDO libera. */
export function formatarHorario(iso: string): string {
  const f = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${f.format(new Date(iso))} (horário de Brasília)`;
}

/**
 * A decisão: dadas as publicações de trial ANTERIORES da conta e o agora,
 * este trial pode ser enviado?
 *
 * Ordem das checagens = da mais terminal pra mais transitória, pra mensagem
 * de erro apontar a causa que NÃO se resolve esperando:
 *   dedupe (permanente) → breaker (24h) → limite diário → espaçamento.
 */
export function decidirEnvioTrial(input: {
  /** ISO do "agora" (injetado — módulo puro não lê relógio). */
  agora: string;
  /** media_url do trial que quer sair. */
  mediaUrl: string;
  /** Trials anteriores DA MESMA CONTA (a atual publicação fora da lista). */
  anteriores: TrialAnterior[];
}): DecisaoTrial {
  const agoraMs = Date.parse(input.agora);

  // 4. DEDUPE — mesmo vídeo já foi (ou está indo) como trial nesta conta.
  //    failed não conta: re-tentar um vídeo que falhou é legítimo.
  const chave = chaveDedupe(input.mediaUrl);
  const duplicata = input.anteriores.find(
    (t) =>
      chaveDedupe(t.mediaUrl) === chave &&
      (t.status === "processing" || t.status === "published"),
  );
  if (duplicata) {
    return {
      permitido: false,
      regra: "dedupe",
      erro:
        "Este vídeo já foi publicado como Reel de teste nesta conta. " +
        "Escolha outro vídeo ou publique como Reel normal.",
      liberadoEm: null,
    };
  }

  // 3. CIRCUIT BREAKER — algum trial da conta falhou nas últimas 24h
  //    (falha REAL, não bloqueio nosso de guardrail).
  const falhas = input.anteriores.filter(
    (t) => t.status === "failed" && !t.bloqueadaPorGuardrail,
  );
  let ultimaFalhaMs = -Infinity;
  for (const f of falhas) {
    const ms = Date.parse(f.atualizadaEm);
    if (!Number.isNaN(ms) && ms > ultimaFalhaMs) ultimaFalhaMs = ms;
  }
  if (agoraMs - ultimaFalhaMs < BREAKER_MS) {
    const liberadoEm = new Date(ultimaFalhaMs + BREAKER_MS).toISOString();
    return {
      permitido: false,
      regra: "circuit_breaker",
      erro:
        "Reels de teste desta conta estão pausados por 24h após uma falha " +
        "(proteção contra restrição do Instagram). Reels normais continuam " +
        `publicando. Liberado em ${formatarHorario(liberadoEm)}.`,
      liberadoEm,
    };
  }

  // 1. LIMITE DIÁRIO — máx. 6 trials ENVIADOS na janela deslizante de 24h.
  const enviosNaJanela = input.anteriores
    .map(momentoEnvio)
    .filter((ms): ms is number => ms !== null && agoraMs - ms < JANELA_DIARIA_MS)
    .sort((a, b) => a - b);
  if (enviosNaJanela.length >= LIMITE_TRIALS_POR_DIA) {
    // Libera quando o mais antigo da janela completar 24h.
    const liberadoEm = new Date(enviosNaJanela[0] + JANELA_DIARIA_MS).toISOString();
    return {
      permitido: false,
      regra: "limite_diario",
      erro:
        `Limite de ${LIMITE_TRIALS_POR_DIA} Reels de teste por dia nesta ` +
        `conta atingido. Próximo liberado em ${formatarHorario(liberadoEm)}.`,
      liberadoEm,
    };
  }

  // 2. ESPAÇAMENTO — 2h30 desde o ÚLTIMO trial enviado da conta.
  let ultimoEnvioMs = -Infinity;
  for (const t of input.anteriores) {
    const ms = momentoEnvio(t);
    if (ms !== null && ms > ultimoEnvioMs) ultimoEnvioMs = ms;
  }
  if (agoraMs - ultimoEnvioMs < ESPACAMENTO_MINIMO_MS) {
    const liberadoEm = new Date(ultimoEnvioMs + ESPACAMENTO_MINIMO_MS).toISOString();
    return {
      permitido: false,
      regra: "espacamento",
      erro:
        "Intervalo mínimo de 2h30 entre Reels de teste da mesma conta. " +
        `Próximo liberado em ${formatarHorario(liberadoEm)}.`,
      liberadoEm,
    };
  }

  return { permitido: true };
}

export type DecisaoRetry = { retry: true; backoffMs: number } | { retry: false };

/**
 * Regra 5: retry com backoff SOMENTE em HTTP 429 (rate limit transitório).
 * Qualquer outro erro — inclusive restrição de recurso (2207001/2207042/
 * 2207051 vêm com status ≠ 429) e 5xx — NÃO retenta: falha terminal, e o
 * failed abre o circuit breaker da conta.
 *
 * `attempts` = tentativas já feitas INCLUINDO a que acabou de falhar.
 * Backoff exponencial: 15min, 30min, … com teto de 2h.
 */
export function decidirRetryTrial(input: {
  httpStatus: number | null;
  attempts: number;
}): DecisaoRetry {
  if (input.httpStatus !== 429) return { retry: false };
  if (input.attempts >= MAX_TENTATIVAS_TRIAL) return { retry: false };
  const backoffMs = Math.min(
    BACKOFF_429_BASE_MS * 2 ** Math.max(0, input.attempts - 1),
    BACKOFF_429_MAX_MS,
  );
  return { retry: true, backoffMs };
}
