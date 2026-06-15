"use client";

import { useCallback, useEffect, useState } from "react";
import { Trash2, Plus, ShieldCheck } from "lucide-react";

type Admin = {
  id: string;
  email: string;
  added_by: string | null;
  created_at: string;
};

const INPUT =
  "h-10 flex-1 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] px-3 text-sm text-[var(--ink)] placeholder:text-[var(--ash)] focus-visible:border-[var(--hairline-bright)] focus-visible:outline-none";
const PILL =
  "inline-flex h-10 items-center justify-center gap-2 rounded-[var(--radius)] bg-[var(--pill-bg)] px-4 font-sans text-[14px] font-medium tracking-[-0.01em] text-[var(--pill-ink)] transition-[background-color,transform] duration-[var(--dur-base)] ease-[var(--ease-out)] hover:bg-white active:scale-[0.98] disabled:opacity-[0.42] disabled:pointer-events-none";

export default function AdminsPage() {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/v1/admin/admins");
    const json = await res.json().catch(() => ({}));
    if (res.ok) setAdmins(json.admins ?? []);
    else setError(json?.error?.message || "Falha ao carregar");
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/v1/admin/admins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim() }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok) {
      setEmail("");
      await load();
    } else {
      setError(json?.error?.message || "Falha ao adicionar");
    }
    setBusy(false);
  }

  async function remove(id: string, addr: string) {
    if (!confirm(`Remover ${addr} dos admins?`)) return;
    setError(null);
    const res = await fetch(`/api/v1/admin/admins/${id}`, { method: "DELETE" });
    const json = await res.json().catch(() => ({}));
    if (res.ok) await load();
    else setError(json?.error?.message || "Falha ao remover");
  }

  return (
    <div className="flex max-w-[760px] flex-col gap-8">
      <div>
        <h1 className="font-sans text-[26px] font-semibold tracking-[-0.03em] text-[var(--ink)]">
          Admins
        </h1>
        <p className="mt-1 text-[14px] text-[var(--mute)]">
          Quem pode acessar o painel <code className="text-[var(--silver)]">/admin</code>.
          Adicione ou remova a qualquer momento.
        </p>
      </div>

      <form onSubmit={add} className="flex items-center gap-3">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="novo-admin@exemplo.com"
          className={INPUT}
        />
        <button type="submit" disabled={busy || !email.trim()} className={PILL}>
          <Plus className="size-4" />
          Adicionar
        </button>
      </form>

      {error && (
        <p
          role="alert"
          className="rounded-[var(--radius)] border border-[var(--status-error)]/40 bg-[var(--surface-card)] px-3 py-2 font-mono text-[11px] tracking-wide text-[var(--status-error)]"
        >
          {error}
        </p>
      )}

      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--hairline-strong)]">
        {loading ? (
          <div className="px-5 py-8 text-center font-mono text-[12px] text-[var(--ash)]">
            carregando…
          </div>
        ) : admins.length === 0 ? (
          <div className="px-5 py-8 text-center font-mono text-[12px] text-[var(--ash)]">
            nenhum admin
          </div>
        ) : (
          <ul>
            {admins.map((a, i) => (
              <li
                key={a.id}
                className={`flex items-center gap-3 bg-[var(--surface-card)] px-5 py-3.5 ${
                  i > 0 ? "border-t border-[var(--hairline)]" : ""
                }`}
              >
                <ShieldCheck className="size-4 flex-none text-[var(--silver)]" />
                <span className="flex-1 truncate text-sm text-[var(--ink)]">{a.email}</span>
                <span className="hidden font-mono text-[10px] tracking-wide text-[var(--ash)] sm:inline">
                  {new Date(a.created_at).toLocaleDateString("pt-BR")}
                </span>
                <button
                  type="button"
                  onClick={() => remove(a.id, a.email)}
                  className="text-[var(--mute)] transition-colors hover:text-[var(--status-error)]"
                  aria-label={`Remover ${a.email}`}
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
