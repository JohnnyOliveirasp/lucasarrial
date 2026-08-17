"use client";

/**
 * O que dá pra fazer com um viral guardado.
 *
 * São DUAS saídas de verdade (a terceira que o Johnny descreveu — "importar o
 * link pro Edição" — é a mesma coisa que "usar a ideia": o Estúdio já
 * transforma link em roteiro. Dois botões pro mesmo destino só geram dúvida
 * sobre qual clicar).
 */
import { useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { DRAFT_VAZIO } from "@/components/react/react-tipos";
import { compacto } from "./virais-estilo";
import type { Viral } from "./virais-tipos";

export function PainelViral({
  v,
  onFechar,
  onDevolver,
}: {
  v: Viral;
  onFechar: () => void;
  onDevolver: () => void;
}) {
  const router = useRouter();
  const [copiado, setCopiado] = useState(false);
  const [estado, setEstado] = useState(v.download_status);
  const [baixando, setBaixando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  /**
   * Abre o wizard do React JÁ com este viral escolhido (rascunho novo no
   * localStorage — mesmo formato do ReactWizard). O botão ficou "disabled"
   * de 14→17/08 porque nasceu ANTES do wizard existir e ninguém religou;
   * o Johnny achou na tela.
   */
  function fazerReact() {
    try {
      localStorage.setItem(
        "fc-react-draft-v1",
        JSON.stringify({
          ...DRAFT_VAZIO,
          viral: {
            id: v.id,
            url: v.url,
            autor: v.autor ?? null,
            thumb_url: v.thumb_url ?? null,
            duracao_seg: v.duracao_seg ?? null,
            likes: v.likes ?? 0,
            download_status: estado,
          },
        }),
      );
    } catch {
      /* sem localStorage: o wizard abre e a pessoa escolhe na prateleira */
    }
    router.push("/app/lab/react");
  }

  async function baixar() {
    setBaixando(true);
    setErro(null);
    try {
      const r = await fetch("/api/v1/virais/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ viral_id: v.id }),
      });
      const j = await r.json();
      if (r.ok) {
        setEstado("pronto");
      } else {
        setEstado("erro");
        setErro(j?.error?.message ?? "Não consegui baixar agora.");
      }
    } catch {
      setErro("Falha de rede ao baixar.");
    } finally {
      setBaixando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onFechar}
      role="presentation"
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col gap-3 overflow-auto rounded-[16px] border border-[var(--hairline)] bg-[var(--surface)] p-4"
        onClick={(e) => e.stopPropagation()}
        role="presentation"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-[16px] font-semibold text-[var(--ink)]">@{v.autor ?? "?"}</h3>
            <p className="text-[12px] text-[var(--mute)]">
              ❤️ {compacto(v.likes)}
              {v.views ? ` · ${compacto(v.views)} views` : ""}
              {v.duracao_seg ? ` · ${Math.round(v.duracao_seg)}s` : ""}
              {v.usando > 1 ? ` · 👤 ${v.usando} pessoas usando` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onFechar}
            className="h-8 rounded-[8px] border border-[var(--hairline)] px-3 text-[13px] text-[var(--ink)]"
          >
            Fechar
          </button>
        </div>

        <div className="flex gap-3">
          {v.thumb_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={v.thumb_url}
              alt=""
              className="h-40 w-[90px] shrink-0 rounded-[8px] object-cover"
              referrerPolicy="no-referrer"
            />
          )}
          <p className="line-clamp-6 text-[13px] leading-relaxed text-[var(--ink)]">
            {v.legenda || "(sem descrição)"}
          </p>
        </div>

        <div className="flex flex-col gap-2 border-t border-[var(--hairline)] pt-3">
          <button
            type="button"
            onClick={fazerReact}
            className="flex h-11 items-center justify-center gap-2 rounded-[var(--radius-sm)] bg-[var(--ink)] text-[14px] font-semibold text-[var(--surface-deep)]"
          >
            ▶ Fazer React com este vídeo
          </button>

          {/* O download vive AQUI: guardar não baixa nada, o arquivo só nasce
              quando a pessoa vai produzir. Enquanto o wizard não existe, o
              botão fica avulso pra dar pra testar e baixar o material. */}
          <button
            type="button"
            onClick={baixar}
            disabled={baixando || estado === "pronto"}
            className="flex h-10 items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] text-[13px] font-medium text-[var(--ink)] disabled:opacity-50"
          >
            {estado === "pronto"
              ? "✓ vídeo baixado"
              : baixando
                ? "Baixando do TikTok…"
                : "⬇ Baixar o vídeo agora"}
          </button>
          {erro ? (
            <p className="text-center text-[11px] text-red-400">{erro}</p>
          ) : (
            <p className="text-center text-[11px] text-[var(--mute)]">
              o vídeo é baixado só quando você for produzir — sem marca d&apos;água
            </p>
          )}

          <Link
            href={`/app/videos/edicao?link=${encodeURIComponent(v.url)}`}
            className="flex h-11 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] text-[14px] font-medium text-[var(--ink)]"
          >
            💡 Usar a ideia no Estúdio Automático
          </Link>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(v.url);
                setCopiado(true);
                setTimeout(() => setCopiado(false), 2000);
              }}
              className="h-8 rounded-[var(--radius-sm)] border border-[var(--hairline)] px-3 text-[12px] text-[var(--ink)]"
            >
              {copiado ? "copiado!" : "copiar link"}
            </button>
            <a
              href={v.url}
              target="_blank"
              rel="noreferrer"
              className="h-8 rounded-[var(--radius-sm)] border border-[var(--hairline)] px-3 text-[12px] leading-8 text-[var(--ink)]"
            >
              abrir no TikTok
            </a>
            <button
              type="button"
              onClick={onDevolver}
              title="Tira da sua prateleira — não apaga pra mais ninguém"
              className="ml-auto h-8 px-2 text-[12px] text-[var(--mute)] underline"
            >
              tirar de Meus Virais
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
