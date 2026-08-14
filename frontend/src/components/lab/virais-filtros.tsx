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
  ordem: Ordem;
  /** Um campo só peneira tema, @perfil e legenda — ver o comentário do JSX. */
  termo: string;
  soSelecionados: boolean;
};

export const FILTROS_INICIAIS: Filtros = {
  minLikes: 0,
  dias: 0,
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

      {/* Tema é CAMPO, não ficha: com 400 alunos buscando, ficha vira parede
          de botões (Johnny, 14/08). Filtra ao digitar e apagar traz tudo de
          volta — as buscas já feitas aparecem como sugestão. */}
      <Linha rotulo="Tema">
        <input
          value={f.termo}
          onChange={(e) => set("termo", e.target.value)}
          list="virais-temas"
          placeholder="digite um tema, @perfil ou palavra — apague pra ver tudo"
          className={`h-8 w-full max-w-md ${CAMPO}`}
        />
        <datalist id="virais-temas">
          {temas.map((t) => (
            <option key={t.tema} value={t.tema}>
              {t.total} vídeos
            </option>
          ))}
        </datalist>
        {f.termo && (
          <button
            type="button"
            onClick={() => set("termo", "")}
            className="h-8 px-2 text-[11px] text-[var(--mute)] underline"
          >
            limpar
          </button>
        )}
        <label className="ml-auto flex items-center gap-1.5 text-[11px] text-[var(--ink)]">
          <input
            type="checkbox"
            checked={f.soSelecionados}
            onChange={(e) => set("soSelecionados", e.target.checked)}
          />
          só Meus Virais
        </label>
      </Linha>

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
