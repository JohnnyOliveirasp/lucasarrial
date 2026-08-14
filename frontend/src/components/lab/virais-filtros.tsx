"use client";

/**
 * Barra de filtros do acervo de virais.
 *
 * Peneira o que JÁ voltou — não busca nada novo no TikTok (e não gasta
 * Apify). Tudo é ficha de um clique: digitar número de likes era atrito
 * demais pra uma peneira que se usa dez vezes por minuto.
 */
import type { TemaAcervo } from "@/lib/virais/acervo";
import { CAMPO, compacto, ficha } from "./virais-estilo";

export type Ordem = "score" | "likes" | "views" | "recentes";

export type Filtros = {
  minLikes: number;
  dias: number;
  tema: string;
  ordem: Ordem;
  termo: string;
  soSelecionados: boolean;
};

export const FILTROS_INICIAIS: Filtros = {
  minLikes: 0,
  dias: 0,
  tema: "",
  ordem: "score",
  termo: "",
  soSelecionados: false,
};

/** Faixas de like — 5k é o corte que o Johnny usa na mão hoje. */
const LIKES = [0, 5_000, 10_000, 50_000, 100_000, 500_000, 1_000_000];

const PERIODOS: { dias: number; rotulo: string }[] = [
  { dias: 0, rotulo: "qualquer data" },
  { dias: 7, rotulo: "7 dias" },
  { dias: 30, rotulo: "30 dias" },
  { dias: 90, rotulo: "3 meses" },
];

const ORDENS: { id: Ordem; rotulo: string }[] = [
  { id: "score", rotulo: "mais quentes" },
  { id: "likes", rotulo: "mais curtidos" },
  { id: "views", rotulo: "mais vistos" },
  { id: "recentes", rotulo: "mais recentes" },
];

export function ViraisFiltros({
  f,
  temas,
  onMudar,
}: {
  f: Filtros;
  temas: TemaAcervo[];
  onMudar: (novo: Filtros) => void;
}) {
  const set = <K extends keyof Filtros>(chave: K, valor: Filtros[K]) =>
    onMudar({ ...f, [chave]: valor });

  return (
    <div className="flex flex-col gap-2 rounded-[var(--radius-sm)] border border-[var(--hairline)] bg-[var(--surface)] p-2.5">
      <Linha rotulo="Likes">
        {LIKES.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => set("minLikes", n)}
            className={ficha(f.minLikes === n)}
          >
            {n === 0 ? "todos" : `${compacto(n)}+`}
          </button>
        ))}
      </Linha>

      {temas.length > 0 && (
        <Linha rotulo="Tema">
          <button
            type="button"
            onClick={() => set("tema", "")}
            className={ficha(f.tema === "")}
          >
            todos
          </button>
          {temas.map((t) => (
            <button
              key={t.tema}
              type="button"
              onClick={() => set("tema", f.tema === t.tema ? "" : t.tema)}
              className={ficha(f.tema === t.tema)}
              title={`${t.tema}\n${t.total} vídeos · ${t.marcados} marcados pra baixar`}
            >
              {/* o termo gravado é a busca INTEIRA ("a, b, c") — sem corte a
                  ficha ocupa a linha toda. O texto cheio fica no title. */}
              {t.tema.length > 26 ? `${t.tema.slice(0, 26)}…` : t.tema}
              <span className="ml-1 opacity-60">{t.total}</span>
            </button>
          ))}
        </Linha>
      )}

      <Linha rotulo="Quando">
        {PERIODOS.map((p) => (
          <button
            key={p.dias}
            type="button"
            onClick={() => set("dias", p.dias)}
            className={ficha(f.dias === p.dias)}
          >
            {p.rotulo}
          </button>
        ))}
      </Linha>

      <Linha rotulo="Ordem">
        {ORDENS.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => set("ordem", o.id)}
            className={ficha(f.ordem === o.id)}
          >
            {o.rotulo}
          </button>
        ))}
        <span className="ml-auto flex items-center gap-2">
          <input
            value={f.termo}
            onChange={(e) => set("termo", e.target.value)}
            placeholder="@perfil ou palavra"
            className={`h-7 w-48 ${CAMPO}`}
          />
          <label className="flex items-center gap-1.5 text-[11px] text-[var(--ink)]">
            <input
              type="checkbox"
              checked={f.soSelecionados}
              onChange={(e) => set("soSelecionados", e.target.checked)}
            />
            só a minha lista
          </label>
        </span>
      </Linha>
    </div>
  );
}

function Linha({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="w-14 shrink-0 text-[11px] text-[var(--mute)]">{rotulo}</span>
      {children}
    </div>
  );
}
