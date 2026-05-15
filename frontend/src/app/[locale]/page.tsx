import { SiteHeader } from "@/components/site-header";
import { Hero } from "@/components/sections/hero";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        {/* TODO: Problema, Solução, Preview-da-plataforma, Features, CTA */}
        <section
          id="placeholder"
          className="border-t border-[var(--border)] py-32"
        >
          <div className="mx-auto max-w-[1400px] px-6 md:px-10">
            <span className="label-mono text-[var(--muted-fg)]">
              02 · próximas seções
            </span>
            <h2 className="display-hero mt-4 text-[clamp(2rem,6vw,5rem)] text-[var(--fg)]">
              Em construção<span className="text-[var(--accent)]">.</span>
            </h2>
          </div>
        </section>
      </main>
    </>
  );
}
