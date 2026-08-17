"use client";

/**
 * A FOTO do avatar — parte do R1.
 *
 * Escolhe da galeria do aluno e, se ela não estiver no jeito, a plataforma
 * prepara sozinha: reenquadra pra meio corpo pra cima e troca o fundo por
 * verde (pedido do Johnny 14/08 — "no final nós vamos fazer tudo automático").
 *
 * O aluno não precisa entender chroma key: ele vê "foto pronta pro React".
 */
import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import type { ReactDraft } from "./react-tipos";

type Imagem = { id: string; image_url: string | null };

export function ReactFotoAvatar({
  draft,
  update,
}: {
  draft: ReactDraft;
  update: (m: Partial<ReactDraft>) => void;
}) {
  const [galeria, setGaleria] = useState<Imagem[] | null>(null);
  const [preparando, setPreparando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch("/api/v1/images", { cache: "no-store" });
        const j = await r.json();
        const itens: Imagem[] = (j.images ?? j.items ?? []).filter((i: Imagem) => i.image_url);
        setGaleria(itens);
      } catch {
        setGaleria([]);
      }
    })();
  }, []);

  /** Dispara o preparo e acompanha até sair (o Kie é assíncrono). */
  async function preparar() {
    if (!draft.fotoOriginal) return;
    setPreparando(true);
    setErro(null);
    try {
      const r = await fetch("/api/v1/react/foto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_url: draft.fotoOriginal }),
      });
      const j = await r.json();
      if (!r.ok) {
        setErro(j?.error?.message ?? "Não consegui preparar a foto.");
        return;
      }
      for (let i = 0; i < 60; i++) {
        await new Promise((s) => setTimeout(s, 4000));
        const st = await fetch(`/api/v1/react/foto?task=${encodeURIComponent(j.task_id)}`);
        const sj = await st.json();
        if (sj.estado === "success" && sj.url) {
          update({ fotoPronta: sj.url });
          return;
        }
        if (sj.estado === "fail") {
          setErro(sj.erro ?? "O preparo da foto falhou.");
          return;
        }
      }
      setErro("O preparo está demorando demais — tente de novo.");
    } catch {
      setErro("Falha de rede ao preparar a foto.");
    } finally {
      setPreparando(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-[var(--radius-sm)] border border-[var(--hairline)] p-3">
      <p className="text-[12.5px] font-medium text-[var(--ink)]">Qual foto sua vamos usar?</p>

      {galeria === null ? (
        <p className="text-[12px] text-[var(--mute)]">Carregando suas fotos…</p>
      ) : galeria.length === 0 ? (
        <p className="text-[12px] text-[var(--mute)]">
          Você ainda não tem foto na galeria.{" "}
          <Link href="/app/images" className="font-medium text-[var(--ink)] underline">
            Criar uma agora
          </Link>
        </p>
      ) : (
        <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
          {galeria.slice(0, 16).map((img) => {
            const ativa = draft.fotoOriginal === img.image_url;
            return (
              <li key={img.id}>
                <button
                  type="button"
                  onClick={() =>
                    update({
                      fotoOriginal: ativa ? null : img.image_url,
                      // trocou a foto → a versão preparada não vale mais
                      fotoPronta: null,
                    })
                  }
                  className={`relative block aspect-[3/4] w-full overflow-hidden rounded-[var(--radius-sm)] border ${
                    ativa
                      ? "border-[var(--ink)] shadow-[0_0_0_1px_var(--ink)]"
                      : "border-[var(--hairline)] hover:border-[var(--hairline-strong)]"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.image_url ?? ""} alt="" className="h-full w-full object-cover" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {draft.fotoOriginal && (
        <div className="mt-1 flex flex-wrap items-center gap-3">
          {draft.fotoPronta ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={draft.fotoPronta}
                alt="foto preparada"
                className="h-24 w-[72px] rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] object-cover"
              />
              <div className="flex flex-col gap-0.5">
                <span className="text-[12.5px] font-medium text-[var(--ink)]">
                  ✓ Foto pronta pro React
                </span>
                <span className="text-[11.5px] text-[var(--mute)]">
                  enquadrada do meio do corpo pra cima, pronta pra entrar por cima do viral
                </span>
                <button
                  type="button"
                  onClick={preparar}
                  disabled={preparando}
                  className="mt-1 w-fit text-[11.5px] text-[var(--mute)] underline disabled:opacity-40"
                >
                  refazer
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={preparar}
                  disabled={preparando}
                  className="h-10 rounded-[var(--radius-sm)] bg-[var(--ink)] px-4 text-[13px] font-semibold text-[var(--surface-deep)] disabled:opacity-40"
                >
                  {preparando ? "Preparando sua foto…" : "Deixar a foto pronta pro React"}
                </button>
                {/* Foto JÁ preparada (ex.: saiu do preparo e está no histórico)
                    entra direto — sem pagar o preparo de novo (Johnny 17/08). */}
                <button
                  type="button"
                  onClick={() => update({ fotoPronta: draft.fotoOriginal })}
                  disabled={preparando}
                  className="h-10 rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] px-4 text-[13px] font-semibold text-[var(--ink)] disabled:opacity-40"
                >
                  Usar esta foto como está
                </button>
              </div>
              <span className="text-[11.5px] text-[var(--mute)]">
                &quot;Deixar pronta&quot; reenquadra do meio do corpo pra cima e prepara o fundo
                (leva menos de um minuto). Se a foto já está preparada — meio corpo e fundo
                verde —, use ela como está, sem custo.
              </span>
            </div>
          )}
        </div>
      )}

      {erro && <p className="text-[12px] text-red-400">{erro}</p>}
    </div>
  );
}
