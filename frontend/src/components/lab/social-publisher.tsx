"use client";

/**
 * Publicador (Lab · admin-only) — conectar Instagram + publicar/agendar.
 * - Sem conta: botão "Conectar Instagram" (OAuth Instagram Login; exige
 *   conta Profissional). O callback volta pra cá com ?connected=1|?error=.
 * - Conectado: formulário (URL do vídeo/imagem + legenda + agendar) e a
 *   lista de publicações com poll enquanto houver processing.
 */
import { useCallback, useEffect, useRef, useState } from "react";

type Account = {
  id: string;
  platform: string;
  username: string | null;
  status: string;
  token_expires_at: string | null;
  connected_at: string;
};
type Publication = {
  id: string;
  media_type: string;
  media_url: string;
  caption: string | null;
  scheduled_at: string | null;
  status: string;
  platform_post_id: string | null;
  error: string | null;
  created_at: string;
};

const STATUS_LABEL: Record<string, string> = {
  ready: "⏳ agendada",
  processing: "⚙️ processando no Instagram",
  published: "✅ publicada",
  failed: "❌ falhou",
};

export function SocialPublisher() {
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [pubs, setPubs] = useState<Publication[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [accountId, setAccountId] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaType, setMediaType] = useState("reel");
  const [caption, setCaption] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const [accRes, pubRes] = await Promise.all([
        fetch("/api/v1/social/accounts"),
        fetch("/api/v1/social/publish"),
      ]);
      const acc = await accRes.json();
      const pub = await pubRes.json();
      const accList: Account[] = acc?.data?.accounts ?? acc?.accounts ?? [];
      setAccounts(accList);
      setPubs(pub?.data?.publications ?? pub?.publications ?? []);
      setAccountId((cur) => cur || accList.find((a) => a.status === "active")?.id || "");
    } catch {
      setError("Não foi possível carregar o publicador.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    // feedback do callback do OAuth
    const q = new URLSearchParams(window.location.search);
    if (q.get("connected")) setNotice(`Conta @${q.get("username") ?? ""} conectada! 🎉`);
    if (q.get("error")) {
      setError(
        q.get("detail") ||
          (q.get("error") === "denied"
            ? "Você cancelou a autorização no Instagram."
            : "Não foi possível conectar. Tente de novo."),
      );
    }
    if (q.get("connected") || q.get("error")) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [load]);

  // poll enquanto tem publicação em voo
  useEffect(() => {
    const inFlight = pubs.some((p) => p.status === "processing" || p.status === "ready");
    if (inFlight && !pollRef.current) {
      pollRef.current = setInterval(() => void load(), 5000);
    }
    if (!inFlight && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [pubs, load]);

  async function connect() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/social/instagram/connect");
      const json = await res.json();
      const url = json?.data?.url ?? json?.url;
      if (!res.ok || !url) {
        setError("Não foi possível iniciar a conexão com o Instagram.");
        return;
      }
      window.location.href = url;
    } finally {
      setBusy(false);
    }
  }

  async function disconnect(id: string) {
    if (!window.confirm("Desconectar esta conta do Instagram?")) return;
    await fetch(`/api/v1/social/accounts?id=${id}`, { method: "DELETE" });
    await load();
  }

  async function publish() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/v1/social/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_id: accountId,
          media_url: mediaUrl.trim(),
          media_type: mediaType,
          caption: caption.trim() || undefined,
          scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? json?.message ?? "Não foi possível publicar.");
        return;
      }
      setMediaUrl("");
      setCaption("");
      setScheduledAt("");
      setNotice(scheduledAt ? "Publicação agendada! 📅" : "Enviado pro Instagram — processando… ⚙️");
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="text-[14px] text-[var(--mute)]">Carregando…</p>;

  const activeAccounts = accounts.filter((a) => a.status === "active");

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      {notice && <p className="text-[13.5px] text-[var(--ink)]">{notice}</p>}
      {error && <p className="text-[13.5px] text-[var(--danger,#e5484d)]">{error}</p>}

      {/* contas */}
      <div className="rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--surface-card)] p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-sans text-[16px] font-semibold text-[var(--ink)]">Contas conectadas</h2>
          <button
            type="button"
            onClick={() => void connect()}
            disabled={busy}
            className="rounded-[var(--radius-sm)] bg-[var(--ink)] px-4 py-2 text-[13px] font-semibold text-[var(--surface-deep)] disabled:opacity-40"
          >
            Conectar Instagram
          </button>
        </div>
        {accounts.length === 0 ? (
          <p className="mt-3 text-[13.5px] text-[var(--mute)]">
            Nenhuma conta ainda. Conecte um Instagram <strong>Profissional</strong> (Criador ou
            Comercial — a troca é grátis nas configurações do app do Instagram).
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {accounts.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-[var(--hairline)] px-3 py-2"
              >
                <span className="text-[13.5px] text-[var(--ink)]">
                  @{a.username ?? a.id}{" "}
                  <span className="text-[12px] text-[var(--ash)]">
                    {a.status === "active" ? "· conectada" : "· ⚠️ reconectar"}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => void disconnect(a.id)}
                  className="text-[12px] text-[var(--ash)] underline-offset-2 hover:underline"
                >
                  desconectar
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* publicar */}
      {activeAccounts.length > 0 && (
        <div className="rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--surface-card)] p-5">
          <h2 className="font-sans text-[16px] font-semibold text-[var(--ink)]">Publicar</h2>
          <div className="mt-3 flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] px-3 py-2 text-[13px] text-[var(--ink)]"
              >
                {activeAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    @{a.username ?? a.id}
                  </option>
                ))}
              </select>
              <select
                value={mediaType}
                onChange={(e) => setMediaType(e.target.value)}
                className="rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] px-3 py-2 text-[13px] text-[var(--ink)]"
              >
                <option value="reel">Reel (vídeo)</option>
                <option value="image">Foto (feed)</option>
                <option value="story">Story (vídeo)</option>
              </select>
            </div>
            <input
              type="url"
              value={mediaUrl}
              onChange={(e) => setMediaUrl(e.target.value)}
              placeholder="URL https pública do vídeo/imagem (MP4 com +faststart)"
              className="rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] px-3 py-2 font-mono text-[12.5px] text-[var(--ink)] placeholder:text-[var(--ash)]"
            />
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Legenda (opcional, até 2.200 caracteres)"
              rows={3}
              maxLength={2200}
              className="rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] px-3 py-2 text-[13px] text-[var(--ink)] placeholder:text-[var(--ash)]"
            />
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-[12.5px] text-[var(--mute)]">
                Agendar pra:
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] px-2 py-1.5 text-[12.5px] text-[var(--ink)]"
                />
              </label>
              <button
                type="button"
                onClick={() => void publish()}
                disabled={busy || !mediaUrl.trim() || !accountId}
                className="ml-auto rounded-[var(--radius-sm)] bg-[var(--ink)] px-5 py-2 text-[13px] font-semibold text-[var(--surface-deep)] disabled:opacity-40"
              >
                {busy ? "Enviando…" : scheduledAt ? "Agendar" : "Publicar agora"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* histórico */}
      {pubs.length > 0 && (
        <div className="rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--surface-card)] p-5">
          <h2 className="font-sans text-[16px] font-semibold text-[var(--ink)]">Publicações</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {pubs.map((p) => (
              <li
                key={p.id}
                className="rounded-[var(--radius-sm)] border border-[var(--hairline)] px-3 py-2 text-[13px]"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[var(--ink)]">
                    {STATUS_LABEL[p.status] ?? p.status} · {p.media_type}
                    {p.scheduled_at && p.status === "ready" && (
                      <span className="text-[var(--ash)]">
                        {" "}
                        → {new Date(p.scheduled_at).toLocaleString("pt-BR")}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 font-mono text-[11px] text-[var(--ash)]">
                    {new Date(p.created_at).toLocaleString("pt-BR")}
                  </span>
                </div>
                {p.caption && (
                  <p className="mt-1 truncate text-[12.5px] text-[var(--mute)]">{p.caption}</p>
                )}
                {p.error && (
                  <p className="mt-1 text-[12.5px] text-[var(--danger,#e5484d)]">{p.error}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
