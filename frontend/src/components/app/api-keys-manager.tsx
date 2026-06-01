"use client";

/**
 * Gestão de API keys (Configurações → API). Gerar (mostra o segredo 1x),
 * listar (só prefixo + metadados) e revogar. Tudo via sessão do painel.
 */
import { useCallback, useEffect, useState } from "react";
import { KeyRound, Plus, Copy, Check, Trash2, AlertTriangle } from "lucide-react";

type ApiKey = {
  id: string;
  name: string;
  key_prefix: string;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

export function ApiKeysManager() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pendingRevoke, setPendingRevoke] = useState<ApiKey | null>(null);
  const [revoking, setRevoking] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/api-keys", { cache: "no-store" });
      if (!res.ok) throw new Error("Falha ao carregar chaves");
      const json = await res.json();
      setKeys((json.api_keys ?? []) as ApiKey[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function create() {
    setCreating(true);
    setError(null);
    setNewKey(null);
    try {
      const res = await fetch("/api/v1/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() || undefined }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error?.message || "Falha ao gerar chave");
      }
      const json = await res.json();
      setNewKey(json.api_key.key as string);
      setName("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setCreating(false);
    }
  }

  async function copyKey() {
    if (!newKey) return;
    try {
      await navigator.clipboard.writeText(newKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard pode falhar sem https; ignora */
    }
  }

  async function confirmRevoke() {
    if (!pendingRevoke) return;
    setRevoking(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/api-keys/${pendingRevoke.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error?.message || "Falha ao revogar");
      }
      setPendingRevoke(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setRevoking(false);
    }
  }

  const fmt = (s: string | null) =>
    s ? new Date(s).toLocaleString("pt-BR") : "—";

  return (
    <section className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <KeyRound className="h-5 w-5 text-accent" />
        <h2 className="font-display text-2xl uppercase tracking-tight text-fg">
          Chaves de API
        </h2>
      </div>
      <p className="text-sm text-muted-fg">
        Use uma chave pra gerar áudio por fora do site (cURL, n8n, scripts). A
        chave fica amarrada à sua conta e só acessa as suas vozes.
      </p>

      {/* Segredo recém-criado (aparece uma única vez) */}
      {newKey && (
        <div className="flex flex-col gap-2 border border-accent bg-accent/5 p-4">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">
            Copie agora — a chave não será mostrada de novo
          </span>
          <div className="flex items-center gap-2">
            <code className="flex-1 overflow-x-auto whitespace-nowrap border border-border bg-bg px-3 py-2 font-mono text-xs text-fg">
              {newKey}
            </code>
            <button
              type="button"
              onClick={copyKey}
              className="flex items-center gap-2 border border-accent px-3 py-2 text-xs font-bold uppercase tracking-wide text-accent transition-colors hover:bg-accent hover:text-accent-fg"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copiado" : "Copiar"}
            </button>
          </div>
        </div>
      )}

      {/* Gerar nova */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome da chave (ex: máquina n8n)"
          maxLength={60}
          className="flex-1 border border-border bg-bg px-3 py-3 text-sm text-fg placeholder:text-muted-fg/50 focus:border-accent focus:outline-none"
        />
        <button
          type="button"
          onClick={create}
          disabled={creating}
          className="flex items-center justify-center gap-2 bg-accent px-5 py-3 text-sm font-bold uppercase tracking-wide text-accent-fg transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40"
        >
          <Plus className="h-4 w-4" />
          {creating ? "Gerando…" : "Gerar chave"}
        </button>
      </div>

      {error && (
        <p
          role="alert"
          className="border border-accent/40 bg-accent/5 px-3 py-2 font-mono text-[11px] uppercase tracking-wide text-accent"
        >
          {error}
        </p>
      )}

      {/* Lista */}
      {loading ? (
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-fg">
          Carregando…
        </p>
      ) : keys.length === 0 ? (
        <p className="border border-dashed border-border bg-surface px-4 py-6 text-center text-sm text-muted-fg">
          Nenhuma chave ainda. Gere a primeira acima.
        </p>
      ) : (
        <ul className="flex flex-col gap-px bg-border">
          {keys.map((k) => {
            const revoked = !!k.revoked_at;
            return (
              <li
                key={k.id}
                className="flex flex-col gap-1 bg-bg px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-fg">{k.name}</span>
                    <code className="font-mono text-[11px] text-muted-fg">
                      {k.key_prefix}…
                    </code>
                    {revoked && (
                      <span className="border border-border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-fg">
                        revogada
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-fg">
                    criada {fmt(k.created_at)} · último uso {fmt(k.last_used_at)}
                  </span>
                </div>
                {!revoked && (
                  <button
                    type="button"
                    onClick={() => setPendingRevoke(k)}
                    aria-label="Revogar chave"
                    className="flex items-center gap-2 self-start border border-border px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-muted-fg transition-colors hover:border-accent hover:text-accent sm:self-center"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Revogar
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Confirmação de revogação */}
      {pendingRevoke && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => !revoking && setPendingRevoke(null)}
        >
          <div
            className="w-full max-w-md border border-accent bg-bg p-6 flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-accent" />
              <h3 className="font-display text-xl uppercase tracking-tight text-fg">
                Revogar “{pendingRevoke.name}”?
              </h3>
            </div>
            <p className="text-sm text-muted-fg">
              Quem estiver usando essa chave para de funcionar na hora. Ação{" "}
              <strong className="text-fg">irreversível</strong>.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => !revoking && setPendingRevoke(null)}
                className="border border-border px-5 py-3 text-sm font-bold uppercase tracking-wide text-fg transition-colors hover:bg-surface"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmRevoke}
                disabled={revoking}
                className="flex items-center gap-2 bg-accent px-5 py-3 text-sm font-bold uppercase tracking-wide text-accent-fg transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40"
              >
                <Trash2 className="h-4 w-4" />
                {revoking ? "Revogando…" : "Revogar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
