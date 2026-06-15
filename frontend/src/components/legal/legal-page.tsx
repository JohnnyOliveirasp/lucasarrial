import { SiteHeader } from "@/components/site-header";
import { Footer } from "@/components/sections/footer";
import { Link } from "@/i18n/navigation";
import { LEGAL_DOCS, type LegalDoc } from "@/lib/legal";
import { LegalDocView } from "./legal-doc-view";

/** Página pública de documento legal (com header da landing, nav entre docs e footer). */
export function LegalPage({ doc }: { doc: LegalDoc }) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-6 py-16 lg:py-24">
        <LegalDocView doc={doc} />

        <nav className="flex flex-wrap gap-3 border-t border-[var(--hairline)] pt-6">
          {LEGAL_DOCS.map((d) => (
            <Link
              key={d.slug}
              href={`/${d.slug}`}
              className={`rounded-[var(--radius-sm)] px-3 py-1.5 font-sans text-[11px] font-medium uppercase tracking-[0.16em] transition-colors ${
                d.slug === doc.slug
                  ? "bg-[var(--pill-bg)] text-[var(--pill-ink)]"
                  : "border border-[var(--hairline-strong)] text-[var(--mute)] hover:text-[var(--ink)]"
              }`}
            >
              {d.title}
            </Link>
          ))}
        </nav>
      </main>
      <Footer />
    </>
  );
}
