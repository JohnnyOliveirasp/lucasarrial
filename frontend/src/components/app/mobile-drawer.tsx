"use client";

/**
 * Drawer de navegação do celular (02/09).
 *
 * Abaixo de lg o <aside> da sidebar é `display:none` e o header não tinha
 * hamburguer nenhum — quem entrava pelo celular caía numa tela e não
 * conseguia sair dela (incidente #220). Este drawer renderiza a MESMA
 * <SidebarTree /> do desktop: uma fonte só, sem lista duplicada.
 */
import { useEffect } from "react";
import { usePathname } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { useMobileNav } from "./mobile-nav";
import { SidebarBrand, SidebarTree, type NavProps } from "./sidebar-tree";

export function MobileDrawer(props: NavProps) {
  const { open, fechar } = useMobileNav();
  const pathname = usePathname();
  const tShell = useTranslations("shell.sidebar");

  // Fecha ao NAVEGAR — senão o aluno clica num item e o menu fica por cima
  // da tela nova.
  useEffect(() => {
    fechar();
  }, [pathname, fechar]);

  // Enquanto aberto: Esc fecha e o scroll do body fica travado.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") fechar();
    }
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflowAnterior;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, fechar]);

  return (
    <div className="lg:hidden">
      {/* Overlay: botão de verdade pra fechar também no teclado. */}
      <button
        type="button"
        tabIndex={open ? 0 : -1}
        aria-hidden={!open}
        aria-label={tShell("closeMenu")}
        onClick={fechar}
        className={[
          "fixed inset-0 z-40 bg-black/60 transition-opacity duration-[var(--dur-base)] ease-[var(--ease-out)]",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        ].join(" ")}
      />
      {/* `inert` fechado: o painel continua montado (a animação de sair
          funciona) mas some do Tab e do leitor de tela. */}
      <aside
        id="menu-mobile"
        inert={!open}
        className={[
          "fixed inset-y-0 left-0 z-50 flex w-[280px] max-w-[85vw] flex-col overflow-y-auto border-r border-[var(--hairline)] bg-[var(--surface-deep)]",
          "transition-transform duration-[var(--dur-base)] ease-[var(--ease-out)]",
          open ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        <div className="flex items-center justify-between gap-3 border-b border-[var(--hairline)] px-5 py-5">
          <SidebarBrand />
          <button
            type="button"
            onClick={fechar}
            aria-label={tShell("closeMenu")}
            className="inline-flex size-8 items-center justify-center rounded-[var(--radius-sm)] text-[var(--mute)] transition-colors duration-[var(--dur-fast)] ease-[var(--ease-out)] hover:bg-[var(--surface-card)] hover:text-[var(--ink)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <SidebarTree {...props} />
      </aside>
    </div>
  );
}
