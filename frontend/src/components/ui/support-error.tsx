/**
 * Mensagem de erro amigável ao usuário. NUNCA mostra o erro técnico (stack, msg
 * do RunPod, etc.) — esse fica nos logs/banco pra debug. Mostra "deu erro + fale
 * com o suporte" com o e-mail de contato.
 */
export const SUPPORT_EMAIL = "suporte@fastcloner.com";

export function SupportError({ action = "concluir a operação" }: { action?: string }) {
  return (
    <section className="flex flex-col gap-2 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-4">
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--status-error)]">
        Ops, algo deu errado
      </p>
      <p className="text-sm text-[var(--body)]">
        Não foi possível {action}. O erro foi registrado do nosso lado — tente de novo em
        alguns minutos.
      </p>
      <p className="text-sm text-[var(--mute)]">
        Se continuar, fale com o suporte:{" "}
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
