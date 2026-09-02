/**
 * Navegação do /admin + de quem pode ver cada área (mig 95).
 *
 * Fonte única: a topbar monta o menu daqui e o gate de tela decide o acesso
 * daqui. Área nova entra nesta lista — se esquecer o `roles`, ela nasce
 * ADMIN-ONLY (fechado demais, nunca vazado).
 */
import type { AdminRole } from "@/lib/admin/guard";

export type AdminNavItem = {
  href: string;
  label: string;
  exact: boolean;
  /** Quem enxerga. Ausente = só admin. */
  roles?: readonly AdminRole[];
};

/**
 * O suporte trabalha em chamados, no painel da Fast e — desde 02/09 — na fila
 * do SGP. O SGP entra pro suporte DE PROPÓSITO: a tela foi pedida pelo Lucas
 * justamente pra equipe dele ver sozinha quem já foi feito e quem precisa ser
 * cobrado. Sem `roles`, ela nasceria admin-only e não serviria pra nada.
 */
const AMBOS = ["admin", "suporte"] as const;

export const ADMIN_NAV: readonly AdminNavItem[] = [
  { href: "/admin", label: "Visão geral", exact: true },
  { href: "/admin/usuarios", label: "Usuários", exact: false },
  { href: "/admin/falhas", label: "Falhas", exact: false, roles: AMBOS },
  { href: "/admin/sgp", label: "SGP", exact: false, roles: AMBOS },
  { href: "/admin/campanhas", label: "Campanhas", exact: false },
  { href: "/admin/cortesias", label: "Cortesias", exact: false },
  { href: "/admin/agente", label: "Agente", exact: false, roles: AMBOS },
  { href: "/admin/historico", label: "Históricos", exact: false },
  { href: "/admin/admins", label: "Admins", exact: false },
] as const;

export function navFor(role: AdminRole): readonly AdminNavItem[] {
  return ADMIN_NAV.filter((i) => (i.roles ?? ["admin"]).includes(role));
}

/** Primeira tela que o papel pode abrir — destino de quem cai numa área fechada. */
export function homeFor(role: AdminRole): string {
  return navFor(role)[0]?.href ?? "/admin/falhas";
}

/**
 * O papel pode abrir esta URL? Compara pelo item mais específico (o prefixo
 * mais longo), senão "/admin" casaria com tudo.
 */
export function canOpen(role: AdminRole, pathname: string): boolean {
  const limpo = pathname.replace(/^\/(pt-BR|en|es)(?=\/|$)/, "") || "/admin";
  const match = [...ADMIN_NAV]
    .filter((i) => (i.exact ? limpo === i.href : limpo === i.href || limpo.startsWith(`${i.href}/`)))
    .sort((a, b) => b.href.length - a.href.length)[0];
  if (!match) return role === "admin"; // rota sem item de menu: só admin
  return (match.roles ?? ["admin"]).includes(role);
}
