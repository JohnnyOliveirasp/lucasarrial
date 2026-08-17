"use client";

/**
 * "Vídeos Virais" — parte 1: achar o viral do nicho e escolher o que baixar.
 *
 * A tela segue o caminho natural (ajuste do Johnny 14/08): primeiro os
 * PARÂMETROS e o botão, depois os RESULTADOS. Os filtros do acervo ficam
 * junto da lista, não misturados com a busca — antes pareciam dois
 * formulários concorrentes.
 *
 * Só o vídeo MARCADO desce pro R2 depois: a busca traz centenas e o bucket
 * não pode virar depósito de vídeo ruim.
 */
import { useCallback, useEffect, useState } from "react";
import type { TemaAcervo } from "@/lib/virais/acervo";
import { GRADE } from "./virais-estilo";
import type { Filtros } from "./virais-filtros";
import { FILTROS_INICIAIS, ViraisFiltros } from "./virais-filtros";
import { FormBusca, ImportarBuscas } from "./virais-form-busca";
import { Miniatura } from "./virais-miniatura";
import { ViralPlayer } from "./virais-player";
import type { Viral } from "./virais-tipos";

export type { Viral } from "./virais-tipos";
export { compacto } from "./virais-estilo";

/**
 * Página = 4 linhas da grade no desktop largo (14 colunas × 4 — regra do
 * Johnny 17/08: TODO o acervo alcançável, paginado; nada de teto escondendo
 * vídeo como o 300 fixo fazia).
 */
const POR_PAGINA = 56;

