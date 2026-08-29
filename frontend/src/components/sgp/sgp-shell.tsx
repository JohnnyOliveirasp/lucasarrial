import { useTranslations } from "next-intl";
import { SGP_PASSOS, type SgpPasso } from "@/lib/sgp/types";
import { SgpAjudaWidget } from "./sgp-ajuda-widget";

/**
 * Moldura de todas as telas do SGP: selo "Sistema de Geração Pronto", título,
 * barra de passos (1 Dados · 2 Imagem · 3 Áudio · 4 Confirmação) e o card.
 * Visual = tokens do FastCloner (decisão 29/08: não copiar o laranja do
 * formulário antigo).
 *
 * O botão "Ajuda" (a Fast) mora aqui, e não em cada tela: é o mesmo motivo do
 * shell existir — quem entra numa tela nova ganha a ajuda de graça, e ninguém
 * esquece de plugar numa delas (Johnny 29/08: "o botão de ajuda em cada tela").
 */
export function SgpShell({
  passo,
  titulo,
  descricao,
  children,
}: {
  passo: SgpPasso;
  titulo: string;
  descricao?: string;
  children: React.ReactNode;
}) {
  const t = useTranslations("sgp");
  const atual = SGP_PASSOS.indexOf(passo);

  return (
    <main className="min-h-svh bg-[var(--canvas)] px-4 py-10 sm:px-6 lg:py-16">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
        <header className="flex flex-col items-center gap-4 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--hairline-strong)] bg-[var(--surface-card)] px-3.5 py-1.5 text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--silver)]">
            {t("selo")}
          </span>
          <h1 className="font-sans text-3xl font-semibold leading-[1.05] tracking-[-0.03em] text-[var(--ink)] sm:text-4xl">
            {t("titulo")}
          </h1>
          <p className="max-w-md text-[15px] leading-[1.5] text-[var(--mute)]">{t("subtitulo")}</p>
        </header>

        <ol className="grid grid-cols-4 gap-2" aria-label={t("passos.aria")}>
          {SGP_PASSOS.map((p, i) => {
            const feito = i < atual;
            const ativo = i === atual;
            return (
              <li key={p} className="flex flex-col items-center gap-2">
                <span
                  aria-current={ativo ? "step" : undefined}
                  className={[
                    "flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-semibold transition-colors",
                    ativo || feito
                      ? "bg-[var(--pill-bg)] text-[var(--pill-ink)]"
                      : "border border-[var(--hairline-strong)] text-[var(--ash)]",
                  ].join(" ")}
                >
                  {feito ? "✓" : i + 1}
                </span>
                <span
                  className={[
                    "text-[12px]",
                    ativo ? "text-[var(--ink)]" : "text-[var(--ash)]",
                  ].join(" ")}
                >
                  {t(`passos.${p}`)}
                </span>
              </li>
            );
          })}
        </ol>

        <section className="rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-6 sm:p-8">
          <div className="mb-6 flex flex-col gap-2">
            <h2 className="text-2xl font-semibold tracking-[-0.02em] text-[var(--ink)]">{titulo}</h2>
            {descricao ? (
              <p className="text-[14px] leading-[1.5] text-[var(--mute)]">{descricao}</p>
            ) : null}
          </div>
          {children}
        </section>
      </div>

      <SgpAjudaWidget passo={passo} />
    </main>
  );
}
