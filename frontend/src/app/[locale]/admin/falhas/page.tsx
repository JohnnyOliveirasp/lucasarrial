"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, CheckCircle2, ChevronDown, Plus } from "lucide-react";
import { CAUSE_LABELS, KIND_LABELS, type IncidentCause } from "@/lib/incidents/classify";
import { alunoRespondido, motivoDefeitoVivo, type NotaIncidente } from "@/lib/incidents/baixa";
import type { IncidentStatus } from "@/lib/incidents/status";

type AgentNote = NotaIncidente;
type Incident = {
  id: string;
  /** tecnico = tem ação NOSSA que resolve · atendimento = precisa de pessoa (mig 93). */
  categoria: "tecnico" | "atendimento";
  /** Número curto do chamado (mig 87) — é por ele que as pessoas se referem
   *  ao caso ("olha o #85"), e não pelo uuid. */
  numero: number | null;
  kind: string;
  cause: IncidentCause;
  status: IncidentStatus;
  title: string;
  occurrences: number;
  affected_emails: string[];
  sample_error: string | null;
  description: string | null;
  reported_by: string | null;
  first_seen_at: string;
  last_seen_at: string;
  resolution_note: string | null;
  resolved_commit: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  agent_notes: AgentNote[];
};

const STATUS_META: Record<Incident["status"], { label: string; cls: string }> = {
  open: { label: "Aberto", cls: "text-[var(--status-error)]" },
  investigating: { label: "Investigando (agente)", cls: "text-amber-400" },
  fixing: { label: "Corrigindo", cls: "text-amber-400" },
  // A bola está com o ALUNO. Regra do Johnny (24/08): "se já mandou pro aluno
  // e está esperando resposta dele, não é mais caso aberto". Sai dos Ativos,
  // mas NÃO vira "corrigido" — não foi resolvido, está em espera. Volta
  // sozinho pra "Aberto" quando o aluno responder (lib/incidents/espera.ts).
  aguardando_aluno: { label: "Aguardando o aluno", cls: "text-sky-400" },
  // "Depende do time de suporte" (pedido do Lucas, 04/09). CONTINUA em aberto
  // de propósito: é uma gaveta pro time se organizar, não uma forma de sumir
  // com o caso — some da tela só o que foi fechado ou está com o aluno.
  suporte_necessario: { label: "Suporte necessário", cls: "text-violet-400" },
  fixed: { label: "Corrigido", cls: "text-[var(--status-online)]" },
  ignored: { label: "Ignorado", cls: "text-[var(--ash)]" },
};

/**
 * Duas filas, pedido do Johnny (24/08): *"senão fica na tela um monte de
 * chamado aberto e fica difícil saber o que é o quê"*.
 *
 * TÉCNICOS = tem ação nossa e a gente executa (retreinar voz, refazer imagem,
 * reprocessar, corrigir bug). É a fila de correção.
 * ATENDIMENTO = reclamação do produto, dúvida, pré-venda, espera de resposta.
 * Precisa de PESSOA falando com o aluno.
 */
const FILTERS = [
  { key: "tecnicos", label: "Técnicos" },
  { key: "atendimento", label: "Atendimento" },
  { key: "aguardando_aluno", label: "Aguardando o aluno" },
  { key: "suporte_necessario", label: "Suporte necessário" },
  { key: "fixed", label: "Corrigidos" },
  { key: "all", label: "Todos" },
] as const;

/** Em aberto de verdade: nem resolvido, nem esperando o aluno. */
const emAberto = (i: Incident) =>
  i.status !== "fixed" && i.status !== "ignored" && i.status !== "aguardando_aluno";

