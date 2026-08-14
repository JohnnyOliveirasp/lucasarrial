"use client";

/**
 * R3 — você ajusta o roteiro e decide o CTA.
 *
 * Duas regras que vieram da conversa de 14/08 e estão visíveis na tela:
 *  1. pedir mudança REESCREVE o roteiro inteiro (não cola parágrafo solto)
 *  2. o CTA é sempre o FIM e tem CENA PRÓPRIA — por isso ele não disputa o
 *     tempo do viral. Sem cena própria, a fala do CTA passaria do fim do
 *     vídeo e sobraria áudio sem imagem.
 */
import { useState } from "react";
import type { CtaCena, ReactDraft } from "./react-tipos";

export function ReactPassoAjuste({
  draft,
  update,
}: {
  draft: ReactDraft;
  update: (m: Partial<ReactDraft>) => void;
}) {
  const [pedido, setPedido] = useState("");
  const [oferta, setOferta] = useState("");
  const [ocupado, setOcupado] = useState<"roteiro" | "cta" | "limpar" | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [querCta, setQuerCta] = useState<boolean | null>(draft.cta ? true : null);

  async function chamar(modo: "reescrever" | "cta" | "limpar") {
    // "limpar" tira a chamada que o modelo colou no fim do comentário —
    // o pedido já vai pronto, a pessoa não precisa escrever nada.
    const texto =
      modo === "cta"
        ? oferta
        : modo === "limpar"
          ? "Remova QUALQUER chamada para ação do final (link na bio, acesse, saiba mais, me chama). O texto tem que terminar no comentário sobre o vídeo, sem convite nenhum."
          : pedido;
    if (!texto.trim()) return;
    setOcupado(modo === "cta" ? "cta" : modo === "limpar" ? "limpar" : "roteiro");
    setErro(null);
    try {
      const r = await fetch("/api/v1/react/ajustar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modo: modo === "limpar" ? "reescrever" : modo,
          roteiro: draft.roteiro,
          pedido: texto,
          duracao_seg: draft.viral?.duracao_seg ?? 30,
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        setErro(j?.error?.message ?? "Não consegui ajustar.");
        return;
      }
      if (modo === "cta") {
        update({ cta: j.cta });
      } else {
        update({ roteiro: j.roteiro });
        if (modo !== "limpar") setPedido("");
      }
    } catch {
      setErro("Falha de rede.");
    } finally {
      setOcupado(null);
    }
  }

  const duracao = draft.viral?.duracao_seg ? Math.round(draft.viral.duracao_seg) : null;
  const palavras = draft.roteiro.trim() ? draft.roteiro.trim().split(/\s+/).length : 0;
  const segundos = Math.round(palavras / 2.5);
  const estourou = duracao !== null && segundos > duracao;

  /**
   * O modelo às vezes escreve chamada no fim do roteiro mesmo mandado não
   * escrever (visto no teste do Johnny 14/08). Com o CTA separado, o vídeo
   * termina com DUAS chamadas seguidas.
   */
  const CHAMADA = /(link na bio|clica no link|acesse|acessa|chama no direct|saiba mais|comenta a palavra|me chama)/i;
  const ctaDuplicado = Boolean(draft.cta.trim()) && CHAMADA.test(draft.roteiro.slice(-160));

  /** A fala final é o que a voz vai dizer, na ordem: comentário + chamada. */
  const falaFinal = [draft.roteiro.trim(), draft.cta.trim()].filter(Boolean).join("\n\n");
  const palavrasFinal = falaFinal ? falaFinal.trim().split(/\s+/).length : 0;
  const segundosFinal = Math.round(palavrasFinal / 2.5);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-[15px] font-semibold text-[var(--ink)]">Ajuste e chamada final</h2>
        <p className="mt-0.5 text-[12.5px] text-[var(--mute)]">
          Peça a mudança em português e o roteiro é reescrito inteiro, com a sua ideia
          dentro — em vez de colar um parágrafo solto no meio. Cada ajuste custa 10 créditos.
        </p>
      </div>

      <textarea
        value={draft.roteiro}
        onChange={(e) => update({ roteiro: e.target.value })}
        rows={8}
        className="w-full rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] p-3 text-[13.5px] leading-relaxed text-[var(--ink)] outline-none focus:border-[var(--ink)]"
      />
      <p className="-mt-2 flex flex-wrap items-center gap-2 text-[12px] text-[var(--mute)]">
        <span>
          {palavras} palavras · ~{segundos}s de fala
          {duracao !== null ? ` · vídeo tem ${duracao}s` : ""}
        </span>
        {estourou && duracao !== null && (
          <span className="rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] px-2 py-0.5 text-[11.5px] text-[var(--ink)]">
            os últimos {segundos - duracao}s aparecem com você em tela cheia
          </span>
        )}
      </p>

      <div className="flex flex-col gap-2 rounded-[var(--radius-sm)] border border-[var(--hairline)] p-3">
        <label className="text-[12.5px] font-medium text-[var(--ink)]">
          O que você quer mudar?
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={pedido}
            onChange={(e) => setPedido(e.target.value)}
            placeholder="ex.: fala do meu caso com o cliente de Belém, e tira a parte técnica"
            className="h-10 flex-1 rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] px-3 text-[13px] text-[var(--ink)] outline-none focus:border-[var(--ink)]"
          />
          <button
            type="button"
            onClick={() => chamar("reescrever")}
            disabled={ocupado !== null || !pedido.trim()}
            className="h-10 rounded-[var(--radius-sm)] bg-[var(--ink)] px-4 text-[13px] font-semibold text-[var(--surface-deep)] disabled:opacity-40"
          >
            {ocupado === "roteiro" ? "Reescrevendo…" : "Reescrever"}
          </button>
        </div>
      </div>

      {/* CTA: pergunta explícita, como o Johnny pediu. */}
      <div className="flex flex-col gap-2 rounded-[var(--radius-sm)] border border-[var(--hairline)] p-3">
        <p className="text-[12.5px] font-medium text-[var(--ink)]">
          Depois do comentário, você quer chamar alguém pro seu site ou oferta?
        </p>
        <p className="text-[11.5px] text-[var(--mute)]">
          A chamada entra <strong className="text-[var(--ink)]">no fim</strong>, com cena
          própria — por isso ela não rouba tempo do viral.
        </p>
        <div className="flex flex-wrap gap-2">
          {[
            { v: true, r: "Sim, quero CTA" },
            { v: false, r: "Não, termina no comentário" },
          ].map((o) => (
            <button
              key={String(o.v)}
              type="button"
              onClick={() => {
                setQuerCta(o.v);
                if (!o.v) update({ cta: "" });
              }}
              className={`h-8 rounded-full border px-3 text-[12px] ${
                querCta === o.v
                  ? "border-[var(--ink)] bg-[var(--ink)] font-semibold text-[var(--surface-deep)]"
                  : "border-[var(--hairline-strong)] text-[var(--ink)]"
              }`}
            >
              {o.r}
            </button>
          ))}
        </div>

        {querCta && (
          <div className="mt-1 flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={oferta}
                onChange={(e) => setOferta(e.target.value)}
                placeholder="ex.: meu site de tradução para igrejas, traduzoja.com"
                className="h-10 flex-1 rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] px-3 text-[13px] text-[var(--ink)] outline-none focus:border-[var(--ink)]"
              />
              <button
                type="button"
                onClick={() => chamar("cta")}
                disabled={ocupado !== null || !oferta.trim()}
                className="h-10 rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] px-4 text-[13px] font-medium text-[var(--ink)] disabled:opacity-40"
              >
                {ocupado === "cta" ? "Escrevendo…" : "Escrever a chamada"}
              </button>
            </div>

            {draft.cta && (
              <>
                <textarea
                  value={draft.cta}
                  onChange={(e) => update({ cta: e.target.value })}
                  rows={3}
                  className="w-full rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] p-3 text-[13px] leading-relaxed text-[var(--ink)] outline-none focus:border-[var(--ink)]"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[12px] text-[var(--mute)]">O que aparece na tela:</span>
                  {(
                    [
                      { v: "avatar", r: "só você" },
                      { v: "cena", r: "uma cena minha (site, produto)" },
                    ] as { v: CtaCena; r: string }[]
                  ).map((o) => (
                    <button
                      key={o.v}
                      type="button"
                      onClick={() => update({ ctaCena: o.v })}
                      className={`h-8 rounded-full border px-3 text-[12px] ${
                        (draft.ctaCena ?? "avatar") === o.v
                          ? "border-[var(--ink)] bg-[var(--ink)] font-semibold text-[var(--surface-deep)]"
                          : "border-[var(--hairline-strong)] text-[var(--ink)]"
                      }`}
                    >
                      {o.r}
                    </button>
                  ))}
                </div>
                {(draft.ctaCena ?? "avatar") === "cena" && (
                  <p className="text-[11.5px] text-[var(--mute)]">
                    Você sobe a imagem ou o vídeo do CTA no passo da montagem.
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* A fala final: é isso que a voz vai dizer, costurado. Sem este bloco
          a pessoa tem dois textos soltos e nenhuma ideia do resultado
          (dúvida do Johnny no teste de 14/08). */}
      {falaFinal && (
        <div className="flex flex-col gap-2 rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] p-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[12.5px] font-semibold text-[var(--ink)]">
              A fala final — é isso que a sua voz vai dizer
            </p>
            <span className="ml-auto text-[11.5px] text-[var(--mute)]">
              {palavrasFinal} palavras · ~{segundosFinal}s
            </span>
          </div>
          <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-[var(--ink)]">
            {falaFinal}
          </p>
          {draft.cta && (
            <p className="text-[11.5px] text-[var(--mute)]">
              A parte final ({Math.round(draft.cta.trim().split(/\s+/).length / 2.5)}s) roda na
              cena da chamada, depois do vídeo — não disputa os {duracao ?? "?"}s do viral.
            </p>
          )}
          {ctaDuplicado && (
            <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] px-2.5 py-2">
              <span className="text-[11.5px] text-[var(--ink)]">
                ⚠️ Seu comentário já termina com uma chamada — vai ficar chamando duas vezes
                seguidas.
              </span>
              <button
                type="button"
                onClick={() => chamar("limpar")}
                disabled={ocupado !== null}
                className="ml-auto h-8 rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] px-3 text-[11.5px] text-[var(--ink)] disabled:opacity-40"
              >
                {ocupado === "limpar" ? "Tirando…" : "Tirar a chamada do comentário"}
              </button>
            </div>
          )}
        </div>
      )}

      {erro && <p className="text-[12.5px] text-red-400">{erro}</p>}
    </div>
  );
}
