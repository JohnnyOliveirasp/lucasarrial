"use client";

/**
 * "Entrar na conta do aluno" — o atalho que o suporte usa pra abrir a conta do
 * comprador do SGP e mexer nas fotos/áudio dele (o trabalho feito-pra-você que
 * antes dependia da senha anotada na planilha).
 *
 * Abre em ABA NOVA de propósito: a sessão do aluno não pode derrubar a sessão
 * de admin da atendente na mesma aba — ela perderia a fila de trabalho.
 *
 * O link é de uso único e some daqui assim que é usado: nada é guardado.
 */
import { useState } from "react";
import { LogIn } from "lucide-react";

export function EntrarComoAluno({ email, nome }: { email: string; nome: string }) {
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
        throw new Error(json?.error?.message || "Não consegui abrir a conta deste aluno");
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
        className="inline-flex h-8 w-fit items-center gap-1.5 rounded-[var(--radius)] border border-[var(--hairline-strong)] px-3 font-mono text-[11px] text-[var(--ink)] transition-colors hover:bg-[var(--surface-elevated)] disabled:opacity-50"
      >
        <LogIn className="size-3.5" />
        {estado === "abrindo" ? "abrindo…" : "Entrar na conta do aluno"}
      </button>
      {erro && <span className="font-mono text-[11px] text-[var(--status-error)]">{erro}</span>}
    </div>
  );
}