const dt = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export default function FalhasPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("tecnicos");
  const [open, setOpen] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);
  /** Papel de quem está olhando — só o admin pode forçar um fechamento travado. */
  const [role, setRole] = useState<"admin" | "suporte" | null>(null);

  async function load() {
    const res = await fetch("/api/v1/admin/incidents", { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    if (res.ok) {
      setIncidents(json.incidents ?? []);
      setRole(json.role ?? null);
    }
    setLoading(false);
  }
  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, []);

  async function setStatus(id: string, status: Incident["status"], force = false) {
    let resolution_note: string | undefined;
    if (status === "fixed") {
      resolution_note = window.prompt("Nota da correção (ex.: fix no commit abc1234):") ?? undefined;
      if (resolution_note === undefined) return;
    }
    const res = await fetch(`/api/v1/admin/incidents/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, resolution_note, ...(force ? { force: true } : {}) }),
    });
    // 409 = a trava do defeito vivo. O motivo vem escrito da rota; mostrar ele
    // é o ponto: silêncio faria a pessoa achar que o painel quebrou.
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      window.alert(json?.error?.message ?? "Não foi possível mudar o status.");
    }
    load();
  }

  /** A parte HUMANA está feita. Não muda status, não fecha, não esconde. */
  async function marcarAlunoRespondido(id: string) {
    const nota = window.prompt(
      "Já falou com o aluno. Quer anotar alguma coisa? (opcional — pode deixar em branco)",
    );
    if (nota === null) return;
    await fetch(`/api/v1/admin/incidents/${id}/aluno-respondido`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nota }),
    });
    load();
  }

  async function desfazerAlunoRespondido(id: string) {
    if (!window.confirm("Desfazer a baixa? O chamado volta pra fila de atendimento.")) return;
    await fetch(`/api/v1/admin/incidents/${id}/aluno-respondido`, { method: "DELETE" });
    load();
  }

  const shown = useMemo(() => {
    if (filter === "tecnicos") return incidents.filter((i) => emAberto(i) && i.categoria === "tecnico");
    // A baixa "aluno respondido" tira da fila de ATENDIMENTO — e só dela. Um
    // caso técnico continua na fila técnica: responder o aluno não conserta o
    // defeito, e é exatamente essa confusão que o pedido do Lucas separa.
    if (filter === "atendimento")
      return incidents.filter((i) => emAberto(i) && i.categoria === "atendimento" && !alunoRespondido(i));
    if (filter === "aguardando_aluno") return incidents.filter((i) => i.status === "aguardando_aluno");
    if (filter === "suporte_necessario") return incidents.filter((i) => i.status === "suporte_necessario");
    if (filter === "fixed") return incidents.filter((i) => i.status === "fixed");
    return incidents;
  }, [incidents, filter]);

  const active = incidents.filter((i) => i.status !== "fixed" && i.status !== "ignored");
  const today = new Date().toDateString();
  const todayHits = incidents.filter((i) => new Date(i.last_seen_at).toDateString() === today);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-sans text-[26px] font-semibold tracking-[-0.03em] text-[var(--ink)]">Falhas</h1>
          <p className="mt-1 text-[14px] text-[var(--mute)]">
            Incidentes agrupados por causa · atualiza a cada 30s
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowReport(true)}
          className="inline-flex h-10 items-center gap-2 rounded-[var(--radius)] bg-[var(--pill-bg)] px-4 text-[13px] font-medium text-[var(--pill-ink)] transition-colors hover:bg-white"
        >
          <Plus className="size-4" /> Reportar erro
        </button>
      </div>

      {/* Banner de situação */}
      <div
        className={`flex items-center gap-3 rounded-[var(--radius-lg)] border px-4 py-3.5 ${
          active.length
            ? "border-[var(--status-error)]/40 bg-[var(--status-error)]/5"
            : "border-[var(--status-online)]/30 bg-[var(--status-online)]/5"
        }`}
      >
        {active.length ? (
          <AlertTriangle className="size-5 text-[var(--status-error)]" />
        ) : (
          <CheckCircle2 className="size-5 text-[var(--status-online)]" />
        )}
        <span className="text-[14px] text-[var(--ink)]">
          {active.length
            ? `${active.length} incidente(s) precisando de atenção · ${todayHits.length} com atividade hoje`
            : "Sistema sem falhas em aberto ✅"}
        </span>
      </div>

      <div className="flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`h-8 rounded-full border px-3.5 font-mono text-[11px] transition-colors ${
              filter === f.key
                ? "border-[var(--hairline-bright)] bg-[var(--surface-elevated)] text-[var(--ink)]"
                : "border-[var(--hairline-strong)] text-[var(--mute)] hover:text-[var(--ink)]"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--hairline-strong)]">
        {loading ? (
          <div className="px-4 py-8 text-center font-mono text-[12px] text-[var(--ash)]">carregando…</div>
        ) : shown.length === 0 ? (
          <div className="px-4 py-8 text-center font-mono text-[12px] text-[var(--ash)]">nenhum incidente</div>
        ) : (
          <ul>
            {shown.map((inc, i) => {
              const isOpen = open === inc.id;
              const meta = STATUS_META[inc.status] ?? { label: inc.status, cls: "text-[var(--ash)]" };
              return (
                <li key={inc.id} className={i > 0 ? "border-t border-[var(--hairline)]" : ""}>
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : inc.id)}
                    className="grid w-full grid-cols-[1fr_auto] items-center gap-3 bg-[var(--surface-card)] px-4 py-3 text-left transition-colors hover:bg-[var(--surface-elevated)] md:grid-cols-[1fr_150px_130px_120px_70px_24px]"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] text-[var(--ink)]">
                        {inc.numero != null && (
                          <span className="mr-1.5 font-mono text-[11px] text-[var(--mute)]">#{inc.numero}</span>
                        )}
                        {inc.title}
                      </span>
                      <span className="block truncate font-mono text-[10px] text-[var(--ash)]">
                        {KIND_LABELS[inc.kind] ?? inc.kind} · {CAUSE_LABELS[inc.cause] ?? inc.cause}
                        {inc.affected_emails.length > 0 && ` · ${inc.affected_emails.length} usuário(s)`}
                        {/* A baixa aparece na LINHA, sem precisar abrir: quem varre a
                            fila tem que enxergar o que já foi atendido de relance. */}
                        {alunoRespondido(inc) && (
                          <span className="text-[var(--status-online)]"> · ✅ aluno respondido</span>
                        )}
                      </span>
                    </span>
                    <span className={`hidden text-[12px] font-medium md:block ${meta.cls}`}>{meta.label}</span>
                    <span className="hidden font-mono text-[11px] text-[var(--mute)] md:block">
                      último: {dt(inc.last_seen_at)}
                    </span>
                    <span className="hidden font-mono text-[11px] text-[var(--mute)] md:block">
                      1º: {dt(inc.first_seen_at)}
                    </span>
                    <span className="hidden text-right font-mono text-[12px] tabular-nums text-[var(--body)] md:block">
                      {inc.occurrences}×
                    </span>
                    <ChevronDown className={`size-4 text-[var(--ash)] transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </button>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22, ease: "easeOut" }}
                        className="overflow-hidden bg-[var(--surface-deep)]"
                      >
                        <div className="flex flex-col gap-3 px-4 py-4">
                          {inc.description && (
                            <p className="text-[13px] text-[var(--body)]">{inc.description}</p>
                          )}
                          {inc.sample_error && (
                            <pre className="overflow-x-auto rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--surface-card)] p-3 font-mono text-[11px] leading-relaxed text-[var(--mute)]">
                              {inc.sample_error}
                            </pre>
                          )}
                          {inc.affected_emails.length > 0 && (
                            <p className="font-mono text-[11px] text-[var(--ash)]">
                              afetados: {inc.affected_emails.join(", ")}
                            </p>
                          )}
                          {(inc.agent_notes ?? []).length > 0 && (
                            <div className="flex flex-col gap-1.5">
                              {inc.agent_notes.map((n, ni) => (
                                <p key={ni} className="text-[12px] text-[var(--body)]">
                                  <span className="font-mono text-[10px] text-[var(--ash)]">
                                    {dt(n.at)} · {n.by === "agent" ? "🤖 agente" : n.by}:
                                  </span>{" "}
                                  {n.note}
                                </p>
                              ))}
                            </div>
                          )}
                          {inc.status === "fixed" && (
                            <p className="text-[12px] text-[var(--status-online)]">
                              ✅ Corrigido {inc.resolved_at ? dt(inc.resolved_at) : ""} por {inc.resolved_by ?? "?"}
                              {inc.resolution_note && ` — ${inc.resolution_note}`}
                              {inc.resolved_commit && ` (${inc.resolved_commit})`}
                            </p>
                          )}
                          <Baixa
                            inc={inc}
                            role={role}
                            setStatus={setStatus}
                            marcarAlunoRespondido={marcarAlunoRespondido}
                            desfazerAlunoRespondido={desfazerAlunoRespondido}
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {showReport && <ReportModal onClose={() => setShowReport(false)} onDone={load} />}
    </div>
  );
}

function ActionBtn({
  children,
  onClick,
  disabled,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="inline-flex h-8 items-center rounded-[var(--radius)] border border-[var(--hairline-strong)] px-3 font-mono text-[11px] text-[var(--ink)] transition-colors hover:bg-[var(--surface-elevated)] disabled:cursor-not-allowed disabled:border-[var(--hairline)] disabled:text-[var(--ash)] disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}

/**
 * A BAIXA do chamado — o pedido do Lucas (04/09): o painel tem que funcionar
 * como CRM, com botão pro time dar baixa, sem que dar baixa vire mentira.
 *
 * DUAS COISAS SEPARADAS, que antes eram um botão só:
 *  · "Aluno respondido" — a parte humana está feita. Qualquer um do time
 *    marca, não muda status, não fecha nada. Tira da fila de ATENDIMENTO.
 *  · "Marcar corrigido" — o DEFEITO acabou. Fica DESABILITADO (com o porquê
 *    escrito ao lado, não escondido) enquanto o defeito estiver vivo: mais de
 *    50 ocorrências ou mais de 5 alunos. Ver @/lib/incidents/baixa.
 *
 * O botão travado continua VISÍVEL de propósito. Time que não entende por que
 * não pode, contorna — manda e-mail, mexe no banco, marca outra coisa errada.
 */
function Baixa({
  inc,
  role,
  setStatus,
  marcarAlunoRespondido,
  desfazerAlunoRespondido,
}: {
  inc: Incident;
  role: "admin" | "suporte" | null;
  setStatus: (id: string, status: Incident["status"], force?: boolean) => void;
  marcarAlunoRespondido: (id: string) => void;
  desfazerAlunoRespondido: (id: string) => void;
}) {
  const baixa = alunoRespondido(inc);
  const motivo = motivoDefeitoVivo(inc);
  const fechado = inc.status === "fixed" || inc.status === "ignored";
  // O admin não fica preso: ele vê o mesmo aviso, confirma, e a rota aceita o
  // `force`. Pro suporte o botão simplesmente não clica.
  const podeForcar = role === "admin";

  function fechar(status: Incident["status"]) {
    if (motivo && podeForcar) {
      if (!window.confirm(`${motivo}\n\nTem certeza que quer fechar assim mesmo?`)) return;
      setStatus(inc.id, status, true);
      return;
    }
    setStatus(inc.id, status);
  }

  return (
    <div className="flex flex-col gap-2">
      {baixa && (
        <p className="text-[12px] text-[var(--status-online)]">
          ✅ Aluno já respondido em {dt(baixa.at)} por {baixa.by}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {!fechado &&
          (baixa ? (
            <ActionBtn onClick={() => desfazerAlunoRespondido(inc.id)}>
              Desfazer &quot;aluno respondido&quot;
            </ActionBtn>
          ) : (
            <ActionBtn onClick={() => marcarAlunoRespondido(inc.id)}>✓ Aluno respondido</ActionBtn>
          ))}
        {!fechado && inc.status !== "suporte_necessario" && (
          <ActionBtn onClick={() => setStatus(inc.id, "suporte_necessario")}>
            Precisa do suporte
          </ActionBtn>
        )}
        {inc.status === "suporte_necessario" && (
          <ActionBtn onClick={() => setStatus(inc.id, "open")}>Tirar de &quot;suporte&quot;</ActionBtn>
        )}
        {inc.status !== "fixed" && (
          <ActionBtn
            onClick={() => fechar("fixed")}
            disabled={Boolean(motivo) && !podeForcar}
            title={motivo ?? undefined}
          >
            ✓ Marcar corrigido
          </ActionBtn>
        )}
        {!fechado && (
          <ActionBtn
            onClick={() => fechar("ignored")}
            disabled={Boolean(motivo) && !podeForcar}
            title={motivo ?? undefined}
          >
            Ignorar
          </ActionBtn>
        )}
        {fechado && <ActionBtn onClick={() => setStatus(inc.id, "open")}>Reabrir</ActionBtn>}
      </div>
      {motivo && inc.status !== "fixed" && (
        <p className="text-[12px] leading-relaxed text-amber-400">
          ⚠️ {motivo}
          {podeForcar && (
            <span className="text-[var(--ash)]">
              {" "}
              (você é admin: dá pra forçar, e o painel vai pedir confirmação)
            </span>
          )}
        </p>
      )}
    </div>
  );
}

/** Reporte manual: descrição + anexo (print/áudio) → vira incidente 'reported'
 * que o agente de monitoramento prioriza na próxima rodada. */
function ReportModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [email, setEmail] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!title.trim()) return;
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.append("title", title);
    form.append("description", description);
    form.append("email", email);
    if (file) form.append("file", file);
    const res = await fetch("/api/v1/admin/incidents", { method: "POST", body: form });
    if (res.ok) {
      onDone();
      onClose();
    } else {
      const json = await res.json().catch(() => ({}));
      setError(json?.error?.message || "Falha ao reportar");
      setBusy(false);
    }
  }

  const input =
    "h-10 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] px-3 text-[13px] text-[var(--ink)] placeholder:text-[var(--ash)] focus-visible:border-[var(--hairline-bright)] focus-visible:outline-none";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="flex w-full max-w-[480px] flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-[16px] font-semibold text-[var(--ink)]">Reportar erro</h2>
        <input className={input} placeholder="Resumo do erro (obrigatório)" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea
          className={`${input} h-24 resize-none py-2`}
          placeholder="Descrição: o que a pessoa fez, o que aconteceu, mensagem que apareceu…"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <input className={input} placeholder="E-mail do usuário afetado (opcional)" value={email} onChange={(e) => setEmail(e.target.value)} />
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[11px] text-[var(--ash)]">Anexo (print ou áudio, até 8MB — opcional)</span>
          <input type="file" accept="image/*,audio/*,.txt,.log" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-[12px] text-[var(--mute)]" />
        </label>
        {error && <p className="text-[12px] text-[var(--status-error)]">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="h-10 rounded-[var(--radius)] px-4 font-mono text-[12px] text-[var(--mute)] hover:text-[var(--ink)]">
            Cancelar
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy || !title.trim()}
            className="h-10 rounded-[var(--radius)] bg-[var(--pill-bg)] px-4 text-[13px] font-medium text-[var(--pill-ink)] transition-colors hover:bg-white disabled:opacity-60"
          >
            {busy ? "Enviando…" : "Enviar pro agente"}
          </button>
        </div>
      </div>
    </div>
  );
}
