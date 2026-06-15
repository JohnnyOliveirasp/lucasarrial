import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { LEGAL_DOCS } from "@/lib/legal";
import { Eyebrow } from "@/components/ui/eyebrow";

// Colunas de produto/recursos/empresa são placeholders (#); legal aponta pras
// páginas públicas reais (/termos /privacidade /uso).
const LINK_COLUMNS = ["product", "resources", "company"] as const;

export function Footer() {
  const t = useTranslations("footer");

  return (
    <footer className="bg-[var(--canvas)]">
      <div className="mx-auto w-full max-w-[1200px] px-6 py-16 md:px-8">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-[1.6fr_repeat(4,1fr)]">
          {/* Marca + tagline */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex size-[26px] items-center justify-center rounded-[7px] border border-[var(--hairline-bright)] bg-[var(--surface-elevated)]">
                <Image
                  src="/brand/fastpost-glyph.png"
                  alt=""
                  width={16}
                  height={16}
                  className="size-4"
                />
              </span>
              <span className="font-sans text-[16px] font-semibold tracking-[-0.02em] text-[var(--ink)]">
                FastPost
              </span>
            </div>
            <p className="mt-[18px] max-w-[240px] text-[14px] leading-[1.6] text-[var(--ash)]">
              {t("tagline")}
            </p>
          </div>

          {LINK_COLUMNS.map((col) => (
            <div key={col} className="flex flex-col gap-3.5">
              <Eyebrow className="text-[var(--silver)]">
                {t(`columns.${col}.title`)}
              </Eyebrow>
              {(["1", "2", "3", "4"] as const).map((k) => (
                <a
                  key={k}
                  href="#"
                  className="text-[14px] text-[var(--mute)] transition-colors duration-[var(--dur-fast)] ease-[var(--ease-out)] hover:text-[var(--ink)]"
                >
                  {t(`columns.${col}.items.${k}`)}
                </a>
              ))}
            </div>
          ))}

          {/* Legal — páginas reais */}
          <div className="flex flex-col gap-3.5">
            <Eyebrow className="text-[var(--silver)]">
              {t("columns.legal.title")}
            </Eyebrow>
            {LEGAL_DOCS.map((d) => (
              <Link
                key={d.slug}
                href={`/${d.slug}`}
                className="text-[14px] text-[var(--mute)] transition-colors duration-[var(--dur-fast)] ease-[var(--ease-out)] hover:text-[var(--ink)]"
              >
                {d.title}
              </Link>
            ))}
          </div>
        </div>

        <div className="mt-14 flex flex-col items-start justify-between gap-3 border-t border-[rgba(255,255,255,0.04)] pt-6 md:flex-row md:items-center">
          <span className="text-[13px] text-[var(--ash)]">
            {t("copyright")}
          </span>
          <span className="inline-flex items-center gap-2 text-[13px] text-[var(--mute)]">
            <span className="size-[7px] rounded-full bg-[var(--status-online)]" />
            {t("status")}
          </span>
        </div>
      </div>
    </footer>
  );
}
