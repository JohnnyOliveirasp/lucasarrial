"use client";

/**
 * Gestão de API keys (Configurações → API). Gerar (mostra o segredo 1x),
 * listar (só prefixo + metadados) e revogar. Tudo via sessão do painel.
 */
import { useCallback, useEffect, useState } from "react";
import { KeyRound, Plus, Copy, Check, Trash2, AlertTriangle } from "lucide-react";
import { Button, Input, Badge } from "@/components/ui";

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
    <section className="flex flex-col gap-6">
      <div className="flex items-center gap-2.5">
        <KeyRound className="h-5 w-5 text-[var(--silver)]" />
        <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-[var(--ink)]">
          Chaves de API
        </h2>
      </div>
      <p className="text-[14px] leading-relaxed text-[var(--mute)]">
        Use uma chave pra gerar áudio por fora do site (cURL, n8n, scripts). A
        chave fica amarrada à sua conta e só acessa as suas vozes.
      </p>

      {/* Segredo recém-criado (aparece uma única vez) */}
      {newKey && (
        <div className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--hairline-bright)] bg-[var(--surface-elevated)] p-4">
          <span className="text-[13px] text-[var(--silver)]">
            Copie agora — a chave não será mostrada de novo
          </span>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] px-3 py-2.5 font-mono text-[13px] text-[var(--silver)]">
              {newKey}
            </code>
            <Button
              variant="secondary"
              onClick={copyKey}
              iconLeft={
                copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />
              }
            >
              {copied ? "Copiado" : "Copiar"}
            </Button>
          </div>
        </div>
      )}

      {/* Gerar nova */}
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <Input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome da chave (ex: máquina n8n)"
          maxLength={60}
          iconLeft={<KeyRound className="h-4 w-4" />}
          className="sm:flex-1"
        />
        <Button
          variant="primary"
          onClick={create}
          disabled={creating}
          iconLeft={<Plus className="h-4 w-4" />}
          className="shrink-0"
        >
          {creating ? "Gerando…" : "Gerar chave"}
        </Button>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-[var(--radius)] border border-[var(--hairline-strong)] px-3 py-2.5 text-[13px] text-[var(--status-error)]"
        >
          {error}
        </p>
      )}

      {/* Lista */}
      {loading ? (
        <p className="text-[13px] text-[var(--ash)]">Carregando…</p>
      ) : keys.length === 0 ? (
        <p className="rounded-[var(--radius-lg)] border border-dashed border-[var(--hairline-strong)] bg-[var(--surface-card)] px-4 py-7 text-center text-[14px] text-[var(--mute)]">
          Nenhuma chave ainda. Gere a primeira acima.
        </p>
      ) : (
        <ul className="flex flex-col rounded-[var(--radius-lg)] border border-[var(--hairline-strong)]">
          {keys.map((k, i) => {
            const revoked = !!k.revoked_at;
            return (
              <li
                key={k.id}
                className={`flex flex-col gap-2 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between ${
                  i > 0 ? "border-t border-[var(--hairline)]" : ""
                }`}
              >
                <div className="flex flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[14px] font-medium text-[var(--ink)]">
                      {k.name}
                    </span>
                    <code className="font-mono text-[13px] text-[var(--ash)]">
                      {k.key_prefix}…
                    </code>
                    {revoked && (
                      <Badge variant="soft" className="text-[var(--ash)]">
                        revogada
                      </Badge>
                    )}
                  </div>
                  <span className="text-[12px] text-[var(--ash)]">
                    criada {fmt(k.created_at)} · último uso {fmt(k.last_used_at)}
                  </span>
                </div>
                {!revoked && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPendingRevoke(k)}
                    aria-label="Revogar chave"
                    iconLeft={<Trash2 className="h-3.5 w-3.5" />}
                    className="self-start text-[var(--mute)] hover:text-[var(--status-error)] sm:self-center"
                  >
                    Revogar
                  </Button>
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
            className="flex w-full max-w-md flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="h-5 w-5 text-[var(--status-error)]" />
              <h3 className="text-[20px] font-semibold tracking-[-0.02em] text-[var(--ink)]">
                Revogar “{pendingRevoke.name}”?
              </h3>
            </div>
            <p className="text-[14px] leading-relaxed text-[var(--mute)]">
              Quem estiver usando essa chave para de funcionar na hora. Ação{" "}
              <strong className="font-medium text-[var(--ink)]">irreversível</strong>.
            </p>
            <div className="flex justify-end gap-3">
              <Button
                variant="ghost"
                onClick={() => !revoking && setPendingRevoke(null)}
              >
                Cancelar
              </Button>
              <Button
                variant="secondary"
                onClick={confirmRevoke}
                disabled={revoking}
                iconLeft={<Trash2 className="h-4 w-4" />}
                className="text-[var(--status-error)] hover:border-[var(--status-error)]"
              >
                {revoking ? "Revogando…" : "Revogar"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
