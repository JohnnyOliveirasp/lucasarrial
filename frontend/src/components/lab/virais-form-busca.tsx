"use client";

/**
 * Passo 1 da tela: os parâmetros e o botão que dispara a busca no Apify.
 *
 * O botão acompanha a execução até terminar e traz os vídeos — a busca leva
 * minutos, então a tela pergunta o status de 6 em 6s em vez de segurar a
 * requisição aberta.
 */
import { useEffect, useState } from "react";
import { BOTAO, CAMPO } from "./virais-estilo";
import type { Run } from "./virais-tipos";

const PERIODOS = [
  { id: "THIS_WEEK", rotulo: "Últimos 7 dias" },
  { id: "THIS_MONTH", rotulo: "Último mês" },
  { id: "LAST_THREE_MONTHS", rotulo: "Últimos 3 meses" },
  { id: "LAST_SIX_MONTHS", rotulo: "Últimos 6 meses" },
  { id: "ALL_TIME", rotulo: "Qualquer data" },
];

export function FormBusca({ onPronto }: { onPronto: () => Promise<void> }) {
  const [nichos, setNichos] = useState("");
  const [perfis, setPerfis] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [links, setLinks] = useState("");
  const [periodo, setPeriodo] = useState("LAST_THREE_MONTHS");
  const [maxItens, setMaxItens] = useState(100);
  const [rodando, setRodando] = useState(false);
  const [situacao, setSituacao] = useState<string | null>(null);

  const temAlgo = [nichos, perfis, hashtags, links].some((c) => c.trim().length > 0);
  const alvo = [nichos, perfis, hashtags].filter(Boolean).join(", ").slice(0, 60) || "TikTok";

  async function buscar(e: React.FormEvent) {
    e.preventDefault();
    if (rodando) return;
    if (!temAlgo) {
      setSituacao("Preencha pelo menos um campo: nicho, perfil, hashtag ou link.");
      return;
    }
    setRodando(true);
    setSituacao("Pedindo a busca ao Apify…");
    try {
      const r = await fetch("/api/v1/virais/buscar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nichos, perfis, hashtags, links, periodo, max_itens: maxItens }),
      });
      const j = await r.json();
      if (!r.ok) {
        setSituacao(j?.error?.message ?? "Não consegui iniciar a busca.");
        return;
      }
      const runId = j.run?.id as string;
      setSituacao(`Buscando ${alvo} no TikTok… isso leva alguns minutos.`);

      for (let i = 0; i < 100; i++) {
        await new Promise((s) => setTimeout(s, 6000));
        const st = await fetch(
          `/api/v1/virais/buscar?run=${encodeURIComponent(runId)}&termo=${encodeURIComponent(j.termo ?? alvo)}`,
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
      <p className="text-[13px] text-[var(--mute)]">
        Preencha <strong className="text-[var(--ink)]">um ou vários</strong> campos — eles se
        somam na mesma busca. Separe com vírgula pra buscar mais de um.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-[12px] text-[var(--mute)]">
          Nicho / palavra-chave
          <input
            value={nichos}
            onChange={(e) => setNichos(e.target.value)}
            placeholder="handyman, home repair"
            className={`h-10 ${CAMPO}`}
          />
          <span className="text-[11px]">só aqui dá pra trazer ordenado pelos mais curtidos</span>
        </label>
        <label className="flex flex-col gap-1 text-[12px] text-[var(--mute)]">
          Perfis (@)
          <input
            value={perfis}
            onChange={(e) => setPerfis(e.target.value)}
            placeholder="@gordonramsayofficial, @outroperfil"
            className={`h-10 ${CAMPO}`}
          />
          <span className="text-[11px]">traz os vídeos desses perfis</span>
        </label>
        <label className="flex flex-col gap-1 text-[12px] text-[var(--mute)]">
          Hashtags (#)
          <input
            value={hashtags}
            onChange={(e) => setHashtags(e.target.value)}
            placeholder="#handyman, #diy"
            className={`h-10 ${CAMPO}`}
          />
        </label>
        <label className="flex flex-col gap-1 text-[12px] text-[var(--mute)]">
          Links do TikTok
          <input
            value={links}
            onChange={(e) => setLinks(e.target.value)}
            placeholder="cole URLs de perfil, tag, som ou local"
            className={`h-10 ${CAMPO}`}
          />
        </label>
      </div>
      <div className="flex flex-wrap items-end gap-3 border-t border-[var(--hairline)] pt-3">
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
        {/* País/proxy REMOVIDO 17/08 (provado em teste A/B/C): com
            proxyCountryCode "BR" o actor devolvia ~12 resultados de fome —
            foi a busca do Lucas. A palavra em português já puxa o conteúdo
            brasileiro sem proxy nenhum (14/08: 100 vídeos, top 610k likes). */}
        {/* só desabilita ENQUANTO roda: antes ficava cinza morto com o campo
            vazio e nem parecia botão (marcado pelo Johnny na tela 14/08). */}
        <button type="submit" disabled={rodando} className={`h-10 ${BOTAO}`}>
          {rodando ? "Buscando…" : "Buscar virais"}
        </button>
      </div>
      <p className="text-[12px] text-[var(--mute)]">
        Traz os vídeos mais curtidos do período no TikTok · custo desta busca ≈ US${" "}
        {(maxItens * 0.0037).toFixed(2)}
      </p>
      {situacao && <p className="text-[13px] text-[var(--ink)]">{situacao}</p>}
    </form>
  );
}

/** Rodapé: trazer o resultado de uma busca rodada direto no console do Apify. */
export function ImportarBuscas({ onImportou }: { onImportou: () => Promise<void> }) {
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
