"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Search, ChevronDown, KeyRound, Check, Copy } from "lucide-react";
import type { AdminUser } from "@/lib/admin/queries";

const num = (n: number) => n.toLocaleString("pt-BR");
const ONLINE_MS = 90_000;

function isOnline(u: AdminUser) {
  return !!u.last_seen_at && Date.now() - new Date(u.last_seen_at).getTime() < ONLINE_MS;
}

function rel(iso: string | null): string {
  if (!iso) return "nunca";
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "agora";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}min atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  return `${Math.floor(h / 24)}d atrás`;
}

function subStatus(u: AdminUser): { label: string; tone: string } {
  if (u.access_until && new Date(u.access_until).getTime() > Date.now()) {
    return { label: "Ativo", tone: "text-[var(--status-online)]" };
  }
  return { label: "Sem plano", tone: "text-[var(--ash)]" };
}

export default function UsuariosPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const res = await fetch("/api/v1/admin/users", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (alive && res.ok) setUsers(json.users ?? []);
      if (alive) setLoading(false);
    };
    load();
    const id = setInterval(load, 10_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const filtered = users.filter((u) =>
    `${u.email} ${u.display_name ?? ""}`.toLowerCase().includes(q.toLowerCase()),
  );
  const onlineCount = users.filter(isOnline).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-sans text-[26px] font-semibold tracking-[-0.03em] text-[var(--ink)]">Usuários</h1>
          <p className="mt-1 text-[14px] text-[var(--mute)]">
            {num(users.length)} no total ·{" "}
            <span className="text-[var(--status-online)]">{num(onlineCount)} online agora</span>
          </p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--ash)]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar e-mail ou nome…"
            className="h-10 w-[260px] rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] pl-9 pr-3 text-sm text-[var(--ink)] placeholder:text-[var(--ash)] focus-visible:border-[var(--hairline-bright)] focus-visible:outline-none"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--hairline-strong)]">
        <div className="hidden grid-cols-[1fr_110px_120px_110px_90px] gap-3 border-b border-[var(--hairline)] bg-[var(--surface-deep)] px-4 py-2.5 font-mono text-[10px] uppercase tracking-wider text-[var(--ash)] md:grid">
          <span>Usuário</span>
          <span>Último login</span>
          <span>Assinatura</span>
          <span className="text-right">Créditos</span>
          <span className="text-right">Vozes</span>
        </div>

        {loading ? (
          <div className="px-4 py-8 text-center font-mono text-[12px] text-[var(--ash)]">carregando…</div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-8 text-center font-mono text-[12px] text-[var(--ash)]">nenhum usuário</div>
        ) : (
          <ul>
            {filtered.map((u, i) => {
              const online = isOnline(u);
              const sub = subStatus(u);
              const isOpen = open === u.id;
              return (
                <li key={u.id} className={i > 0 ? "border-t border-[var(--hairline)]" : ""}>
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : u.id)}
                    className="grid w-full grid-cols-[1fr_auto] items-center gap-3 bg-[var(--surface-card)] px-4 py-3 text-left transition-colors hover:bg-[var(--surface-elevated)] md:grid-cols-[1fr_110px_120px_110px_90px]"
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span className="relative flex size-2 flex-none">
                        <span className={`inline-flex size-2 rounded-full ${online ? "bg-[var(--status-online)]" : "bg-[var(--hairline-bright)]"}`} />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] text-[var(--ink)]">{u.display_name || u.email}</span>
                        <span className="block truncate font-mono text-[10px] text-[var(--ash)]">{u.email}</span>
                      </span>
                    </span>
                    <span className="hidden font-mono text-[11px] text-[var(--mute)] md:block">{rel(u.last_sign_in_at)}</span>
                    <span className={`hidden text-[12px] font-medium md:block ${sub.tone}`}>{sub.label}</span>
                    <span className="hidden text-right font-mono text-[12px] tabular-nums text-[var(--body)] md:block">{num(u.credits)}</span>
                    <span className="flex items-center justify-end gap-2">
                      <span className="hidden text-right font-mono text-[12px] tabular-nums text-[var(--body)] md:block">{num(u.voices)}</span>
                      <ChevronDown className={`size-4 text-[var(--ash)] transition-transform ${isOpen ? "rotate-180" : ""}`} />
                    </span>
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
                        <div className="grid grid-cols-2 gap-4 px-4 py-4 sm:grid-cols-4">
                          <Detail label="Online" value={online ? "agora" : rel(u.last_seen_at)} />
                          <Detail label="Cadastro" value={new Date(u.created_at).toLocaleDateString("pt-BR")} />
                          <Detail label="Gerações" value={num(u.generations)} />
                          <Detail label="Vozes" value={num(u.voices)} />
                          <Detail label="Créditos" value={num(u.credits)} />
                          <Detail label="Acesso até" value={u.access_until ? new Date(u.access_until).toLocaleDateString("pt-BR") : "—"} />
                          <Detail label="Origem" value={u.access_source || "—"} />
                          <Detail label="Último login" value={rel(u.last_sign_in_at)} />
                        </div>
                        <RecoveryLink email={u.email} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Gera link de recuperação de senha pro suporte mandar por WhatsApp — casos
 * em que o e-mail do aluno não chega (webmail corporativo). Link vale ~1h. */
function RecoveryLink({ email }: { email: string }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function generate() {
    setState("loading");
    const res = await fetch("/api/v1/admin/users/recovery-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.link) {
      setLink(json.link);
      setState("done");
    } else {
      setState("error");
    }
  }

  async function copy() {
    if (!link) return;
    await navigator.clipboard.writeText(link).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="border-t border-[var(--hairline)] px-4 py-3">
      {state === "done" && link ? (
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-[var(--body)]">{link}</span>
          <button
            type="button"
            onClick={copy}
            className="inline-flex h-8 flex-none items-center gap-1.5 rounded-[var(--radius)] border border-[var(--hairline-strong)] px-3 font-mono text-[11px] text-[var(--ink)] transition-colors hover:bg-[var(--surface-elevated)]"
          >
            {copied ? <Check className="size-3.5 text-[var(--status-online)]" /> : <Copy className="size-3.5" />}
            {copied ? "copiado" : "copiar"}
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={generate}
            disabled={state === "loading"}
            className="inline-flex h-8 items-center gap-1.5 rounded-[var(--radius)] border border-[var(--hairline-strong)] px-3 font-mono text-[11px] text-[var(--ink)] transition-colors hover:bg-[var(--surface-elevated)] disabled:opacity-60"
          >
            <KeyRound className="size-3.5" />
            {state === "loading" ? "gerando…" : "Gerar link de acesso"}
          </button>
          <span className="text-[11px] text-[var(--ash)]">
            {state === "error"
              ? "falhou — tente de novo"
              : "cria senha nova sem depender de e-mail · vale 1h"}
          </span>
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--ash)]">{label}</span>
      <span className="text-[13px] text-[var(--ink)]">{value}</span>
    </div>
  );
}
