"use client";

/**
 * "Vídeos Virais" — parte 1: o acervo em miniaturas.
 *
 * Fluxo desenhado com o Johnny (14/08): ELE roda a busca no console do Apify;
 * aqui ele importa o resultado, assiste ao que interessa e MARCA os que quer
 * baixar. Só o marcado desce pro R2 depois — a busca traz centenas e o bucket
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

export function ViraisBusca() {
  const [videos, setVideos] = useState<Viral[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [importando, setImportando] = useState<string | null>(null);
  const [aberto, setAberto] = useState<Viral | null>(null);
  const [minLikes, setMinLikes] = useState(0);
  const [termo, setTermo] = useState("");
  const [soSelecionados, setSoSelecionados] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const qs = new URLSearchParams({
        min_likes: String(minLikes),
        termo,
        selecionados: soSelecionados ? "1" : "0",
        limite: "60",
      });
      const r = await fetch(`/api/v1/virais/videos?${qs}`);
      const j = await r.json();
      setVideos(r.ok ? j.videos ?? [] : []);
    } finally {
      setCarregando(false);
    }
  }, [minLikes, termo, soSelecionados]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    void (async () => {
      const r = await fetch("/api/v1/virais/runs");
      const j = await r.json();
      setRuns(j.runs ?? []);
      setAviso(j.aviso ?? null);
    })();
  }, []);

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
      setAviso(
        r.ok
          ? j.aviso ?? `${j.gravados} vídeos importados dessa busca.`
          : j?.error?.message ?? "Falha ao importar.",
      );
      if (r.ok) await carregar();
    } finally {
      setImportando(null);
    }
  }

  async function alternar(v: Viral) {
    const novo = !v.selecionado;
    setVideos((atual) =>
      atual.map((x) => (x.id === v.id ? { ...x, selecionado: novo } : x)),
    );
    setAberto((a) => (a && a.id === v.id ? { ...a, selecionado: novo } : a));
    const r = await fetch("/api/v1/virais/videos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: v.id, selecionado: novo }),
    });
    if (!r.ok) {
      setVideos((atual) =>
        atual.map((x) => (x.id === v.id ? { ...x, selecionado: !novo } : x)),
      );
    }
  }

  const marcados = videos.filter((v) => v.selecionado).length;

  return (
    <div className="flex flex-col gap-5">
      <ImportarBuscas
        runs={runs}
        aviso={aviso}
        importando={importando}
        onImportar={importar}
      />

      <div className="flex flex-wrap items-end gap-3 rounded-[14px] border border-[var(--hairline)] bg-[var(--surface)] p-3">
        <label className="flex flex-col gap-1 text-[12px] text-[var(--mute)]">
          Buscar no acervo
          <input
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            placeholder="@perfil, tema ou palavra da legenda"
            className="h-9 w-64 rounded-[9px] border border-[var(--hairline)] bg-[var(--bg)] px-3 text-[13px] text-[var(--ink)] outline-none focus:border-[var(--ink)]"
          />
        </label>
        <label className="flex flex-col gap-1 text-[12px] text-[var(--mute)]">
          Mínimo de likes
          <input
            type="number"
            min={0}
            step={10000}
            value={minLikes}
            onChange={(e) => setMinLikes(Number(e.target.value) || 0)}
            className="h-9 w-32 rounded-[9px] border border-[var(--hairline)] bg-[var(--bg)] px-3 text-[13px] text-[var(--ink)] outline-none focus:border-[var(--ink)]"
          />
        </label>
        <label className="flex h-9 items-center gap-2 text-[13px] text-[var(--ink)]">
          <input
            type="checkbox"
            checked={soSelecionados}
            onChange={(e) => setSoSelecionados(e.target.checked)}
          />
          Só os marcados
        </label>
        <span className="ml-auto text-[12px] text-[var(--mute)]">
          {videos.length} vídeos · <strong className="text-[var(--ink)]">{marcados}</strong> marcados pra baixar
        </span>
      </div>

      {carregando ? (
        <p className="text-[14px] text-[var(--mute)]">Carregando…</p>
      ) : videos.length === 0 ? (
        <p className="rounded-[12px] border border-dashed border-[var(--hairline)] p-6 text-center text-[14px] text-[var(--mute)]">
          Nenhum vídeo no acervo ainda. Rode uma busca no Apify e importe ela aqui em cima.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {videos.map((v) => (
            <Miniatura key={v.id} v={v} onAbrir={() => setAberto(v)} onMarcar={() => alternar(v)} />
          ))}
        </ul>
      )}

      {aberto && (
        <ViralPlayer
          v={aberto}
          onFechar={() => setAberto(null)}
          onMarcar={() => alternar(aberto)}
        />
      )}
    </div>
  );
}

function ImportarBuscas({
  runs,
  aviso,
  importando,
  onImportar,
}: {
  runs: Run[];
  aviso: string | null;
  importando: string | null;
  onImportar: (r: Run) => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-[14px] border border-[var(--hairline)] bg-[var(--surface)] p-4">
      <div>
        <h2 className="text-[15px] font-semibold text-[var(--ink)]">Suas buscas no Apify</h2>
        <p className="text-[13px] text-[var(--mute)]">
          Rode a busca no console do Apify e traga o resultado pra cá. A plataforma não
          dispara busca sozinha — assim não gasta crédito sem você mandar.
        </p>
      </div>
      {aviso && <p className="text-[13px] text-[var(--ink)]">{aviso}</p>}
      {runs.length === 0 ? (
        <p className="text-[13px] text-[var(--mute)]">Nenhuma busca encontrada ainda.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {runs.slice(0, 5).map((r) => (
            <li
              key={r.id}
              className="flex items-center gap-3 rounded-[9px] border border-[var(--hairline)] px-3 py-2 text-[13px]"
            >
              <span className="text-[var(--ink)]">
                {r.itens ?? 0} vídeos
              </span>
              <span className="text-[var(--mute)]">
                {r.terminado_em ? new Date(r.terminado_em).toLocaleString("pt-BR") : r.status}
              </span>
              <button
                type="button"
                onClick={() => onImportar(r)}
                disabled={!r.dataset_id || importando === r.id || r.status !== "SUCCEEDED"}
                className="ml-auto h-8 rounded-[8px] bg-[var(--ink)] px-3 text-[12px] font-medium text-[var(--bg)] disabled:opacity-40"
              >
                {importando === r.id ? "Importando…" : "Importar"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
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
    <li className="flex flex-col overflow-hidden rounded-[12px] border border-[var(--hairline)] bg-[var(--surface)]">
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
          <span className="absolute right-1 top-1 rounded bg-[var(--ink)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--bg)]">
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
