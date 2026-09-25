"use client";

/**
 * R0 — qual viral você vai comentar.
 *
 * DUAS FONTES (pedido do Johnny 22/09), escolhidas pela prop `fonte`:
 *  • "garimpo" (pré-produção, admin): a prateleira do acervo pago da casa —
 *    exatamente como era, sem mudar nada pra quem já usa;
 *  • "comunidade" (alunos): o acervo que a turma enviou + o vídeo que a
 *    própria pessoa subir aqui, que fica PRIVADO dela.
 *
 * O upload daqui nasce privado de propósito: "este vídeo que ela subir não vai
 * para os virais de todos, fica somente para a pessoa que subiu".
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@/i18n/navigation";
import { compacto } from "@/components/lab/virais-estilo";
import { LIMITE_VIRAL, recusaPorDuracao, recusaPorTamanho } from "@/lib/virais/limites";
import type { ReactDraft, ViralEscolhido } from "./react-tipos";

type Fonte = "garimpo" | "comunidade";

/** O card da comunidade no formato que o wizard entende. */
type LinhaComunidade = {
  id: string;
  url: string;
  autor: string | null;
  thumbUrl: string | null;
  duracaoSegundos: number | null;
  likes: number | null;
  videoUrl: string | null;
  publico: boolean;
};

const daComunidade = (v: LinhaComunidade): ViralEscolhido => ({
  id: v.id,
  url: v.url,
  autor: v.autor,
  thumb_url: v.thumbUrl,
  duracao_seg: v.duracaoSegundos,
  likes: v.likes ?? 0,
  // Vídeo do acervo da turma já está no nosso R2: nada pra baixar depois.
  download_status: v.videoUrl ? "pronto" : "",
});

/** Duração sem subir nada: o navegador lê do cabeçalho do arquivo. */
async function duracaoDoArquivo(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(v.duration) ? v.duration : null);
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    v.src = url;
  });
}

