"use client";

/**
 * R2 — a LLM assiste o viral e escreve o comentário.
 *
 * A conta de tempo fica VISÍVEL: a fala precisa caber na duração do viral,
 * senão a montagem não fecha. Melhor a pessoa ver isso aqui do que descobrir
 * depois de gastar crédito de clone (105 cr/s).
 */
import { useState } from "react";
import type { ReactDraft } from "./react-tipos";

type Resposta = {
  roteiro: string;
  /** O que o modelo viu na tela — prova de que ele assistiu mesmo. */
  descricao?: string;
  tem_fala: boolean;
  palavras: number;
  palavras_alvo: number;
  segundos_estimados: number;
  duracao_viral: number;
  /** Quanto custa apertar de novo (a 1ª vem inclusa no React). */
  proxima_custa?: number;
  escritas?: number;
};

export function ReactPassoRoteiro({
  draft,
  update,
}: {
  draft: ReactDraft;
  update: (m: Partial<ReactDraft>) => void;
}) {
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [info, setInfo] = useState<Resposta | null>(null);

  async function gerar() {
    if (!draft.viral) return;
    setGerando(true);
    setErro(null);
    try {
      const r = await fetch("/api/v1/react/roteiro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ viral_id: draft.viral.id, ideia: draft.ideia.trim() || undefined }),
      });
      const j = await r.json();
      if (r.ok) {
        setInfo(j as Resposta);
        update({ roteiro: j.roteiro });
      } else {
        setErro(j?.error?.message ?? "Não consegui escrever o roteiro.");
      }
    } catch {
      setErro("Falha de rede.");
    } finally {
      setGerando(false);
    }
  }

  const duracao = draft.viral?.duracao_seg ? Math.round(draft.viral.duracao_seg) : null;
  const palavras = draft.roteiro.trim() ? draft.roteiro.trim().split(/\s+/).length : 0;
  const segundos = Math.round(palavras / 2.5);
  const estourou = duracao !== null && segundos > duracao;

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="text-[15px] font-semibold text-[var(--ink)]">O que você vai falar</h2>
        <p className="mt-0.5 text-[12.5px] text-[var(--mute)]">
          A plataforma <strong>assiste</strong> o vídeo de{" "}
          <strong>@{draft.viral?.autor ?? "?"}</strong> — imagem e áudio — e escreve o seu
          comentário. Você ajusta depois: o texto é seu.
        </p>
      </div>

      <div>
        <label className="text-[12.5px] font-medium text-[var(--ink)]" htmlFor="react-ideia">
          Qual é a sua ideia? <span className="font-normal text-[var(--mute)]">(opcional, mas muda tudo)</span>
        </label>
        <textarea
          id="react-ideia"
          value={draft.ideia}
          onChange={(e) => update({ ideia: e.target.value })}
          rows={2}
          maxLength={500}
          placeholder="ex.: meu produto é tradução simultânea para igrejas — conecta o vídeo a isso"
          className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] p-3 text-[13px] leading-relaxed text-[var(--ink)] outline-none placeholder:text-[var(--mute)] focus:border-[var(--ink)]"
        />
        <p className="mt-0.5 text-[11.5px] text-[var(--mute)]">
          Sem isso, o comentário sai só no tema do vídeo. Com a ideia, ele puxa a reação pro seu assunto.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={gerar}
          disabled={gerando || !draft.viral}
          className="h-10 rounded-[var(--radius-sm)] bg-[var(--ink)] px-4 text-[13.5px] font-semibold text-[var(--surface-deep)] disabled:opacity-40"
        >
          {gerando
            ? "Assistindo o vídeo…"
            : draft.roteiro
              ? "Escrever de novo"
              : "Escrever meu comentário"}
        </button>
        {gerando ? (
          <span className="text-[12px] text-[var(--mute)]">
            ele vê e ouve o vídeo inteiro antes de escrever — leva uns 20 segundos
          </span>
        ) : (
          <span className="text-[12px] text-[var(--mute)]">
            {draft.roteiro
              ? `escrever de novo custa ${info?.proxima_custa ?? 50} créditos — ele assiste o vídeo outra vez`
              : "a primeira escrita já está inclusa no React"}
          </span>
        )}
      </div>

      {erro && <p className="text-[12.5px] text-red-400">{erro}</p>}

      {info?.descricao && (
        <p className="rounded-[var(--radius-sm)] border border-[var(--hairline)] px-3 py-2 text-[12px] text-[var(--mute)]">
          <strong className="text-[var(--ink)]">O que ele viu:</strong> {info.descricao}
          {!info.tem_fala && " (o vídeo não tem fala — o roteiro saiu do que aparece na tela)"}
        </p>
      )}

      {draft.roteiro && (
        <>
          <textarea
            value={draft.roteiro}
            onChange={(e) => update({ roteiro: e.target.value })}
            rows={10}
            className="w-full rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] p-3 text-[13.5px] leading-relaxed text-[var(--ink)] outline-none focus:border-[var(--ink)]"
          />
          <div className="flex flex-wrap items-center gap-3 text-[12px]">
            <span className="text-[var(--mute)]">
              {palavras} palavras · <strong className="text-[var(--ink)]">~{segundos}s</strong> de fala
              {duracao !== null ? ` · vídeo tem ${duracao}s` : ""}
            </span>
            {estourou && duracao !== null && (
              <span className="rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] px-2 py-0.5 text-[11.5px] text-[var(--ink)]">
                o vídeo acaba antes: os últimos {segundos - duracao}s ficam com você em tela cheia
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