export function ViraisBusca() {
  const [videos, setVideos] = useState<Viral[]>([]);
  const [temas, setTemas] = useState<TemaAcervo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [aberto, setAberto] = useState<Viral | null>(null);
  const [f, setF] = useState<Filtros>(FILTROS_INICIAIS);
  const [limpando, setLimpando] = useState(false);
  const [recado, setRecado] = useState<string | null>(null);
  /** Seleção múltipla estilo caixa de e-mail — NÃO é o "guardar". */
  const [selecao, setSelecao] = useState<Set<string>>(new Set());
  const [pagina, setPagina] = useState(1);
  /** Total do FILTRO no servidor — é dele que saem os números das páginas. */
  const [total, setTotal] = useState(0);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const qs = new URLSearchParams({
        min_likes: String(f.minLikes),
        dias: String(f.dias),
        ordem: f.ordem,
        termo: f.termo,
        meus: f.soSelecionados ? "1" : "0",
        limite: String(POR_PAGINA),
        offset: String((pagina - 1) * POR_PAGINA),
      });
      const r = await fetch(`/api/v1/virais/videos?${qs}`);
      const j = await r.json();
      setVideos(r.ok ? j.videos ?? [] : []);
      if (r.ok) {
        setTemas(j.temas ?? []);
        setTotal(j.total ?? 0);
      }
    } finally {
      setCarregando(false);
    }
  }, [f, pagina]);

  // Respiro antes de ir ao servidor: sem isto, cada tecla do campo de texto
  // (e cada ficha clicada em sequência) vira uma consulta.
  useEffect(() => {
    const t = setTimeout(() => void carregar(), 250);
    return () => clearTimeout(t);
  }, [carregar]);

  async function alternar(v: Viral) {
    const novo = !v.reservado;
    setVideos((atual) => atual.map((x) => (x.id === v.id ? { ...x, reservado: novo } : x)));
    setAberto((a) => (a && a.id === v.id ? { ...a, reservado: novo } : a));
    const r = await fetch("/api/v1/virais/videos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: v.id, reservado: novo }),
    });
    if (!r.ok) {
      setVideos((atual) => atual.map((x) => (x.id === v.id ? { ...x, reservado: !novo } : x)));
    }
  }

  const marcados = videos.filter((v) => v.reservado).length;

  function alternarSelecao(id: string) {
    setSelecao((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  function selecionarTodos() {
    setSelecao((atual) =>
      atual.size === videos.length ? new Set() : new Set(videos.map((v) => v.id)),
    );
  }

  /** Apaga exatamente os selecionados (o que a caixinha do card marcou). */
  async function apagarSelecionados() {
    const ids = [...selecao];
    if (ids.length === 0) return;
    const comMarca = videos.filter((v) => selecao.has(v.id) && v.reservado).length;
    const aviso = comMarca > 0 ? `\n\n⚠️ ${comMarca} deles estão na sua lista de download.` : "";
    if (!window.confirm(`Jogar fora ${ids.length} vídeos? Eles não voltam em buscas futuras.${aviso}`)) return;
    setLimpando(true);
    try {
      const r = await fetch("/api/v1/virais/videos", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const j = await r.json();
      if (r.ok) {
        setRecado(`${j.apagados} vídeos jogados fora.`);
        setSelecao(new Set());
        await carregar();
      } else {
        setRecado(j?.error?.message ?? "Não consegui apagar.");
      }
    } finally {
      setLimpando(false);
    }
  }

  /** Guarda de uma vez todos os selecionados em Meus Virais. */
  async function marcarSelecionados() {
    const ids = [...selecao];
    if (ids.length === 0) return;
    setLimpando(true);
    try {
      for (const id of ids) {
        await fetch("/api/v1/virais/videos", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, reservado: true }),
        });
      }
      setRecado(`${ids.length} vídeos guardados em Meus Virais.`);
      setSelecao(new Set());
      await carregar();
    } finally {
      setLimpando(false);
    }
  }

  /** Faxina: joga fora o que não presta e mantém a curadoria intacta. */
  async function limpar() {
    const ok = window.confirm(
      `Jogar fora TODOS os vídeos que você NÃO marcou?\n\n` +
        `Os ${marcados} marcados continuam aqui. Isso não apaga nada no TikTok — ` +
        `só some daqui — e a próxima busca não traz eles de volta.`,
    );
    if (!ok) return;
    setLimpando(true);
    try {
      const r = await fetch("/api/v1/virais/videos", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ escopo: "nao_marcados" }),
      });
      const j = await r.json();
      if (r.ok) {
        setRecado(`${j.apagados} vídeos jogados fora (não voltam em buscas futuras).`);
        await carregar();
      } else {
        setRecado(j?.error?.message ?? "Não consegui limpar.");
      }
    } finally {
      setLimpando(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <FormBusca onPronto={carregar} />

      <section className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-[15px] font-semibold text-[var(--ink)]">
            Resultados
            <span className="ml-2 text-[13px] font-normal text-[var(--mute)]">
              {videos.length} vídeos · {marcados} em Meus Virais
            </span>
          </h2>
          <button
            type="button"
            onClick={limpar}
            disabled={limpando || videos.length === 0}
            title="Joga fora, só da SUA grade, tudo que você não guardou"
            className="ml-auto h-8 rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] px-3 text-[12px] text-[var(--ink)] disabled:opacity-40"
          >
            {limpando ? "Limpando…" : "Limpar não guardados"}
          </button>
        </div>

        <ViraisFiltros
          f={f}
          temas={temas}
          onMudar={(novo) => {
            setF(novo);
            setPagina(1); // filtro novo = volta pra 1ª página, senão cai numa página vazia
          }}
        />

        {recado && <p className="text-[13px] text-[var(--ink)]">{recado}</p>}

        {/* Barra de ações em massa — só aparece quando há seleção. */}
        {videos.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--hairline)] bg-[var(--surface)] px-3 py-1.5">
            <label className="flex items-center gap-1.5 text-[12px] text-[var(--ink)]">
              <input
                type="checkbox"
                checked={selecao.size === videos.length && videos.length > 0}
                onChange={selecionarTodos}
              />
              selecionar todos
            </label>
            <span className="text-[12px] text-[var(--mute)]">
              {selecao.size > 0 ? `${selecao.size} selecionados` : "nenhum selecionado"}
            </span>
            {selecao.size > 0 && (
              <>
                <button
                  type="button"
                  onClick={marcarSelecionados}
                  disabled={limpando}
                  className="h-7 rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] px-3 text-[12px] text-[var(--ink)] disabled:opacity-40"
                >
                  guardar em Meus Virais
                </button>
                <button
                  type="button"
                  onClick={apagarSelecionados}
                  disabled={limpando}
                  className="h-7 rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] px-3 text-[12px] font-medium text-[var(--ink)] disabled:opacity-40"
                >
                  {limpando ? "…" : `apagar ${selecao.size}`}
                </button>
                <button
                  type="button"
                  onClick={() => setSelecao(new Set())}
                  className="h-7 px-2 text-[12px] text-[var(--mute)] underline"
                >
                  cancelar
                </button>
              </>
            )}
          </div>
        )}

        {carregando ? (
          <p className="text-[14px] text-[var(--mute)]">Carregando…</p>
        ) : videos.length === 0 ? (
          <p className="rounded-[var(--radius)] border border-dashed border-[var(--hairline-strong)] p-8 text-center text-[14px] text-[var(--mute)]">
            Nenhum vídeo aqui ainda. Preencha um dos campos lá em cima e clique em{" "}
            <strong className="text-[var(--ink)]">Buscar virais</strong>.
          </p>
        ) : (
          <>
            <ul className={GRADE}>
              {videos.map((v) => (
                <Miniatura
                  key={v.id}
                  v={v}
                  selecionadoNaLista={selecao.has(v.id)}
                  onSelecionar={() => alternarSelecao(v.id)}
                  onAbrir={() => setAberto(v)}
                  onMarcar={() => alternar(v)}
                />
              ))}
            </ul>
            <Paginacao
              pagina={pagina}
              total={total}
              onIr={(p) => {
                setPagina(p);
                setSelecao(new Set()); // a seleção é da página que estava na tela
              }}
            />
          </>
        )}
      </section>

      <ImportarBuscas onImportou={carregar} />

      {aberto && (
        <ViralPlayer v={aberto} onFechar={() => setAberto(null)} onMarcar={() => alternar(aberto)} />
      )}
    </div>
  );
}

