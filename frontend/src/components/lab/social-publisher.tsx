"use client";

/**
 * Publicador (Lab · admin-only) — conectar Instagram + publicar/agendar.
 * - Sem conta: botão "Conectar Instagram" (OAuth Instagram Login; exige
 *   conta Profissional). O callback volta pra cá com ?connected=1|?error=.
 * - Conectado: formulário (URL do vídeo/imagem + legenda + agendar) e a
 *   lista de publicações com poll enquanto houver processing.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { SocialMediaPicker, type PickedMedia } from "./social-media-picker";

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
  permalink: string | null;
  error: string | null;
  created_at: string;
  thumb_url: string | null;
};

export function SocialPublisher() {
  const t = useTranslations("social");
  const locale = useLocale();
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [pubs, setPubs] = useState<Publication[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [accountId, setAccountId] = useState("");
  const [picked, setPicked] = useState<PickedMedia | null>(null);
  const [caption, setCaption] = useState("");
  const [captionIdea, setCaptionIdea] = useState("");
  const [captionBusy, setCaptionBusy] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // TikTok: opções do criador (privacidade permitida) + escolhas do post.
  const [ttPrivacyOptions, setTtPrivacyOptions] = useState<string[]>([]);
  const [ttPrivacy, setTtPrivacy] = useState("SELF_ONLY");
  const [ttDisableComment, setTtDisableComment] = useState(false);
  const [ttBrandOrganic, setTtBrandOrganic] = useState(false);
  const [ttBrandContent, setTtBrandContent] = useState(false);

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
      setError(t("errors.load"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    // feedback do callback do OAuth
    const q = new URLSearchParams(window.location.search);
    if (q.get("connected")) setNotice(t("notice.connected", { username: q.get("username") ?? "" }));
    if (q.get("error")) {
      setError(
        q.get("detail") || (q.get("error") === "denied" ? t("notice.denied") : t("notice.error")),
      );
    }
    if (q.get("connected") || q.get("error")) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [load]);

  // conta TikTok selecionada → busca os níveis de privacidade permitidos
  useEffect(() => {
    const acc = accounts.find((a) => a.id === accountId);
    if (acc?.platform !== "tiktok") {
      setTtPrivacyOptions([]);
      return;
    }
    let alive = true;
    void fetch(`/api/v1/social/tiktok/creator-info?account_id=${accountId}`)
      .then(async (r) => {
        const j = await r.json();
        const opts: string[] = j?.data?.creator_info?.privacy_level_options ?? [];
        if (alive && opts.length > 0) {
          setTtPrivacyOptions(opts);
          setTtPrivacy((cur) => (opts.includes(cur) ? cur : opts[0]));
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [accountId, accounts]);

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

  async function connect(platform: "instagram" | "tiktok") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/social/${platform}/connect?locale=${locale}`);
      const json = await res.json();
      const url = json?.data?.url ?? json?.url;
      if (!res.ok || !url) {
        setError(t("errors.connectStart"));
        return;
      }
      window.location.href = url;
    } finally {
      setBusy(false);
    }
  }

  async function disconnect(id: string) {
    if (!window.confirm(t("accounts.confirmDisconnect"))) return;
    await fetch(`/api/v1/social/accounts?id=${id}`, { method: "DELETE" });
    await load();
  }

  async function generateCaption() {
    setCaptionBusy(true);
    try {
      const res = await fetch("/api/v1/social/caption", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context: picked?.context ?? "", locale, idea: captionIdea }),
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
    if (!picked) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/v1/social/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_id: accountId,
          source: picked.source,
          caption: caption.trim() || undefined,
          scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
          platform_options: isTiktok
            ? {
                privacy_level: ttPrivacy,
                disable_comment: ttDisableComment,
                brand_organic: ttBrandOrganic,
                brand_content: ttBrandContent,
              }
            : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? json?.message ?? t("errors.publish"));
        return;
      }
      setPicked(null);
      setCaption("");
      setCaptionIdea("");
      setScheduledAt("");
      setNotice(scheduledAt ? t("notice.scheduled") : t("notice.sent"));
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="text-[14px] text-[var(--mute)]">{t("loading")}</p>;

  const activeAccounts = accounts.filter((a) => a.status === "active");
  const isTiktok = activeAccounts.find((a) => a.id === accountId)?.platform === "tiktok";

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      {notice && <p className="text-[13.5px] text-[var(--ink)]">{notice}</p>}
      {error && <p className="text-[13.5px] text-[var(--danger,#e5484d)]">{error}</p>}

      {/* contas */}
      <div className="rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--surface-card)] p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-sans text-[16px] font-semibold text-[var(--ink)]">{t("accounts.title")}</h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void connect("instagram")}
              disabled={busy}
              className="rounded-[var(--radius-sm)] bg-[var(--ink)] px-4 py-2 text-[13px] font-semibold text-[var(--surface-deep)] disabled:opacity-40"
            >
              {t("accounts.connect")}
            </button>
            <button
              type="button"
              onClick={() => void connect("tiktok")}
              disabled={busy}
              className="rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] px-4 py-2 text-[13px] font-semibold text-[var(--ink)] disabled:opacity-40"
            >
              {t("accounts.connectTiktok")}
            </button>
          </div>
        </div>
        {accounts.length === 0 ? (
          <p className="mt-3 text-[13.5px] text-[var(--mute)]">{t("accounts.empty")}</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {accounts.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-[var(--hairline)] px-3 py-2"
              >
                <span className="text-[13.5px] text-[var(--ink)]">
                  <span className="mr-1.5 rounded border border-[var(--hairline)] px-1.5 py-0.5 text-[10.5px] uppercase text-[var(--ash)]">
                    {a.platform === "tiktok" ? "TikTok" : "Instagram"}
                  </span>
                  @{a.username ?? a.id}{" "}
                  <span className="text-[12px] text-[var(--ash)]">
                    {a.status === "active" ? t("accounts.connected") : t("accounts.reconnect")}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => void disconnect(a.id)}
                  className="text-[12px] text-[var(--ash)] underline-offset-2 hover:underline"
                >
                  {t("accounts.disconnect")}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* publicar */}
      {activeAccounts.length > 0 && (
        <div className="rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--surface-card)] p-5">
          <h2 className="font-sans text-[16px] font-semibold text-[var(--ink)]">{t("publish.title")}</h2>
          <div className="mt-3 flex flex-col gap-3">
            {activeAccounts.length > 1 && (
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="self-start rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] px-3 py-2 text-[13px] text-[var(--ink)]"
              >
                {activeAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.platform === "tiktok" ? "TikTok" : "Instagram"} · @{a.username ?? a.id}
                  </option>
                ))}
              </select>
            )}
            <SocialMediaPicker value={picked} onChange={setPicked} />
            {isTiktok && (
              <div className="flex flex-col gap-2 rounded-[var(--radius-sm)] border border-[var(--hairline)] p-3">
                <label className="flex items-center gap-2 text-[12.5px] text-[var(--mute)]">
                  {t("tiktok.privacy")}
                  <select
                    value={ttPrivacy}
                    onChange={(e) => setTtPrivacy(e.target.value)}
                    className="rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] px-2 py-1.5 text-[12.5px] text-[var(--ink)]"
                  >
                    {(ttPrivacyOptions.length > 0 ? ttPrivacyOptions : ["SELF_ONLY"]).map((p) => (
                      <option key={p} value={p}>
                        {t(`tiktok.privacyLevels.${p}` as never)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2 text-[12.5px] text-[var(--mute)]">
                  <input
                    type="checkbox"
                    checked={ttDisableComment}
                    onChange={(e) => setTtDisableComment(e.target.checked)}
                  />
                  {t("tiktok.disableComment")}
                </label>
                <label className="flex items-center gap-2 text-[12.5px] text-[var(--mute)]">
                  <input
                    type="checkbox"
                    checked={ttBrandOrganic}
                    onChange={(e) => setTtBrandOrganic(e.target.checked)}
                  />
                  {t("tiktok.brandOrganic")}
                </label>
                <label className="flex items-center gap-2 text-[12.5px] text-[var(--mute)]">
                  <input
                    type="checkbox"
                    checked={ttBrandContent}
                    onChange={(e) => setTtBrandContent(e.target.checked)}
                  />
                  {t("tiktok.brandContent")}
                </label>
                <p className="text-[11.5px] text-[var(--ash)]">{t("tiktok.musicConsent")}</p>
              </div>
            )}
            <div className="flex flex-col gap-1">
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder={t("publish.captionPlaceholder")}
                rows={3}
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
                disabled={captionBusy || !picked}
                className="self-start text-[12.5px] text-[var(--ink)] underline-offset-2 hover:underline disabled:opacity-40"
              >
                {captionBusy ? t("modal.generating") : t("modal.generateCaption")}
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-[12.5px] text-[var(--mute)]">
                {t("publish.scheduleLabel")}
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
                disabled={busy || !picked || !accountId}
                className="ml-auto rounded-[var(--radius-sm)] bg-[var(--ink)] px-5 py-2 text-[13px] font-semibold text-[var(--surface-deep)] disabled:opacity-40"
              >
                {busy ? t("publish.sending") : scheduledAt ? t("publish.submitSchedule") : t("publish.submitNow")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* histórico */}
      {pubs.length > 0 && (
        <div className="rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--surface-card)] p-5">
          <h2 className="font-sans text-[16px] font-semibold text-[var(--ink)]">{t("history.title")}</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {pubs.map((p) => (
              <li
                key={p.id}
                className="flex gap-3 rounded-[var(--radius-sm)] border border-[var(--hairline)] px-3 py-2 text-[13px]"
              >
                <PubThumb pub={p} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[var(--ink)]">
                      {(["ready","processing","published","failed"].includes(p.status) ? t(`history.${p.status}`) : p.status)} · {p.media_type}
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
                  {p.permalink && p.status === "published" && (
                    <a
                      href={p.permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-block text-[12.5px] text-[var(--ink)] underline underline-offset-2"
                    >
                      {t("history.viewOnInstagram")} ↗
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Miniatura do item do histórico. O poll de 5s devolve um presigned NOVO a
 * cada rodada — trocar o src faria a imagem re-baixar e piscar; guardamos o
 * primeiro thumb que chegou por publicação e usamos sempre ele.
 */
const thumbCache = new Map<string, string>();
function PubThumb({ pub }: { pub: Publication }) {
  let src = thumbCache.get(pub.id) ?? null;
  if (!src && pub.thumb_url) {
    thumbCache.set(pub.id, pub.thumb_url);
    src = pub.thumb_url;
  }
  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-sm)] border border-[var(--hairline)] bg-[var(--surface-deep)]">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="text-[18px]">{pub.media_type === "image" ? "🖼️" : "🎬"}</span>
      )}
    </div>
  );
}
