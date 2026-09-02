"use client";

/**
 * Estado do menu mobile (02/09): o botão hamburguer mora na Topbar e o drawer
 * mora junto da Sidebar — são irmãos no layout, então o estado precisa de um
 * contexto acima dos dois. Abaixo de lg o <aside> é `display:none`, e sem isso
 * quem entra pelo celular fica SEM nenhuma navegação (incidente #220).
 */
import { createContext, useCallback, useContext, useMemo, useState } from "react";

type MobileNavValue = {
  open: boolean;
  abrir: () => void;
  fechar: () => void;
  alternar: () => void;
};

const MobileNavContext = createContext<MobileNavValue | null>(null);

export function MobileNavProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const abrir = useCallback(() => setOpen(true), []);
  const fechar = useCallback(() => setOpen(false), []);
  const alternar = useCallback(() => setOpen((o) => !o), []);
  const value = useMemo(
    () => ({ open, abrir, fechar, alternar }),
    [open, abrir, fechar, alternar],
  );
  return <MobileNavContext.Provider value={value}>{children}</MobileNavContext.Provider>;
}

export function useMobileNav(): MobileNavValue {
  const ctx = useContext(MobileNavContext);
  if (!ctx) throw new Error("useMobileNav precisa estar dentro de <MobileNavProvider>");
  return ctx;
}
