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

        <nav className="flex flex-wrap gap-3 border-t border-border pt-6">
          {LEGAL_DOCS.map((d) => (
            <Link
              key={d.slug}
              href={`/${d.slug}`}
              className={`px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors ${
                d.slug === doc.slug
                  ? "bg-accent text-accent-fg"
                  : "border border-border text-muted-fg hover:text-fg"
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
