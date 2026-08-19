/**
 * Mensagem de erro amigável ao usuário. O erro TÉCNICO cru (stack, msg do
 * RunPod, etc.) continua fora da tela — fica nos logs/banco pra debug. Mas a
 * mensagem escrita PRA pessoa ("essa foto não subiu", "formato não suportado")
 * vai em `message` e APARECE: sem ela o aluno tenta de novo do mesmo jeito sem
 * saber o motivo (caso VP, 19/08 — tela calculava 14 mensagens e mostrava
 * sempre a mesma frase genérica). Sem `message`, cai no aviso genérico.
 */
import { useTranslations } from "next-intl";

export const SUPPORT_EMAIL = "suporte@fastcloner.com";

export function SupportError({ action, message }: { action?: string; message?: string }) {
  const t = useTranslations("misc.supportError");
  return (
    <section
      role="alert"
      className="flex flex-col gap-2 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-4"
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--status-error)]">
        {t("title")}
      </p>
      <p className="text-sm text-[var(--body)]">
        {t("body", { action: action ?? t("defaultAction") })}{" "}
        {message ?? t("retryHint")}
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
