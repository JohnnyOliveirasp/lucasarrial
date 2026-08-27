"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";

/**
 * Lixeira POR CENA do Vídeo História (#158, 27/08).
 *
 * Não existia: a única lixeira era a do projeto inteiro (video-board). A Fast
 * mandou uma aluna "apagar na lixeirinha as cenas que não quer" e garantiu que
 * ela não perderia nada — ela achou a única lixeira que havia e apagou um
 * projeto. Este botão é a lixeira que o bot descreveu: apaga UMA cena (linha +
 * imagem/clipe no R2), com confirmação, e nunca a última cena do projeto.
 *
 * Usado no estágio de cenas (prompt) e no card do clipe. O pai recarrega a
 * lista via `onDeleted` — cada estágio tem seu próprio fetch.
 */
export function SceneDeleteButton({
  projectId,
  sceneId,
  idx,
  disabled,
  compact,
  onDeleted,
}: {
  projectId: string;
  sceneId: string;
  idx: number;
  disabled?: boolean;
  /** Ícone só (card do clipe). */
  compact?: boolean;
  onDeleted: () => void | Promise<void>;
}) {
  const t = useTranslations("videoWizard.sceneDelete");
  const tc = useTranslations("videoWizard.common");
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function confirm() {
    setDeleting(true);
    setErr(null);
    try {
      const res = await fetch(`/api/v1/videos/${projectId}/scenes/${sceneId}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error?.message || t("failed"));
      }
      setOpen(false);
      await onDeleted();
    } catch (e) {
      setErr(e instanceof Error ? e.message : tc("error"));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        title={t("title", { n: idx })}
        aria-label={t("title", { n: idx })}
        className={
          compact
            ? "inline-flex items-center justify-center rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-elevated)] px-2 py-1.5 text-[var(--silver)] transition-colors hover:border-[var(--hairline-bright)] hover:text-[var(--status-error)] disabled:opacity-50"
            : "inline-flex items-center gap-1.5 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-elevated)] px-2.5 py-1.5 font-sans text-[12px] font-medium text-[var(--silver)] transition-colors hover:border-[var(--hairline-bright)] hover:text-[var(--status-error)] disabled:opacity-50"
        }
      >
        <Trash2 className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
        {!compact && t("label")}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--canvas)]/80 p-4 backdrop-blur"
          role="dialog"
          aria-modal="true"
          onClick={() => !deleting && setOpen(false)}
        >
          <div
            className="flex w-full max-w-md flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-[var(--status-error)]" />
              <h3 className="text-xl font-semibold tracking-[-0.01em] text-[var(--ink)]">
                {t("title", { n: idx })}
              </h3>
            </div>
            <p className="text-sm text-[var(--body)]">
              {t.rich("warning", {
                strong: (chunks) => <strong className="text-[var(--ink)]">{chunks}</strong>,
              })}
            </p>
            {err && (
              <p role="alert" className="text-sm text-[var(--status-error)]">
                {err}
              </p>
            )}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => !deleting && setOpen(false)}
                className="inline-flex h-10 items-center rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-elevated)] px-[18px] text-[14px] font-medium text-[var(--ink)] hover:border-[var(--hairline-bright)]"
              >
                {tc("cancel")}
              </button>
              <button
                type="button"
                onClick={confirm}
                disabled={deleting}
                className="inline-flex h-10 items-center gap-2 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-elevated)] px-[18px] text-[14px] font-medium text-[var(--status-error)] hover:border-[var(--hairline-bright)] disabled:opacity-40"
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                {deleting ? t("deleting") : t("label")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
