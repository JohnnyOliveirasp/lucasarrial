"use client";

import { MobileDrawer } from "./mobile-drawer";
import { SidebarBrand, SidebarTree, type NavProps } from "./sidebar-tree";

type Props = NavProps & {
  /** Assinatura ativa? Não tranca mais nada aqui — os cadeados olham CRÉDITO
   *  (ordem do Johnny 18/08, gate_por_credito). Mantida no contrato porque o
   *  layout continua passando e outras telas ainda usam pra escolher texto. */
  subscribed: boolean;
};

/**
 * Casca da navegação. A ÁRVORE de itens vive em sidebar-tree.tsx e é a mesma
 * nos dois destinos: o <aside> fixo do desktop (≥ lg) e o drawer do celular
 * (< lg, 02/09 — antes não existia menu nenhum abaixo de 1024px).
 */
export function Sidebar(props: Props) {
  // `subscribed` segue no contrato (o layout passa), mas não decide nada aqui:
  // os cadeados olham CRÉDITO desde 18/08. Por isso a árvore só recebe NavProps.
  const nav: NavProps = {
    creditsTotal: props.creditsTotal,
    unlimited: props.unlimited,
    isAdmin: props.isAdmin,
    podeAbrirPainel: props.podeAbrirPainel,
    hasReadyVoice: props.hasReadyVoice,
    publisherAllowed: props.publisherAllowed,
  };

  return (
    <>
      <aside className="hidden border-r border-[var(--hairline)] bg-[var(--surface-deep)] lg:flex lg:flex-col">
        <div className="border-b border-[var(--hairline)] px-5 py-5">
          <SidebarBrand />
        </div>

        <SidebarTree {...nav} />

        <div className="border-t border-[var(--hairline)] px-5 py-4">
          <p className="font-mono text-[10px] tracking-[0.04em] text-[var(--ash)]">v0.1 · dev</p>
        </div>
      </aside>

      <MobileDrawer {...nav} />
    </>
  );
}
