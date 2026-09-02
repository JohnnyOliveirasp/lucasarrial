"use client";

import { ShieldAlert } from "lucide-react";
import { usePathname } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { canOpen, homeFor } from "@/lib/admin/nav";
import type { AdminRole } from "@/lib/admin/guard";

/**
 * Trava de TELA por papel (mig 95). A trava de VERDADE é a API (gateAdmin) —
 * esta aqui existe pra quem digitar a URL na mão ver um aviso claro em vez de
 * uma tela quebrada de 403.
 */
export function AdminRoleGate({
  role,
  children,
}: {
  role: AdminRole;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  if (canOpen(role, pathname)) return <>{children}</>;

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <span className="inline-flex size-11 items-center justify-center rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-elevated)]">
        <ShieldAlert className="size-5 text-[var(--mute)]" />
      </span>
      <div>
        <h1 className="font-sans text-lg font-semibold tracking-[-0.02em] text-[var(--ink)]">
          Esta área não faz parte do seu acesso
        </h1>
        <p className="mt-1 text-sm text-[var(--mute)]">
          Seu perfil é de suporte: você trabalha em Falhas, SGP e no Agente.
        </p>
      </div>
      <Link
        href={homeFor(role)}
        className="text-[13px] font-medium text-[var(--mute)] underline underline-offset-4 transition-colors hover:text-[var(--ink)]"
      >
        Ir para Falhas
      </Link>
    </div>
  );
}
