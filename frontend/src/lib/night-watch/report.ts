/**
 * Vigia noturno — RELATÓRIO da rodada, no formato do 06_RELATORIO_E_LIMITES.md.
 *
 * Sai SEMPRE, mesmo com zero achado — uma rodada que varre e não fala é
 * exatamente o bug que o vigia conserta (silêncio foi confundido com saúde e
 * 43 vozes ficaram paradas semanas). Nesta onda o relatório é "burro"
 * ("varri X, N presos, nada corrigido"); a Onda 2 enriquece.
 *
 * Regras do 06: o resolvido vem primeiro; "precisa de você" é curto e binário
 * (vazio = dizer "nada precisa de você" com todas as letras); número sempre,
 * nunca "vários"; erro nosso entra no relatório.
 */
import { sendEmail, escapeHtml } from "@/lib/email/resend";
import type { NightWatchRunResult } from "./types";

// Mesmo destino do failure-alert (SUPPORT_EMAIL). Duplicado de propósito: o
// import arrastaria a árvore de créditos inteira pra dentro do vigia e do
// teste de regressão do dry-run, sem ganho real.
const SUPPORT_EMAIL = "suporte@fastcloner.com";

const MAX_LISTED = 15; // relatório é pra ler no celular; o resto vai em número

export function buildReport(r: NightWatchRunResult): string {
  const dia = r.startedAt.slice(0, 10).split("-").reverse().slice(0, 2).join("/");
  const checked = r.detectors.reduce((n, d) => n + d.checked, 0);
  const alreadySeen = r.detectors.reduce((n, d) => n + d.alreadySeen, 0);
  const truncated = r.detectors.reduce((n, d) => n + d.truncated, 0);
  const failures = r.detectors.filter((d) => d.error);
  const anomalies = r.detectors.filter((d) => d.anomaly);

  const lines: string[] = [];
  lines.push(`📊 FastCloner — Vigia noturno — ${dia}${r.dryRun ? " (DRY-RUN: nada foi escrito)" : ""}`);
  lines.push("");

  lines.push("✅ Resolvido");
  // A espinha não corrige nada por design (resolvedora é Onda 2) — dizer isso
  // com todas as letras evita ler "0 corrigidos" como falha.
  lines.push("• nada corrigido nesta rodada (espinha ainda sem resolvedora — Onda 2)");
  lines.push("");

  lines.push("⚠️ Precisa de você");
  const needsHuman: string[] = [];
  for (const f of r.findings.slice(0, MAX_LISTED)) {
    needsHuman.push(`• [${f.table}] ${f.summary} (${f.ageHours.toFixed(1)}h preso${f.hasRecipe ? ", tem receita" : ""})`);
  }
  if (r.findings.length > MAX_LISTED) {
    needsHuman.push(`• … e mais ${r.findings.length - MAX_LISTED} item(ns) preso(s) (detalhe no /admin ou na resposta do endpoint)`);
  }
  for (const d of failures) {
    needsHuman.push(`• detector "${d.name}" FALHOU: ${d.error} — a tabela ${d.table} ficou SEM varredura esta noite`);
  }
  for (const d of anomalies) {
    needsHuman.push(`• 🚨 ANOMALIA no detector "${d.name}": ${d.anomaly}`);
  }
  if (truncated > 0) {
    needsHuman.push(`• teto por tabela cortou ${truncated} item(ns) do relatório — eles existem, só não estão listados`);
  }
  lines.push(...(needsHuman.length > 0 ? needsHuman : ["• nada precisa de você"]));
  lines.push("");

  const estado =
    r.detectors.length === 0
      ? "espinha no ar, 0 detectores registrados — varredura real começa quando os cards 2 e 6 plugarem"
      : `${r.detectors.length} detector(es) · ${checked} item(ns) checados · ${r.findings.length} preso(s) novo(s)` +
        (alreadySeen > 0 ? ` · ${alreadySeen} já conhecido(s)` : "") +
        (failures.length > 0 ? ` · ${failures.length} detector(es) com erro` : "");
  lines.push(`📈 Estado: ${estado}`);
  return lines.join("\n");
}

/**
 * Entrega o relatório por e-mail pro suporte@ (mesmo canal interno do
 * failure-alert; o mail-sweep/Frank leva ao Johnny). Best-effort e SÓ em modo
 * live — dry-run não toca o mundo externo. A resposta do endpoint carrega o
 * relatório de qualquer jeito: o e-mail é redundância, não o único canal.
 */
export async function deliverReport(r: NightWatchRunResult): Promise<boolean> {
  if (r.dryRun) return false;
  return sendEmail({
    to: SUPPORT_EMAIL,
    subject: `🌙 Vigia noturno — ${r.startedAt.slice(0, 10)} — ${r.findings.length} preso(s) novo(s)`,
    html: `<pre style="font-family:monospace;white-space:pre-wrap">${escapeHtml(r.report)}</pre>`,
  });
}
