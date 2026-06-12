import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { LEGAL_DOCS } from "@/lib/legal";
import { Eyebrow } from "@/components/ui/eyebrow";

// product/company seguem como placeholders; legal aponta pras páginas reais.
const COLUMNS = ["product", "company"] as const;

export function Footer() {
  const t = useTranslations("footer");

  return (
    <footer className="border-t border-[var(--hairline)] bg-[var(--canvas)] py-16 md:py-20">
      <div className="mx-auto w-full max-w-[1200px] px-6 md:px-8">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex size-7 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] bg-[var(--surface-elevated)]">
                <Image
                  src="/brand/fastpost-glyph.png"
                  alt=""
                  width={16}
                  height={16}
                  className="size-4"
                />
              </span>
              <span className="font-sans text-[17px] font-semibold tracking-[-0.03em] text-[var(--ink)]">
                FastPost
              </span>
            </div>
            <p className="mt-4 max-w-[240px] text-[14px] leading-[1.6] text-[var(--mute)]">
              {t("tagline")}
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col}>
              <Eyebrow className="mb-4 block text-[var(--silver)]">
                {t(`columns.${col}.title`)}
              </Eyebrow>
              <ul className="space-y-2.5">
                {(["1", "2", "3", "4"] as const).map((k) => (
                  <li key={k}>
                    <a
                      href="#"
                      className="text-[14px] text-[var(--mute)] transition-colors duration-[var(--dur-fast)] ease-[var(--ease-out)] hover:text-[var(--ink)]"
                    >
                      {t(`columns.${col}.items.${k}`)}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Legal — links pras páginas públicas */}
          <div>
            <Eyebrow className="mb-4 block text-[var(--silver)]">
              {t("columns.legal.title")}
            </Eyebrow>
            <ul className="space-y-2.5">
              {LEGAL_DOCS.map((d) => (
                <li key={d.slug}>
                  <Link
                    href={`/${d.slug}`}
                    className="text-[14px] text-[var(--mute)] transition-colors duration-[var(--dur-fast)] ease-[var(--ease-out)] hover:text-[var(--ink)]"
                  >
                    {d.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-16 flex flex-col items-start justify-between gap-3 border-t border-[var(--hairline)] pt-8 md:flex-row md:items-center">
          <span className="text-[13px] text-[var(--ash)]">{t("copyright")}</span>
          <span className="text-[13px] text-[var(--ash)]">{t("made")}</span>
        </div>
      </div>
    </footer>
  );
}
