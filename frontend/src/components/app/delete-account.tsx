"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Loader2, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button, Input } from "@/components/ui";

const REASON_KEYS = [
  "noNeed",
  "expensive",
  "missingFeature",
  "technicalIssue",
  "privacy",
  "other",
] as const;

type Props = {
  /** E-mail da conta — o usuário precisa digitar exatamente este pra confirmar. */
  email: string;
};

const dangerWash = {
  background:
    "radial-gradient(ellipse 120% 90% at 50% 0%, rgba(248,113,113,0.06), transparent 70%)",
} as const;

export function DeleteAccount({ email }: Props) {
  const t = useTranslations("shell.deleteAccount");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailMatches =
    confirmEmail.trim().toLowerCase() === email.trim().toLowerCase();

  async function confirm() {
    if (!emailMatches) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, detail, email: confirmEmail.trim() }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error?.message || t("deleteError"));
      }
      // Conta apagada → encerra a sessão e manda pra home.
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("genericError"));
      setLoading(false);
    }
  }

  return (
    <div
      className="relative flex flex-col gap-3 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-6"
      style={dangerWash}
    >
      <h2 className="flex items-center gap-2 text-[13px] font-medium text-[var(--status-error)]">
        <AlertTriangle className="h-4 w-4" />
        {t("dangerZone")}
      </h2>
      <p className="max-w-xl text-[14px] leading-relaxed text-[var(--mute)]">
        {t.rich("warning", {
          strong: (chunks) => (
            <strong className="font-medium text-[var(--ink)]">{chunks}</strong>
          ),
        })}
      </p>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start text-[13px] text-[var(--status-error)] underline-offset-4 transition-colors duration-[var(--dur-base)] ease-[var(--ease-out)] hover:underline"
      >
        {t("trigger")}
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[var(--canvas)]/80 p-4 backdrop-blur-sm">
          <div
            className="flex max-h-[90vh] w-full max-w-md flex-col gap-5 overflow-y-auto rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-7"
            style={dangerWash}
          >
            <div className="flex flex-col gap-2">
              <h3 className="flex items-center gap-2.5 text-[22px] font-semibold tracking-[-0.02em] text-[var(--ink)]">
                <AlertTriangle className="h-5 w-5 text-[var(--status-error)]" />
                {t("modalTitle")}
              </h3>
              <div className="rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] p-3.5 text-[14px] text-[var(--body)]">
                {t.rich("noUndo", {
                  strong: (chunks) => (
                    <strong className="font-medium text-[var(--ink)]">{chunks}</strong>
                  ),
                })}
                <ul className="mt-2 list-disc pl-5 text-[var(--mute)]">
                  <li>{t("consequence1")}</li>
                  <li>{t("consequence2")}</li>
                  <li>{t("consequence3")}</li>
                </ul>
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <span className="text-[13px] text-[var(--silver)]">
                {t("whyLeaving")}
              </span>
              {REASON_KEYS.map((k) => {
                const r = t(`reasons.${k}`);
                return (
                  <label
                    key={k}
                    className="flex cursor-pointer items-center gap-3 text-[14px] text-[var(--body)]"
                  >
                    <input
                      type="radio"
                      name="delete-reason"
                      value={r}
                      checked={reason === r}
                      onChange={() => setReason(r)}
                      className="accent-[var(--status-error)]"
                    />
                    {r}
                  </label>
                );
              })}
            </div>

            <textarea
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              rows={2}
              placeholder={t("detailPlaceholder")}
              className="resize-none rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] placeholder:text-[var(--ash)] focus:border-[var(--status-error)] focus:outline-none"
            />

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="confirm-email"
                className="text-[13px] text-[var(--silver)]"
              >
                {t.rich("typeToConfirm", {
                  email,
                  strong: (chunks) => (
                    <span className="font-medium text-[var(--ink)]">{chunks}</span>
                  ),
                })}
              </label>
              <Input
                id="confirm-email"
                type="email"
                autoComplete="off"
                value={confirmEmail}
                onChange={(e) => setConfirmEmail(e.target.value)}
                placeholder={email}
                invalid={confirmEmail.length > 0 && !emailMatches}
              />
            </div>

            {error && (
              <p className="rounded-[var(--radius)] border border-[var(--hairline-strong)] px-3 py-2.5 text-[13px] text-[var(--status-error)]">
                {error}
              </p>
            )}

            <div className="flex items-center justify-between gap-3 pt-1">
              <Button
                variant="ghost"
                onClick={() => setOpen(false)}
                disabled={loading}
              >
                {t("back")}
              </Button>
              <Button
                variant="secondary"
                disabled={!emailMatches || loading}
                onClick={confirm}
                iconLeft={
                  loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : undefined
                }
                className="text-[var(--status-error)] hover:border-[var(--status-error)] disabled:hover:border-[var(--hairline-strong)]"
              >
                {loading ? t("deleting") : t("confirm")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
