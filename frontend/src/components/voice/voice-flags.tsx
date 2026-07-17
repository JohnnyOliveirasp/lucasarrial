/**
 * Bandeirinhas SVG do catálogo de vozes (emoji de bandeira não renderiza no
 * Windows — Chrome mostra "BR" em texto). Formas simplificadas, 20×14.
 */
export type FlagCode = "br" | "pt" | "es" | "us";

/** Idioma+accent da voz → bandeira. pt-PT é o único override hoje. */
export function flagFor(language: string, accent?: string | null): FlagCode {
  if (accent === "pt-PT") return "pt";
  if (language === "es") return "es";
  if (language === "en") return "us";
  return "br";
}

export function Flag({ code, className }: { code: FlagCode; className?: string }) {
  const common = {
    width: 20,
    height: 14,
    viewBox: "0 0 20 14",
    className,
    "aria-hidden": true as const,
  };
  switch (code) {
    case "br":
      return (
        <svg {...common}>
          <rect width="20" height="14" rx="2" fill="#009B3A" />
          <path d="M10 2 L18 7 L10 12 L2 7 Z" fill="#FEDF00" />
          <circle cx="10" cy="7" r="2.6" fill="#002776" />
        </svg>
      );
    case "pt":
      return (
        <svg {...common}>
          <rect width="20" height="14" rx="2" fill="#DA291C" />
          <path d="M0 0 H8 V14 H0 Z" fill="#046A38" style={{ clipPath: "inset(0 round 2px 0 0 2px)" }} />
          <circle cx="8" cy="7" r="2.4" fill="#FFE900" />
          <circle cx="8" cy="7" r="1.4" fill="#DA291C" />
        </svg>
      );
    case "es":
      return (
        <svg {...common}>
          <rect width="20" height="14" rx="2" fill="#AA151B" />
          <rect y="3.5" width="20" height="7" fill="#F1BF00" />
        </svg>
      );
    case "us":
      return (
        <svg {...common}>
          <rect width="20" height="14" rx="2" fill="#FFFFFF" />
          {[0, 2, 4, 6, 8, 10, 12].map((y) => (
            <rect key={y} y={y} width="20" height="1" fill="#B22234" />
          ))}
          <rect width="9" height="7" fill="#3C3B6E" style={{ clipPath: "inset(0 0 0 0 round 2px 0 0 0)" }} />
        </svg>
      );
  }
}
