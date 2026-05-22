/**
 * Mensagem de erro amigável ao usuário. NUNCA mostra o erro técnico (stack, msg
 * do RunPod, etc.) — esse fica nos logs/banco pra debug. Mostra "deu erro + fale
 * com o suporte" com o e-mail de contato.
 */
export const SUPPORT_EMAIL = "contact@jcsolutionsus.com";

export function SupportError({ action = "concluir a operação" }: { action?: string }) {
  return (
    <section className="border border-accent bg-accent/5 p-4 flex flex-col gap-2">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">
        Ops, algo deu errado
      </p>
      <p className="text-sm text-fg">
        Não foi possível {action}. O erro foi registrado do nosso lado — tente de novo em
        alguns minutos.
      </p>
      <p className="text-sm text-muted-fg">
        Se continuar, fale com o suporte:{" "}
        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          className="text-accent underline underline-offset-2 hover:opacity-80"
        >
          {SUPPORT_EMAIL}
        </a>
      </p>
    </section>
  );
}
