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
import { ViralPlayer } from "./virais-player";

export type Viral = {
  id: string;
  plataforma: string;
  video_id: string;
  url: string;
  autor: string | null;
  autor_seguidores: number | null;
  legenda: string | null;
  likes: number;
  views: number | null;
  comentarios: number | null;
  publicado_em: string | null;
  duracao_seg: number | null;
  thumb_url: string | null;
  video_url: string | null;
  hashtags: string[] | null;
  termo_busca: string | null;
  selecionado: boolean;
  download_status: string;
};

type Run = {
  id: string;
  status: string;
  terminado_em: string | null;
  dataset_id: string | null;
  itens: number | null;
};

const PERIODOS = [
  { id: "THIS_WEEK", rotulo: "Últimos 7 dias" },
  { id: "THIS_MONTH", rotulo: "Último mês" },
  { id: "LAST_THREE_MONTHS", rotulo: "Últimos 3 meses" },
  { id: "LAST_SIX_MONTHS", rotulo: "Últimos 6 meses" },
  { id: "ALL_TIME", rotulo: "Qualquer data" },
];

const CAMPO =
  "rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] px-3 text-[13px] text-[var(--ink)] outline-none focus:border-[var(--ink)]";
const BOTAO =
  "rounded-[var(--radius-sm)] bg-[var(--ink)] px-5 text-[14px] font-semibold text-[var(--surface-deep)] disabled:opacity-40";

