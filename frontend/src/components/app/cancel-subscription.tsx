"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui";

const REASON_KEYS = [
  "expensive",
  "notUsing",
  "missingFeature",
  "technicalIssue",
  "other",
] as const;

export function CancelSubscription() {
  const t = useTranslations("shell.cancelSub");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function confirm() {
    setLoading(true);
    try {
      await fetch("/api/v1/subscription/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, detail }),
      });
      setDone(true);
      router.refresh();
    } catch {
      /* mesmo em falha, o motivo foi enviado; não trava o usuário */
      setDone(true);
    }
    setLoading(false);
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[13px] text-[var(--mute)] underline-offset-4 transition-colors duration-[var(--dur-base)] ease-[var(--ease-out)] hover:text-[var(--status-error)] hover:underline"
      >
        {t("trigger")}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--canvas)]/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-8">
            {done ? (
              <div className="flex flex-col gap-4">
                <h3 className="text-[22px] font-semibold tracking-[-0.02em] text-[var(--ink)]">
                  {t("doneTitle")}
                </h3>
                <p className="text-[14px] leading-relaxed text-[var(--mute)]">
                  {t("doneBody")}
                </p>
                <Button
                  variant="primary"
                  onClick={() => setOpen(false)}
                  className="self-start"
                >
                  {t("close")}
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-2">
                  <h3 className="text-[22px] font-semibold tracking-[-0.02em] text-[var(--ink)]">
                    {t("title")}
                  </h3>
                  <p className="text-[14px] leading-relaxed text-[var(--mute)]">
                    {t("body")}
                  </p>
                </div>

                <div className="flex flex-col gap-2.5">
                  {REASON_KEYS.map((k) => {
                    const r = t(`reasons.${k}`);
                    return (
                      <label
                        key={k}
                        className="flex cursor-pointer items-center gap-3 text-[14px] text-[var(--body)]"
                      >
                        <input
                          type="radio"
                          name="cancel-reason"
                          value={r}
                          checked={reason === r}
                          onChange={() => setReason(r)}
                          className="accent-[var(--ink)]"
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
                  className="resize-none rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] placeholder:text-[var(--ash)] focus:border-[var(--hairline-bright)] focus:outline-none"
                />

                <div className="flex items-center justify-between gap-3">
                  <Button variant="ghost" onClick={() => setOpen(false)}>
                    {t("back")}
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={loading}
                    onClick={confirm}
                    iconLeft={
                      loading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : undefined
                    }
                    className="text-[var(--status-error)] hover:border-[var(--status-error)]"
                  >
                    {loading ? t("canceling") : t("confirm")}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
