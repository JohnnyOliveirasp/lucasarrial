"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ImageStudio, type FixedRef } from "@/components/image/image-studio";
import { ImageHistory } from "@/components/image/image-history";
import { ReferenciasSalvas } from "@/components/image/referencias-salvas";

/**
 * Compõe o Studio (gerador) + o Histórico na mesma tela. Quando o Studio
 * dispara/conclui uma geração, bumpa `reloadKey` pra o Histórico recarregar.
 * "Usar como referência" no histórico troca a referência FIXA do Studio
 * (29/07) e rola a tela de volta pro gerador.
 */
export function ImageWorkspace({
  creditsTotal,
  unlimited,
  userId,
}: {
  creditsTotal: number;
  unlimited: boolean;
  userId: string;
}) {
  const t = useTranslations("images.page");
  const [reloadKey, setReloadKey] = useState(0);
  // A aba do banco recarrega quando uma foto nova é adotada (upload/adoção).
  const [refsReloadKey, setRefsReloadKey] = useState(0);
  const [aba, setAba] = useState<"criadas" | "refs">("criadas");
  // Chave da referência ATUAL — a aba marca o card dela como "em uso".
  const [currentRefKey, setCurrentRefKey] = useState<string | null>(null);
  // Chaves das fotos extras no quadro — a aba marca "já está nas extras".
  const [extrasKeys, setExtrasKeys] = useState<string[]>([]);
  // "Animar" na tela de resultado → abre o painel de vídeo da imagem no histórico.
  const [animateId, setAnimateId] = useState<string | null>(null);
  const [refRequest, setRefRequest] = useState<(FixedRef & { seq: number }) | null>(null);
  const [extraRequest, setExtraRequest] = useState<(FixedRef & { seq: number }) | null>(null);
  const studioRef = useRef<HTMLElement>(null);

  function useAsReference(key: string, url: string) {
    setRefRequest((prev) => ({ key, url, seq: (prev?.seq ?? 0) + 1 }));
    studioRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Do banco pro quadro: a pessoa monta o conjunto (1 principal + extras) sem
  // subir nada de novo. Sem scroll — ela costuma adicionar várias em sequência.
  function addAsExtra(key: string, url: string) {
    setExtraRequest((prev) => ({ key, url, seq: (prev?.seq ?? 0) + 1 }));
  }

  return (
    <div className="flex flex-col gap-12">
      <section
        ref={studioRef}
        className="rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] p-6"
      >
        <ImageStudio
          creditsTotal={creditsTotal}
          unlimited={unlimited}
          userId={userId}
          refRequest={refRequest}
          extraRequest={extraRequest}
          onFixedRefKey={setCurrentRefKey}
          onExtrasChange={setExtrasKeys}
          onRefsChanged={() => setRefsReloadKey((k) => k + 1)}
          onGenerated={() => setReloadKey((k) => k + 1)}
          onAnimate={(id) => setAnimateId(id)}
        />
      </section>

      <section className="flex flex-col gap-4">
        {/* Abas (19/08): "Imagens criadas" continua o histórico de sempre;
            "Referências salvas" é a área que o apagar-do-histórico não toca —
            nasceu do erro "uma das fotos de referência não existe mais". */}
        {/* Segmentado estilo iOS (pedido do Johnny 19/08): canaleta rebaixada +
            a aba ativa como pílula em relevo — dá pra VER em qual aba se está,
            em vez de dois nomes soltos sem divisão. */}
        <div className="flex w-fit items-center gap-1 rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--surface-deep)] p-1">
          {(
            [
              { id: "criadas" as const, label: t("yourImages") },
              { id: "refs" as const, label: t("savedRefs") },
            ]
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setAba(tab.id)}
              aria-pressed={aba === tab.id}
              className={`rounded-[var(--radius-sm)] border px-4 py-2 font-sans text-[14px] tracking-[-0.01em] transition-colors duration-[var(--dur-base)] ease-[var(--ease-out)] ${
                aba === tab.id
                  ? "border-[var(--hairline-strong)] bg-[var(--surface-elevated)] font-semibold text-[var(--ink)] shadow-[0_1px_2px_rgba(0,0,0,0.35)]"
                  : "border-transparent font-medium text-[var(--mute)] hover:text-[var(--ink)]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {aba === "criadas" ? (
          <ImageHistory
            reloadKey={reloadKey}
            openAnimateId={animateId}
            onUseAsRef={useAsReference}
          />
        ) : (
          <ReferenciasSalvas
            reloadKey={refsReloadKey}
            currentRefKey={currentRefKey}
            extrasKeys={extrasKeys}
            onUseAsRef={useAsReference}
            onAddExtra={addAsExtra}
          />
        )}
      </section>
    </div>
  );
}
