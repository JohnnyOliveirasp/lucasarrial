import { useTranslations } from "next-intl";

const COLUMNS = ["product", "company", "legal"] as const;

export function Footer() {
  const t = useTranslations("footer");

  return (
    <footer className="border-t border-[var(--border)] bg-[var(--bg)] py-16 md:py-20">
      <div className="mx-auto w-full max-w-[1400px] px-6 md:px-10">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <div className="font-display text-3xl uppercase leading-none">
              Lucas<span className="text-[var(--accent)]">.</span>
            </div>
            <p className="mt-4 max-w-[240px] text-sm leading-relaxed text-[var(--muted-fg)]">
              {t("tagline")}
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col}>
              <h3 className="label-mono mb-4 text-[var(--fg)]">
                {t(`columns.${col}.title`)}
              </h3>
              <ul className="space-y-2.5">
                {(["1", "2", "3", "4"] as const).map((k) => (
                  <li key={k}>
                    <a
                      href="#"
                      className="text-sm text-[var(--muted-fg)] transition-colors duration-[var(--dur-fast)] ease-[var(--ease-snap)] hover:text-[var(--accent)]"
                    >
                      {t(`columns.${col}.items.${k}`)}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 flex flex-col items-start justify-between gap-3 border-t border-[var(--border)] pt-8 md:flex-row md:items-center">
          <span className="label-mono text-[var(--muted-fg)]">
            {t("copyright")}
          </span>
          <span className="label-mono text-[var(--muted-fg)]">{t("made")}</span>
        </div>
      </div>
    </footer>
  );
}
