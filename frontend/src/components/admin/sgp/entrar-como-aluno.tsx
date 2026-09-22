"use client";

/**
 * "Entrar na conta do aluno" — o atalho que o suporte usa pra abrir a conta do
 * comprador do SGP e mexer nas fotos/áudio dele (o trabalho feito-pra-você que
 * antes dependia da senha anotada na planilha).
 *
 * Abre em aba nova pra atendente não perder a fila — mas aba nova NÃO protege
 * a sessão: cookie é por host. Quem protege é o link sair no `www.`
 * (`casaDoAluno` em lib/sgp/link-entrada-pure.ts). Em 22/09 a Karen clicou,
 * a sessão do aluno tomou a dela no host do painel, e o clique seguinte
 * voltou "Acesso restrito a administradores".
 *
 * O link é de uso único e some daqui assim que é usado: nada é guardado.
 *
 * `compacto` (21/09): na GRID a célula tem ~110px e o rótulo inteiro quebrava
 * em duas linhas dentro de um botão de altura fixa — a segunda linha saía
 * cortada. Na grid o botão diz só "Entrar" (a coluna já se chama Acesso) e o
 * texto inteiro vive no `title`; no painel, onde sobra largura, ele fala a
 * frase completa.
 */
import { useState } from "react";
import { LogIn } from "lucide-react";

export function EntrarComoAluno({
  email,
  nome,
  compacto = false,
}: {
  email: string;
  nome: string;
  /** true = dentro da grid (rótulo curto, uma linha só). */
  compacto?: boolean;
}) {
  const [estado, setEstado] = useState<"parado" | "abrindo" | "erro">("parado");
  const [erro, setErro] = useState<string | null>(null);

  async function entrar() {
    if (estado === "abrindo") return;
    setEstado("abrindo");
    setErro(null);
    try {
      const res = await fetch("/api/v1/admin/sgp/entrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.link) {
        const msg = json?.error?.message || "Não consegui abrir a conta deste aluno";
        // 403 com sessão viva = a sessão de admin foi trocada por outra (um
        // link de aluno aberto no host do painel). Dizer o caminho de volta.
        throw new Error(
          res.status === 403
            ? `${msg}. Sua sessão pode ter virado a de um aluno: saia da conta e entre de novo no /admin.`
            : msg,
        );
      }
      window.open(json.link as string, "_blank", "noopener,noreferrer");
      setEstado("parado");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não consegui abrir a conta deste aluno");
      setEstado("erro");
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={entrar}
        disabled={estado === "abrindo"}
        title={`Abrir a conta de ${nome} já logada, em outra aba`}
        className="inline-flex min-h-8 w-fit items-center gap-1.5 whitespace-nowrap rounded-[var(--radius)] border border-[var(--hairline-strong)] px-3 py-1 font-mono text-[11px] leading-none text-[var(--ink)] transition-colors hover:bg-[var(--surface-elevated)] disabled:opacity-50"
      >
        <LogIn className="size-3.5 shrink-0" />
        {estado === "abrindo" ? "abrindo…" : compacto ? "Entrar" : "Entrar na conta do aluno"}
      </button>
      {erro && (
        <span className="max-w-[220px] font-mono text-[11px] leading-snug text-[var(--status-error)]">{erro}</span>
      )}
    </div>
  );
}
