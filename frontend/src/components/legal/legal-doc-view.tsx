import type { LegalDoc } from "@/lib/legal";
import { DRAFT_NOTICE } from "@/lib/legal";

/**
 * Render de um documento legal. Usado tanto no popup de aceite quanto nas
 * páginas públicas (/termos, /privacidade, /uso). `compact` reduz o título
 * pro contexto do modal.
 */
export function LegalDocView({
  doc,
  compact = false,
}: {
  doc: LegalDoc;
  compact?: boolean;
}) {
  return (
    <article className="flex flex-col gap-5 text-sm leading-relaxed text-muted-fg">
      <header className="flex flex-col gap-1">
        <h1
          className={`font-display uppercase tracking-tight text-fg ${
            compact ? "text-2xl" : "text-4xl lg:text-5xl"
          }`}
        >
          {doc.title}
        </h1>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-fg">
          Atualizado: {doc.updatedAt}
        </p>
      </header>

      <p className="border border-accent/40 bg-accent/5 px-3 py-2 font-mono text-[11px] leading-relaxed text-accent">
        {DRAFT_NOTICE}
      </p>

      {doc.intro.map((p, i) => (
        <p key={`intro-${i}`}>{p}</p>
      ))}

      {doc.sections.map((s) => (
        <section key={s.heading} className="flex flex-col gap-2">
          <h2 className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-fg">
            {s.heading}
          </h2>
          {s.body.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </section>
      ))}
    </article>
  );
}
