/**
 * Mensagem de erro amigável ao usuário. NUNCA mostra o erro técnico (stack, msg
 * do RunPod, etc.) — esse fica nos logs/banco pra debug. Mostra "deu erro + fale
 * com o suporte" com o e-mail de contato.
 */
import { useTranslations } from "next-intl";

export const SUPPORT_EMAIL = "suporte@fastcloner.com";

export function SupportError({ action }: { action?: string }) {
  const t = useTranslations("misc.supportError");
  return (
    <section className="flex flex-col gap-2 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-4">
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--status-error)]">
        {t("title")}
      </p>
      <p className="text-sm text-[var(--body)]">
        {t("body", { action: action ?? t("defaultAction") })}
      </p>
      <p className="text-sm text-[var(--mute)]">
        {t("contact")}{" "}
        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          className="text-[var(--silver)] underline underline-offset-2 transition-opacity hover:opacity-80"
        >
          {SUPPORT_EMAIL}
        </a>
      </p>
    </section>
  );
}
