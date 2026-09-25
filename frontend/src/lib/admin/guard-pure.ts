/**
 * Decisão PURA do gate de admin — sem Supabase, sem Next, testável com
 * `npx tsx --test`. Extraída de guard.ts/api.ts em 21/09 por dois defeitos
 * medidos em produção no mesmo dia:
 *
 * 1) A NEGATIVA ERA MUDA. O Johnny levou "Acesso restrito a administradores"
 *    três vezes no /admin/sgp e o log de produção tinha ZERO ocorrências da
 *    recusa — impossível fechar a causa. Agora todo caminho de recusa produz
 *    um payload de log (e-mail, papel, fonte, rota, motivo).
 *
 * 2) ERRO DE CONSULTA VIRAVA "VOCÊ NÃO É ADMIN". Se o select em admin_emails
 *    falhava, o fallback legado descartava o próprio erro e devolvia null —
 *    banco fora do ar respondia 403. Regra permanente da casa (a mesma já
 *    aplicada no _hotmart.cjs): erro de consulta NUNCA vira "a pessoa não tem
 *    acesso". "Não tem papel" é 403; "não consegui verificar" é 503.
 *
 * Quem sofre o defeito 2 é quem depende SÓ do banco — os papéis `suporte`
 * (Karen, Luany, Victor, Vitor); admin de env responde antes e não sente.
 */

export type AdminRole = "admin" | "suporte";

/** Formato mínimo do retorno de um select do Supabase (data/error). */
export type RespostaSelect = {
  data: { email?: string; role?: string | null } | null;
  error: { message?: string } | null;
};

export type GuardDeps = {
  /** allowlist da env ADMIN_EMAILS (bootstrap; quem entra por ela é admin) */
  isAdminEmail: (email: string) => boolean;
  /** SELECT email, role FROM admin_emails WHERE email = $1 (pós-mig 95) */
  selectComRole: (email: string) => Promise<RespostaSelect>;
  /** SELECT email FROM admin_emails WHERE email = $1 (fallback pré-mig 95) */
  selectLegado: (email: string) => Promise<RespostaSelect>;
};

/**
 * `ok: true`  → conseguimos uma RESPOSTA: role é o papel (ou null = não é admin)
 *               e `fonte` diz quem respondeu (env ou banco).
 * `ok: false` → NÃO conseguimos verificar (as duas consultas falharam).
 *               Isso NÃO é "não é admin" — o chamador responde 503, nunca 403.
 */
export type PapelResolvido =
  | { ok: true; role: AdminRole | null; fonte: "env" | "banco" | null }
  | { ok: false; erro: string };

/** Nunca deixa uma consulta que LANÇA derrubar a resolução: vira error. */
async function tentar(
  fn: (email: string) => Promise<RespostaSelect>,
  email: string,
): Promise<RespostaSelect> {
  try {
    return await fn(email);
  } catch (err) {
    return { data: null, error: { message: err instanceof Error ? err.message : String(err) } };
  }
}

export async function resolverPapel(
  email: string | null | undefined,
  deps: GuardDeps,
): Promise<PapelResolvido> {
  // Sem e-mail não há o que consultar: é uma RESPOSTA (não tem papel), não um erro.
  if (!email) return { ok: true, role: null, fonte: null };
  const e = email.trim().toLowerCase();
  if (deps.isAdminEmail(e)) return { ok: true, role: "admin", fonte: "env" };

  const primeira = await tentar(deps.selectComRole, e);
  if (!primeira.error) {
    if (!primeira.data) return { ok: true, role: null, fonte: "banco" };
    return {
      ok: true,
      role: primeira.data.role === "suporte" ? "suporte" : "admin",
      fonte: "banco",
    };
  }

  // A coluna `role` pode não existir (deploy chegou antes da mig 95): o select
  // legado sem a coluna ainda é uma fonte legítima. Mas o erro DELE não pode
  // mais ser descartado: se as duas tentativas falham, ninguém respondeu.
  const segunda = await tentar(deps.selectLegado, e);
  if (!segunda.error) {
    // Linha presente sem papel = admin, como sempre foi.
    return segunda.data
      ? { ok: true, role: "admin", fonte: "banco" }
      : { ok: true, role: null, fonte: "banco" };
  }

  return {
    ok: false,
    erro:
      `select com role: ${primeira.error.message ?? "erro sem mensagem"}; ` +
      `select legado: ${segunda.error.message ?? "erro sem mensagem"}`,
  };
}

/**
 * Payload de log de toda recusa do gate. SÓ e-mail, papel, fonte, rota e
 * motivo — nunca token, cookie ou segredo.
 */
export type LogNegativa = {
  email: string | null;
  papel: AdminRole | null;
  fonte: "env" | "banco" | "erro_consulta" | "sem_email";
  rota: string;
  motivo: "sem_papel" | "papel_nao_permitido" | "erro_consulta";
  erro?: string;
};

export type GateDecisao =
  | { tipo: "permitir"; role: AdminRole }
  | { tipo: "negar_403"; motivo: "sem_papel" | "papel_nao_permitido"; log: LogNegativa }
  | { tipo: "negar_503"; log: LogNegativa };

/**
 * A decisão do gate, separada do transporte HTTP:
 *   permitir  → segue;
 *   negar_403 → a pessoa NÃO tem o papel exigido (resposta conhecida);
 *   negar_503 → não conseguimos VERIFICAR — "tente de novo", nunca "você não é admin".
 * Este módulo não afrouxa permissão nenhuma: quem não tem papel continua fora.
 */
export function decidirGate(
  resultado: PapelResolvido,
  allow: readonly AdminRole[],
  ctx: { email: string | null; rota: string },
): GateDecisao {
  if (!resultado.ok) {
    return {
      tipo: "negar_503",
      log: {
        email: ctx.email,
        papel: null,
        fonte: "erro_consulta",
        rota: ctx.rota,
        motivo: "erro_consulta",
        erro: resultado.erro,
      },
    };
  }

  const fonte = resultado.fonte ?? "sem_email";
  if (resultado.role === null) {
    return {
      tipo: "negar_403",
      motivo: "sem_papel",
      log: { email: ctx.email, papel: null, fonte, rota: ctx.rota, motivo: "sem_papel" },
    };
  }
  if (!allow.includes(resultado.role)) {
    return {
      tipo: "negar_403",
      motivo: "papel_nao_permitido",
      log: {
        email: ctx.email,
        papel: resultado.role,
        fonte,
        rota: ctx.rota,
        motivo: "papel_nao_permitido",
      },
    };
  }
  return { tipo: "permitir", role: resultado.role };
}
