"use client";

/**
 * Botão "📤 Publicar no Instagram" + popup — vive junto do conteúdo pronto
 * (histórico de imagens; vídeos entram na sequência). Só aparece pra quem o
 * Publicador está liberado (admin até o App Review da Meta) — o estado vem
 * de /api/v1/social/accounts e é cacheado no módulo (1 fetch por página,
 * não por botão).
 */
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

type Account = { id: string; username: string | null; status: string };
type PublisherState = { enabled: boolean; accounts: Account[] };

let stateCache: Promise<PublisherState> | null = null;
function loadPublisherState(force = false): Promise<PublisherState> {
  if (!stateCache || force) {
    stateCache = fetch("/api/v1/social/accounts")
      .then(async (r) => {
        const j = await r.json();
        const d = j?.data ?? j;
        return { enabled: Boolean(d?.enabled), accounts: (d?.accounts ?? []) as Account[] };
      })
      .catch(() => ({ enabled: false, accounts: [] }));
  }
  return stateCache;
}

export function PublishButton({
  source,
  context,
  thumbnailUrl,
  className,
}: {
  /** Referência do conteúdo NA plataforma (o servidor valida a posse). */
  source: { kind: "image"; id: string };
  /** Texto-base pro "✨ Gerar legenda" (prompt da imagem / roteiro). */
  context?: string | null;
  thumbnailUrl?: string | null;
  className?: string;
}) {
  const t = useTranslations("social");
  const [state, setState] = useState<PublisherState | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    void loadPublisherState().then((s) => alive && setState(s));
    return () => {
      alive = false;
    };
  }, []);

  if (!state?.enabled) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ??
          "rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] px-2.5 py-1.5 text-[12px] text-[var(--ink)] hover:bg-[var(--surface-deep)]"
        }
        title={t("button.tooltip")}
      >
        {t("button.publish")}
      </button>
      {open && (
        <PublishModal
          source={source}
          context={context}
          thumbnailUrl={thumbnailUrl}
          accounts={state.accounts.filter((a) => a.status === "active")}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function PublishModal({
  source,
  context,
  thumbnailUrl,
  accounts,
  onClose,
}: {
  source: { kind: "image"; id: string };
  context?: string | null;
  thumbnailUrl?: string | null;
  accounts: Account[];
  onClose: () => void;
}) {
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [caption, setCaption] = useState("");
  const [captionIdea, setCaptionIdea] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [captionBusy, setCaptionBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const t = useTranslations("social");
  const locale = useLocale();

  async function generateCaption() {
    setCaptionBusy(true);
    try {
      const res = await fetch("/api/v1/social/caption", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context: context ?? "", locale, idea: captionIdea }),
      });
      const j = await res.json();
      const text = j?.data?.caption ?? j?.caption ?? "";
      if (text) setCaption(text);
      else setError(t("modal.captionFail"));
    } finally {
      setCaptionBusy(false);
    }
  }

  async function publish() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/social/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_id: accountId,
          source,
          caption: caption.trim() || undefined,
          scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j?.error?.message ?? j?.message ?? t("errors.publish"));
        return;
      }
      setDone(scheduledAt ? t("modal.doneScheduled") : t("modal.doneSent"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--surface-card)] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-sans text-[16px] font-semibold text-[var(--ink)]">
            {t("modal.title")}
          </h3>
          <button type="button" onClick={onClose} className="text-[var(--ash)]">✕</button>
        </div>

        {done ? (
          <div className="mt-4 flex flex-col gap-3">
            <p className="text-[14px] text-[var(--ink)]">{done}</p>
            <button
              type="button"
              onClick={onClose}
              className="self-end rounded-[var(--radius-sm)] bg-[var(--ink)] px-4 py-2 text-[13px] font-semibold text-[var(--surface-deep)]"
            >
              {t("modal.close")}
            </button>
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            {thumbnailUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={thumbnailUrl}
                alt=""
                className="max-h-40 w-auto self-center rounded-[var(--radius-sm)] object-contain"
              />
            )}
            {accounts.length === 0 ? (
              <p className="text-[13.5px] text-[var(--mute)]">
                {t("modal.noAccountPrefix")}{" "}
                <Link href="/app/lab/publicador" className="underline">{t("modal.noAccountLink")}</Link>{" "}
                {t("modal.noAccountSuffix")}
              </p>
            ) : (
              <>
                <select
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] px-3 py-2 text-[13px] text-[var(--ink)]"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>@{a.username ?? a.id}</option>
                  ))}
                </select>
                <div className="flex flex-col gap-1">
                  <textarea
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder={t("modal.captionPlaceholder")}
                    rows={5}
                    maxLength={2200}
                    className="rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] px-3 py-2 text-[13px] text-[var(--ink)] placeholder:text-[var(--ash)]"
                  />
                  <input
                    type="text"
                    value={captionIdea}
                    onChange={(e) => setCaptionIdea(e.target.value)}
                    placeholder={t("modal.captionIdeaPlaceholder")}
                    maxLength={500}
                    className="rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] px-3 py-1.5 text-[12.5px] text-[var(--ink)] placeholder:text-[var(--ash)]"
                  />
                  <button
                    type="button"
                    onClick={() => void generateCaption()}
                    disabled={captionBusy}
                    className="self-start text-[12.5px] text-[var(--ink)] underline-offset-2 hover:underline disabled:opacity-40"
                  >
                    {captionBusy ? t("modal.generating") : t("modal.generateCaption")}
                  </button>
                </div>
                <label className="flex items-center gap-2 text-[12.5px] text-[var(--mute)]">
                  {t("publish.scheduleLabel")}
                  <input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    className="rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] px-2 py-1.5 text-[12.5px] text-[var(--ink)]"
                  />
                </label>
                {error && <p className="text-[13px] text-[var(--danger,#e5484d)]">{error}</p>}
                <button
                  type="button"
                  onClick={() => void publish()}
                  disabled={busy || !accountId}
                  className="self-end rounded-[var(--radius-sm)] bg-[var(--ink)] px-5 py-2 text-[13px] font-semibold text-[var(--surface-deep)] disabled:opacity-40"
                >
                  {busy ? t("publish.sending") : scheduledAt ? t("publish.submitSchedule") : t("publish.submitNow")}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