/**
 * Barra de páginas — números com janela (1 … 4 5 6 … 12), estilo ficha.
 * Só aparece quando o filtro tem mais de uma página.
 */
function Paginacao({
  pagina,
  total,
  onIr,
}: {
  pagina: number;
  total: number;
  onIr: (p: number) => void;
}) {
  const paginas = Math.ceil(total / POR_PAGINA);
  if (paginas <= 1) return null;

  // Janela: primeira, última e as vizinhas da atual; o resto vira "…".
  const alvo = new Set([1, paginas, pagina - 1, pagina, pagina + 1]);
  const itens: (number | "…")[] = [];
  for (let p = 1; p <= paginas; p++) {
    if (alvo.has(p)) itens.push(p);
    else if (itens[itens.length - 1] !== "…") itens.push("…");
  }

  const botao =
    "h-8 min-w-8 rounded-[var(--radius-sm)] border px-2 text-[12.5px] disabled:opacity-40";
  return (
    <nav className="flex flex-wrap items-center justify-center gap-1.5 pt-2">
      <button
        type="button"
        disabled={pagina === 1}
        onClick={() => onIr(pagina - 1)}
        className={`${botao} border-[var(--hairline-strong)] text-[var(--ink)]`}
      >
        ‹
      </button>
      {itens.map((p, i) =>
        p === "…" ? (
          <span key={`e${i}`} className="px-1 text-[12.5px] text-[var(--ash)]">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onIr(p)}
            className={`${botao} ${
              p === pagina
                ? "border-[var(--ink)] bg-[var(--ink)] font-semibold text-[var(--surface-deep)]"
                : "border-[var(--hairline-strong)] text-[var(--ink)]"
            }`}
          >
            {p}
          </button>
        ),
      )}
      <button
        type="button"
        disabled={pagina === paginas}
        onClick={() => onIr(pagina + 1)}
        className={`${botao} border-[var(--hairline-strong)] text-[var(--ink)]`}
      >
        ›
      </button>
      <span className="ml-2 text-[12px] text-[var(--mute)]">
        página {pagina} de {paginas} · {total.toLocaleString("pt-BR")} vídeos
      </span>
    </nav>
  );
}