export function ReactPassoVideo({
  draft,
  update,
  fonte = "garimpo",
}: {
  draft: ReactDraft;
  update: (m: Partial<ReactDraft>) => void;
  fonte?: Fonte;
}) {
  const [lista, setLista] = useState<ViralEscolhido[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [subindo, setSubindo] = useState<string | null>(null);
  const [erroUpload, setErroUpload] = useState<string | null>(null);
  const inputArquivo = useRef<HTMLInputElement>(null);

  const carregar = useCallback(async () => {
    try {
      const rota =
        fonte === "comunidade"
          ? "/api/v1/virais/comunidade?pagina=1&meus_privados=1"
          : "/api/v1/virais/videos?meus=1&limite=120&ordem=score";
      const r = await fetch(rota, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) setLista([]);
      else if (fonte === "comunidade") setLista((j.videos ?? []).map(daComunidade));
      else setLista(j.videos ?? []);
    } finally {
      setCarregando(false);
    }
  }, [fonte]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  /** Upload do próprio vídeo — PRIVADO: não entra no acervo de todos. */
  async function enviarMeuVideo(f: File | null) {
    if (!f) return;
    setErroUpload(null);
    if (f.size > LIMITE_VIRAL.bytes) {
      setErroUpload(recusaPorTamanho(f.size));
      return;
    }
    const seg = await duracaoDoArquivo(f);
    if (seg !== null && seg > LIMITE_VIRAL.segundos) {
      setErroUpload(recusaPorDuracao(seg));
      return;
    }
    try {
      setSubindo("preparando…");
      const r1 = await fetch("/api/v1/virais/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content_type: f.type || "video/mp4",
          bytes: f.size,
          filename: f.name,
        }),
      });
      const j1 = await r1.json();
      if (!r1.ok) throw new Error(j1?.error?.message || "Não consegui preparar o envio.");

      setSubindo("enviando " + (f.size / 1024 / 1024).toFixed(0) + " MB…");
      const put = await fetch(j1.upload_url as string, {
        method: "PUT",
        headers: { "Content-Type": f.type || "video/mp4" },
        body: f,
      });
      if (!put.ok) throw new Error("O envio do arquivo falhou.");

      setSubindo("guardando…");
      const r2 = await fetch("/api/v1/virais/enviar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // A duração vai junto: é ela que dimensiona o roteiro e o corte. Sem
        // ela todo vídeo do aluno valeria 30s no passo 3 (chamado #540).
        body: JSON.stringify({
          arquivo_key: j1.key,
          titulo: f.name,
          privado: true,
          duracao_seg: seg,
        }),
      });
      const j2 = await r2.json();
      if (!r2.ok) throw new Error(j2?.error?.message || "Não consegui guardar o vídeo.");
      await carregar();
      if (inputArquivo.current) inputArquivo.current.value = "";
    } catch (e) {
      setErroUpload(e instanceof Error ? e.message : "Não consegui enviar o vídeo.");
    } finally {
      setSubindo(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="text-[15px] font-semibold text-[var(--ink)]">
          Qual vídeo você vai comentar?
        </h2>
        <p className="mt-0.5 text-[12.5px] text-[var(--mute)]">
          {fonte === "comunidade"
            ? "Escolha um viral que a turma enviou — ou mande o seu, que fica só na sua conta."
            : "Escolha um dos virais que você guardou. O arquivo só é baixado quando o React for gerado — guardar não baixa nada."}
        </p>
      </div>

      {fonte === "comunidade" && (
        <div className="flex flex-col gap-1 rounded-[var(--radius-sm)] border border-dashed border-[var(--hairline-strong)] px-3 py-2.5">
          <label className="flex cursor-pointer flex-wrap items-center gap-2 text-[12.5px] text-[var(--mute)]">
            <span className="font-medium text-[var(--ink)]">Usar um vídeo meu:</span>
            <input
              ref={inputArquivo}
              type="file"
              accept="video/mp4,video/quicktime,video/webm"
              disabled={!!subindo}
              onChange={(e) => void enviarMeuVideo(e.target.files?.[0] ?? null)}
              className="text-[11px] file:mr-2 file:rounded file:border-0 file:bg-[var(--surface-elevated)] file:px-2 file:py-1 file:text-[11px] file:text-[var(--ink)]"
            />
          </label>
          <span className="font-mono text-[10.5px] text-[var(--ash)]">
            fica só na sua conta, não entra no acervo da turma · até {LIMITE_VIRAL.mb} MB e{" "}
            {LIMITE_VIRAL.segundos / 60} minutos
          </span>
          {subindo && <span className="font-mono text-[10.5px] text-[var(--ash)]">{subindo}</span>}
          {erroUpload && (
            <span className="text-[11.5px] text-[var(--status-error)]">{erroUpload}</span>
          )}
        </div>
      )}

      {carregando ? (
        <p className="text-[13px] text-[var(--mute)]">Carregando sua prateleira…</p>
      ) : lista.length === 0 ? (
        <div className="rounded-[var(--radius-sm)] border border-dashed border-[var(--hairline-strong)] p-6 text-center">
          <p className="text-[13.5px] text-[var(--mute)]">
            {fonte === "comunidade" ? (
              <>
                Nenhum viral por aqui ainda. Mande um em{" "}
                <Link href="/app/videos/virais" className="font-medium text-[var(--ink)] underline">
                  Vídeos · Virais
                </Link>{" "}
                ou envie o seu no campo acima.
              </>
            ) : (
              <>
                Sua prateleira está vazia. Garimpe na{" "}
                <Link href="/app/lab/virais" className="font-medium text-[var(--ink)] underline">
                  Galeria de Vídeos Virais
                </Link>{" "}
                e guarde os que quiser usar.
              </>
            )}
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
          {lista.map((v) => {
            const escolhido = draft.viral?.id === v.id;
            return (
              <li key={v.id}>
                <button
                  type="button"
                  onClick={() =>
                    // Trocar de vídeo LIMPA o que era do vídeo antigo (caso
                    // Johnny 17/08: roteiro velho seguia na tela). Fica o que
                    // é da PESSOA: foto, ideia, voz, layout e legenda.
                    update({
                      viral: escolhido ? null : v,
                      roteiro: "",
                      cta: "",
                      audioUrl: null,
                      audioGenId: null,
                      jobId: null,
                    })
                  }
                  title={`@${v.autor ?? "?"} · ${compacto(v.likes)} likes`}
                  className={`relative block w-full overflow-hidden rounded-[var(--radius-sm)] border transition-colors ${
                    escolhido
                      ? "border-[var(--ink)] shadow-[0_0_0_1px_var(--ink)]"
                      : "border-[var(--hairline)] hover:border-[var(--hairline-strong)]"
                  }`}
                >
                  {v.thumb_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={v.thumb_url}
                      alt=""
                      className="aspect-[9/16] w-full object-cover"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span className="flex aspect-[9/16] w-full items-center justify-center bg-black/70 text-[10px] text-white/60">
                      sem capa
                    </span>
                  )}
                  {escolhido && (
                    <span className="absolute right-0.5 top-0.5 rounded bg-[var(--ink)] px-1 text-[9px] font-semibold text-[var(--surface-deep)]">
                      ✓
                    </span>
                  )}
                  {v.download_status === "pronto" && (
                    <span
                      className="absolute bottom-0.5 left-0.5 rounded bg-black/70 px-1 text-[9px] text-white/90"
                      title="Arquivo já baixado"
                    >
                      ⬇
                    </span>
                  )}
                </button>
                <span className="mt-0.5 block truncate text-[9px] text-[var(--mute)]">
                  {v.duracao_seg ? `${Math.round(v.duracao_seg)}s · ` : ""}
                  {compacto(v.likes)}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {draft.viral && (
        <p className="rounded-[var(--radius-sm)] bg-[var(--surface-deep)] px-3 py-2 text-[12.5px] text-[var(--ink)]">
          Escolhido: <strong>@{draft.viral.autor ?? "?"}</strong>
          {draft.viral.duracao_seg ? ` · ${Math.round(draft.viral.duracao_seg)}s de vídeo` : ""}
          {draft.viral.download_status === "pronto" ? " · arquivo já baixado" : ""}
        </p>
      )}
    </div>
  );
}