export function ViraisBusca() {
  const [videos, setVideos] = useState<Viral[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [aberto, setAberto] = useState<Viral | null>(null);
  const [minLikes, setMinLikes] = useState(0);
  const [filtro, setFiltro] = useState("");
  const [soSelecionados, setSoSelecionados] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const qs = new URLSearchParams({
        min_likes: String(minLikes),
        termo: filtro,
        selecionados: soSelecionados ? "1" : "0",
        limite: "60",
      });
      const r = await fetch(`/api/v1/virais/videos?${qs}`);
      const j = await r.json();
      setVideos(r.ok ? j.videos ?? [] : []);
    } finally {
      setCarregando(false);
    }
  }, [minLikes, filtro, soSelecionados]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function alternar(v: Viral) {
    const novo = !v.selecionado;
    setVideos((atual) => atual.map((x) => (x.id === v.id ? { ...x, selecionado: novo } : x)));
    setAberto((a) => (a && a.id === v.id ? { ...a, selecionado: novo } : a));
    const r = await fetch("/api/v1/virais/videos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: v.id, selecionado: novo }),
    });
    if (!r.ok) {
      setVideos((atual) => atual.map((x) => (x.id === v.id ? { ...x, selecionado: !novo } : x)));
    }
  }

  const marcados = videos.filter((v) => v.selecionado).length;

  return (
    <div className="flex flex-col gap-6">
      <FormBusca onPronto={carregar} />

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-[15px] font-semibold text-[var(--ink)]">
            Resultados
            <span className="ml-2 text-[13px] font-normal text-[var(--mute)]">
              {videos.length} vídeos · {marcados} marcados pra baixar
            </span>
          </h2>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <input
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              placeholder="filtrar por @perfil ou palavra"
              className={`h-9 w-56 ${CAMPO}`}
            />
            <input
              type="number"
              min={0}
              step={10000}
              value={minLikes}
              onChange={(e) => setMinLikes(Number(e.target.value) || 0)}
              title="Mínimo de likes"
              className={`h-9 w-28 ${CAMPO}`}
            />
            <label className="flex h-9 items-center gap-1.5 text-[13px] text-[var(--ink)]">
              <input
                type="checkbox"
                checked={soSelecionados}
                onChange={(e) => setSoSelecionados(e.target.checked)}
              />
              só os marcados
            </label>
          </div>
        </div>

        {carregando ? (
          <p className="text-[14px] text-[var(--mute)]">Carregando…</p>
        ) : videos.length === 0 ? (
          <p className="rounded-[var(--radius)] border border-dashed border-[var(--hairline-strong)] p-8 text-center text-[14px] text-[var(--mute)]">
            Nenhum vídeo aqui ainda. Preencha o nicho lá em cima e clique em{" "}
            <strong className="text-[var(--ink)]">Buscar virais</strong>.
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {videos.map((v) => (
              <Miniatura
                key={v.id}
                v={v}
                onAbrir={() => setAberto(v)}
                onMarcar={() => alternar(v)}
              />
            ))}
          </ul>
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
 * Passo 1: os parâmetros e o botão. O botão dispara a busca no Apify,
 * acompanha até terminar e traz os vídeos — a busca leva minutos, então a
 * tela pergunta o status de 6 em 6s em vez de segurar a requisição.
 */
function FormBusca({ onPronto }: { onPronto: () => Promise<void> }) {
  const [nicho, setNicho] = useState("");
  const [periodo, setPeriodo] = useState("LAST_THREE_MONTHS");
  const [maxItens, setMaxItens] = useState(100);
  const [pais, setPais] = useState("US");
  const [rodando, setRodando] = useState(false);
  const [situacao, setSituacao] = useState<string | null>(null);

  async function buscar(e: React.FormEvent) {
    e.preventDefault();
    if (!nicho.trim() || rodando) return;
    setRodando(true);
    setSituacao("Pedindo a busca ao Apify…");
    try {
      const r = await fetch("/api/v1/virais/buscar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nicho: nicho.trim(), periodo, max_itens: maxItens, pais }),
      });
      const j = await r.json();
      if (!r.ok) {
        setSituacao(j?.error?.message ?? "Não consegui iniciar a busca.");
        return;
      }
      const runId = j.run?.id as string;
      setSituacao(`Buscando "${nicho}" no TikTok… isso leva alguns minutos.`);

      for (let i = 0; i < 100; i++) {
        await new Promise((s) => setTimeout(s, 6000));
        const st = await fetch(
          `/api/v1/virais/buscar?run=${encodeURIComponent(runId)}&termo=${encodeURIComponent(nicho.trim())}`,
        );
        const sj = await st.json();
        if (!st.ok) {
          setSituacao(sj?.error?.message ?? "Perdi o contato com a busca.");
          return;
        }
        if (sj.terminou) {
          setSituacao(
            sj.gravados > 0
              ? `Pronto: ${sj.gravados} vídeos trazidos.`
              : sj.aviso ?? "A busca terminou sem resultado.",
          );
          await onPronto();
          return;
        }
        const status = sj.run?.status;
        if (status && status !== "RUNNING" && status !== "READY") {
          setSituacao(`A busca terminou como ${status}.`);
          return;
        }
      }
      setSituacao("A busca está demorando demais — dá pra trazer depois lá embaixo.");
    } catch {
      setSituacao("Falha de rede ao buscar.");
    } finally {
      setRodando(false);
    }
  }

  return (
    <form
      onSubmit={buscar}
      className="flex flex-col gap-3 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface)] p-4"
    >
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-[12px] text-[var(--mute)]">
          Nicho
          <input
            value={nicho}
            onChange={(e) => setNicho(e.target.value)}
            placeholder="handyman, marcenaria, finanças…"
            className={`h-10 w-60 ${CAMPO}`}
          />
        </label>
        <label className="flex flex-col gap-1 text-[12px] text-[var(--mute)]">
          Período
          <select
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value)}
            className={`h-10 ${CAMPO}`}
          >
            {/* a lista nativa herda o fundo do SO: sem cor explícita a opção
                sai branca no branco e some (visto na tela 14/08). */}
            {PERIODOS.map((p) => (
              <option
                key={p.id}
                value={p.id}
                className="bg-[var(--surface-deep)] text-[var(--ink)]"
              >
                {p.rotulo}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[12px] text-[var(--mute)]">
          Quantos vídeos
          <input
            type="number"
            min={10}
            max={500}
            step={10}
            value={maxItens}
            onChange={(e) => setMaxItens(Number(e.target.value) || 100)}
            className={`h-10 w-28 ${CAMPO}`}
          />
        </label>
        <label className="flex flex-col gap-1 text-[12px] text-[var(--mute)]">
          País
          <input
            value={pais}
            onChange={(e) => setPais(e.target.value.toUpperCase().slice(0, 2))}
            placeholder="US"
            className={`h-10 w-20 uppercase ${CAMPO}`}
          />
        </label>
        <button type="submit" disabled={rodando || !nicho.trim()} className={`h-10 ${BOTAO}`}>
          {rodando ? "Buscando…" : "Buscar virais"}
        </button>
      </div>
      <p className="text-[12px] text-[var(--mute)]">
        Traz os vídeos mais curtidos do período no TikTok · custo desta busca ≈ US${" "}
        {(maxItens * 0.0003).toFixed(2)}
      </p>
      {situacao && <p className="text-[13px] text-[var(--ink)]">{situacao}</p>}
    </form>
  );
}

/** Rodapé: trazer o resultado de uma busca rodada direto no console do Apify. */
function ImportarBuscas({ onImportou }: { onImportou: () => Promise<void> }) {
  const [runs, setRuns] = useState<Run[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);
  const [importando, setImportando] = useState<string | null>(null);
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    if (!aberto || runs.length > 0) return;
    void (async () => {
      const r = await fetch("/api/v1/virais/runs");
      const j = await r.json();
      setRuns(j.runs ?? []);
      setAviso(j.aviso ?? null);
    })();
  }, [aberto, runs.length]);

  async function importar(run: Run) {
    if (!run.dataset_id) return;
    setImportando(run.id);
    try {
      const r = await fetch("/api/v1/virais/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataset_id: run.dataset_id, run_id: run.id }),
      });
      const j = await r.json();
      setAviso(r.ok ? `${j.gravados} vídeos trazidos.` : j?.error?.message ?? "Falha ao importar.");
      if (r.ok) await onImportou();
    } finally {
      setImportando(null);
    }
  }

  return (
    <details
      open={aberto}
      onToggle={(e) => setAberto((e.currentTarget as HTMLDetailsElement).open)}
      className="rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--surface)] p-3"
    >
      <summary className="cursor-pointer text-[13px] text-[var(--mute)]">
        Trazer uma busca que você rodou direto no Apify
      </summary>
      <div className="mt-3 flex flex-col gap-2">
        {aviso && <p className="text-[13px] text-[var(--ink)]">{aviso}</p>}
        {runs.length === 0 ? (
          <p className="text-[13px] text-[var(--mute)]">Nenhuma busca encontrada.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {runs.slice(0, 5).map((r) => (
              <li
                key={r.id}
                className="flex items-center gap-3 rounded-[var(--radius-sm)] border border-[var(--hairline)] px-3 py-2 text-[13px]"
              >
                <span className="text-[var(--ink)]">{r.itens ?? 0} vídeos</span>
                <span className="text-[var(--mute)]">
                  {r.terminado_em ? new Date(r.terminado_em).toLocaleString("pt-BR") : r.status}
                </span>
                <button
                  type="button"
                  onClick={() => importar(r)}
                  disabled={!r.dataset_id || importando === r.id || r.status !== "SUCCEEDED"}
                  className={`ml-auto h-8 px-3 text-[12px] ${BOTAO}`}
                >
                  {importando === r.id ? "Trazendo…" : "Trazer"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}

function Miniatura({
  v,
  onAbrir,
  onMarcar,
}: {
  v: Viral;
  onAbrir: () => void;
  onMarcar: () => void;
}) {
  return (
    <li className="flex flex-col overflow-hidden rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface)]">
      <button
        type="button"
        onClick={onAbrir}
        className="relative aspect-[9/16] w-full overflow-hidden bg-black/80"
        title="Abrir para assistir"
      >
        {v.thumb_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={v.thumb_url}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className="flex h-full items-center justify-center text-[12px] text-white/60">
            sem capa
          </span>
        )}
        <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[11px] font-medium text-white">
          ❤️ {compacto(v.likes)}
        </span>
        {v.selecionado && (
          <span className="absolute right-1 top-1 rounded bg-[var(--ink)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--surface-deep)]">
            ✓ baixar
          </span>
        )}
      </button>
      <div className="flex flex-1 flex-col gap-1 p-2">
        <span className="text-[11px] text-[var(--mute)]">
          @{v.autor ?? "?"}
          {v.views ? ` · ${compacto(v.views)} views` : ""}
        </span>
        <p className="line-clamp-2 text-[12px] leading-snug text-[var(--ink)]">
          {v.legenda || "(sem descrição)"}
        </p>
        <label className="mt-auto flex items-center gap-1.5 pt-1 text-[12px] text-[var(--ink)]">
          <input type="checkbox" checked={v.selecionado} onChange={onMarcar} />
          baixar este
        </label>
      </div>
    </li>
  );
}

export function compacto(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".0", "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(".0", "")}k`;
  return String(n);
}
