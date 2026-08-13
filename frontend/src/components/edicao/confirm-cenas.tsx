"use client";

/**
 * C1+C4 (13/08) — confirmação ANTES de gerar/cobrar as cenas:
 *  · C1: "sua fala tem N frases → N cenas", com ajuste da quantidade
 *    (frases vizinhas dividem a mesma cena no servidor).
 *  · C4: "quer aparecer nas cenas ou automático?" — automático explica que
 *    tudo sai da fala e SEGUE direto; com fotos, a pessoa escolhe até 3 do
 *    acervo e a LLM de visão decide em quais cenas ela entra (privadas).
 */
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Clapperboard, Library, Loader2, UserRound, Wand2 } from "lucide-react";
import { STUDIO_SCENE_COST } from "@/lib/studio/pricing";
import { BancoCenasPicker } from "@/components/studio/banco-cenas";

type FotoAcervo = { id: string; image_url: string | null; image_path: string | null; status: string };

const MAX_FOTOS = 3;
const MAX_CENAS_BANCO = 10;

export function ConfirmCenas({
  frases,
  gerando,
  onGerar,
}: {
  /** Nº de frases da fala (sentence_count do GET). */
  frases: number;
  gerando: boolean;
  /** sceneCount undefined = sugestão (1 cena/frase); photoKeys = fotos (C4);
   *  bankIds = cenas escolhidas à mão no banco (reuso grátis). */
  onGerar: (sceneCount: number | undefined, photoKeys: string[], bankIds: string[]) => void;
}) {
  const t = useTranslations("edicao.video.cenas");
  const [qtd, setQtd] = useState<number | null>(null);
  const [modo, setModo] = useState<"auto" | "fotos" | null>(null);
  const [fotos, setFotos] = useState<FotoAcervo[] | null>(null);
  const [selecionadas, setSelecionadas] = useState<string[]>([]);
  // Explorador do banco: null = IA escolhe (padrão, grátis); array = manual.
  const [bancoManual, setBancoManual] = useState(false);
  const [cenasBanco, setCenasBanco] = useState<string[]>([]);
  const escolhida = Math.min(Math.max(qtd ?? frases, 1), Math.max(frases, 1));

  // Acervo "Minhas fotos" — só quando a pessoa escolhe aparecer.
  useEffect(() => {
    if (modo !== "fotos" || fotos !== null) return;
    fetch("/api/v1/images", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { images: [] }))
      .then((j) =>
        setFotos(
          ((j.images ?? []) as FotoAcervo[]).filter((f) => f.status === "ready" && f.image_url && f.image_path),
        ),
      )
      .catch(() => setFotos([]));
  }, [modo, fotos]);

  const toggleFoto = (key: string) =>
    setSelecionadas((s) =>
      s.includes(key) ? s.filter((k) => k !== key) : s.length >= MAX_FOTOS ? s : [...s, key],
    );

  const podeGerar = modo === "auto" || (modo === "fotos" && selecionadas.length > 0);

  const CARD = (ativo: boolean) =>
    `flex-1 rounded-[var(--radius-sm)] border p-3 text-left transition-colors ${
      ativo ? "border-[var(--ink)]" : "border-[var(--hairline)] hover:border-[var(--hairline-strong)]"
    }`;

  return (
    <div className="flex flex-col gap-2.5 rounded-[var(--radius-sm)] border border-[var(--hairline)] p-3">
      <p className="text-[13px] text-[var(--ink)]">
        {frases > 0 ? t("confirmFrases", { frases }) : t("confirmSemContagem")}
      </p>
      <p className="text-[12px] text-[var(--ash)]">
        {t("confirmCusto", { custo: escolhida * STUDIO_SCENE_COST, cada: STUDIO_SCENE_COST })}
      </p>
      {frases > 1 && (
        <label className="flex items-center gap-2 text-[12.5px] text-[var(--mute)]">
          {t("confirmQtd")}
          <input
            type="number"
            min={1}
            max={frases}
            value={escolhida}
            onChange={(e) => setQtd(Number(e.target.value) || frases)}
            className="w-20 rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] bg-transparent px-2 py-1 text-[13px] text-[var(--ink)]"
          />
          <span className="text-[11px] text-[var(--ash)]">{t("confirmMax", { max: frases })}</span>
        </label>
      )}

      {/* C4: automático × aparecer nas cenas */}
      <p className="mt-1 text-[13px] text-[var(--ink)]">{t("fotosPergunta")}</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="button" onClick={() => setModo("auto")} aria-pressed={modo === "auto"} className={CARD(modo === "auto")}>
          <p className="flex items-center gap-1.5 text-[13px] font-semibold text-[var(--ink)]">
            <Wand2 className="size-3.5" /> {t("fotosAutoTitulo")}
          </p>
          <p className="mt-0.5 text-[12px] text-[var(--mute)]">{t("fotosAutoCorpo")}</p>
        </button>
        <button type="button" onClick={() => setModo("fotos")} aria-pressed={modo === "fotos"} className={CARD(modo === "fotos")}>
          <p className="flex items-center gap-1.5 text-[13px] font-semibold text-[var(--ink)]">
            <UserRound className="size-3.5" /> {t("fotosEuTitulo")}
          </p>
          <p className="mt-0.5 text-[12px] text-[var(--mute)]">{t("fotosEuCorpo", { max: MAX_FOTOS })}</p>
        </button>
      </div>

      {modo === "fotos" &&
        (fotos === null ? (
          <p className="flex items-center gap-2 text-[12.5px] text-[var(--mute)]">
            <Loader2 className="size-3.5 animate-spin" /> {t("fotosCarregando")}
          </p>
        ) : fotos.length === 0 ? (
          <p className="rounded-[var(--radius-sm)] border border-dashed border-[var(--hairline-strong)] p-3 text-[12.5px] text-[var(--mute)]">
            {t("fotosVazio")}
          </p>
        ) : (
          <>
            <ul className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
              {fotos.slice(0, 18).map((f) => {
                const key = f.image_path as string;
                const ativa = selecionadas.includes(key);
                return (
                  <li key={f.id}>
                    <button
                      type="button"
                      onClick={() => toggleFoto(key)}
                      aria-pressed={ativa}
                      className={`relative block aspect-square w-full overflow-hidden rounded-[var(--radius-sm)] border transition-colors ${
                        ativa ? "border-[var(--hairline-bright)] shadow-[0_0_0_1px_var(--hairline-bright)]" : "border-[var(--hairline)] hover:border-[var(--hairline-strong)]"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={f.image_url as string} alt="" className="h-full w-full object-cover" />
                      {ativa && (
                        <span className="absolute right-0.5 top-0.5 rounded-full bg-[var(--silver)] p-0.5 text-[var(--canvas)]">
                          <Check className="size-3" />
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="text-[11px] text-[var(--ash)]">{t("fotosConsent")}</p>
          </>
        ))}

      {/* Explorador do banco (13/08): aproveitar cenas prontas = grátis. */}
      <p className="mt-1 text-[13px] text-[var(--ink)]">{t("bancoPergunta")}</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="button" onClick={() => setBancoManual(false)} aria-pressed={!bancoManual} className={CARD(!bancoManual)}>
          <p className="flex items-center gap-1.5 text-[13px] font-semibold text-[var(--ink)]">
            <Wand2 className="size-3.5" /> {t("bancoAutoTitulo")}
          </p>
          <p className="mt-0.5 text-[12px] text-[var(--mute)]">{t("bancoAutoCorpo")}</p>
        </button>
        <button type="button" onClick={() => setBancoManual(true)} aria-pressed={bancoManual} className={CARD(bancoManual)}>
          <p className="flex items-center gap-1.5 text-[13px] font-semibold text-[var(--ink)]">
            <Library className="size-3.5" /> {t("bancoEscolherTitulo")}
          </p>
          <p className="mt-0.5 text-[12px] text-[var(--mute)]">{t("bancoEscolherCorpo")}</p>
        </button>
      </div>
      {bancoManual && (
        <BancoCenasPicker
          selecionadas={cenasBanco}
          onToggle={(id) =>
            setCenasBanco((s) =>
              s.includes(id) ? s.filter((x) => x !== id) : s.length >= MAX_CENAS_BANCO ? s : [...s, id],
            )
          }
          max={MAX_CENAS_BANCO}
        />
      )}

      <button
        type="button"
        onClick={() =>
          onGerar(
            escolhida < frases ? escolhida : undefined,
            modo === "fotos" ? selecionadas : [],
            bancoManual ? cenasBanco : [],
          )
        }
        disabled={gerando || !podeGerar}
        className="flex w-fit items-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--ink)] px-4 py-2 text-[13px] font-semibold text-[var(--surface-deep)] disabled:opacity-40"
      >
        {gerando ? <Loader2 className="size-4 animate-spin" /> : <Clapperboard className="size-4" />}
        {frases > 0 ? t("gerarQtd", { n: escolhida }) : t("gerarCenas", { custo: STUDIO_SCENE_COST })}
      </button>
      {!podeGerar && <p className="text-[11.5px] text-[var(--ash)]">{t("fotosEscolhaModo")}</p>}
    </div>
  );
}
