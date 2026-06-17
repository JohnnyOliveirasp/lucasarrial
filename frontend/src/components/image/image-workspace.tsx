"use client";

import { useState } from "react";
import { ImageStudio } from "@/components/image/image-studio";
import { ImageHistory } from "@/components/image/image-history";

/**
 * Compõe o Studio (gerador) + o Histórico na mesma tela. Quando o Studio
 * dispara/conclui uma geração, bumpa `reloadKey` pra o Histórico recarregar.
 */
export function ImageWorkspace({
  creditsTotal,
  unlimited,
}: {
  creditsTotal: number;
  unlimited: boolean;
}) {
  const [reloadKey, setReloadKey] = useState(0);

  return (
    <div className="flex flex-col gap-12">
      <section className="rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] p-6">
        <ImageStudio
          creditsTotal={creditsTotal}
          unlimited={unlimited}
          onGenerated={() => setReloadKey((k) => k + 1)}
        />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-sans text-xl font-semibold tracking-[-0.01em] text-[var(--ink)]">
          Suas imagens
        </h2>
        <ImageHistory reloadKey={reloadKey} />
      </section>
    </div>
  );
}
