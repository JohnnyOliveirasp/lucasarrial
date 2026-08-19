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
  const [aba, setAba] = useState<"criadas" | "refs">("criadas");
  // "Animar" na tela de resultado → abre o painel de vídeo da imagem no histórico.
  const [animateId, setAnimateId] = useState<string | null>(null);
  const [refRequest, setRefRequest] = useState<(FixedRef & { seq: number }) | null>(null);
  const studioRef = useRef<HTMLElement>(null);

  function useAsReference(key: string, url: string) {
    setRefRequest((prev) => ({ key, url, seq: (prev?.seq ?? 0) + 1 }));
    studioRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
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
          onGenerated={() => setReloadKey((k) => k + 1)}
          onAnimate={(id) => setAnimateId(id)}
        />
      </section>

      <section className="flex flex-col gap-4">
        {/* Abas (19/08): "Imagens criadas" continua o histórico de sempre;
            "Referências salvas" é a área que o apagar-do-histórico não toca —
            nasceu do erro "uma das fotos de referência não existe mais". */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setAba("criadas")}
            className={`font-sans text-xl font-semibold tracking-[-0.01em] transition-colors ${
              aba === "criadas" ? "text-[var(--ink)]" : "text-[var(--ash)] hover:text-[var(--mute)]"
            }`}
          >
            {t("yourImages")}
          </button>
          <button
            type="button"
            onClick={() => setAba("refs")}
            className={`font-sans text-xl font-semibold tracking-[-0.01em] transition-colors ${
              aba === "refs" ? "text-[var(--ink)]" : "text-[var(--ash)] hover:text-[var(--mute)]"
            }`}
          >
            {t("savedRefs")}
          </button>
        </div>
        {aba === "criadas" ? (
          <ImageHistory
            reloadKey={reloadKey}
            openAnimateId={animateId}
            onUseAsRef={useAsReference}
          />
        ) : (
          <ReferenciasSalvas reloadKey={reloadKey} onUseAsRef={useAsReference} />
        )}
      </section>
    </div>
  );
}
