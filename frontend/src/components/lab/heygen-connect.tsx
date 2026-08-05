"use client";

/**
 * Conexão BYOK do HeyGen + galeria importada (Lab · Vídeo HeyGen).
 * - Sem conexão: campo pra colar a API key (com passo a passo de onde pegar).
 * - Conectado: saldo de API da conta + grupos de foto-avatar (só os do aluno)
 *   + desconectar. A key NUNCA volta do servidor (nem mascarada).
 */
import { useCallback, useEffect, useState } from "react";

type Account = {
  status: string;
  remaining_credits: number | null;
  last_validated_at: string | null;
  created_at: string;
} | null;

type Group = { id: string; name: string; preview_url: string | null; num_looks: number };

export function HeygenConnect() {
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [account, setAccount] = useState<Account>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadState = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const acc = await (await fetch("/api/v1/heygen/account")).json();
      setConnected(Boolean(acc?.data?.connected ?? acc?.connected));
      setAccount(acc?.data?.account ?? acc?.account ?? null);
      if (acc?.data?.connected ?? acc?.connected) {
        const av = await (await fetch("/api/v1/heygen/avatars")).json();
        setGroups(av?.data?.groups ?? av?.groups ?? []);
      } else {
        setGroups([]);
      }
    } catch {
      setError("Não foi possível carregar o estado da conexão.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  async function connect() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/heygen/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: apiKey.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? json?.message ?? "A chave não foi aceita.");
        return;
      }
      setApiKey("");
      await loadState();
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    if (!window.confirm("Desconectar sua conta HeyGen? A chave salva será apagada.")) return;
    setBusy(true);
    try {
      await fetch("/api/v1/heygen/account", { method: "DELETE" });
      await loadState();
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="text-[14px] text-[var(--mute)]">Carregando…</p>;
  }

  if (!connected) {
    return (
      <div className="max-w-xl rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--surface-card)] p-5">
        <h2 className="font-sans text-[16px] font-semibold text-[var(--ink)]">Conectar minha conta HeyGen</h2>
        <ol className="mt-3 list-decimal pl-5 text-[13.5px] leading-relaxed text-[var(--mute)]">
          <li>Entre em <span className="font-mono text-[12.5px]">app.heygen.com</span></li>
          <li>Vá em <strong>Settings → Subscriptions &amp; API</strong></li>
          <li>Na seção <strong>HeyGen API</strong>, copie o token e cole aqui:</li>
        </ol>
        <div className="mt-3 flex gap-2">
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Cole sua API key do HeyGen"
            className="min-w-0 flex-1 rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] px-3 py-2 font-mono text-[12.5px] text-[var(--ink)] placeholder:text-[var(--ash)]"
            autoComplete="off"
          />
          <button
            type="button"
            onClick={() => void connect()}
            disabled={busy || apiKey.trim().length < 20}
            className="rounded-[var(--radius-sm)] bg-[var(--ink)] px-4 py-2 text-[13px] font-semibold text-[var(--surface-deep)] disabled:opacity-40"
          >
            {busy ? "Validando…" : "Conectar"}
          </button>
        </div>
        {error && <p className="mt-2 text-[13px] text-[var(--danger,#e5484d)]">{error}</p>}
        <p className="mt-3 text-[12px] text-[var(--ash)]">
          A chave fica criptografada e nunca aparece de volta. Os vídeos gerados aqui consomem os
          créditos de API da sua conta HeyGen.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--surface-card)] px-4 py-3">
        <span className="inline-flex items-center gap-2 text-[13.5px] text-[var(--ink)]">
          <span className="size-2 rounded-full bg-emerald-500" aria-hidden />
          Conta HeyGen conectada
        </span>
        {typeof account?.remaining_credits === "number" && (
          <span className="font-mono text-[12px] text-[var(--mute)]">
            saldo de API: {account.remaining_credits.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} créditos
          </span>
        )}
        <button
          type="button"
          onClick={() => void disconnect()}
          disabled={busy}
          className="ml-auto text-[12.5px] text-[var(--mute)] underline underline-offset-2 hover:text-[var(--ink)]"
        >
          Desconectar
        </button>
      </div>

      <div>
        <h2 className="font-sans text-[16px] font-semibold text-[var(--ink)]">Seus avatares de foto</h2>
        <p className="mt-0.5 text-[13px] text-[var(--mute)]">
          Importados da sua conta — cada grupo é uma pessoa, com os looks que você criou lá.
        </p>
        {error && <p className="mt-2 text-[13px] text-[var(--danger,#e5484d)]">{error}</p>}
        {groups.length === 0 ? (
          <p className="mt-3 text-[13.5px] text-[var(--mute)]">
            Nenhum foto-avatar próprio encontrado nesta conta HeyGen.
          </p>
        ) : (
          <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {groups.map((g) => (
              <li
                key={g.id}
                className="overflow-hidden rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--surface-card)]"
              >
                {g.preview_url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- preview externo do HeyGen
                  <img src={g.preview_url} alt={g.name} className="aspect-square w-full object-cover" />
                ) : (
                  <div className="flex aspect-square w-full items-center justify-center bg-[var(--surface-deep)] text-[var(--ash)]">
                    sem prévia
                  </div>
                )}
                <div className="px-3 py-2">
                  <p className="truncate text-[13.5px] font-medium text-[var(--ink)]">{g.name}</p>
                  <p className="text-[12px] text-[var(--mute)]">{g.num_looks} looks</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-[12px] text-[var(--ash)]">
        Próximo passo (em construção): escolher um look + um áudio da sua voz clonada e gerar o
        vídeo Avatar IV daqui — a geração consome os créditos da sua conta HeyGen.
      </p>
    </div>
  );
}
