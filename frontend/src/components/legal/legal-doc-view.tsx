import type { LegalDoc } from "@/lib/legal";
import { DRAFT_NOTICE } from "@/lib/legal";
import { Eyebrow } from "@/components/ui/eyebrow";

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
    <article className="mx-auto flex w-full max-w-[720px] flex-col gap-7 text-[15px] leading-[1.6] text-[var(--body)]">
      <header className="flex flex-col gap-3 border-b border-[var(--hairline)] pb-7">
        <h1
          className={`font-sans font-semibold tracking-[-0.02em] text-[var(--ink)] ${
            compact ? "text-2xl" : "text-4xl lg:text-5xl"
          }`}
        >
          {doc.title}
        </h1>
        <Eyebrow>Atualizado: {doc.updatedAt}</Eyebrow>
      </header>

      <p className="rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] px-4 py-3 text-[13px] leading-[1.6] text-[var(--silver)]">
        {DRAFT_NOTICE}
      </p>

      {doc.intro.map((p, i) => (
        <p key={`intro-${i}`}>{p}</p>
      ))}

      {doc.sections.map((s) => (
        <section
          key={s.heading}
          className="flex flex-col gap-3 border-t border-[var(--hairline)] pt-7"
        >
          <h2 className="font-sans text-lg font-semibold tracking-[-0.01em] text-[var(--ink)]">
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
